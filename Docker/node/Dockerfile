# Utilisez l'image officielle Node.js avec une version alpine pour la légèreté
FROM node:20-alpine

# Définissez le répertoire de travail dans le conteneur
WORKDIR /usr/src/app

# Copiez les fichiers package.json et le lock file pour installer les dépendances
COPY package*.json ./

# Installez les dépendances en utilisant npm ci pour une installation plus rapide et fiable
RUN npm ci --production --legacy-peer-deps

# Copiez votre code source dans le conteneur
COPY . .

# Exécutez le script de build de votre application AdonisJS
RUN npm run build

# Installez PM2 globalement
RUN npm install pm2 -g

# Exposez le port sur lequel votre app va tourner
EXPOSE 3333

# Utilisez un utilisateur non root pour des raisons de sécurité
USER node

# Commande pour démarrer votre application
CMD ["pm2-runtime", "start", "ecosystem.config.js"]
