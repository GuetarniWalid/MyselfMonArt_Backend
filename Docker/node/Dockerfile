# Utilisez l'image officielle Node.js avec une version alpine pour la légèreté
FROM node:20-alpine AS builder

# Installer git
RUN apt-get update && apt-get install -y git

# Définissez le répertoire de travail dans le conteneur
WORKDIR /usr/src/app

# Cloner le dépôt Git
RUN git clone https://github.com/GuetarniWalid/MyselfMonArt_Backend.git .

# Installe toutes les dépendances, y compris les devDependencies
RUN npm install

# Exécutez la commande de build pour votre application
RUN npm run build

# Installez les dépendances en utilisant npm ci pour une installation plus rapide et fiable
RUN npm ci --production --legacy-peer-deps

# Copiez le fichier .env dans le dossier build
COPY .env /usr/src/app/build/.env

# Installez pm2 pour gérer les processus Node.js
RUN npm install pm2 -g

# Exposez le port sur lequel votre app va tourner
EXPOSE 3333

# Utilisez un utilisateur non root pour des raisons de sécurité
USER node

# Commande pour démarrer votre application
CMD ["pm2-runtime", "start", "ecosystem.config.js"]
