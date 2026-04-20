FROM node:20-alpine

WORKDIR /app

RUN apk add --no-cache python3 make g++

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

RUN mkdir -p data

EXPOSE 3000

ENV NODE_ENV=production

CMD ["node", "src/index.js"]
