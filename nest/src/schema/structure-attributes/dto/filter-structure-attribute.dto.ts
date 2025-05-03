import { IsOptional, IsString, IsNumber, IsBoolean, IsIn } from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class FilterStructureAttributeDto {
  @IsOptional()
  @IsString()
  attributeName?: string;

  @IsOptional()
  @IsString()
  exactAttributeName?: string;

  @IsOptional()
  @IsString()
  attributeValue?: string;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  structureId?: number;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  isActive?: boolean;
  
  @IsOptional()
  @IsString()
  stare?: string;
  // Add more filters as needed based on your structure-attributes model

  // Pagination parameters
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  page?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  limit?: number;

  // Sorting parameters
  @IsOptional()
  @IsString()
  sortBy?: string;

  @IsOptional()
  @IsString()
  @IsIn(['asc', 'desc', 'ASC', 'DESC'])
  @Transform(({ value }) => value?.toLowerCase())
  sortOrder?: 'asc' | 'desc';
}