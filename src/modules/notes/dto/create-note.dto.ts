import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class CreateNoteDto {
  @ApiProperty({ example: 'Компания показывает стабильный рост выручки' })
  @IsString()
  @MinLength(1)
  content: string;
}
