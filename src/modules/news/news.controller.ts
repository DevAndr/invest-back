import { Controller, Get, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { NewsService } from './news.service';
import { NewsResponseDto } from './dto/news-item.dto';

@ApiTags('Новости')
@Controller('news')
export class NewsController {
  constructor(private readonly newsService: NewsService) {}

  @Get()
  @Public()
  @ApiOperation({ summary: 'Получить новости экономики RBC за сегодня из БД' })
  @ApiResponse({
    status: 200,
    type: NewsResponseDto,
    description: 'Список новостей за текущий день с пагинацией',
  })
  async getNews(@Query() query: PaginationQueryDto): Promise<NewsResponseDto> {
    return this.newsService.getNews(query);
  }

  @Post('parse')
  @Public()
  @ApiOperation({ summary: 'Запустить парсинг новостей вручную' })
  @ApiResponse({
    status: 201,
    description: 'Результат парсинга',
  })
  async parse(): Promise<{ saved: number; total: number }> {
    return this.newsService.parseAndSave();
  }
}
