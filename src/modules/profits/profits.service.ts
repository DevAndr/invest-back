import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProfitDto } from './dto/create-profit.dto';
import { ProfitQueryDto } from './dto/profit-query.dto';
import { CompareQueryDto } from './dto/compare-query.dto';
import { Prisma, Profit, PeriodType } from '@prisma/client';

export interface CompareCompany {
  id: string;
  name: string;
  ticker: string | null;
  data: (number | null)[];
  growth: number | null;
  average: number;
}

export interface CompareResponse {
  periods: string[];
  companies: CompareCompany[];
}

export interface ProfitSummary {
  company: { id: string; name: string; ticker: string | null };
  latestPeriod: {
    period: string;
    revenue: number;
    netProfit: number;
    margin: number | null;
  } | null;
  growth: {
    revenueYoY: number | null;
    profitYoY: number | null;
  };
  averageMargin: number | null;
  trend: 'growing' | 'declining' | 'stable';
  totalPeriods: number;
}

@Injectable()
export class ProfitsService {
  constructor(private readonly prisma: PrismaService) {}

  async findByCompany(companyId: string, query: ProfitQueryDto): Promise<Profit[]> {
    const where: Prisma.ProfitWhereInput = { companyId };

    if (query.from || query.to) {
      where.period = {};
      if (query.from) where.period.gte = new Date(query.from);
      if (query.to) where.period.lte = new Date(query.to);
    }

    if (query.periodType) {
      where.periodType = query.periodType;
    }

    return this.prisma.profit.findMany({
      where,
      orderBy: { period: 'asc' },
    });
  }

  async create(companyId: string, dto: CreateProfitDto): Promise<Profit> {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
    });
    if (!company) {
      throw new NotFoundException('Компания не найдена');
    }

    const margin = dto.revenue !== 0 ? (dto.netProfit / dto.revenue) * 100 : null;

    return this.prisma.profit.create({
      data: {
        companyId,
        period: new Date(dto.period),
        periodType: dto.periodType,
        revenue: dto.revenue,
        netProfit: dto.netProfit,
        grossProfit: dto.grossProfit,
        ebitda: dto.ebitda,
        margin,
        evEbitda: dto.evEbitda,
        roe: dto.roe,
        pe: dto.pe,
      },
    });
  }

  async createBulk(companyId: string, dtos: CreateProfitDto[]): Promise<{ count: number }> {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
    });
    if (!company) {
      throw new NotFoundException('Компания не найдена');
    }

    const data = dtos.map((dto) => ({
      companyId,
      period: new Date(dto.period),
      periodType: dto.periodType,
      revenue: dto.revenue,
      netProfit: dto.netProfit,
      grossProfit: dto.grossProfit,
      ebitda: dto.ebitda,
      margin: dto.revenue !== 0 ? (dto.netProfit / dto.revenue) * 100 : null,
      evEbitda: dto.evEbitda,
      roe: dto.roe,
      pe: dto.pe,
    }));

    const result = await this.prisma.profit.createMany({
      data,
      skipDuplicates: true,
    });

    return { count: result.count };
  }

  async remove(id: string): Promise<Profit> {
    const profit = await this.prisma.profit.findUnique({ where: { id } });
    if (!profit) {
      throw new NotFoundException('Запись прибыли не найдена');
    }
    return this.prisma.profit.delete({ where: { id } });
  }

  async compare(query: CompareQueryDto): Promise<CompareResponse> {
    if (!query.companyIds || query.companyIds.length === 0) {
      throw new BadRequestException('Необходимо указать хотя бы одну компанию');
    }

    const where: Prisma.ProfitWhereInput = {
      companyId: { in: query.companyIds },
    };

    if (query.from || query.to) {
      where.period = {};
      if (query.from) where.period.gte = new Date(query.from);
      if (query.to) where.period.lte = new Date(query.to);
    }

    if (query.periodType) {
      where.periodType = query.periodType;
    }

    const profits = await this.prisma.profit.findMany({
      where,
      include: { company: true },
      orderBy: { period: 'asc' },
    });

    // Собираем уникальные периоды
    const periodsSet = new Set<string>();
    for (const p of profits) {
      periodsSet.add(this.formatPeriod(p.period, p.periodType));
    }
    const periods = Array.from(periodsSet).sort();

    // Группируем по компаниям
    const companiesMap = new Map<
      string,
      { name: string; ticker: string | null; values: Map<string, number | null> }
    >();

    for (const p of profits) {
      if (!companiesMap.has(p.companyId)) {
        companiesMap.set(p.companyId, {
          name: p.company.name,
          ticker: p.company.ticker,
          values: new Map(),
        });
      }
      const periodKey = this.formatPeriod(p.period, p.periodType);
      const metricValue = this.getMetricValue(p, query.metric || 'netProfit');
      companiesMap.get(p.companyId)!.values.set(periodKey, metricValue);
    }

    const companies: CompareCompany[] = [];
    for (const [id, info] of companiesMap) {
      const data = periods.map((period) => info.values.get(period) ?? null);
      const nonNullValues = data.filter((v): v is number => v !== null);

      const first = data.find((v): v is number => v !== null);
      const last = [...data].reverse().find((v): v is number => v !== null);
      const growth =
        first != null && last != null && first !== 0
          ? ((last - first) / Math.abs(first)) * 100
          : null;

      const average =
        nonNullValues.length > 0
          ? nonNullValues.reduce((a, b) => a + b, 0) / nonNullValues.length
          : 0;

      companies.push({ id, name: info.name, ticker: info.ticker, data, growth, average });
    }

    return { periods, companies };
  }

  async summary(companyId: string): Promise<ProfitSummary> {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
    });
    if (!company) {
      throw new NotFoundException('Компания не найдена');
    }

    const profits = await this.prisma.profit.findMany({
      where: { companyId },
      orderBy: { period: 'asc' },
    });

    const totalPeriods = profits.length;

    if (totalPeriods === 0) {
      return {
        company: { id: company.id, name: company.name, ticker: company.ticker },
        latestPeriod: null,
        growth: { revenueYoY: null, profitYoY: null },
        averageMargin: null,
        trend: 'stable',
        totalPeriods: 0,
      };
    }

    const latest = profits[profits.length - 1];
    const latestPeriod = {
      period: this.formatPeriod(latest.period, latest.periodType),
      revenue: latest.revenue,
      netProfit: latest.netProfit,
      margin: latest.margin,
    };

    // YoY: сравнение последнего периода с периодом год назад
    const yoYTarget = new Date(latest.period);
    yoYTarget.setFullYear(yoYTarget.getFullYear() - 1);

    const yearAgo = profits.find(
      (p) =>
        p.periodType === latest.periodType &&
        Math.abs(p.period.getTime() - yoYTarget.getTime()) < 45 * 24 * 60 * 60 * 1000,
    );

    const revenueYoY =
      yearAgo && yearAgo.revenue !== 0
        ? ((latest.revenue - yearAgo.revenue) / Math.abs(yearAgo.revenue)) * 100
        : null;

    const profitYoY =
      yearAgo && yearAgo.netProfit !== 0
        ? ((latest.netProfit - yearAgo.netProfit) / Math.abs(yearAgo.netProfit)) * 100
        : null;

    // Средняя маржа
    const margins = profits.filter((p) => p.margin != null).map((p) => p.margin!);
    const averageMargin =
      margins.length > 0
        ? margins.reduce((a, b) => a + b, 0) / margins.length
        : null;

    // Тренд по последним 4 периодам
    const lastFour = profits.slice(-4);
    const trend = this.determineTrend(lastFour.map((p) => p.netProfit));

    return {
      company: { id: company.id, name: company.name, ticker: company.ticker },
      latestPeriod,
      growth: { revenueYoY, profitYoY },
      averageMargin,
      trend,
      totalPeriods,
    };
  }

  private formatPeriod(date: Date, periodType: PeriodType): string {
    const year = date.getFullYear();
    const month = date.getMonth() + 1;

    switch (periodType) {
      case PeriodType.YEAR:
        return `${year}`;
      case PeriodType.QUARTER:
        return `${year}-Q${Math.ceil(month / 3)}`;
      case PeriodType.MONTH:
        return `${year}-${String(month).padStart(2, '0')}`;
    }
  }

  private getMetricValue(profit: Profit, metric: string): number | null {
    switch (metric) {
      case 'revenue':
        return profit.revenue;
      case 'netProfit':
        return profit.netProfit;
      case 'grossProfit':
        return profit.grossProfit;
      case 'ebitda':
        return profit.ebitda;
      case 'margin':
        return profit.margin;
      case 'evEbitda':
        return profit.evEbitda;
      case 'roe':
        return profit.roe;
      case 'pe':
        return profit.pe;
      default:
        return profit.netProfit;
    }
  }

  private determineTrend(values: number[]): 'growing' | 'declining' | 'stable' {
    if (values.length < 2) return 'stable';

    let increases = 0;
    let decreases = 0;

    for (let i = 1; i < values.length; i++) {
      if (values[i] > values[i - 1]) increases++;
      else if (values[i] < values[i - 1]) decreases++;
    }

    if (increases > decreases) return 'growing';
    if (decreases > increases) return 'declining';
    return 'stable';
  }
}
