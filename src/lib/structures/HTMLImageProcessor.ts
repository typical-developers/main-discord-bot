import { container } from '@sapphire/framework';

import { errAsync, okAsync } from "neverthrow";
import puppeteer, { Browser, type ConnectOptions } from "puppeteer";
import ImageProcessorError, { ImageProcessorErrorReference } from "#/lib/extensions/ImageProcessorError";

interface DrawOptions<T> {
    url: string;
    headers?: Record<string, string>;
}

export default class HTMLImageProcessor {
    private browser: Browser;
    private opts: ConnectOptions = {};

    constructor(browser: Browser, opts: ConnectOptions = {}) {
        this.browser = browser;
        this.opts = opts;

        this.browser.once('disconnected', async () => {
            container.logger.warn('HTMLImageProcessor: The process has been disconnected. Automatically reconnecting in 5 seconds.');
            await new Promise(async (res) =>
                setTimeout(() => res(this.reconnect()), 5000)
            );
        });
    }

    private static async connect(options: ConnectOptions = {}) {
        const browser = await puppeteer.connect(options).catch(() => null);

        if (!browser) {
            return errAsync(new ImageProcessorError({
                message: 'There was an issue establishing a connection to the browser.',
                reference: ImageProcessorErrorReference.ConnectFailed
            }));
        }

        return okAsync(browser);
    }

    /**
     * Launch a new HTML Image Processor instance.
     * @param options The custom options you want for puppeteer.
     * @returns {Promise<HTMLImageProcessor>}
     */
    static async launch(options: ConnectOptions = {}): Promise<HTMLImageProcessor> {
        // No container.logger can be used here because it's not accessible since everything is still starting up.
        // Need to figure out a way to initalize it first to be properly used.

        const browser = await HTMLImageProcessor.connect(options);

        if (!browser.isOk()) {
            return new Promise(async (res) =>
                setTimeout(() => res(HTMLImageProcessor.launch(options)), 5_000)
           );
        }

        return new this(browser.value, options);
    }

    /**
     * Reconnects the browser.
     */
    private async reconnect() {
        const browser = await puppeteer.connect(this.opts).catch(() => null);
        if (!browser) {
            container.logger.warn('HTMLImageProcessor: The process failed to reconnect. Automatically attempting to reconnect in 5 seconds.');

            return await new Promise(async (res) =>
                setTimeout(() => res(this.reconnect()), 5000)
            );
        }

        container.logger.info('HTMLImageProcessor: The process has been reconnected.');

        browser.once('disconnected', async () => {
            container.logger.warn('HTMLImageProcessor: The process has been disconnected. Automatically reconnecting in 5 seconds.');
            await new Promise(async (res) =>
                setTimeout(() => res(this.reconnect()), 5000)
            );
        });

        this.browser = browser;
    }

    /**
     * Close the specified instance.
     * @returns {Promise<void>}
     */
    public async close(): Promise<void> {
        await this.browser.close();
    }

    /**
     * Draw the current image and return its buffer.
     * @param options The HTML and Handlebars content you want.
     * @returns {Promise<Buffer>} The image buffer.
     */
    public async draw<T extends any>(options: DrawOptions<T>) {
        const page = await this.browser.newPage();
        if (options.headers) {
            await page.setExtraHTTPHeaders(options.headers);
        }

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