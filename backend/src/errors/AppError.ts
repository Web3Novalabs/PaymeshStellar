export class AppError extends Error {
  public statusCode: number;
  public publicMessage: string;
  public cause?: unknown;

  constructor(statusCode: number, publicMessage: string, cause?: unknown) {
    super(publicMessage, cause instanceof Error ? { cause } : undefined);
    this.statusCode = statusCode;
    this.publicMessage = publicMessage;
    this.cause = cause;
    this.name = 'AppError';

    if (cause instanceof Error && cause.stack) {
      this.stack = cause.stack;
    }
  }
}
