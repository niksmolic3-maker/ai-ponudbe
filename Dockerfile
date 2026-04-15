FROM node:22-slim

# Namesti Chromium
RUN apt-get update && apt-get install -y chromium

# Nastavi okolje za puppeteer
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 3000

CMD ["node", "final-server-mongo.js"]