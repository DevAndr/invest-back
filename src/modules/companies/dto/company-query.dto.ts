import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';

export class CompanyQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Фильтр по отрасли' })
  @IsOptional()
  @IsString()
  industry?: string;

  @ApiPropertyOptional({ description: 'Фильтр по стране' })
  @IsOptional()
  @IsString()
  country?: string;
}
