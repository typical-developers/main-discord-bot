export default class RequestError<T> extends Error {
    /**
     * The response that was sent back from the API.
     */
    public readonly response?: Response;
    /**
     * If a JSON payload was sent back with the API.
     */
    public readonly payload?: T;
    /**
     * If the request errored, the original error of the request.
     */
    public readonly error?: any;

    constructor({
        message, response, payload, error
    }: { message: string, response?: Response, payload?: T, error?: any }) {
        super(message);

        this.name = 'RequestError';
        this.response = response;
        this.payload = payload;
        this.error = error;
    }
}