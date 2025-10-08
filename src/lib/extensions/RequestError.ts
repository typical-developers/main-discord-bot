export default class RequestError<T> extends Error {
    /**
     * The response that was sent back from the API.
     */
    public readonly response: Response;
    /**
     * If a JSON payload was sent back with the API.
     */
    public readonly payload: T;

    constructor({
        message, response, payload
    }: { message: string, response: Response, payload: T }) {
        super(message);

        this.name = 'RequestError';
        this.response = response;
        this.payload = payload;
    }
}