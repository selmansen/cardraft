import {
  Catch,
  HttpException,
  HttpStatus,
  Logger,
  type ArgumentsHost,
  type ExceptionFilter,
} from '@nestjs/common';
import type { Request, Response } from 'express';

/**
 * Tek tip hata gövdesi.
 *
 * Neden gerekli: NestJS'in varsayılan davranışında beklenen hatalar
 * (HttpException) ile beklenmeyenler (bir yerdeki TypeError) farklı şekilde
 * dışarı çıkar. Beklenmeyen hatada yığın izi (stack trace) istemciye
 * sızabilir — bu hem bir güvenlik sorunudur (iç yapıyı ifşa eder) hem de
 * istemcinin hata işlemesini imkânsız kılar (her hata farklı şekilde geliyor).
 *
 * Bu filtre: dışarı her zaman aynı şekli verir, beklenmeyen hataların
 * detayını sadece sunucu loguna yazar.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const isHttp = exception instanceof HttpException;
    const status = isHttp ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    // HttpException'ın gövdesi string ya da nesne olabilir; ikisini de tek
    // şekle indiriyoruz ki istemci her seferinde aynı alanları bulsun.
    let message: string | string[] = 'Beklenmeyen bir hata oluştu';
    if (isHttp) {
      const body = exception.getResponse();
      message =
        typeof body === 'string'
          ? body
          : ((body as { message?: string | string[] }).message ?? exception.message);
    }

    if (!isHttp) {
      // Sadece log: istemciye iç detay gitmiyor.
      this.logger.error(
        `${request.method} ${request.url} — işlenmeyen hata`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    response.status(status).json({
      statusCode: status,
      message,
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }
}
