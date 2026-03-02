// src/modules/import/import.controller.ts

import {
  Controller,
  Post,
  UploadedFile,
  UploadedFiles,
  UseInterceptors,
  BadRequestException,
  Body,
  Param,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
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

  /**
   * Массовый импорт нескольких CSV файлов. Каждый файл — отдельная компания.
   * Для каждого файла создаётся/находится компания по тикеру и импортируются данные.
   * Метаданные компаний передаются JSON-массивом в поле `companies`.
   */
  @Post('batch')
  @UseInterceptors(FilesInterceptor('files', 50))
  @ApiOperation({ summary: 'Массовый импорт нескольких CSV файлов' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        files: {
          type: 'array',
          items: { type: 'string', format: 'binary' },
        },
        companies: {
          type: 'string',
          description: 'JSON-массив: [{"companyName":"Apple","ticker":"AAPL","industry":"Technology"}, ...]',
          example: '[{"companyName":"Apple","ticker":"AAPL"}]',
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Результат импорта по каждому файлу',
  })
  async importBatch(
    @UploadedFiles() files: Express.Multer.File[],
    @Body('companies') companiesRaw: string,
  ) {
    if (!files || files.length === 0) {
      throw new BadRequestException('Файлы не загружены');
    }

    let companiesMeta: { companyName: string; ticker?: string; industry?: string }[];
    try {
      companiesMeta = JSON.parse(companiesRaw);
    } catch {
      throw new BadRequestException('Поле companies должно быть валидным JSON-массивом');
    }

    if (!Array.isArray(companiesMeta) || companiesMeta.length !== files.length) {
      throw new BadRequestException(
        `Количество файлов (${files.length}) не совпадает с количеством записей в companies (${companiesMeta?.length ?? 0})`,
      );
    }

    const results: {
      fileName: string;
      company: { id: string; name: string; ticker: string | null };
      imported: number;
      skipped: number;
      errors: string[];
    }[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const meta = companiesMeta[i];

      this.validateFile(file);

      if (!meta.companyName?.trim()) {
        results.push({
          fileName: file.originalname,
          company: { id: '', name: '', ticker: null },
          imported: 0,
          skipped: 0,
          errors: ['companyName обязателен'],
        });
        continue;
      }

      let company;
      if (meta.ticker) {
        company = await this.prisma.company.upsert({
          where: { ticker: meta.ticker },
          update: { name: meta.companyName.trim(), industry: meta.industry },
          create: { name: meta.companyName.trim(), ticker: meta.ticker, industry: meta.industry },
        });
      } else {
        company = await this.prisma.company.create({
          data: { name: meta.companyName.trim(), industry: meta.industry },
        });
      }

      const content = file.buffer.toString('utf-8');
      const records = this.csvParser.parseSmartLabCsv(content);
      const result = await this.upsertRecords(company.id, records);

      results.push({
        fileName: file.originalname,
        company: { id: company.id, name: company.name, ticker: company.ticker },
        ...result,
      });
    }

    return {
      totalFiles: files.length,
      results,
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
          evEbitda: record.evEbitda,
          roe: record.roe,
          pe: record.pe,
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
            evEbitda: record.evEbitda,
            roe: record.roe,
            pe: record.pe,
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