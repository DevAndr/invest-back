import { PeriodType } from '@prisma/client';

export interface LatestProfitRecord {
  id: string;
  companyId: string;
  period: Date;
  periodType: PeriodType;
  revenue: number;
  netProfit: number;
  grossProfit: number | null;
  ebitda: number | null;
  margin: number | null;
  evEbitda: number | null;
  roe: number | null;
  pe: number | null;
  periodLabel: string | null;
  createdAt: Date;
  companyName: string;
  ticker: string | null;
  industry: string | null;
  country: string | null;
  logo: string | null;
}

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

type MetricStatus = 'excellent' | 'good' | 'normal' | 'poor' | 'critical';

export interface MetricAnalysis {
  value: number | null;
  status: MetricStatus | null;
  description: string;
}

export interface CompanyAnalysis {
  logo: string | null;
  companyId: string;
  companyName: string;
  ticker: string | null;
  industry: string | null;
  periodType: PeriodType;
  period: Date;
  metrics: {
    revenue: MetricAnalysis;
    netProfit: MetricAnalysis;
    grossProfit: MetricAnalysis;
    ebitda: MetricAnalysis;
    margin: MetricAnalysis;
    evEbitda: MetricAnalysis;
    roe: MetricAnalysis;
    pe: MetricAnalysis;
  };
}