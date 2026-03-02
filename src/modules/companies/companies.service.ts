import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { CompanyQueryDto } from './dto/company-query.dto';
import {
  PaginatedResponse,
  createPaginatedResponse,
} from '../../common/dto/paginated-response.dto';
import { Company, Prisma } from '@prisma/client';

@Injectable()
export class CompaniesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: CompanyQueryDto): Promise<PaginatedResponse<Company>> {
    const { page = 1, limit = 20, search, sortBy, sortOrder = 'desc', industry, country } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.CompanyWhereInput = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { ticker: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (industry) {
      where.industry = { equals: industry, mode: 'insensitive' };
    }

    if (country) {
      where.country = { equals: country, mode: 'insensitive' };
    }

    const orderBy: Prisma.CompanyOrderByWithRelationInput = sortBy
      ? { [sortBy]: sortOrder }
      : { createdAt: sortOrder };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.company.findMany({ where, orderBy, skip, take: limit }),
      this.prisma.company.count({ where }),
    ]);

    return createPaginatedResponse(data, total, page, limit);
  }

  async findOne(id: string): Promise<Company> {
    const company = await this.prisma.company.findUnique({
      where: { id },
      include: { profits: { orderBy: { period: 'desc' }, take: 4 } },
    });

    if (!company) {
      throw new NotFoundException('Компания не найдена');
    }

    return company;
  }

  async create(dto: CreateCompanyDto): Promise<Company> {
    return this.prisma.company.create({ data: dto });
  }

  async update(id: string, dto: UpdateCompanyDto): Promise<Company> {
    await this.findOne(id);
    return this.prisma.company.update({ where: { id }, data: dto });
  }

  async remove(id: string): Promise<Company> {
    await this.findOne(id);
    return this.prisma.company.delete({ where: { id } });
  }
}
