# bdd-services-Tadayoshi123/Dockerfile
# Multi-stage Dockerfile optimisé pour SupervIA DB Service

# ===================================
# 🏗️ STAGE 1: BASE
# Base commune pour les autres étapes
# ===================================
FROM node:20-alpine AS base

# Installer les dépendances système communes
# curl pour les health checks, openssl3 pour Prisma sur les versions récentes d'Alpine
RUN apk add --no-cache curl openssl3

WORKDIR /app

# ===================================
# 🧩 STAGE 2: BUILDER
# Installe toutes les dépendances et génère le client Prisma.
# Sert de base pour les étapes de production et de développement.
# ===================================
FROM base AS builder

# Installer les outils de compilation pour les dépendances natives
RUN apk add --no-cache --virtual .build-deps \
    python3 \
    make \
    g++

# Copier les fichiers de configuration
COPY package*.json ./
COPY prisma/ ./prisma/

# Installer toutes les dépendances (y compris dev)
RUN npm install

# Générer le client Prisma
RUN npx prisma generate

# Supprimer les dépendances de build pour alléger l'image
RUN apk del .build-deps

# ===================================
# 🚀 STAGE 3: PRODUCTION
# Construit l'image finale, légère et sécurisée.
# ===================================
FROM base AS production

# Créer un utilisateur non-root pour la sécurité
RUN addgroup -g 1001 -S appgroup && \
    adduser -S appuser -u 1001 -G appgroup

# Copier les dépendances et le client Prisma depuis l'étape 'builder'
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY package*.json ./

# Supprimer les dépendances de développement pour alléger l'image
RUN npm prune --production

# Copier le code source de l'application
COPY --chown=appuser:appgroup src/ ./src/
COPY --chown=appuser:appgroup scripts/ ./scripts/

# Donner les permissions d'exécution au script d'entrée
RUN chmod +x /app/scripts/entrypoint.sh

# Créer les répertoires de volumes
RUN mkdir -p logs temp && \
    chown -R appuser:appgroup logs temp

# Variables d'environnement pour la production
ENV NODE_ENV=production
ENV PORT=3002

# Changer vers l'utilisateur non-root
USER appuser

EXPOSE 3002

# Health check pour l'orchestration
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3002/health || exit 1

# Point d'entrée pour exécuter les migrations au démarrage
ENTRYPOINT ["/app/scripts/entrypoint.sh"]

# Commande de démarrage
CMD ["node", "src/server.js"]

# ===================================
# 💻 STAGE 4: DEVELOPMENT
# Image pour le développement local avec hot-reloading.
# ===================================
FROM builder AS development

# L'étape 'builder' a déjà installé tous les outils et dépendances.
# Il suffit de copier le reste du code source.
COPY . .

# Variables d'environnement pour le développement
ENV NODE_ENV=development
ENV PORT=3002

# Utiliser nodemon pour le rechargement à chaud
CMD ["npm", "run", "dev"] 