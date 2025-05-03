import { IsOptional, IsString, IsIn, IsInt, Min } from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class FilterCategoryDto {
  @IsOptional()
  @IsString()
  name?: string; // Filter by name (contains)

  @IsOptional()
  @IsString()
  @IsIn(['active', 'inactive'])
  status?: string; // Filter by exact status

  // Pagination parameters
  @IsOptional()
  @Type(() => Number) // Transform query param string to number
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number) // Transform query param string to number
  @IsInt()
  @Min(0) // Allow 0 to fetch all (handled in service)
  limit?: number = 10;

  // Sorting parameters
  @IsOptional()
  @IsString()
  // Allow sorting by 'id', 'name', 'status', 'createdAt', 'updatedAt'
  @IsIn(['id', 'name', 'status', 'createdAt', 'updatedAt'])
  sortBy?: string = 'createdAt'; // Default sort field

  @IsOptional()
  @IsString()
  @IsIn(['asc', 'desc'])
  @Transform(({ value }) => value?.toLowerCase())
  sortOrder?: 'asc' | 'desc' = 'desc'; // Default sort order
}