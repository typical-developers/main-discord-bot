FROM node:latest

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD true

RUN apt-get update && apt-get install curl gnupg -y \
  && curl --location --silent https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - \
  && sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list' \
  && apt-get update \
  && apt-get install google-chrome-stable -y --no-install-recommends \
  && rm -rf /var/lib/apt/lists/*

RUN mkdir -p /usr/src/main-discord-bot
WORKDIR /usr/src/main-discord-bot

COPY package.json /usr/src/main-discord-bot
RUN npm i -g pnpm
RUN pnpm i

COPY . /usr/src/main-discord-bot

CMD ["pnpm", "run", "deploy"]