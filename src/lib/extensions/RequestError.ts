declare class RequestErrorWithResponse extends RequestError {
    declare public readonly response: Response;
    public hasJSON(): boolean;
    public json<T = any>(): Promise<T>;
}

export default class RequestError extends Error {
    /**
     * The original request that was sent.
     */
    public readonly request: Request;
    /**
     * The original response, if any, that was returned from the request that was sent.
     * If there was no data returned back from the request, this will be undefined.
     * 
     * Use {@link hasResponse} to check if there is a response.
     */
    public readonly response?: Response;

    constructor({ message, request, response }: { message: string, request: Request, response?: Response }) {
        super(message);

        this.name = 'RequestError';
        this.request = request;
        this.response = response;
    }

    /**
     * Whether or not the request has a response.
     */
    public hasResponse(): this is RequestErrorWithResponse {
        return this.response instanceof Response;
    }

    /**
     * Whether or not the response is JSON.
     */
    public hasJSON() {
        const contentType = this.response?.headers.get('content-type');
        return contentType?.includes('application/json') ?? false;
    }

    /**
     * Unwraps the response data JSON.
     */
    public async json<T = any>(): Promise<T | undefined> {
        if (!this.hasJSON()) return undefined;
        return await this.response?.json() as T;
    }
}