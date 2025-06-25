# Utilisez l'image officielle Nginx Alpine pour la légèreté et la sécurité
FROM nginx:alpine

# Set timezone to France
ENV TZ=Europe/Paris

# Install inotify-tools for watching certificate changes and timezone data
RUN apk add --no-cache inotify-tools tzdata \
    && cp /usr/share/zoneinfo/$TZ /etc/localtime \
    && echo $TZ > /etc/timezone

# Supprimez le fichier de configuration par défaut fourni par Nginx
RUN rm /etc/nginx/conf.d/default.conf

# Copiez le fichier de configuration Nginx personnalisé depuis votre projet vers l'image
COPY ./Docker/nginx/default.conf /etc/nginx/conf.d

# Add script to reload nginx when certificates are renewed
COPY ./Docker/nginx/docker-entrypoint.sh /
RUN chmod +x /docker-entrypoint.sh

# Exposez le port 80 (HTTP) et/ou 443 (HTTPS) selon vos besoins
EXPOSE 80 443

ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]