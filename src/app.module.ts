import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER } from '@nestjs/core';
import { PrismaModule } from './modules/prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { CompaniesModule } from './modules/companies/companies.module';
import { ProfitsModule } from './modules/profits/profits.module';
import { NotesModule } from './modules/notes/notes.module';
import { PrismaExceptionFilter } from './common/filters/prisma-exception.filter';
import { ImportModule } from './modules/import/import.module';
import { TinkoffModule } from './modules/tinkoff/tinkoff.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    UsersModule,
    CompaniesModule,
    ProfitsModule,
    NotesModule,
    ImportModule,
    TinkoffModule
  ],
  providers: [
    {
      provide: APP_FILTER,
      useClass: PrismaExceptionFilter,
    },
  ],
})
export class AppModule {}
