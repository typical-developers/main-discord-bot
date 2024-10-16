import { join } from 'path';
import { readFileSync } from 'fs';

/**
 * Read an asset file with custom encoding.
 * @param assetPath The path to the asset that you want to read.
 * @param encoding THe encoding that you want to use while reading.
 * @returns {string | null}
 */
export function readAssetFile(assetPath: string, encoding: BufferEncoding = 'utf-8'): string | null {
    try {
        const asset = readFileSync(join(process.cwd(), assetPath), encoding);
        return asset;
    } catch (e) {
        return null;
    }
}

/**
 * Read an image asset and turn it into base64.
 * @param assetPath The image path that you want to turn into base64.
 * @returns {string | null}
 */
export function imageToBase64(assetPath: string): string | null {
    const asset = readAssetFile(assetPath, 'base64');
    return asset;
}