import { type APIError, APIErrorCodes } from "#/lib/types/api";

export default class APIRequestError extends Error {
    /**
     * The original error that was thrown.
     */
    public readonly error: unknown;
    /**
     * The error code that the API returned.
     */
    public readonly code: APIErrorCodes;
    /**
     * The message that the API returned due to an error.
     */
    public readonly message: string;

    constructor(error: unknown, { code, message }: Omit<APIError, 'success'>) {
        super(message);

        this.name = 'APIRequestError';
        this.error = error;
        this.code = code;
        this.message = message;
    }

    /**
     * Checks if an error is an APIRequestError.
     */
    public static isAPIError(error: unknown): error is APIRequestError {
        return error instanceof APIRequestError;
    }

    /**
     * Checks if the provided error code matches the error code of the error.
     */
    public isErrorCode(code: APIErrorCodes) {
        return this.code === code;
    }
}