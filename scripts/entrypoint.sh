#!/bin/sh
# bdd-services-Tadayoshi123/scripts/entrypoint.sh

# Arrête le script si une commande échoue
set -e

# Affiche un message indiquant le début des migrations
echo "🚀 Applying database migrations..."

# Exécute la commande Prisma pour appliquer les migrations en attente
# C'est la commande recommandée pour les environnements de production/CI/CD
npx prisma migrate deploy

# Affiche un message de succès
echo "✅ Migrations applied successfully."

# Exécute la commande passée en argument au script (le CMD du Dockerfile)
# Permet de démarrer le serveur Node.js après la migration
exec "$@" 