/**
 * Standard application error class.
 * This class is used to distinguish between operational errors and programmer errors.
 */
export class AppError extends Error {
    public readonly statusCode: number;
    public readonly code: string;
    public readonly isOperational: boolean;

    constructor(message: string, statusCode: number = 500, code: string = 'INTERNAL_ERROR', isOperational: boolean = true) {
        super(message);
        this.statusCode = statusCode;
        this.code = code;
        this.isOperational = isOperational;

        Object.setPrototypeOf(this, AppError.prototype);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if ((Error as any).captureStackTrace) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (Error as any).captureStackTrace(this, this.constructor);
        }
    }
}

/**
 * Errors specifically related to the Stellar Horizon API.
 */
export class HorizonError extends AppError {
    constructor(message: string, statusCode: number = 500, code: string = 'HORIZON_ERROR') {
        super(message, statusCode, code);
        Object.setPrototypeOf(this, HorizonError.prototype);
    }
}
