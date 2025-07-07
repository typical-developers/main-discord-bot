import { container } from '@sapphire/framework';
import HTMLImageProcessor from "#/lib/structures/HTMLImageProcessor"

container.imageProcessor = await HTMLImageProcessor.launch({
    defaultViewport: null,
    browserWSEndpoint: process.env.CHROME_WS_URL,
    targetFilter (target) {
        return !!target.url() || target.type() !== 'page'
    }
})
