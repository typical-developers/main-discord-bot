import { errAsync, okAsync } from "neverthrow";
import puppeteer, { Browser, type ConnectOptions } from "puppeteer";
import ImageProcessorError, { ImageProcessorErrorReference } from "#/lib/extensions/ImageProcessorError";

interface DrawOptions<T> {
    url: string;
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
    public async draw<T extends any>(options: DrawOptions<T>) {
        const page = await this._browser.newPage();

        const contents = await page.goto(options.url, { waitUntil: 'networkidle0' });
        if (!contents) {
            return errAsync(new ImageProcessorError({
                message: 'There was an issue when loading the contents of the page.',
                reference: ImageProcessorErrorReference.ScreenshotFailed,
            }));
        }

        const status = contents.status();
        if (status < 200 || status >= 300) {
            return errAsync(new ImageProcessorError({
                message: `Status code ${contents.status()} was returned.`,
                reference: ImageProcessorErrorReference.StatusNotOK,
            }));
        }

        const element = await page.$('body');
        if (!element) {
            return errAsync(new ImageProcessorError({
                message: `No body element was found to screenshot.`,
                reference: ImageProcessorErrorReference.ScreenshotFailed,
            }));
        }

        const image = Buffer.from(await element.screenshot({
            type: 'png',
            omitBackground: true
        }))

        await page.close();
        
        return okAsync(image);
    }
}