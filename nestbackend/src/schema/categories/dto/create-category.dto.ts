import { IsString, IsNotEmpty, IsOptional, MaxLength, IsIn } from 'class-validator';

export class CreateCategoryDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255) // Example max length
  name: string;

  @IsOptional()
  @IsString()
  @IsIn(['active', 'inactive']) // Example valid statuses
  @MaxLength(24)
  status?: string; // Defaults to 'active' via Prisma schema
}
