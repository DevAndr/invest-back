import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { CompaniesService } from './companies.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { CompanyQueryDto } from './dto/company-query.dto';

@ApiTags('Companies')
@Controller('companies')
export class CompaniesController {
  constructor(private readonly companiesService: CompaniesService) {}

  @Get()
  @ApiOperation({ summary: 'Список компаний с пагинацией и фильтрацией' })
  @ApiResponse({ status: 200, description: 'Список компаний' })
  findAll(@Query() query: CompanyQueryDto) {
    return this.companiesService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Детали компании' })
  @ApiResponse({ status: 200, description: 'Компания' })
  @ApiResponse({ status: 404, description: 'Не найдена' })
  findOne(@Param('id') id: string) {
    return this.companiesService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Создать компанию' })
  @ApiResponse({ status: 201, description: 'Компания создана' })
  create(@Body() dto: CreateCompanyDto) {
    return this.companiesService.create(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Обновить компанию' })
  @ApiResponse({ status: 200, description: 'Компания обновлена' })
  update(@Param('id') id: string, @Body() dto: UpdateCompanyDto) {
    return this.companiesService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Удалить компанию' })
  @ApiResponse({ status: 200, description: 'Компания удалена' })
  remove(@Param('id') id: string) {
    return this.companiesService.remove(id);
  }
}
