FROM node:18-alpine

WORKDIR /app

# Copiar package.json
COPY package.json ./

# Instalar dependências
RUN npm install --production && npm cache clean --force

# Copiar código
COPY server.js ./

# Expor porta
EXPOSE 3000

# Iniciar aplicação
CMD ["node", "server.js"]
