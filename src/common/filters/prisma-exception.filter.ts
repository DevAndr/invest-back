import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpStatus,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Response } from 'express';

@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status: number;
    let message: string;

    switch (exception.code) {
      case 'P2002': {
        status = HttpStatus.CONFLICT;
        const fields = (exception.meta?.target as string[])?.join(', ') || 'field';
        message = `Запись с таким значением ${fields} уже существует`;
        break;
      }
      case 'P2025':
        status = HttpStatus.NOT_FOUND;
        message = 'Запись не найдена';
        break;
      case 'P2003':
        status = HttpStatus.BAD_REQUEST;
        message = 'Ошибка связи: указанная запись не существует';
        break;
      default:
        status = HttpStatus.INTERNAL_SERVER_ERROR;
        message = 'Ошибка базы данных';
    }

    response.status(status).json({
      statusCode: status,
      message,
      error: exception.code,
    });
  }
}
