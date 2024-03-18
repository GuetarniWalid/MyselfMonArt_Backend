# Utilisez l'image officielle Node.js avec une version alpine pour la légèreté
FROM node:20-alpine

# Définissez le répertoire de travail dans le conteneur
WORKDIR /usr/src/app

# Copiez les fichiers package.json et le lock file pour installer les dépendances
COPY package*.json ./

# Installez les dépendances
RUN npm install
RUN npm install pm2 -g

# Copiez votre code source dans le conteneur
COPY . .

# Exposez le port sur lequel votre app va tourner
EXPOSE 3333

# Commande pour démarrer votre application
CMD ["pm2-runtime", "start", "ecosystem.config.js"]