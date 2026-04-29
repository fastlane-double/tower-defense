FROM node:20-alpine

# /app/server holds the Node.js server; /app holds the game static files.
# This mirrors the local dev layout:
#   _default/
#     index.html  game.js  style.css   <- static files
#     server/
#       src/index.js                   <- GAME_DIR = path.join(__dirname, '..', '..') = /app

WORKDIR /app/server

# Install dependencies first (layer caching)
COPY package*.json ./
RUN npm ci --omit=dev

# Copy server source
COPY src/ ./src/

# Copy game static files to /app (parent of server dir)
# Build context must be project root (../) for this to work.
# See README-DEPLOY.md for build instructions.
COPY index.html game.js style.css /app/

# Create data directory for SQLite
RUN mkdir -p /app/server/data

# Non-root user for security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
RUN chown -R appuser:appgroup /app
USER appuser

EXPOSE 3000

ENV NODE_ENV=production
ENV PORT=3000

CMD ["node", "src/index.js"]
