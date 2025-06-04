import puppeteer, { type LaunchOptions } from "puppeteer";
import Handlebars from "handlebars";
import { Cluster } from "puppeteer-cluster";

interface DrawOptions<T> {
    html: string;
    handlebars?: T;
    transparency?: boolean;
    savePath?: string;
}

export default class HTMLImageProcessor {
    private _cluster: Cluster;

    constructor(cluster: Cluster) {
        this._cluster = cluster;

        this._cluster.task(async ({ page, data: { html, transparency, savePath } }) => {
            await page.setContent(html, { waitUntil: 'networkidle0', timeout: 0 });

            const element = await page.$('#root');

            if (!element) {
                throw new Error('No body element was found to screenshot.');
            }

            return await element.screenshot({
                type: 'png',
                optimizeForSpeed: true,
                omitBackground: transparency,
                path: savePath
            });
        });
    }

    /**
     * Launch a new HTML Image Processor instance.
     * @param options The custom options you want for puppeteer.
     * @returns {Promise<HTMLImageProcessor>}
     */
    static async launch(options?: LaunchOptions): Promise<HTMLImageProcessor> {
        const cluster = await Cluster.launch({
            puppeteer: puppeteer,
            concurrency: Cluster.CONCURRENCY_PAGE,
            maxConcurrency: 5,
            puppeteerOptions: options,
        });

        return new this(cluster);
    }

    /**
     * Close the specified instance.
     * @returns {Promise<void>}
     */
    public async close(): Promise<void> {
        await this._cluster.close();
    }

    /**
     * Draw the current image and return its buffer.
     * @param options The HTML and Handlebars content you want.
     * @returns {Promise<Buffer>} The image buffer.
     */
    public async draw<T extends any>(options: DrawOptions<T>): Promise<Buffer> {
        const template = Handlebars.compile<T>(options.html);
        const result = template(options.handlebars || {} as T);

        const { html, handlebars, ...payload } = options;
        const image: Uint8Array = await this._cluster.execute({ html: result, ...payload });

        await this._cluster.idle();
        return Buffer.from(image);
    }
}