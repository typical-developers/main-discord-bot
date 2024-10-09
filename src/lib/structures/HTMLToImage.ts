import { Readable } from 'stream';
import nodeHtmlToImage from 'node-html-to-image';
import puppeteer from 'puppeteer';
import { htmlFunctions } from '#lib/util/html';
import { css } from '#lib/util/css';

const { html, head, meta, script, style, body } = htmlFunctions;

export class HTMLToImage {
    /** The raw HTML. */
    public readonly html: string;
    /** Content that gets injected into the HTML. */
    public readonly htmlContent: object;

    /**
     * A base class for generating HTML images. Extending off of this class makes it easier to generate images from HTML.
     * @param page The HTML/Styling information.
     * @param content Content that will get injected into the HTML.
     */
    constructor(page: { html: string; styling: string[] }, content: any) {
        this.html = html({}, [
            head({}, [
                meta({
                    charset: "utf-8"
                }),
                script({
                    src: 'https://unpkg.com/twemoji@latest/dist/twemoji.min.js',
                    crossorigin: 'anonymous'
                }),
                style({}, [
                    css('body', {
                        position: 'absolute',
                        margin: '0',
                        color: 'white',
                        background_color: 'transparent',
                        font_family: 'Fixel Variable',
                        font_size: '12px',
                        text_rendering: 'optimizeLegibility'
                    }),
                    css('img.emoji', {
                        width: '12px',
                        height: '12px'
                    })
                ]),
                style({}, [...page.styling])
            ]),
            body({}, [page.html]),
            script({}, ['twemoji.parse(document.body)'])
        ]);

        this.htmlContent = content;
    }

    /**
     * Draw the image with the html and styling provided.
     * @returns {Promise<Readable>}
     */
    public async draw(): Promise<Readable> {
        const image = await nodeHtmlToImage({
            waitUntil: 'load',
            transparent: true,
            puppeteerArgs: {
                executablePath: process.env.DEV_DEPLOYMENT === 'true' ? puppeteer.executablePath() : '/usr/bin/google-chrome-stable',
                args: ['--no-sandbox', '--disable-gpu', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
                ignoreDefaultArgs: ['--disable-extensions']
            },
            html: this.html,
            content: this.htmlContent
        });

        return Readable.from(image);
    }
}
