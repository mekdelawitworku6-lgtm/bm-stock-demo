import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const exceptionResponse =
      exception instanceof HttpException
        ? exception.getResponse()
        : 'Internal server error';

    // Handle validation errors (ValidationPipe returns { message: string[], error, statusCode })
    let message: string | string[];
    let errors: string[] | undefined;
    let errorCode: string | undefined;

    if (typeof exceptionResponse === 'string') {
      message = exceptionResponse;
    } else if (typeof exceptionResponse === 'object') {
      const resp = exceptionResponse as any;
      if (Array.isArray(resp.message)) {
        // ValidationPipe error: message is an array of constraint violations
        message = resp.message[0] ?? 'Validation failed';
        errors = resp.message;
      } else {
        message = resp.message ?? 'An error occurred';
      }
      if (typeof resp.errorCode === 'string') {
        errorCode = resp.errorCode;
      }
    } else {
      message = 'Internal server error';
    }

    const errorResponse = {
      success: false,
      message,
      ...(errorCode ? { errorCode } : {}),
      ...(errors ? { errors } : {}),
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
    };

    this.logger.error(
      `Unhandled Exception: ${request.method} ${request.url} - ${status} | ${JSON.stringify(errors ?? message)}`,
      exception instanceof Error ? exception.stack : String(exception),
    );

    response.status(status).json(errorResponse);
  }
}