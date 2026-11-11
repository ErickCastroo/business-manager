export type ErrorDetails = Readonly<Record<string, unknown>>;

type AppErrorOptions = {
  code: string;
  details?: ErrorDetails;
  message: string;
  statusCode: number;
};

export class AppError extends Error {
  readonly code: string;
  readonly details: ErrorDetails | undefined;
  readonly statusCode: number;

  constructor({ code, details, message, statusCode }: AppErrorOptions) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.details = details;
    this.statusCode = statusCode;

    Error.captureStackTrace(this, AppError);
  }
}
