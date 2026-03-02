import { Module } from '@nestjs/common';
import { ProfitsController } from './profits.controller';
import { ProfitsService } from './profits.service';

@Module({
  controllers: [ProfitsController],
  providers: [ProfitsService],
  exports: [ProfitsService],
})
export class ProfitsModule {}
