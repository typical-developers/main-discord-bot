# Typical Developers Discord Bot
Open-sourced code for the Typical Developers Discord bot, used in relating Typical Developers servers. There is no documentation except for inside of the code itself; this is for those who want to look at or use the bot's code and add new features to it. Feedback is very much appreciated!

> [!NOTE]  
> `@typical-developers/api-types` is a private npm github package. This package is private since it would expose some of our internal api types, which we do not feel comfortable allowing others to have access to.

## Usage
### Prequesties
- Node 18 (LTS recommended)
- pnpm (`npm i -g pnpm`)

### Installing Dependencies
```
pnpm i
```

### Environment
Refer to the `.env-example` for environmental variables

### Building
```
pnpm run build
```

### Deployment
```
pnpm run deploy
```

## Licensing
All code for the bot is licensed under the [GNU General Public License v3.0](https://github.com/typical-developers/main-discord-bot/blob/main/LICENSE) license. Please refer to the LICENSE file for more information regarding rights and limitations.

TL;DR: You are allowed to do whatever with the code (modify, sell, redistribute, etc) as long as you allow others to do the same with yours.