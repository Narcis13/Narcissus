import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { Prisma, PersonAttributes } from '@prisma/client';
import { FilteringService, FilterConfig} from '../../shared/services/filtering.service'; 
import { FilterPersonAttributeDto } from './dto/filter-person-attributes.dto';
@Injectable()
export class PersonAttributesService {
  private readonly filterConfig:FilterConfig = {
    attributeName: { field: 'attributeName', operator: 'contains' },
    exactAttributeName: { field: 'attributeName', operator: 'equals' },
    attributeValue: { field: 'attributeValue', operator: 'contains' },
    personId: { field: 'personId', operator: 'equals' , type:'int'},
    stare: { field: 'status', operator: 'equals' },
    // Add more mappings as needed
  };
  constructor(private readonly databaseService: DatabaseService, private filteringService:FilteringService) {}

  async create(data: Prisma.PersonAttributesCreateInput) {
    return this.databaseService.personAttributes.create({
      data,
    });
  }

  async findAll(filters: FilterPersonAttributeDto) {
    const where = this.filteringService.createWhereCondition<'PersonAttributes'>(filters, this.filterConfig);
   // const pagination = this.filteringService.createPaginationParams(filters);
    const orderBy = this.filteringService.createSortingParams<'PersonAttributes'>(filters, this.filterConfig);

    const [data, total] = await Promise.all([
      this.databaseService.personAttributes.findMany({
        where,
        include: {
          person: true,
        },
        orderBy,
     //   ...pagination,
      }),
      this.databaseService.personAttributes.count({ where }),
    ]);

    return {
      data,
      meta: {
       
      },
    };
  }
 async findAllPersons(){
  return this.databaseService.person.findMany({});
 }
  async findOne(id: number) {
    return this.databaseService.personAttributes.findUnique({
      where: { id },
      include: {
        person: true,
      },
    });
  }

  async update(id: number, data: Prisma.PersonAttributesUpdateInput) {
    return this.databaseService.personAttributes.update({
      where: { id },
      data,
    });
  }

  async remove(id: number) {
    return this.databaseService.personAttributes.delete({
      where: { id },
    });
  }
}