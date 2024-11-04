import { container } from "@sapphire/pieces";
import { readAssetFile } from "@/lib/util/files";
import { htmlFunctions } from "@/lib/util/html";

const { div, img, a, th, tr, td } = htmlFunctions;

export function getResetTime(reset: Date, includeHours: boolean = false) {
    const nowSeconds = new Date().getTime() / 1000;
    const resetSeconds = reset.getTime() / 1000

    const remainingSeconds = Math.floor(resetSeconds - nowSeconds);

    if (remainingSeconds <= 0) {
        return `00:00:00`;
    }

    const seconds = Math.floor(remainingSeconds % 60).toString().padStart(2, '0');
    const minutes = Math.floor((remainingSeconds % 3600) / 60).toString().padStart(2, '0');

    if (!includeHours) {
        const hours = Math.floor(remainingSeconds / 3600).toString().padStart(2, '0');
        return `${hours}:${minutes}:${seconds}`;
    }

    const hours = Math.floor((remainingSeconds / 3600) % 24).toString().padStart(2, '0');
    const days = Math.floor(remainingSeconds / 86400).toString().padStart(2, '0');

    return `${days}:${hours}:${minutes}:${seconds}`;
}

export async function generateClassicShop(options: {
    resetTime: string;
    items: {
        thumbnail: string;
        name: string;
        price: number;
    }[];
}) {
    const html = readAssetFile('/assets/html/classic-shop.html');

    if (!html) {
        throw new Error('Something went wrong with generating the classic shop image.');
    }

    const content = options.items.map((i) =>
        div({ class: "shop-item" }, [
            img({ src: i.thumbnail !== ""
                ? i.thumbnail
                : "https://www.roblox.com/Thumbs/unapproved.png"
            }),
            a({ class: "item-header"}, [i.name]),
            a({ class: "item-cost" }, [`Ca$h: ${i.price}`])
        ])
    ).join('');

    const image = await container.imageProcessor.draw({
        transparency: true,
        html, handlebars: {
            shopResetTime: options.resetTime,
            shopContentHtml: content
        }
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
