import { Readable } from 'stream';
import nodeHtmlToImage from "node-html-to-image";
import { htmlFunctions } from "#lib/util/html";
import { css } from "#lib/util/css";

const { html, head, script, style, body } = htmlFunctions;

export class HTMLToImage {
    public readonly html: string;
    public readonly htmlContent: object;

    constructor(page: { html: string, styling: string[] }, content: object) {
        const styling = [
            css('body', {
                position: 'absolute',
                margin: '0',
                color: 'black',
                font_family: 'Fixel Variable',
                font_size: '12px',
                background_color: 'transparent'
            }),
            ...page.styling
        ];

        this.html = html({}, [
            head({}, [
                script({
                    src: 'https://twemoji.maxcdn.com/v/latest/twemoji.min.js',
					crossorigin: 'anonymous'
                }),
                style({}, styling)
            ]),
            body({}, [page.html]),
            script({}, ['twemoji.parse(document.body)'])
        ]);

        this.htmlContent = content;
    }

    public async draw() {
        const image = await nodeHtmlToImage({
            waitUntil: 'load',
            transparent: true,
            puppeteerArgs: {
                args: [
                    '--no-sandbox',
                    '--disable-gpu',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage'
                ],
                ignoreDefaultArgs: ['--disable-extensions']
            },
            html: this.html,
            content: this.htmlContent
        });

        return Readable.from(image);
    }
}