import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { NotesService } from './notes.service';
import { CreateNoteDto } from './dto/create-note.dto';
import { UpdateNoteDto } from './dto/update-note.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Notes')
@Controller()
export class NotesController {
  constructor(private readonly notesService: NotesService) {}

  @Get('companies/:id/notes')
  @ApiOperation({ summary: 'Заметки к компании' })
  @ApiResponse({ status: 200, description: 'Список заметок' })
  findByCompany(@Param('id') id: string) {
    return this.notesService.findByCompany(id);
  }

  @Post('companies/:id/notes')
  @ApiOperation({ summary: 'Создать заметку' })
  @ApiResponse({ status: 201, description: 'Заметка создана' })
  create(
    @Param('id') id: string,
    @Body() dto: CreateNoteDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.notesService.create(id, userId, dto);
  }

  @Patch('notes/:id')
  @ApiOperation({ summary: 'Редактировать заметку (только автор)' })
  @ApiResponse({ status: 200, description: 'Заметка обновлена' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateNoteDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.notesService.update(id, userId, dto);
  }

  @Delete('notes/:id')
  @ApiOperation({ summary: 'Удалить заметку (только автор)' })
  @ApiResponse({ status: 200, description: 'Заметка удалена' })
  remove(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.notesService.remove(id, userId);
  }
}
