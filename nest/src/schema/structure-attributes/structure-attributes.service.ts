import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { Prisma } from '@prisma/client';
import { FilterService } from './filter.service';
import { FilterStructureAttributeDto } from './dto/filter-structure-attribute.dto';
@Injectable()
export class StructureAttributesService {
  private filterConfig = {
    attributeName: { field: 'attributeName', operator: 'contains' },
    exactAttributeName: { field: 'attributeName', operator: 'equals' },
    attributeValue: { field: 'attributeValue', operator: 'contains' },
    structureId: { field: 'structureId', operator: 'equals' , type:'int'},
    stare: { field: 'status', operator: 'equals' },
    // Add more mappings as needed
  };
  constructor(private readonly databaseService: DatabaseService, private filterService:FilterService) {}

  async create(data: Prisma.StructureAttributesCreateInput) {
    return this.databaseService.structureAttributes.create({
      data,
    });
  }

  async findAll(filters: FilterStructureAttributeDto) {
    const where = this.filterService.createWhereCondition(filters, this.filterConfig);
    const pagination = this.filterService.createPaginationParams(filters);
    const orderBy = this.filterService.createSortingParams(filters, this.filterConfig);

    const [data, total] = await Promise.all([
      this.databaseService.structureAttributes.findMany({
        where,
        include: {
          structure: true,
        },
        orderBy,
        ...pagination,
      }),
      this.databaseService.structureAttributes.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page: filters.page || 1,
        limit: filters.limit || 10,
        totalPages: Math.ceil(total / (filters.limit || 10)),
      },
    };
  }
 async findAllStructures(){
  return this.databaseService.structure.findMany({});
 }
  async findOne(id: number) {
    return this.databaseService.structureAttributes.findUnique({
      where: { id },
      include: {
        structure: true,
      },
    });
  }

  async update(id: number, data: Prisma.StructureAttributesUpdateInput) {
    return this.databaseService.structureAttributes.update({
      where: { id },
      data,
    });
  }

  async remove(id: number) {
    return this.databaseService.structureAttributes.delete({
      where: { id },
    });
  }
}