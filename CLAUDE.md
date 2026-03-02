# CLAUDE.md — Backend Profit Analyzer (NestJS + Prisma)

## Обзор проекта

Бэкенд для приложения "Анализатор прибыли компаний". REST API на NestJS с Prisma ORM и PostgreSQL. Позволяет управлять компаниями, их финансовыми данными, строить сравнения и оставлять заметки.

---

## Стек технологий

- **Runtime:** Node.js 20+
- **Framework:** NestJS 10+
- **ORM:** Prisma 5+
- **База данных:** PostgreSQL 15+
- **Валидация:** class-validator + class-transformer
- **Документация API:** Swagger (@nestjs/swagger)
- **Аутентификация:** JWT (@nestjs/jwt + @nestjs/passport)
- **Тесты:** Jest + Supertest

---

## Структура проекта

```
src/
├── app.module.ts
├── main.ts
├── common/
│   ├── decorators/          # Кастомные декораторы (@CurrentUser, @ApiPaginated)
│   ├── dto/                 # Общие DTO (pagination.dto.ts, date-range.dto.ts)
│   ├── filters/             # Exception filters (prisma-exception.filter.ts)
│   ├── guards/              # Auth guards (jwt-auth.guard.ts)
│   ├── interceptors/        # Transform, logging interceptors
│   ├── pipes/               # Кастомные pipes
│   └── utils/               # Хелперы (date utils, math)
├── modules/
│   ├── auth/
│   │   ├── auth.module.ts
│   │   ├── auth.controller.ts
│   │   ├── auth.service.ts
│   │   ├── dto/
│   │   │   ├── login.dto.ts
│   │   │   └── register.dto.ts
│   │   ├── strategies/
│   │   │   └── jwt.strategy.ts
│   │   └── guards/
│   │       └── jwt-auth.guard.ts
│   ├── users/
│   │   ├── users.module.ts
│   │   ├── users.service.ts
│   │   └── dto/
│   ├── companies/
│   │   ├── companies.module.ts
│   │   ├── companies.controller.ts
│   │   ├── companies.service.ts
│   │   └── dto/
│   │       ├── create-company.dto.ts
│   │       ├── update-company.dto.ts
│   │       └── company-query.dto.ts
│   ├── profits/
│   │   ├── profits.module.ts
│   │   ├── profits.controller.ts
│   │   ├── profits.service.ts
│   │   └── dto/
│   │       ├── create-profit.dto.ts
│   │       ├── profit-query.dto.ts
│   │       └── compare-query.dto.ts
│   ├── notes/
│   │   ├── notes.module.ts
│   │   ├── notes.controller.ts
│   │   ├── notes.service.ts
│   │   └── dto/
│   │       ├── create-note.dto.ts
│   │       └── update-note.dto.ts
│   └── prisma/
│       ├── prisma.module.ts
│       └── prisma.service.ts
prisma/
├── schema.prisma
├── migrations/
└── seed.ts
test/
├── app.e2e-spec.ts
└── factories/               # Фабрики тестовых данных
```

---

## Схема базы данных (Prisma)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id        String   @id @default(cuid())
  email     String   @unique
  password  String
  name      String?
  notes     Note[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@map("users")
}

model Company {
  id        String   @id @default(cuid())
  name      String
  ticker    String?  @unique
  industry  String?
  country   String?
  logo      String?
  profits   Profit[]
  notes     Note[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([industry])
  @@index([ticker])
  @@map("companies")
}

model Profit {
  id          String     @id @default(cuid())
  companyId   String
  company     Company    @relation(fields: [companyId], references: [id], onDelete: Cascade)
  period      DateTime
  periodType  PeriodType @default(QUARTER)
  revenue     Float
  netProfit   Float
  grossProfit Float?
  ebitda      Float?
  margin      Float?
  createdAt   DateTime   @default(now())

  @@unique([companyId, period, periodType])
  @@index([companyId, period])
  @@map("profits")
}

model Note {
  id        String   @id @default(cuid())
  content   String
  companyId String
  company   Company  @relation(fields: [companyId], references: [id], onDelete: Cascade)
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([companyId])
  @@index([userId])
  @@map("notes")
}

enum PeriodType {
  MONTH
  QUARTER
  YEAR
}
```

---

## API-эндпоинты

### Auth
| Метод | Путь | Описание |
|-------|------|----------|
| POST | `/auth/register` | Регистрация |
| POST | `/auth/login` | Логин, возвращает JWT |
| GET | `/auth/me` | Текущий пользователь |

### Companies
| Метод | Путь | Описание |
|-------|------|----------|
| GET | `/companies` | Список компаний (пагинация, поиск, фильтр по industry) |
| GET | `/companies/:id` | Детали компании |
| POST | `/companies` | Создать компанию |
| PATCH | `/companies/:id` | Обновить компанию |
| DELETE | `/companies/:id` | Удалить компанию |

### Profits
| Метод | Путь | Описание |
|-------|------|----------|
| GET | `/companies/:id/profits` | Данные прибыли компании (`?from=&to=&periodType=`) |
| POST | `/companies/:id/profits` | Добавить запись прибыли |
| POST | `/companies/:id/profits/bulk` | Массовый импорт данных |
| DELETE | `/profits/:id` | Удалить запись |
| GET | `/profits/compare` | Сравнение компаний (`?companyIds=id1,id2&from=&to=&periodType=&metric=netProfit`) |
| GET | `/profits/summary/:companyId` | Сводка: рост, средняя маржа, тренд |

### Notes
| Метод | Путь | Описание |
|-------|------|----------|
| GET | `/companies/:id/notes` | Заметки к компании |
| POST | `/companies/:id/notes` | Создать заметку |
| PATCH | `/notes/:id` | Редактировать заметку (только автор) |
| DELETE | `/notes/:id` | Удалить заметку (только автор) |

---

## Форматы DTO

### Pagination (общий)
```typescript
class PaginationQueryDto {
  @IsOptional() @IsInt() @Min(1)    page?: number = 1;
  @IsOptional() @IsInt() @Min(1) @Max(100) limit?: number = 20;
  @IsOptional() @IsString()          search?: string;
  @IsOptional() @IsString()          sortBy?: string;
  @IsOptional() @IsIn(['asc','desc']) sortOrder?: 'asc' | 'desc' = 'desc';
}
```

### Ответ пагинации
```typescript
interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}
```

### CreateProfitDto
```typescript
class CreateProfitDto {
  @IsDateString()           period: string;
  @IsEnum(PeriodType)       periodType: PeriodType;
  @IsNumber()               revenue: number;
  @IsNumber()               netProfit: number;
  @IsOptional() @IsNumber() grossProfit?: number;
  @IsOptional() @IsNumber() ebitda?: number;
}
```

### CompareQueryDto
```typescript
class CompareQueryDto {
  @IsArray() @IsString({ each: true })
  companyIds: string[];

  @IsOptional() @IsDateString() from?: string;
  @IsOptional() @IsDateString() to?: string;
  @IsOptional() @IsEnum(PeriodType) periodType?: PeriodType;
  @IsOptional() @IsIn(['revenue', 'netProfit', 'grossProfit', 'ebitda', 'margin'])
  metric?: string = 'netProfit';
}
```

---

## Правила и конвенции кода

### Общие
- **Язык кода:** TypeScript strict mode
- **Язык комментариев и документации:** русский
- **Именование файлов:** kebab-case (`create-company.dto.ts`)
- **Именование классов:** PascalCase (`CompaniesService`)
- **Именование переменных/методов:** camelCase

### NestJS-специфичные
- Каждый модуль автономен — содержит свои controller, service, dto
- Используй `PrismaService` через DI, не создавай экземпляры PrismaClient вручную
- Все входные данные валидируются через DTO + `class-validator`
- Используй `ValidationPipe` глобально в `main.ts`
- Swagger-декораторы на каждом контроллере и DTO (`@ApiTags`, `@ApiOperation`, `@ApiResponse`)
- Используй `@ApiProperty()` на каждом поле DTO для Swagger

### Prisma-специфичные
- Не используй raw SQL без крайней необходимости
- Для транзакций используй `prisma.$transaction()`
- Мягкое удаление НЕ используем — удаляем через `onDelete: Cascade`
- Индексы на полях, по которым часто фильтруем/сортируем
- Seed-файл (`prisma/seed.ts`) должен содержать тестовые компании с реалистичными данными прибыли за 3–5 лет

### Обработка ошибок
- Используй стандартные NestJS-исключения (`NotFoundException`, `BadRequestException`, `ConflictException`)
- Создай `PrismaExceptionFilter` для перехвата ошибок Prisma (P2002 → ConflictException, P2025 → NotFoundException)
- Все ответы должны быть в едином формате

### Безопасность
- Пароли хешируются через `bcrypt` (10 раундов)
- JWT токен в `Authorization: Bearer <token>`
- Эндпоинты модификации данных защищены `JwtAuthGuard`
- GET-эндпоинты списков и сравнений — публичные (без авторизации)
- Заметки — только автор может редактировать/удалять свои

---

## Переменные окружения (.env)

```env
DATABASE_URL="postgresql://user:password@localhost:5432/profit_analyzer"
JWT_SECRET="your-secret-key-min-32-chars"
JWT_EXPIRATION="7d"
PORT=3030
NODE_ENV="development"
CORS_ORIGIN="http://localhost:3000"
```

---

## Команды

```bash
# Установка
npm install

# Запуск dev
npm run start:dev

# Prisma
npx prisma generate          # Генерация клиента
npx prisma migrate dev       # Создание/применение миграции
npx prisma db seed           # Заполнение тестовыми данными
npx prisma studio            # Визуальный просмотр БД

# Тесты
npm run test                 # Unit-тесты
npm run test:e2e             # E2E-тесты

# Сборка
npm run build
npm run start:prod
```

---

## Seed-данные

Seed должен создать:
- 2 тестовых пользователя
- 10–15 компаний из разных индустрий (Apple, Microsoft, Tesla, Газпром, Сбербанк и т.д.)
- Данные прибыли за 2020–2024 поквартально для каждой компании (реалистичные, с трендами роста/падения)
- 5–10 заметок к разным компаниям

---

## Логика сравнения (`/profits/compare`)

Эндпоинт принимает массив `companyIds`, диапазон дат и метрику. Возвращает данные в формате, удобном для графиков:

```typescript
interface CompareResponse {
  periods: string[];                    // ["2023-Q1", "2023-Q2", ...]
  companies: {
    id: string;
    name: string;
    ticker: string | null;
    data: (number | null)[];            // Значения метрики по периодам, null если нет данных
    growth: number | null;              // % изменения от первого к последнему периоду
    average: number;                    // Среднее значение метрики
  }[];
}
```

---

## Логика сводки (`/profits/summary/:companyId`)

```typescript
interface ProfitSummary {
  company: { id: string; name: string; ticker: string | null };
  latestPeriod: {
    period: string;
    revenue: number;
    netProfit: number;
    margin: number | null;
  };
  growth: {
    revenueYoY: number | null;         // % год к году
    profitYoY: number | null;
  };
  averageMargin: number | null;
  trend: 'growing' | 'declining' | 'stable';  // На основе последних 4 периодов
  totalPeriods: number;
}
```

---

## Настройка main.ts

```typescript
async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Глобальный префикс
  app.setGlobalPrefix('api');

  // CORS
  app.enableCors({ origin: process.env.CORS_ORIGIN });

  // Валидация
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    transformOptions: { enableImplicitConversion: true },
  }));

  // Swagger
  const config = new DocumentBuilder()
    .setTitle('Profit Analyzer API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, config));

  await app.listen(process.env.PORT || 3001);
}
```

---

## Важные моменты для Claude Code

1. **При создании нового модуля** — всегда регистрируй его в `app.module.ts`
2. **При изменении schema.prisma** — запускай `npx prisma generate` и создавай миграцию
3. **Не дублируй логику** — общие утилиты выноси в `common/`
4. **Тесты** — пиши unit-тесты для сервисов, e2e для контроллеров
5. **Маржа** — рассчитывается как `(netProfit / revenue) * 100`, сохраняй в поле `margin` при создании Profit
6. **Тренд** — определяется по линейной регрессии или простому сравнению последних 4 периодов
7. **При ошибках Prisma** — оборачивай в понятные HTTP-исключения через фильтр
8. **Все числовые значения прибыли** — хранятся в миллионах (для единообразия)

## Что НЕ делать

- Не использовать `any` в TypeScript