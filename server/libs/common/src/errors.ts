import { Logger } from '@nestjs/common';

export function createLogger(name: string): Logger {
  return new Logger(name);
}

export class AppError extends Error {
  constructor(
    message: string,
    readonly statusCode: number = 500,
    readonly code: string = 'internal_error',
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Not found') {
    super(message, 404, 'not_found');
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') {
    super(message, 403, 'forbidden');
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super(message, 401, 'unauthorized');
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Conflict') {
    super(message, 409, 'conflict');
  }
}

export class LimitReachedError extends AppError {
  constructor(message = 'Limit reached') {
    super(message, 422, 'limit_reached');
  }
}
