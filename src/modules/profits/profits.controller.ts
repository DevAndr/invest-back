import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { ProfitsService } from './profits.service';
import { CreateProfitDto } from './dto/create-profit.dto';
import { ProfitQueryDto } from './dto/profit-query.dto';
import { CompareQueryDto } from './dto/compare-query.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Profits')
@Controller()
export class ProfitsController {
  constructor(private readonly profitsService: ProfitsService) {}

  @Get('companies/:id/profits')
  @ApiOperation({ summary: 'Данные прибыли компании' })
  @ApiResponse({ status: 200, description: 'Список записей прибыли' })
  findByCompany(@Param('id') id: string, @Query() query: ProfitQueryDto) {
    return this.profitsService.findByCompany(id, query);
  }

  @Post('companies/:id/profits')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Добавить запись прибыли' })
  @ApiResponse({ status: 201, description: 'Запись создана' })
  create(@Param('id') id: string, @Body() dto: CreateProfitDto) {
    return this.profitsService.create(id, dto);
  }

  @Post('companies/:id/profits/bulk')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Массовый импорт данных прибыли' })
  @ApiResponse({ status: 201, description: 'Записи созданы' })
  createBulk(@Param('id') id: string, @Body() dtos: CreateProfitDto[]) {
    return this.profitsService.createBulk(id, dtos);
  }

  @Delete('profits/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Удалить запись прибыли' })
  @ApiResponse({ status: 200, description: 'Запись удалена' })
  remove(@Param('id') id: string) {
    return this.profitsService.remove(id);
  }

  @Get('profits/analysis')
  @ApiOperation({ summary: 'Анализ экономических показателей по последним данным каждой компании' })
  @ApiResponse({ status: 200, description: 'Анализ показателей' })
  analyze() {
    return this.profitsService.analyze();
  }

  @Get('profits/latest')
  @ApiOperation({ summary: 'Последние данные прибыли по каждой компании и типу периода' })
  @ApiResponse({ status: 200, description: 'Список последних записей' })
  getLatestByCompany() {
    return this.profitsService.getLatestByCompany();
  }

  @Get('profits/compare')
  @ApiOperation({ summary: 'Сравнение компаний по метрике' })
  @ApiResponse({ status: 200, description: 'Данные для сравнения' })
  compare(@Query() query: CompareQueryDto) {
    return this.profitsService.compare(query);
  }

  @Get('profits/metrics/:companyId')
  @ApiOperation({ summary: 'Массив данных по каждому экономическому показателю компании' })
  @ApiResponse({ status: 200, description: 'Данные метрик по периодам' })
  metricsByCompany(@Param('companyId') companyId: string) {
    return this.profitsService.metricsByCompany(companyId);
  }

  @Get('profits/summary/:companyId')
  @ApiOperation({ summary: 'Сводка по компании' })
  @ApiResponse({ status: 200, description: 'Сводка: рост, маржа, тренд' })
  summary(@Param('companyId') companyId: string) {
    return this.profitsService.summary(companyId);
  }
}
