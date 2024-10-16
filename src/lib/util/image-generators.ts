import { readAssetFile } from "@/lib/util/files";
import { container } from "@sapphire/pieces";

/**
 * Generate an image for the current classic shop.
 * @param handlebars The required hanlebars options.
 * @returns {Promise<Buffer>}
 */
export async function generateClassicShop(handlebars: { shopResetTime: string, shopContentHtml: string }): Promise<Buffer> {
    const html = readAssetFile('/assets/html/classic-shop.html');

    if (!html) {
        throw new Error('Something went wrong with generating the classic shop image.');
    }

    const image = await container.imageProcessor.draw({
        transparency: true,
        html, handlebars
    });

    return image;
}