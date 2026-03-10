import { ApiProperty } from '@nestjs/swagger';

export class NewsItemDto {
  @ApiProperty({ description: 'Заголовок новости' })
  title: string;

  @ApiProperty({ description: 'Ссылка на новость' })
  url: string;

  @ApiProperty({ description: 'Краткое описание', nullable: true })
  description: string | null;

  @ApiProperty({ description: 'Дата и время публикации' })
  publishedAt: string;

  @ApiProperty({ description: 'Категория новости', nullable: true })
  category: string | null;

  @ApiProperty({ description: 'URL изображения новости', nullable: true })
  image: string | null;
}

export class PaginatedNewsMetaDto {
  @ApiProperty() total: number;
  @ApiProperty() page: number;
  @ApiProperty() limit: number;
  @ApiProperty() totalPages: number;
}

export class NewsResponseDto {
  @ApiProperty({ type: [NewsItemDto], description: 'Список новостей' })
  data: NewsItemDto[];

  @ApiProperty({ type: PaginatedNewsMetaDto })
  meta: PaginatedNewsMetaDto;
}
