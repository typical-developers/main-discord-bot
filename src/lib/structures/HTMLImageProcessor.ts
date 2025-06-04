import puppeteer, { Browser, type ConnectOptions } from "puppeteer";

interface DrawOptions<T> {
    html: string;
    handlebars?: T;
    transparency?: boolean;
    savePath?: string;
}

export default class HTMLImageProcessor {
    private readonly _browser: Browser;

    constructor(browser: Browser) {
        this._browser = browser;
    }

    /**
     * Launch a new HTML Image Processor instance.
     * @param options The custom options you want for puppeteer.
     * @returns {Promise<HTMLImageProcessor>}
     */
    static async launch(options: ConnectOptions = {}): Promise<HTMLImageProcessor> {
        const browser = await puppeteer.connect(options);
        return new this(browser);
    }

    /**
     * Close the specified instance.
     * @returns {Promise<void>}
     */
    public async close(): Promise<void> {
        await this._browser.close();
    }

    /**
     * Draw the current image and return its buffer.
     * @param options The HTML and Handlebars content you want.
     * @returns {Promise<Buffer>} The image buffer.
     */
    public async draw<T extends any>(options: DrawOptions<T>): Promise<Buffer> {
        const page = await this._browser.newPage();
        await page.setContent(options.html);

        const element = await page.$('#root');

        if (!element) {
            throw new Error('No body element was found to screenshot.');
        }

        const image = Buffer.from(await element.screenshot({
            type: 'png',
            omitBackground: true
        }))

        await page.close();
        
        return image;
    }
}