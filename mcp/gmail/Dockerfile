FROM node:20-alpine

# Set timezone
ENV TZ=Europe/Paris
RUN apk add --no-cache tzdata \
    && cp /usr/share/zoneinfo/$TZ /etc/localtime \
    && echo $TZ > /etc/timezone

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --omit=dev

# Copy application files (only JS needed for runtime)
COPY *.js ./

# Set SSE mode and port
ENV TRANSPORT_MODE=sse
ENV PORT=3002

EXPOSE 3002

CMD ["node", "index.js"]
