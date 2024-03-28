# Utilisez l'image officielle Nginx Alpine pour la légèreté et la sécurité
FROM nginx:alpine

# Supprimez le fichier de configuration par défaut fourni par Nginx
RUN rm /etc/nginx/conf.d/default.conf

# Copiez le fichier de configuration Nginx personnalisé depuis votre projet vers l'image
COPY ./Docker/nginx/default.conf /etc/nginx/conf.d

# Exposez le port 80 (HTTP) et/ou 443 (HTTPS) selon vos besoins
EXPOSE 80 443

# Lorsque le conteneur démarre, Nginx s'exécute automatiquement en arrière-plan
CMD ["nginx", "-g", "daemon off;"]