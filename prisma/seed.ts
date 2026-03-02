import 'dotenv/config';
import { PrismaClient, PeriodType } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  // Очистка
  await prisma.note.deleteMany();
  await prisma.profit.deleteMany();
  await prisma.company.deleteMany();
  await prisma.user.deleteMany();

  // Пользователи
  const password = await bcrypt.hash('password123', 10);

  const user1 = await prisma.user.create({
    data: {
      email: 'analyst@example.com',
      password,
      name: 'Иван Аналитиков',
    },
  });

  const user2 = await prisma.user.create({
    data: {
      email: 'investor@example.com',
      password,
      name: 'Мария Инвесторова',
    },
  });

  // Компании
  const companies = await Promise.all([
    prisma.company.create({
      data: { name: 'Apple Inc.', ticker: 'AAPL', industry: 'Technology', country: 'USA' },
    }),
    prisma.company.create({
      data: { name: 'Microsoft Corporation', ticker: 'MSFT', industry: 'Technology', country: 'USA' },
    }),
    prisma.company.create({
      data: { name: 'Tesla Inc.', ticker: 'TSLA', industry: 'Automotive', country: 'USA' },
    }),
    prisma.company.create({
      data: { name: 'Amazon.com Inc.', ticker: 'AMZN', industry: 'E-Commerce', country: 'USA' },
    }),
    prisma.company.create({
      data: { name: 'Alphabet Inc.', ticker: 'GOOGL', industry: 'Technology', country: 'USA' },
    }),
    prisma.company.create({
      data: { name: 'Газпром', ticker: 'GAZP', industry: 'Energy', country: 'Russia' },
    }),
    prisma.company.create({
      data: { name: 'Сбербанк', ticker: 'SBER', industry: 'Finance', country: 'Russia' },
    }),
    prisma.company.create({
      data: { name: 'Яндекс', ticker: 'YNDX', industry: 'Technology', country: 'Russia' },
    }),
    prisma.company.create({
      data: { name: 'Samsung Electronics', ticker: 'SMSN', industry: 'Technology', country: 'South Korea' },
    }),
    prisma.company.create({
      data: { name: 'Toyota Motor', ticker: 'TM', industry: 'Automotive', country: 'Japan' },
    }),
    prisma.company.create({
      data: { name: 'NVIDIA Corporation', ticker: 'NVDA', industry: 'Technology', country: 'USA' },
    }),
    prisma.company.create({
      data: { name: 'Meta Platforms', ticker: 'META', industry: 'Technology', country: 'USA' },
    }),
  ]);

  // Данные прибыли — поквартально 2020-2024
  // Все значения в миллионах USD
  const profitData: Record<string, { baseRevenue: number; baseProfit: number; growthRate: number }> = {
    AAPL: { baseRevenue: 65000, baseProfit: 13000, growthRate: 0.06 },
    MSFT: { baseRevenue: 38000, baseProfit: 12000, growthRate: 0.12 },
    TSLA: { baseRevenue: 6000, baseProfit: -100, growthRate: 0.35 },
    AMZN: { baseRevenue: 75000, baseProfit: 2500, growthRate: 0.18 },
    GOOGL: { baseRevenue: 41000, baseProfit: 8000, growthRate: 0.15 },
    GAZP: { baseRevenue: 25000, baseProfit: 5000, growthRate: 0.03 },
    SBER: { baseRevenue: 12000, baseProfit: 3000, growthRate: 0.08 },
    YNDX: { baseRevenue: 800, baseProfit: 100, growthRate: 0.25 },
    SMSN: { baseRevenue: 50000, baseProfit: 6000, growthRate: 0.05 },
    TM: { baseRevenue: 65000, baseProfit: 5000, growthRate: 0.04 },
    NVDA: { baseRevenue: 3000, baseProfit: 600, growthRate: 0.45 },
    META: { baseRevenue: 21000, baseProfit: 7000, growthRate: 0.1 },
  };

  for (const company of companies) {
    const ticker = company.ticker!;
    const config = profitData[ticker];
    if (!config) continue;

    const profits: {
      companyId: string;
      period: Date;
      periodType: PeriodType;
      revenue: number;
      netProfit: number;
      grossProfit: number;
      ebitda: number;
      margin: number;
    }[] = [];

    for (let year = 2020; year <= 2024; year++) {
      for (let quarter = 1; quarter <= 4; quarter++) {
        const quarterIndex = (year - 2020) * 4 + (quarter - 1);
        const growthFactor = Math.pow(1 + config.growthRate / 4, quarterIndex);

        // Сезонность: Q4 обычно сильнее, Q1 слабее
        const seasonality = [0.9, 0.95, 1.0, 1.15][quarter - 1];

        // Случайный шум ±5%
        const noise = 0.95 + Math.random() * 0.1;

        const revenue = Math.round(config.baseRevenue * growthFactor * seasonality * noise);
        const netProfit = Math.round(config.baseProfit * growthFactor * seasonality * noise);
        const grossProfit = Math.round(revenue * (0.35 + Math.random() * 0.15));
        const ebitda = Math.round(netProfit * (1.3 + Math.random() * 0.4));
        const margin = revenue !== 0 ? Math.round((netProfit / revenue) * 10000) / 100 : 0;

        const month = (quarter - 1) * 3 + 1;
        profits.push({
          companyId: company.id,
          period: new Date(year, month - 1, 1),
          periodType: PeriodType.QUARTER,
          revenue,
          netProfit,
          grossProfit,
          ebitda,
          margin,
        });
      }
    }

    await prisma.profit.createMany({ data: profits });
  }

  // Заметки
  const noteData = [
    { companyIdx: 0, userIdx: 0, content: 'Apple стабильно наращивает выручку от сервисов. Маржинальность растёт.' },
    { companyIdx: 1, userIdx: 0, content: 'Microsoft — сильный рост облачного сегмента Azure. Диверсифицированный бизнес.' },
    { companyIdx: 2, userIdx: 1, content: 'Tesla — высокая волатильность, но тренд на рост производства. Следить за маржой.' },
    { companyIdx: 3, userIdx: 1, content: 'Amazon — AWS остаётся главным драйвером прибыли. Ритейл на грани рентабельности.' },
    { companyIdx: 4, userIdx: 0, content: 'Google — рекламный бизнес доминирует, но AI-инвестиции увеличивают расходы.' },
    { companyIdx: 5, userIdx: 1, content: 'Газпром — зависит от цен на газ и геополитической ситуации.' },
    { companyIdx: 6, userIdx: 0, content: 'Сбербанк — лидер банковского сектора РФ. Стабильные дивиденды.' },
    { companyIdx: 10, userIdx: 1, content: 'NVIDIA — бенефициар AI-бума. Экспоненциальный рост выручки от дата-центров.' },
  ];

  for (const note of noteData) {
    await prisma.note.create({
      data: {
        content: note.content,
        companyId: companies[note.companyIdx].id,
        userId: note.userIdx === 0 ? user1.id : user2.id,
      },
    });
  }

  console.log('Seed completed successfully!');
  console.log(`Created: 2 users, ${companies.length} companies, ${companies.length * 20} profit records, ${noteData.length} notes`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
