import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsString,
  IsOptional,
  IsDateString,
  IsEnum,
  IsIn,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { PeriodType } from '@prisma/client';

export class CompareQueryDto {
  @ApiProperty({
    description: 'ID компаний через запятую',
    example: 'id1,id2',
  })
  @IsArray()
  @IsString({ each: true })
  @Transform(({ value }) => (typeof value === 'string' ? value.split(',') : value))
  companyIds: string[];

  @ApiPropertyOptional({ example: '2020-01-01' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ example: '2024-12-31' })
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiPropertyOptional({ enum: PeriodType })
  @IsOptional()
  @IsEnum(PeriodType)
  periodType?: PeriodType;

  @ApiPropertyOptional({
    enum: ['revenue', 'netProfit', 'grossProfit', 'ebitda', 'margin', 'evEbitda', 'roe', 'pe'],
    default: 'netProfit',
  })
  @IsOptional()
  @IsIn(['revenue', 'netProfit', 'grossProfit', 'ebitda', 'margin', 'evEbitda', 'roe', 'pe'])
  metric?: string = 'netProfit';
}
