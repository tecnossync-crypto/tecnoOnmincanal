#!/usr/bin/env bash
# =============================================================================
# setup-aws.sh — Infraestructura AWS para Tecnossync Omnichannel
# Ejecuta este script UNA sola vez para crear todos los recursos en AWS.
# Requiere: AWS CLI v2 instalado y configurado (aws configure)
# =============================================================================
set -euo pipefail

# ─── CONFIGURACIÓN ────────────────────────────────────────────────────────────
REGION="${AWS_REGION:-us-east-1}"
APP="tecnossync"
ENV="${ENV:-prod}"               # prod | qa

VPC_CIDR="10.0.0.0/16"
SUBNET_A_CIDR="10.0.1.0/24"
SUBNET_B_CIDR="10.0.2.0/24"

DB_NAME="${DB_NAME:-tecnossync}"
DB_USER="${DB_USER:-tecnossync_admin}"
DB_PASSWORD="${DB_PASSWORD:?Debes exportar DB_PASSWORD}"
DB_CLASS="${DB_CLASS:-db.t3.micro}"

REDIS_CLASS="${REDIS_CLASS:-cache.t3.micro}"

EC2_TYPE="${EC2_TYPE:-t3.small}"
EC2_KEY="${EC2_KEY:?Debes exportar EC2_KEY (nombre del par de claves SSH en AWS)}"

ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

log() { echo ""; echo "▶ $*"; }

# ─── ECR REPOSITORIES ─────────────────────────────────────────────────────────
log "Creando repositorios ECR..."
for repo in tecnossync-backend tecnossync-frontend; do
  if aws ecr describe-repositories --repository-names "$repo" --region "$REGION" &>/dev/null; then
    echo "  ✓ $repo ya existe"
  else
    aws ecr create-repository \
      --repository-name "$repo" \
      --image-scanning-configuration scanOnPush=true \
      --region "$REGION" \
      --output json | grep repositoryUri
    echo "  ✓ $repo creado"
  fi
done

ECR_REGISTRY="${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com"
echo "ECR_REGISTRY=$ECR_REGISTRY"

# ─── VPC ──────────────────────────────────────────────────────────────────────
log "Creando VPC..."
VPC_ID=$(aws ec2 create-vpc \
  --cidr-block "$VPC_CIDR" \
  --tag-specifications "ResourceType=vpc,Tags=[{Key=Name,Value=${APP}-vpc},{Key=App,Value=${APP}}]" \
  --region "$REGION" \
  --query 'Vpc.VpcId' --output text)
aws ec2 modify-vpc-attribute --vpc-id "$VPC_ID" --enable-dns-support --region "$REGION"
aws ec2 modify-vpc-attribute --vpc-id "$VPC_ID" --enable-dns-hostnames --region "$REGION"
echo "  VPC: $VPC_ID"

# Internet Gateway
IGW_ID=$(aws ec2 create-internet-gateway \
  --tag-specifications "ResourceType=internet-gateway,Tags=[{Key=Name,Value=${APP}-igw}]" \
  --region "$REGION" \
  --query 'InternetGateway.InternetGatewayId' --output text)
aws ec2 attach-internet-gateway --internet-gateway-id "$IGW_ID" --vpc-id "$VPC_ID" --region "$REGION"
echo "  IGW: $IGW_ID"

# Subnets en 2 AZs
AZ_A="${REGION}a"
AZ_B="${REGION}b"
SUBNET_A=$(aws ec2 create-subnet \
  --vpc-id "$VPC_ID" --cidr-block "$SUBNET_A_CIDR" --availability-zone "$AZ_A" \
  --tag-specifications "ResourceType=subnet,Tags=[{Key=Name,Value=${APP}-subnet-a}]" \
  --region "$REGION" --query 'Subnet.SubnetId' --output text)
SUBNET_B=$(aws ec2 create-subnet \
  --vpc-id "$VPC_ID" --cidr-block "$SUBNET_B_CIDR" --availability-zone "$AZ_B" \
  --tag-specifications "ResourceType=subnet,Tags=[{Key=Name,Value=${APP}-subnet-b}]" \
  --region "$REGION" --query 'Subnet.SubnetId' --output text)
echo "  Subnets: $SUBNET_A, $SUBNET_B"

# Route table con acceso a internet
RT_ID=$(aws ec2 create-route-table --vpc-id "$VPC_ID" --region "$REGION" --query 'RouteTable.RouteTableId' --output text)
aws ec2 create-route --route-table-id "$RT_ID" --destination-cidr-block "0.0.0.0/0" --gateway-id "$IGW_ID" --region "$REGION" >/dev/null
aws ec2 associate-route-table --route-table-id "$RT_ID" --subnet-id "$SUBNET_A" --region "$REGION" >/dev/null
aws ec2 associate-route-table --route-table-id "$RT_ID" --subnet-id "$SUBNET_B" --region "$REGION" >/dev/null

# ─── SECURITY GROUPS ──────────────────────────────────────────────────────────
log "Creando Security Groups..."

# SG para EC2 (app)
SG_APP=$(aws ec2 create-security-group \
  --group-name "${APP}-app-sg" \
  --description "Tecnossync app server" \
  --vpc-id "$VPC_ID" --region "$REGION" \
  --query 'GroupId' --output text)
aws ec2 authorize-security-group-ingress --group-id "$SG_APP" --region "$REGION" --ip-permissions \
  '[{"IpProtocol":"tcp","FromPort":22,"ToPort":22,"IpRanges":[{"CidrIp":"0.0.0.0/0","Description":"SSH"}]},
    {"IpProtocol":"tcp","FromPort":80,"ToPort":80,"IpRanges":[{"CidrIp":"0.0.0.0/0"}]},
    {"IpProtocol":"tcp","FromPort":443,"ToPort":443,"IpRanges":[{"CidrIp":"0.0.0.0/0"}]},
    {"IpProtocol":"tcp","FromPort":3001,"ToPort":3001,"IpRanges":[{"CidrIp":"0.0.0.0/0","Description":"Backend internal"}]}]' >/dev/null
echo "  App SG: $SG_APP"

# SG para RDS
SG_DB=$(aws ec2 create-security-group \
  --group-name "${APP}-db-sg" \
  --description "Tecnossync PostgreSQL" \
  --vpc-id "$VPC_ID" --region "$REGION" \
  --query 'GroupId' --output text)
aws ec2 authorize-security-group-ingress --group-id "$SG_DB" --region "$REGION" \
  --protocol tcp --port 5432 --source-group "$SG_APP" >/dev/null
echo "  DB SG: $SG_DB"

# SG para Redis
SG_REDIS=$(aws ec2 create-security-group \
  --group-name "${APP}-redis-sg" \
  --description "Tecnossync Redis" \
  --vpc-id "$VPC_ID" --region "$REGION" \
  --query 'GroupId' --output text)
aws ec2 authorize-security-group-ingress --group-id "$SG_REDIS" --region "$REGION" \
  --protocol tcp --port 6379 --source-group "$SG_APP" >/dev/null
echo "  Redis SG: $SG_REDIS"

# ─── RDS PostgreSQL ───────────────────────────────────────────────────────────
log "Creando RDS PostgreSQL..."
aws rds create-db-subnet-group \
  --db-subnet-group-name "${APP}-subnet-group" \
  --db-subnet-group-description "Tecnossync DB subnets" \
  --subnet-ids "$SUBNET_A" "$SUBNET_B" \
  --region "$REGION" >/dev/null

aws rds create-db-instance \
  --db-instance-identifier "${APP}-db" \
  --db-instance-class "$DB_CLASS" \
  --engine postgres \
  --engine-version "15.4" \
  --master-username "$DB_USER" \
  --master-user-password "$DB_PASSWORD" \
  --db-name "$DB_NAME" \
  --db-subnet-group-name "${APP}-subnet-group" \
  --vpc-security-group-ids "$SG_DB" \
  --no-publicly-accessible \
  --storage-type gp3 \
  --allocated-storage 20 \
  --backup-retention-period 7 \
  --deletion-protection \
  --tags "Key=App,Value=${APP}" \
  --region "$REGION" >/dev/null
echo "  RDS creándose... (tarda ~5 min)"

# ─── ElastiCache Redis ────────────────────────────────────────────────────────
log "Creando ElastiCache Redis..."
aws elasticache create-cache-subnet-group \
  --cache-subnet-group-name "${APP}-redis-subnet" \
  --cache-subnet-group-description "Tecnossync Redis subnets" \
  --subnet-ids "$SUBNET_A" "$SUBNET_B" \
  --region "$REGION" >/dev/null

aws elasticache create-cache-cluster \
  --cache-cluster-id "${APP}-redis" \
  --engine redis \
  --cache-node-type "$REDIS_CLASS" \
  --num-cache-nodes 1 \
  --cache-subnet-group-name "${APP}-redis-subnet" \
  --security-group-ids "$SG_REDIS" \
  --tags "Key=App,Value=${APP}" \
  --region "$REGION" >/dev/null
echo "  Redis creándose..."

# ─── S3 para uploads ──────────────────────────────────────────────────────────
log "Creando bucket S3..."
BUCKET="${APP}-uploads-${ACCOUNT_ID}"
if aws s3api head-bucket --bucket "$BUCKET" 2>/dev/null; then
  echo "  ✓ Bucket ya existe"
else
  if [ "$REGION" = "us-east-1" ]; then
    aws s3api create-bucket --bucket "$BUCKET" --region "$REGION" >/dev/null
  else
    aws s3api create-bucket --bucket "$BUCKET" --region "$REGION" \
      --create-bucket-configuration LocationConstraint="$REGION" >/dev/null
  fi
  aws s3api put-public-access-block --bucket "$BUCKET" \
    --public-access-block-configuration "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"
  echo "  Bucket: s3://$BUCKET"
fi

# ─── EC2 Instance ─────────────────────────────────────────────────────────────
log "Creando EC2 Instance..."

# Obtener AMI Amazon Linux 2023 más reciente
AMI_ID=$(aws ec2 describe-images \
  --owners amazon \
  --filters "Name=name,Values=al2023-ami-*-x86_64" "Name=state,Values=available" \
  --query 'reverse(sort_by(Images, &CreationDate))[0].ImageId' \
  --region "$REGION" --output text)
echo "  AMI: $AMI_ID"

# User data para instalar Docker
USER_DATA=$(cat <<'USERDATA'
#!/bin/bash
yum update -y
yum install -y docker
systemctl enable docker
systemctl start docker
usermod -aG docker ec2-user
curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-linux-x86_64" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose
ln -sf /usr/local/bin/docker-compose /usr/bin/docker-compose
mkdir -p /opt/tecnossync/{logs,sessions,uploads/generated,ssl}
USERDATA
)

INSTANCE_ID=$(aws ec2 run-instances \
  --image-id "$AMI_ID" \
  --instance-type "$EC2_TYPE" \
  --key-name "$EC2_KEY" \
  --security-group-ids "$SG_APP" \
  --subnet-id "$SUBNET_A" \
  --associate-public-ip-address \
  --user-data "$USER_DATA" \
  --block-device-mappings '[{"DeviceName":"/dev/xvda","Ebs":{"VolumeSize":30,"VolumeType":"gp3"}}]' \
  --tag-specifications \
    "ResourceType=instance,Tags=[{Key=Name,Value=${APP}-server},{Key=App,Value=${APP}}]" \
  --region "$REGION" \
  --query 'Instances[0].InstanceId' --output text)

aws ec2 wait instance-running --instance-ids "$INSTANCE_ID" --region "$REGION"
PUBLIC_IP=$(aws ec2 describe-instances \
  --instance-ids "$INSTANCE_ID" --region "$REGION" \
  --query 'Reservations[0].Instances[0].PublicIpAddress' --output text)

echo "  Instance: $INSTANCE_ID"
echo "  IP Pública: $PUBLIC_IP"

# Elastic IP para IP fija
ALLOC_ID=$(aws ec2 allocate-address --domain vpc --region "$REGION" --query 'AllocationId' --output text)
aws ec2 associate-address --instance-id "$INSTANCE_ID" --allocation-id "$ALLOC_ID" --region "$REGION" >/dev/null
ELASTIC_IP=$(aws ec2 describe-addresses --allocation-ids "$ALLOC_ID" --region "$REGION" \
  --query 'Addresses[0].PublicIp' --output text)
echo "  Elastic IP: $ELASTIC_IP"

# ─── IAM Role para que EC2 pueda acceder a ECR ────────────────────────────────
log "Creando IAM Role para EC2..."
aws iam create-role \
  --role-name "${APP}-ec2-role" \
  --assume-role-policy-document '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"ec2.amazonaws.com"},"Action":"sts:AssumeRole"}]}' \
  --output json >/dev/null 2>/dev/null || true
aws iam attach-role-policy \
  --role-name "${APP}-ec2-role" \
  --policy-arn arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryReadOnly 2>/dev/null || true
aws iam create-instance-profile --instance-profile-name "${APP}-ec2-profile" >/dev/null 2>/dev/null || true
aws iam add-role-to-instance-profile \
  --instance-profile-name "${APP}-ec2-profile" \
  --role-name "${APP}-ec2-role" 2>/dev/null || true
sleep 10
aws ec2 associate-iam-instance-profile \
  --instance-id "$INSTANCE_ID" \
  --iam-instance-profile Name="${APP}-ec2-profile" \
  --region "$REGION" >/dev/null 2>/dev/null || echo "  (perfil IAM asignado previamente)"

# ─── RESUMEN ──────────────────────────────────────────────────────────────────
log "════════════════════════════════════════"
echo "✅ Infraestructura creada exitosamente"
echo ""
echo "  ECR Registry : $ECR_REGISTRY"
echo "  EC2 IP       : $ELASTIC_IP"
echo "  S3 Bucket    : s3://$BUCKET"
echo ""
echo "Próximos pasos:"
echo "  1. Esperar ~5 min a que RDS esté disponible"
echo ""
echo "  2. Obtener endpoint de RDS:"
echo "     aws rds describe-db-instances --db-instance-identifier ${APP}-db --region $REGION --query 'DBInstances[0].Endpoint.Address' --output text"
echo ""
echo "  3. Obtener endpoint de Redis:"
echo "     aws elasticache describe-cache-clusters --cache-cluster-id ${APP}-redis --show-cache-node-info --region $REGION --query 'CacheClusters[0].CacheNodes[0].Endpoint.Address' --output text"
echo ""
echo "  4. Crear /opt/tecnossync/.env.prod en $ELASTIC_IP con los valores de"
echo "     .env.example (ver infrastructure/README.md)"
echo ""
echo "  5. Copiar docker-compose.prod.yml y nginx-prod.conf al servidor"
echo ""
echo "  6. Configurar secretos en GitHub (ver README.md)"
echo ""
echo "  7. Hacer push a develop para el primer deploy a QA"
