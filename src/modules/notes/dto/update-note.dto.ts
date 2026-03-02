import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class UpdateNoteDto {
  @ApiProperty({ example: 'Обновлённый текст заметки' })
  @IsString()
  @MinLength(1)
  content: string;
}
