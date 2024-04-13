FROM node:latest

RUN mkdir -p /usr/src/main-discord-bot
WORKDIR /usr/src/main-discord-bot

COPY package.json /usr/src/main-discord-bot
RUN npm i -g pnpm
RUN pnpm i

COPY . /usr/src/main-discord-bot

CMD ["pnpm", "run", "deploy"]