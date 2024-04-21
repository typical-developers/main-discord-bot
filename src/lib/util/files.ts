import { join } from 'path';
import { readFileSync } from 'fs';

/**
 * Read an image asset and turn it into base64.
 * @param assetPath The image path that you want to turn into base64.
 * @returns {string | null}
 */
export function imageToBase64(assetPath: string): string | null {
    try {
        const asset = readFileSync(join(process.cwd(), assetPath));

        return asset.toString('base64');
    } catch (e) {
        return null;
    }
}