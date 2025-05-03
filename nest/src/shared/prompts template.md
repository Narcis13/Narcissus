I'm working on a NestJS backend project with the following structure and patterns:

## Project Overview
- The project uses NestJS with TypeScript
- Database access is through Prisma ORM
- The codebase follows a modular architecture with services, controllers, and DTOs
- Filtering and pagination are implemented through shared services

## Existing Module Example
Here's an example of how modules are structured in my project:

1. Service file (<module-name>.service.ts):
```typescript
import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { Prisma, EntityName } from '@prisma/client';
import { FilteringService, FilterConfig} from '../../shared/services/filtering.service'; 
import { FilterEntityDto } from './dto/filter-entity.dto';

@Injectable()
export class EntityService {
  private readonly filterConfig:FilterConfig = {
    // Define filter mappings for this entity
    field1: { field: 'dbField1', operator: 'contains' },
    exactField1: { field: 'dbField1', operator: 'equals' },
    // Add more mappings as needed
  };
  
  constructor(
    private readonly databaseService: DatabaseService, 
    private filteringService: FilteringService
  ) {}

  async create(data: Prisma.EntityCreateInput) {
    return this.databaseService.entity.create({
      data,
    });
  }

  async findAll(filters: FilterEntityDto) {
    const where = this.filteringService.createWhereCondition<'Entity'>(filters, this.filterConfig);
    const orderBy = this.filteringService.createSortingParams<'Entity'>(filters, this.filterConfig);

    const [data, total] = await Promise.all([
      this.databaseService.entity.findMany({
        where,
        include: {
          // Define relations to include
          relatedEntity: true,
        },
        orderBy,
      }),
      this.databaseService.entity.count({ where }),
    ]);

    return {
      data,
      meta: {
        // Pagination metadata if needed
      },
    };
  }

  async findOne(id: number) {
    return this.databaseService.entity.findUnique({
      where: { id },
      include: {
        // Define relations to include
        relatedEntity: true,
      },
    });
  }

  async update(id: number, data: Prisma.EntityUpdateInput) {
    return this.databaseService.entity.update({
      where: { id },
      data,
    });
  }

  async remove(id: number) {
    return this.databaseService.entity.delete({
      where: { id },
    });
  }
}

2. Controller file (
   .controller.ts)
3. Module file (
   .module.ts)
4. DTO files in a dto folder (create-entity.dto.ts, update-entity.dto.ts, filter-entity.dto.ts)
## Requirements for the New Module
- Name of the new module: [specify module name]
- Entity fields: [list all fields with their types]
- Required relationships: [specify any relationships with other entities]
- Special filtering requirements: [specify any custom filtering needs]
- Additional endpoints needed beyond CRUD: [specify any custom endpoints]
## Database Service
The DatabaseService provides access to all Prisma client methods for database operations.

## Filtering Service
The FilteringService helps create where conditions, sorting parameters, and pagination for database queries based on DTOs.

Please generate a complete NestJS module including:

1. Module file
2. Service file
3. Controller file
4. DTO files (create, update, filter)
5. Any other necessary files
Follow the existing patterns in the codebase for consistency.