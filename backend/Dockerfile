# backend/Dockerfile
# Imagen base: Node.js LTS sobre Alpine (imagen pequeña ~180MB)
FROM node:20-alpine

# Instalar dependencias del sistema necesarias para bcrypt y pg
RUN apk add --no-cache python3 make g++

# Directorio de trabajo dentro del contenedor
WORKDIR /app

# Copiar primero package.json para aprovechar el caché de Docker
# Si no cambian las deps, Docker reutiliza la capa instalada
COPY package*.json ./

# Instalar dependencias de producción únicamente (requiere package-lock.json en el repo)
RUN npm ci --omit=dev

# Copiar el resto del código fuente
COPY . .

# Crear directorio de logs
RUN mkdir -p logs uploads/vouchers uploads/catalogs sessions

# El puerto que expone la app (debe coincidir con PORT en .env)
EXPOSE 3001

# Usuario no-root para seguridad
RUN addgroup -g 1001 -S nodejs && adduser -S nodeuser -u 1001
RUN chown -R nodeuser:nodejs /app
USER nodeuser

# Comando de inicio
CMD ["node", "src/index.js"]
