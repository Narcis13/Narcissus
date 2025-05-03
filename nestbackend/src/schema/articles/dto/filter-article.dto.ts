import { IsOptional, IsString, IsIn } from 'class-validator';
import { Transform } from 'class-transformer';

export class FilterArticleDto {
  @IsOptional()
  @IsString()
  category?: string;

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