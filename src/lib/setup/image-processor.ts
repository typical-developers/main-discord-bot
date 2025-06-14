import { container } from '@sapphire/framework';
import HTMLImageProcessor from "#/lib/structures/HTMLImageProcessor"

container.imageProcessor = await HTMLImageProcessor.launch({
    defaultViewport: null,
    browserWSEndpoint: process.env.CHROME_WS_URL,
    targetFilter (target) {
        return !!target.url() || target.type() !== 'page'
    }
    // args: [
    //     '--autoplay-policy=user-gesture-required',
    //     '--disable-background-networking',
    //     '--disable-background-timer-throttling',
    //     '--disable-backgrounding-occluded-windows',
    //     '--disable-breakpad',
    //     '--disable-client-side-phishing-detection',
    //     '--disable-component-update',
    //     '--disable-default-apps',
    //     '--disable-dev-shm-usage',
    //     '--disable-domain-reliability',
    //     '--disable-extensions',
    //     '--disable-features=AudioServiceOutOfProcess',
    //     '--disable-hang-monitor',
    //     '--disable-ipc-flooding-protection',
    //     '--disable-notifications',
    //     '--disable-offer-store-unmasked-wallet-cards',
    //     '--disable-popup-blocking',
    //     '--disable-print-preview',
    //     '--disable-prompt-on-repost',
    //     '--disable-renderer-backgrounding',
    //     '--disable-setuid-sandbox',
    //     '--disable-speech-api',
    //     '--disable-sync',
    //     '--hide-scrollbars',
    //     '--ignore-gpu-blacklist',
    //     '--metrics-recording-only',
    //     '--mute-audio',
    //     '--no-default-browser-check',
    //     '--no-first-run',
    //     '--no-pings',
    //     '--no-sandbox',
    //     '--no-zygote',
    //     '--password-store=basic',
    //     '--use-gl=swiftshader',
    //     '--use-mock-keychain',
    //     '--auto-open-devtools-for-tabs'
    // ]
});