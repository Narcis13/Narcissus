
import { IsString, IsOptional, IsIn, IsInt, Min } from 'class-validator';
import { Transform, Type } from 'class-transformer';


export class FilterListDto {
    @IsOptional()
    @IsString()
    item?: string;
  
    @IsOptional()
    @IsString()
    @IsIn(['active', 'inactive', 'completed'])
    status?: string;
  
    // categoryId is implicitly known from the route parameter for listing within a category
    // We might add it back if we need a global list search endpoint later
    // @IsOptional()
    // @Type(() => Number)
    // @IsInt()
    // @IsPositive()
    // categoryId?: number;
  
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    page?: number = 1;
  
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(0)
    limit?: number = 10;
  
    @IsOptional()
    @IsString()
    @IsIn(['id', 'item', 'status', 'createdAt', 'updatedAt']) // category.name sorting isn't directly filterable here
    sortBy?: string = 'createdAt';
  
    @IsOptional()
    @IsString()
    @IsIn(['asc', 'desc'])
    @Transform(({ value }) => value?.toLowerCase())
    sortOrder?: 'asc' | 'desc' = 'desc';
  }
  