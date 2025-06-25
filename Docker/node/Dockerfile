# Étape de build

# Utilisez l'image officielle Node.js avec une version alpine pour la légèreté
FROM node:20-alpine AS builder

# Définissez le répertoire de travail dans le conteneur
WORKDIR /usr/src/app

# Copiez les fichiers package.json et le lock file pour installer les dépendances
COPY package*.json ./

# Installe toutes les dépendances, y compris les devDependencies
RUN npm install

# Copiez votre code source dans le conteneur
COPY . .

# Exécutez le script de build de votre application AdonisJS
RUN npm run build


# Étape de production

# Utilisez l'image officielle Node.js avec une version alpine pour la légèreté
FROM node:20-alpine

# Set timezone to France
ENV TZ=Europe/Paris

# Installez dockerize pour attendre que la base de données soit prête
ENV DOCKERIZE_VERSION v0.7.0

RUN apk update --no-cache \
    && apk add --no-cache wget openssl tzdata \
    && wget -O - https://github.com/jwilder/dockerize/releases/download/$DOCKERIZE_VERSION/dockerize-linux-amd64-$DOCKERIZE_VERSION.tar.gz | tar xzf - -C /usr/local/bin \
    && apk del wget \
    && cp /usr/share/zoneinfo/$TZ /etc/localtime \
    && echo $TZ > /etc/timezone

# Définissez le répertoire de travail dans le conteneur
WORKDIR /usr/src/app

# Copiez les fichiers buildés depuis l'étape de build
COPY --from=builder /usr/src/app/build .
COPY --from=builder /usr/src/app/ecosystem.config.js .
COPY --from=builder /usr/src/app/init.sh .

# Installez les dépendances en utilisant npm ci pour une installation plus rapide et fiable
RUN npm ci --production --legacy-peer-deps
RUN npm install pm2 -g

# Exposez le port sur lequel votre app va tourner
EXPOSE 3333

# Commande pour démarrer votre application
CMD ["sh", "/usr/src/app/init.sh"]
