import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateNoteDto } from './dto/create-note.dto';
import { UpdateNoteDto } from './dto/update-note.dto';
import { Note } from '@prisma/client';

@Injectable()
export class NotesService {
  constructor(private readonly prisma: PrismaService) {}

  async findByCompany(companyId: string): Promise<Note[]> {
    return this.prisma.note.findMany({
      where: { companyId },
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(
    companyId: string,
    userId: string,
    dto: CreateNoteDto,
  ): Promise<Note> {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
    });
    if (!company) {
      throw new NotFoundException('Компания не найдена');
    }

    return this.prisma.note.create({
      data: {
        content: dto.content,
        companyId,
        userId,
      },
      include: { user: { select: { id: true, name: true, email: true } } },
    });
  }

  async update(id: string, userId: string, dto: UpdateNoteDto): Promise<Note> {
    const note = await this.prisma.note.findUnique({ where: { id } });
    if (!note) {
      throw new NotFoundException('Заметка не найдена');
    }
    if (note.userId !== userId) {
      throw new ForbiddenException('Можно редактировать только свои заметки');
    }

    return this.prisma.note.update({
      where: { id },
      data: { content: dto.content },
      include: { user: { select: { id: true, name: true, email: true } } },
    });
  }

  async remove(id: string, userId: string): Promise<Note> {
    const note = await this.prisma.note.findUnique({ where: { id } });
    if (!note) {
      throw new NotFoundException('Заметка не найдена');
    }
    if (note.userId !== userId) {
      throw new ForbiddenException('Можно удалять только свои заметки');
    }

    return this.prisma.note.delete({ where: { id } });
  }
}
