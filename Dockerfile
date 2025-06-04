FROM oven/bun:1.1.21

# Make puppeteer skip chromium downloading
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
