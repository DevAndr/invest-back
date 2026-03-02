import { Module } from '@nestjs/common';
import { ImportController } from './import.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { CsvParserService } from './csv-parser.service';

@Module({
  imports: [PrismaModule],
  controllers: [ImportController],
  providers: [CsvParserService],
  exports: [CsvParserService],
})
export class ImportModule {}