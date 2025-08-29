FROM node:18-alpine

WORKDIR /app

# Copiar package.json
COPY package.json ./

# Usar npm install em vez de npm ci
RUN npm install --production && \
    npm cache clean --force && \
    rm -rf /tmp/*

# Copiar código
COPY server.js ./

# Usuário não-root
RUN addgroup -g 1001 -S nodejs && \
    adduser -S appuser -u 1001 -G nodejs

USER appuser

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

CMD ["node", "server.js"]
