FROM ghcr.io/puppeteer/puppeteer:22.0.0

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm ci

COPY . .

ENV NODE_ENV=production

USER node

CMD [ "node", "final-server-mongo.js" ]