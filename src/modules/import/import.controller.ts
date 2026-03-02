// src/modules/import/import.controller.ts

import {
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
  Body,
  Param,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiConsumes,
  ApiBody,
  ApiResponse,
  ApiParam,
} from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';
import { CsvParserService, ParsedProfitRecord } from './csv-parser.service';

@ApiTags('Import')
@Controller('import')
export class ImportController {
  constructor(
    private readonly csvParser: CsvParserService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Загрузка CSV и предпросмотр распарсенных данных (без сохранения в БД).
   */
  @Post('preview')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Предпросмотр CSV — парсинг без сохранения' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  async previewCsv(
    @UploadedFile() file: Express.Multer.File,
  ): Promise<{
    totalRecords: number;
    periods: string[];
    data: ParsedProfitRecord[];
  }> {
    this.validateFile(file);

    const content = file.buffer.toString('utf-8');
    const records = this.csvParser.parseSmartLabCsv(content);

    return {
      totalRecords: records.length,
      periods: records.map((r) => r.periodLabel),
      data: records,
    };
  }

  /**
   * Импорт CSV данных прибыли в существующую компанию.
   */
  @Post('companies/:companyId/csv')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Импорт CSV данных прибыли в компанию' })
  @ApiParam({ name: 'companyId', description: 'ID компании' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  async importCsv(
    @Param('companyId') companyId: string,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<{ imported: number; skipped: number; errors: string[] }> {
    this.validateFile(file);

    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
    });

    if (!company) {
      throw new BadRequestException(`Компания с ID ${companyId} не найдена`);
    }

    const content = file.buffer.toString('utf-8');
    const records = this.csvParser.parseSmartLabCsv(content);

    return this.upsertRecords(companyId, records);
  }

  /**
   * Импорт CSV с автоматическим созданием компании.
   */
  @Post('csv')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Импорт CSV с автосозданием компании' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        companyName: { type: 'string', example: 'ФосАгро' },
        ticker: { type: 'string', example: 'PHOR' },
        industry: { type: 'string', example: 'Химия' },
      },
    },
  })
  async importCsvWithCompany(
    @UploadedFile() file: Express.Multer.File,
    @Body('companyName') companyName: string,
    @Body('ticker') ticker?: string,
    @Body('industry') industry?: string,
  ) {
    this.validateFile(file);

    if (!companyName?.trim()) {
      throw new BadRequestException('companyName обязателен');
    }

    // Создаём или находим компанию по тикеру
    let company;
    if (ticker) {
      company = await this.prisma.company.upsert({
        where: { ticker },
        update: { name: companyName.trim(), industry },
        create: { name: companyName.trim(), ticker, industry },
      });
    } else {
      company = await this.prisma.company.create({
        data: { name: companyName.trim(), ticker, industry },
      });
    }

    const content = file.buffer.toString('utf-8');
    const records = this.csvParser.parseSmartLabCsv(content);
    const result = await this.upsertRecords(company.id, records);

    return {
      company: { id: company.id, name: company.name },
      ...result,
    };
  }

  // ─── Helpers ──────────────────────────────────────────────────────

  private async upsertRecords(
    companyId: string,
    records: ParsedProfitRecord[],
  ): Promise<{ imported: number; skipped: number; errors: string[] }> {
    let imported = 0;
    let skipped = 0;
    const errors: string[] = [];

    // Батч через транзакцию
    const operations = records
      .filter((r) => r.revenue !== null || r.netProfit !== null)
      .map((record) => {
        const period = new Date(record.period);
        const data = {
          revenue: record.revenue ?? 0,
          netProfit: record.netProfit ?? 0,
          grossProfit: record.grossProfit,
          ebitda: record.ebitda,
          margin: record.margin,
        };

        return this.prisma.profit.upsert({
          where: {
            companyId_period_periodType: {
              companyId,
              period,
              periodType: 'QUARTER',
            },
          },
          update: data,
          create: { companyId, period, periodType: 'QUARTER', ...data },
        });
      });

    try {
      await this.prisma.$transaction(operations);
      imported = operations.length;
    } catch {
      // Fallback: по одной записи
      for (const record of records) {
        try {
          const period = new Date(record.period);
          const data = {
            revenue: record.revenue ?? 0,
            netProfit: record.netProfit ?? 0,
            grossProfit: record.grossProfit,
            ebitda: record.ebitda,
            margin: record.margin,
          };

          await this.prisma.profit.upsert({
            where: {
              companyId_period_periodType: {
                companyId,
                period,
                periodType: 'QUARTER',
              },
            },
            update: data,
            create: { companyId, period, periodType: 'QUARTER', ...data },
          });
          imported++;
        } catch (err) {
          skipped++;
          errors.push(
            `${record.periodLabel}: ${err instanceof Error ? err.message : 'Ошибка'}`,
          );
        }
      }
    }

    return { imported, skipped, errors };
  }

  private validateFile(file: Express.Multer.File): void {
    if (!file) {
      throw new BadRequestException('Файл не загружен');
    }

    const isValidName = file.originalname?.endsWith('.csv');
    const allowedMime = ['text/csv', 'text/plain', 'application/csv'];

    if (!allowedMime.includes(file.mimetype) && !isValidName) {
      throw new BadRequestException('Допустимы только CSV файлы');
    }

    if (file.size > 10 * 1024 * 1024) {
      throw new BadRequestException('Файл превышает 10MB');
    }
  }
}