import { IsString, IsNotEmpty, IsOptional, MaxLength, IsIn } from 'class-validator';


export class CreateListDto {
    @IsString()
    @IsNotEmpty()
    @MaxLength(500)
    item: string;
  
    // categoryId is implicitly known from the route parameter in the controller
    // @IsInt()
    // @IsPositive()
    // @IsNotEmpty()
    // categoryId: number; // We'll get this from the route param
  
    @IsOptional()
    @IsString()
    @IsIn(['active', 'inactive', 'completed'])
    @MaxLength(24)
    status?: string;
  }
  