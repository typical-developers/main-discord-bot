export const enum ImageProcessorErrorReference {
    ConnectFailed = 'CONNECT_FAILED.',
    ScreenshotFailed = 'SCREENSHOT_FAILED.',
    StatusNotOK = 'STATUS_NOT_OK.'
}

export default class ImageProcessorError extends Error {
    public readonly reference: ImageProcessorErrorReference;

    constructor({
        message, reference
    }: { message: string, reference: ImageProcessorErrorReference }) {
        super(message);
        
        this.name = 'ImageProcessorError';
        this.reference = reference;
    }
}