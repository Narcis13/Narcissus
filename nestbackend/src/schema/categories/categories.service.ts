import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service'; // Adjust path
import { Prisma, Category, List } from '@prisma/client';
import { FilteringService, FilterConfig } from '../../shared/services/filtering.service'; // Adjust path
import { CreateCategoryDto } from './dto/create-category.dto'; 
import {  UpdateCategoryDto } from './dto/update-category.dto'; 
import {  FilterCategoryDto } from './dto/filter-category.dto'; // Adjust DTO imports
import { CreateListDto } from './dto/create-list.dto';   
import { UpdateListDto } from './dto/update-list.dto';   
import { FilterListDto } from './dto/filter-list.dto';         // Adjust DTO imports

@Injectable()
export class CategoriesService {
  constructor(
    private readonly prisma: DatabaseService,
    private readonly filteringService: FilteringService,
  ) {}

  // --- Filter Configurations ---
  private readonly categoryFilterConfig: FilterConfig = {
    name: { field: 'name', operator: 'contains', type: 'string' },
    status: { field: 'status', operator: 'equals', type: 'string' },
  };

  private readonly listFilterConfig: FilterConfig = {
    item: { field: 'item', operator: 'contains', type: 'string' },
    status: { field: 'status', operator: 'equals', type: 'string' },
    // categoryId filtering is handled implicitly by the route or explicitly if needed
  };

  // --- Helper Methods ---
  private async findCategoryOrFail(id: number): Promise<Category> {
      const category = await this.prisma.category.findUnique({ where: { id } });
      if (!category) {
          throw new NotFoundException(`Category with ID ${id} not found`);
      }
      return category;
  }

   private async findListOrFail(id: number): Promise<List & { category: Category }> {
      const list = await this.prisma.list.findUnique({
          where: { id },
          include: { category: true }, // Always include category for context
      });
      if (!list) {
          throw new NotFoundException(`List item with ID ${id} not found`);
      }
      return list;
  }

  // --- Category Operations ---

  async createCategory(createCategoryDto: CreateCategoryDto): Promise<Category> {
    try {
      return await this.prisma.category.create({
        data: createCategoryDto,
      });
    } catch (error) {
      // Handle potential errors (e.g., unique name constraint)
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          throw new BadRequestException(`Category with name '${createCategoryDto.name}' already exists.`);
      }
      throw error;
    }
  }

  async findAllCategories(filters: FilterCategoryDto) {
    const where = this.filteringService.createWhereCondition<'Category'>(
      filters,
      this.categoryFilterConfig,
    );
  //  const pagination = this.filteringService.createPaginationParams(filters);
    const orderBy = this.filteringService.createSortingParams<'Category'>(
      filters,
      this.categoryFilterConfig,
    );

    const [data, total] = await this.prisma.$transaction([
      this.prisma.category.findMany({
        where,
        include: { _count: { select: { lists: true } } }, // Include list count
        orderBy,
      //  ...pagination,
      }),
      this.prisma.category.count({ where }),
    ]);

  //  const totalPages = pagination.take ? Math.ceil(total / pagination.take) : 1;
    return {
      data,
      meta: { },
    };
  }

  async findOneCategory(id: number, includeLists: boolean = false): Promise<Category | null> {
    const category = await this.prisma.category.findUnique({
      where: { id },
      include: {
        lists: includeLists ? { orderBy: { createdAt: 'desc' } } : false, // Conditionally include lists
      },
    });
    if (!category) {
      throw new NotFoundException(`Category with ID ${id} not found`);
    }
    return category;
  }

  async updateCategory(id: number, updateCategoryDto: UpdateCategoryDto): Promise<Category> {
    await this.findCategoryOrFail(id); // Ensure exists
    try {
      return await this.prisma.category.update({
        where: { id },
        data: updateCategoryDto,
      });
    } catch (error) {
       if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          throw new BadRequestException(`Category with name '${updateCategoryDto.name}' already exists.`);
      }
      throw error;
    }
  }

  async removeCategory(id: number): Promise<Category> {
    await this.findCategoryOrFail(id); // Ensure exists
    // Prisma's default behavior for relation constraint might prevent deletion if lists exist.
    // Add cascade delete in schema or handle manually if needed.
    try {
      return await this.prisma.category.delete({ where: { id } });
    } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
           // Foreign key constraint failed - category likely has lists associated
           throw new BadRequestException(`Cannot delete category ID ${id} as it has associated list items.`);
        }
        throw error;
    }
  }

  // --- List Item Operations ---

  async createList(categoryId: number, createListDto: CreateListDto): Promise<List> {
    await this.findCategoryOrFail(categoryId); // Ensure parent category exists

    try {
      return await this.prisma.list.create({
        data: {
          ...createListDto,
          categoryId: categoryId, // Assign categoryId from parameter
        },
        include: { category: true },
      });
    } catch (error) {
      throw error;
    }
  }

  async findAllListsForCategory(categoryId: number, filters: FilterListDto) {
     await this.findCategoryOrFail(categoryId); // Ensure parent category exists

     // Base condition: Filter by the specific categoryId
     const baseWhere: Prisma.ListWhereInput = { categoryId: categoryId };

     // Add additional filters from the DTO
     const additionalWhere = this.filteringService.createWhereCondition<'List'>(
         filters,
         this.listFilterConfig
     );

     const where = { ...baseWhere, ...additionalWhere }; // Combine conditions

    // const pagination = this.filteringService.createPaginationParams(filters);
     // Note: Sorting by 'category.name' is not applicable here as all lists belong to the same category
     const orderBy = this.filteringService.createSortingParams<'List'>(
         filters,
         this.listFilterConfig
     );


    const [data, total] = await this.prisma.$transaction([
      this.prisma.list.findMany({
        where,
        include: {
          category: { select: { id: true, name: true } } // Include basic category info
        },
        orderBy,
      //  ...pagination,
      }),
      this.prisma.list.count({ where }),
    ]);

 //   const totalPages = pagination.take ? Math.ceil(total / pagination.take) : 1;
    return {
      data,
      meta: {  },
    };
  }

  async findOneList(listId: number): Promise<List | null> {
      // findListOrFail already includes the category
      return this.findListOrFail(listId);
  }

  async updateList(listId: number, updateListDto: UpdateListDto): Promise<List> {
    await this.findListOrFail(listId); // Ensure list item exists

    // If categoryId is being updated, validate the new categoryId exists
    if (updateListDto.categoryId !== undefined) {
        await this.findCategoryOrFail(updateListDto.categoryId);
    }

    try {
      return await this.prisma.list.update({
        where: { id: listId },
        data: updateListDto,
        include: { category: true }, // Return updated item with category
      });
    } catch (error) {
      throw error;
    }
  }

  async removeList(listId: number): Promise<List> {
    await this.findListOrFail(listId); // Ensure list item exists
    try {
      return await this.prisma.list.delete({
        where: { id: listId },
      });
    } catch (error) {
      throw error;
    }
  }
}

