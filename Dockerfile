FROM oven/bun:1.1.21

# Make puppeteer skip chromium downloading
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD true

# Install latest chromium stable
RUN apt-get update && apt-get install curl gnupg -y \
  && curl --location --silent https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - \
  && sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list' \
  && apt-get update \
  && apt-get install google-chrome-stable -y --no-install-recommends \
  && rm -rf /var/lib/apt/lists/*

RUN mkdir -p /usr/src/main-discord-bot
WORKDIR /usr/src/main-discord-bot

RUN which google-chrome-stable

# Install fonts
RUN apt-get update && apt-get install -y fontconfig
COPY ./assets/fonts /usr/local/share/fonts
RUN fc-cache -f -v

# Setup npm
COPY package.json /usr/src/main-discord-bot
COPY bun.lockb /usr/src/main-discord-bot
COPY .npmrc /usr/src/main-discord-bot
COPY . /usr/src/main-discord-bot

RUN bun i

CMD ["bun", "run", "deploy"]