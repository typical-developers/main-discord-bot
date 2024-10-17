import { container } from "@sapphire/pieces";
import { readAssetFile } from "@/lib/util/files";
import { htmlFunctions } from "@/lib/util/html";

const { th, tr, td } = htmlFunctions;

export function getResetTime(reset: Date) {
    const nowSeconds = new Date().getTime() / 1000;
    const resetSeconds = reset.getTime() / 1000

    const remainingSeconds = Math.floor(resetSeconds - nowSeconds);

    if (remainingSeconds <= 0) {
        return `00:00:00`;
    }

    const hours = Math.floor(remainingSeconds / 3600).toString().padStart(2, '0');
    const minutes = Math.floor((remainingSeconds % 3600) / 60).toString().padStart(2, '0');
    const seconds = Math.floor(remainingSeconds % 60).toString().padStart(2, '0');

    return `${hours}:${minutes}:${seconds}`;
}

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

export async function generateOaklandsLeaderboard<T extends string>(options: {
    title: string;
    resetTime: string;
    columns: T[];
    rows: { [key in T]: {
        value: string;
        customProperties?: object;
    }}[];
}) {
    const html = readAssetFile('/assets/html/oaklands-leaderboard.html');

    if (!html) {
        throw new Error('Something went wrong with generating an oaklands leaderboard image.');
    }

    const columns = options.columns.map((c) =>
        th({ class: "column-item", scope: "column" }, [c.toUpperCase()])
    ).join('');
    
    const rows = options.rows.map((r) => {
        const rowValues = Object.entries(r) as [T, { value: string, customProperties?: any }][];
        
        return tr({ class: "leaderboard-item" }, [
            Object.values(rowValues).map(([_k, v]) =>
                td({ class: "row-item", ...(v.customProperties || {}) }, [v.value])
            ).join('')
        ]);
    }).join('');

    const image = await container.imageProcessor.draw({
        transparency: true,
        html, handlebars: {
            leaderboardTitle: options.title,
            leaderboardTimer: options.resetTime,
            leaderboardColumns: columns,
            leaderboardRows: rows
        }
    });

    return image;
}