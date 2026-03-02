import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsNumber, IsOptional } from 'class-validator';
import { PeriodType } from '@prisma/client';

export class CreateProfitDto {
  @ApiProperty({ example: '2024-01-01' })
  @IsDateString()
  period: string;

  @ApiProperty({ enum: PeriodType, default: PeriodType.QUARTER })
  @IsEnum(PeriodType)
  periodType: PeriodType;

  @ApiProperty({ example: 94836, description: 'Выручка (в миллионах)' })
  @IsNumber()
  revenue: number;

  @ApiProperty({ example: 23636, description: 'Чистая прибыль (в миллионах)' })
  @IsNumber()
  netProfit: number;

  @ApiPropertyOptional({ example: 43000 })
  @IsOptional()
  @IsNumber()
  grossProfit?: number;

  @ApiPropertyOptional({ example: 32000 })
  @IsOptional()
  @IsNumber()
  ebitda?: number;

  @ApiPropertyOptional({ example: 12.5, description: 'EV/EBITDA' })
  @IsOptional()
  @IsNumber()
  evEbitda?: number;

  @ApiPropertyOptional({ example: 25.3, description: 'ROE, %' })
  @IsOptional()
  @IsNumber()
  roe?: number;

  @ApiPropertyOptional({ example: 18.7, description: 'P/E' })
  @IsOptional()
  @IsNumber()
  pe?: number;
}
