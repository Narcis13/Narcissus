// ==================================
// Shared Filtering Service
// Path: src/shared/services/filtering.service.ts
// ==================================
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

// Define a generic type for the WhereInput based on the model
type PrismaWhereInput<T extends keyof Prisma.TypeMap['model']> =
  Prisma.TypeMap['model'][T]['operations']['findMany']['args']['where'];

// Define a generic type for the OrderByInput
type PrismaOrderByInput<T extends keyof Prisma.TypeMap['model']> =
  Prisma.TypeMap['model'][T]['operations']['findMany']['args']['orderBy'];

// Define the structure for the configuration object
export interface FilterConfigItem {
  field: string;
  operator: 'equals' | 'contains' | 'in' | 'gt' | 'lt' | 'gte' | 'lte';
  type?: 'string' | 'number' | 'boolean' | 'date' | 'int';
}

export type FilterConfig = Record<string, FilterConfigItem>;

@Injectable()
export class FilteringService {
  /**
   * Creates a Prisma where condition based on filter parameters.
   * @param filters Object containing filter parameters (usually from DTO).
   * @param config Configuration mapping DTO fields to Prisma fields/operators/types.
   * @returns Prisma where condition object.
   */
  createWhereCondition<TModel extends keyof Prisma.TypeMap['model']>(
    filters: Record<string, any>,
    config: FilterConfig,
  ): PrismaWhereInput<TModel> {
    const whereCondition: Record<string, any> = {};

    // Extract actual filter keys, excluding pagination/sorting
    const { page, limit, sortBy, sortOrder, ...actualFilters } = filters;

    Object.keys(actualFilters).forEach((key) => {
      const filterValue = actualFilters[key];
      const filterConfig = config[key];

      // Proceed only if the filter has a value and is defined in the config
      if (filterValue !== undefined && filterValue !== null && filterConfig) {
        const { field, operator, type } = filterConfig;
        let value: any = filterValue;

        // Type casting based on config (important for query params which are strings)
        if (type === 'number') {
          if (operator === 'in' && Array.isArray(value)) {
            value = value.map(Number).filter(v => !isNaN(v)); // Ensure valid numbers
          } else {
             const numValue = Number(value);
             if (!isNaN(numValue)) value = numValue; else return; // Skip if not a valid number
          }
        } else if (type === 'boolean') {
          // Handle 'true'/'false' strings or actual booleans
          if (typeof value === 'string') {
             if (value.toLowerCase() === 'true') value = true;
             else if (value.toLowerCase() === 'false') value = false;
             else return; // Skip if not a valid boolean representation
          } else if (typeof value !== 'boolean') {
             return; // Skip if not boolean or valid string representation
          }
        } else if (type === 'date') {
            const dateValue = new Date(value);
            if (!isNaN(dateValue.getTime())) value = dateValue; else return; // Skip if not a valid date
        }

        // Skip 'in' operator if the array is empty after filtering/casting
        if (operator === 'in' && Array.isArray(value) && value.length === 0) {
            return;
        }

        // Construct the Prisma condition for the field
        switch (operator) {
          case 'equals':
            whereCondition[field] = { equals: value };
            break;
          case 'contains':
            // Prisma 'contains' typically used for strings
             if (typeof value === 'string') {
                whereCondition[field] = { contains: value, mode: 'insensitive' }; // Case-insensitive search
             } else {
                 // Handle contains for other types if necessary, or default to equals
                 whereCondition[field] = { equals: value };
             }
            break;
          case 'in':
            whereCondition[field] = { in: value };
            break;
          case 'gt':
             whereCondition[field] = { gt: value };
             break;
          case 'lt':
             whereCondition[field] = { lt: value };
             break;
          case 'gte':
             whereCondition[field] = { gte: value };
             break;
          case 'lte':
             whereCondition[field] = { lte: value };
             break;
          default:
            // Default to equals if operator is unknown or not specified
            whereCondition[field] = { equals: value };
        }
      }
    });

    return whereCondition as PrismaWhereInput<TModel>;
  }

  /**
   * Creates pagination parameters for Prisma.
   * @param filters Object containing optional page and limit parameters.
   * @returns Object with skip and take properties.
   */
  createPaginationParams(filters: { page?: number; limit?: number }): {
    skip?: number;
    take?: number;
  } {
    const page = filters.page && filters.page > 0 ? filters.page : 1;
    // Allow fetching all results if limit is explicitly set to 0 or negative
    const take = filters.limit !== undefined && filters.limit >= 0 ? filters.limit : 10; // Default limit: 10

    if (take === 0) { // If limit is 0, don't apply skip or take (fetch all)
        return {};
    }

    return {
      skip: (page - 1) * take,
      take: take,
    };
  }

  /**
   * Creates sorting parameters for Prisma.
   * @param filters Object containing optional sortBy and sortOrder parameters.
   * @param config Configuration mapping DTO fields to Prisma fields. Only used to find the correct db field name if sortBy refers to a DTO key.
   * @returns Prisma orderBy object or undefined.
   */
  createSortingParams<TModel extends keyof Prisma.TypeMap['model']>(
    filters: { sortBy?: string; sortOrder?: 'asc' | 'desc' },
    config: FilterConfig,
  ): PrismaOrderByInput<TModel> | undefined {
    if (!filters.sortBy) {
      return undefined; // No sorting requested
    }

    const direction = filters.sortOrder?.toLowerCase() === 'desc' ? 'desc' : 'asc';

    // Find the database field name. Check if sortBy matches a key in config OR a field value in config.
    const configEntry = Object.entries(config).find(
      ([key, value]) => key === filters.sortBy || value.field === filters.sortBy
    );

    // Use the mapped field name from config if found, otherwise assume sortBy is the direct db field name.
    const fieldName = configEntry ? configEntry[1].field : filters.sortBy;

    // Basic validation: check if fieldName is a reasonable string (optional)
    if (typeof fieldName !== 'string' || fieldName.length === 0) {
        console.warn(`Invalid field name derived for sorting: ${fieldName}`);
        return undefined;
    }

    // Allow sorting by nested fields (e.g., 'category.name') - Prisma supports this
    const fieldParts = fieldName.split('.');
    if (fieldParts.length > 1) {
        let orderByObject = {};
        let currentLevel = orderByObject;
        for (let i = 0; i < fieldParts.length - 1; i++) {
            currentLevel[fieldParts[i]] = {};
            currentLevel = currentLevel[fieldParts[i]];
        }
        currentLevel[fieldParts[fieldParts.length - 1]] = direction;
        return orderByObject as PrismaOrderByInput<TModel>;
    } else {
        // Simple field sorting
        return { [fieldName]: direction } as PrismaOrderByInput<TModel>;
    }

  }
}
