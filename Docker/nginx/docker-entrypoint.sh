#!/bin/sh

# Create a background process that watches for certificate changes
while :; do
  inotifywait -e modify,create,delete /etc/letsencrypt/live/backend.myselfmonart.com/ && \
  nginx -s reload
  sleep 1
done &

# Start nginx
exec "$@" 