import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import * as puppeteer from 'puppeteer';
import * as cheerio from 'cheerio';
import { PrismaService } from '../prisma/prisma.service';
import { NewsItemDto, NewsResponseDto } from './dto/news-item.dto';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';

@Injectable()
export class NewsService {
  private readonly logger = new Logger(NewsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Крон: парсинг каждые 30 минут */
  @Cron(CronExpression.EVERY_30_MINUTES)
  async handleCron(): Promise<void> {
    this.logger.log('Крон: запуск парсинга новостей...');
    try {
      const { saved, total } = await this.parseAndSave();
      this.logger.log(
        `Крон: спарсено ${total}, сохранено новых ${saved}`,
      );
    } catch (error) {
      this.logger.error(`Крон: ошибка парсинга — ${error.message}`);
    }
  }

  /** Парсит новости и сохраняет в БД, возвращает количество */
  async parseAndSave(): Promise<{ saved: number; total: number }> {
    const newsItems = await this.parseNews();

    if (newsItems.length === 0) {
      return { saved: 0, total: 0 };
    }

    const values = newsItems
      .map(
        (item) =>
          `(gen_random_uuid(), ${this.esc(item.title)}, ${this.esc(item.url)}, ${this.escNull(item.description)}, ${this.escNull(item.image)}, ${this.escNull(item.category)}, ${this.esc(item.publishedAt)}, NOW(), NOW())`,
      )
      .join(',\n');

    const result = await this.prisma.$executeRawUnsafe(`
      INSERT INTO news (id, title, url, description, image, category, "publishedAt", "parsedAt", "createdAt")
      VALUES ${values}
      ON CONFLICT (url) DO NOTHING
    `);

    return { saved: result, total: newsItems.length };
  }

  /** Получить новости из БД за сегодня с пагинацией */
  async getNews(query: PaginationQueryDto): Promise<NewsResponseDto> {
    const { page = 1, limit = 20, search, sortBy, sortOrder = 'desc' } = query;
    const skip = (page - 1) * limit;

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const where: Record<string, unknown> = { parsedAt: { gte: todayStart } };
    if (search) {
      where.title = { contains: search, mode: 'insensitive' };
    }

    const orderField = sortBy === 'title' ? 'title' : 'parsedAt';

    const [news, total] = await Promise.all([
      this.prisma.news.findMany({
        where,
        orderBy: { [orderField]: sortOrder },
        skip,
        take: limit,
      }),
      this.prisma.news.count({ where }),
    ]);

    return {
      data: news.map((n) => ({
        title: n.title,
        url: n.url,
        description: n.description,
        publishedAt: n.publishedAt,
        category: n.category,
        image: n.image,
      })),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  private async parseNews(): Promise<NewsItemDto[]> {
    this.logger.log('Запускаем парсинг новостей RBC Economics...');

    let browser: puppeteer.Browser | null = null;
    try {
      browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });

      const page = await browser.newPage();
      await page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      );

      await page.goto('https://www.rbc.ru/rubric/economics', {
        waitUntil: 'load',
        timeout: 30000,
      });

      // Ждём рендера контента
      await new Promise((r) => setTimeout(r, 5000));

      // Получаем HTML через CDP — обходим проблему с destroyed execution context
      const cdp = await page.createCDPSession();
      const { root } = await cdp.send('DOM.getDocument', { depth: -1 });
      const { outerHTML } = await cdp.send('DOM.getOuterHTML', {
        nodeId: root.nodeId,
      });

      const news = this.extractNews(outerHTML);

      this.logger.log(`Спарсено ${news.length} новостей за сегодня`);
      return news;
    } catch (error) {
      this.logger.error(`Ошибка парсинга: ${error.message}`);
      throw error;
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }

  private extractNews(html: string): NewsItemDto[] {
    const $ = cheerio.load(html);
    const today = new Date();
    const todayStr = this.formatDateLocal(today);
    const newsItems: NewsItemDto[] = [];

    // Карточки новостей — ссылки с классом info-block-title
    $('a.info-block-title').each((_, element) => {
      const $el = $(element);
      const url = this.resolveUrl($el.attr('href') || '');
      const title = $el.text().trim();

      if (!title || !url) return;

      const dateFromUrl = this.extractDateFromUrl(url);
      if (dateFromUrl !== todayStr) return;

      const $card = $el.closest('.material-card');
      const description =
        $card.find('.info-block-description').text().trim() || null;
      const dateText = $card.find('.info-block-date').text().trim();
      const category =
        $card.find('.info-block-category').text().trim() || null;
      const image = $card.find('.picture-image').attr('src') || null;

      newsItems.push({
        title,
        url: this.cleanUrl(url),
        description,
        publishedAt: dateText || todayStr,
        category,
        image,
      });
    });

    // Дополнительно: карточки через data-metronome атрибуты
    $('[data-metronome-unit="card_from_story"]').each((_, element) => {
      const $el = $(element);
      const href = $el.attr('data-metronome-href') || '';
      const title =
        $el.attr('data-metronome-text') ||
        $el.find('a.info-block-title').text().trim();
      const url = this.resolveUrl(href);

      if (!title || !url) return;

      const dateFromUrl = this.extractDateFromUrl(url);
      if (dateFromUrl !== todayStr) return;

      if (newsItems.some((n) => n.url === this.cleanUrl(url))) return;

      const description =
        $el.find('.info-block-description').text().trim() || null;
      const dateText = $el.find('.info-block-date').text().trim();
      const category =
        $el.find('.info-block-category').text().trim() || null;
      const image = $el.find('.picture-image').attr('src') || null;

      newsItems.push({
        title,
        url: this.cleanUrl(url),
        description,
        publishedAt: dateText || todayStr,
        category,
        image,
      });
    });

    // Убираем дубликаты по URL
    const uniqueNews = Array.from(
      new Map(newsItems.map((item) => [item.url, item])).values(),
    );

    return uniqueNews;
  }

  private extractDateFromUrl(url: string): string | null {
    const match = url.match(/\/(\d{2})\/(\d{2})\/(\d{4})\//);
    if (!match) return null;
    return `${match[1]}.${match[2]}.${match[3]}`;
  }

  private formatDateLocal(date: Date): string {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}.${month}.${year}`;
  }

  private resolveUrl(url: string): string {
    if (!url) return '';
    if (url.startsWith('http')) return url;
    return `https://www.rbc.ru${url}`;
  }

  private cleanUrl(url: string): string {
    try {
      const parsed = new URL(url);
      return `${parsed.origin}${parsed.pathname}`;
    } catch {
      return url;
    }
  }

  /** Экранирует строку для SQL */
  private esc(value: string): string {
    return `'${value.replace(/'/g, "''")}'`;
  }

  /** Экранирует nullable строку для SQL */
  private escNull(value: string | null): string {
    return value === null ? 'NULL' : this.esc(value);
  }
}
