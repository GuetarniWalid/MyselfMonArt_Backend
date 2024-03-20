# Utilisez l'image officielle Node.js avec une version alpine pour la légèreté
FROM node:20-alpine AS builder

# Définissez le répertoire de travail dans le conteneur
WORKDIR /usr/src/app

# Copiez les fichiers package.json et le lock file pour installer les dépendances
COPY package*.json ./

# Installe toutes les dépendances, y compris les devDependencies
RUN npm install 

# Installez pm2 pour gérer les processus Node.js
RUN npm install pm2 -g

# Installez les dépendances en utilisant npm ci pour une installation plus rapide et fiable
RUN npm ci --production --legacy-peer-deps

# Copiez le fichier .env dans le dossier build
COPY .env /usr/src/app/build/.env

# Copiez votre code source dans le conteneur
COPY . .

# Exécutez la commande de build pour votre application
RUN npm run build

# Exposez le port sur lequel votre app va tourner
EXPOSE 3333

# Utilisez un utilisateur non root pour des raisons de sécurité
USER node

# Commande pour démarrer votre application
CMD ["pm2-runtime", "start", "ecosystem.config.js"]
