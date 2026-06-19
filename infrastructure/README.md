# Infraestructura AWS — Tecnossync Omnichannel

## Arquitectura

```
Internet
    │
    ▼
EC2 t3.small (Docker)
 ├─ nginx (443/80) → frontend React
 └─ backend Node.js (3001)
         │
         ├─ RDS PostgreSQL (db.t3.micro) — privado en VPC
         └─ ElastiCache Redis (cache.t3.micro) — privado en VPC
```

Imágenes Docker almacenadas en **Amazon ECR**.

---

## Requisitos previos

1. AWS CLI v2 instalado y configurado: `aws configure`
2. Par de claves SSH creado en la consola AWS EC2 → Key Pairs
3. Permisos IAM: EC2, RDS, ElastiCache, ECR, S3, IAM

---

## Paso 1 — Crear infraestructura

```bash
export DB_PASSWORD="MiPasswordSegura123!"
export EC2_KEY="mi-keypair-aws"        # nombre del par de claves en AWS
export AWS_REGION="us-east-1"

chmod +x infrastructure/setup-aws.sh
./infrastructure/setup-aws.sh
```

El script crea:
- VPC + subnets en 2 AZs + Internet Gateway
- EC2 t3.small con Docker instalado + Elastic IP
- RDS PostgreSQL 15 (privado)
- ElastiCache Redis (privado)
- ECR repositories: `tecnossync-backend`, `tecnossync-frontend`
- S3 bucket para uploads
- IAM role para que EC2 lea ECR

---

## Paso 2 — Configurar el servidor

Espera ~5 minutos a que RDS esté disponible, luego:

```bash
# Obtener endpoints
RDS_ENDPOINT=$(aws rds describe-db-instances \
  --db-instance-identifier tecnossync-db \
  --query 'DBInstances[0].Endpoint.Address' --output text)

REDIS_ENDPOINT=$(aws elasticache describe-cache-clusters \
  --cache-cluster-id tecnossync-redis \
  --show-cache-node-info \
  --query 'CacheClusters[0].CacheNodes[0].Endpoint.Address' --output text)

EC2_IP=$(aws ec2 describe-instances \
  --filters "Name=tag:Name,Values=tecnossync-server" \
  --query 'Reservations[0].Instances[0].PublicIpAddress' --output text)

echo "RDS: $RDS_ENDPOINT"
echo "Redis: $REDIS_ENDPOINT"
echo "EC2: $EC2_IP"
```

Copia `.env.example` al servidor y rellena los valores:

```bash
scp -i ~/.ssh/mi-keypair.pem .env.example ec2-user@$EC2_IP:/tmp/.env.prod
ssh -i ~/.ssh/mi-keypair.pem ec2-user@$EC2_IP
sudo mv /tmp/.env.prod /opt/tecnossync/.env.prod
sudo nano /opt/tecnossync/.env.prod   # rellenar DB_HOST, REDIS_HOST, etc.
```

Copia los archivos de configuración:

```bash
scp -i ~/.ssh/mi-keypair.pem docker-compose.prod.yml ec2-user@$EC2_IP:/opt/tecnossync/
scp -i ~/.ssh/mi-keypair.pem infrastructure/nginx-prod.conf ec2-user@$EC2_IP:/opt/tecnossync/
```

---

## Paso 3 — SSL con Let's Encrypt

En el servidor:

```bash
sudo yum install -y certbot
sudo certbot certonly --standalone -d tudominio.com
sudo cp /etc/letsencrypt/live/tudominio.com/fullchain.pem /opt/tecnossync/ssl/
sudo cp /etc/letsencrypt/live/tudominio.com/privkey.pem   /opt/tecnossync/ssl/
```

Agrega renovación automática:

```bash
echo "0 0 1 * * certbot renew --quiet && cp /etc/letsencrypt/live/tudominio.com/*.pem /opt/tecnossync/ssl/" | sudo crontab -
```

---

## Paso 4 — Configurar secretos en GitHub

Ve a: `https://github.com/tecnossync-crypto/omnichannel/settings/secrets/actions`

| Secreto | Descripción |
|---------|------------|
| `ECR_REGISTRY` | `<account-id>.dkr.ecr.us-east-1.amazonaws.com` |
| `AWS_ACCESS_KEY_ID` | Access key con permisos ECR |
| `AWS_SECRET_ACCESS_KEY` | Secret key |
| `AWS_REGION` | `us-east-1` |
| `PROD_HOST` | IP elástica del servidor |
| `PROD_USER` | `ec2-user` |
| `PROD_SSH_KEY` | Contenido del archivo `.pem` |
| `PROD_DOMAIN` | `tudominio.com` |
| `QA_HOST` | IP del servidor QA (puede ser el mismo) |
| `QA_USER` | `ec2-user` |
| `QA_SSH_KEY` | Contenido del archivo `.pem` |

### Usuario IAM para GitHub Actions

Crea un usuario IAM con solo estos permisos:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ecr:GetAuthorizationToken",
        "ecr:BatchCheckLayerAvailability",
        "ecr:GetDownloadUrlForLayer",
        "ecr:BatchGetImage",
        "ecr:PutImage",
        "ecr:InitiateLayerUpload",
        "ecr:UploadLayerPart",
        "ecr:CompleteLayerUpload"
      ],
      "Resource": "*"
    }
  ]
}
```

---

## Paso 5 — Primer deploy

```bash
# En tu máquina local
git checkout develop
git push origin develop

# El workflow deploy-qa.yml se activa automáticamente
# o manualmente desde GitHub Actions → "Deploy → QA" → Run workflow
```

Para promover a producción, usa el panel SuperAdmin de la plataforma o ve a:
GitHub Actions → "Deploy → Producción" → Run workflow → escribe `PRODUCCION`

---

## Configurar el token de GitHub para el panel SuperAdmin

El panel de deploys en SuperAdmin necesita un token personal de GitHub:

1. Ve a: `https://github.com/settings/tokens?type=beta`
2. Crea un **Fine-grained token** con:
   - Repository access: `omnichannel`
   - Permissions: `Actions: Read and write`
3. Copia el token y agrégalo a `/opt/tecnossync/.env.prod`:
   ```
   GITHUB_TOKEN=github_pat_XXXX
   GITHUB_OWNER=tecnossync-crypto
   GITHUB_REPO=omnichannel
   ```
4. Reinicia el contenedor backend: `docker compose -f docker-compose.prod.yml restart backend`

---

## Costos estimados (us-east-1, < 10 empresas)

| Recurso | Tipo | Costo ~mensual |
|---------|------|---------------|
| EC2 | t3.small | ~$17 |
| RDS PostgreSQL | db.t3.micro | ~$15 |
| ElastiCache Redis | cache.t3.micro | ~$12 |
| Elastic IP | — | ~$3.6 |
| ECR Storage | 10 GB | ~$1 |
| S3 + transferencia | estimado | ~$2 |
| **Total** | | **~$51/mes** |

---

## Comandos útiles en el servidor

```bash
# Ver estado de contenedores
docker compose -f /opt/tecnossync/docker-compose.prod.yml ps

# Ver logs del backend en vivo
docker logs -f tecnossync_backend

# Reiniciar solo el backend (sin downtime del frontend)
docker compose -f /opt/tecnossync/docker-compose.prod.yml restart backend

# Actualizar manualmente una imagen
docker compose -f /opt/tecnossync/docker-compose.prod.yml pull backend
docker compose -f /opt/tecnossync/docker-compose.prod.yml up -d --no-deps backend
```
