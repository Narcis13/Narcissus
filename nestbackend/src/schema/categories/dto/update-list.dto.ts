import {  IsOptional,  IsInt,  IsPositive } from 'class-validator';

import { PartialType } from '@nestjs/mapped-types';
import { CreateListDto } from './create-list.dto';

export class UpdateListDto extends PartialType(CreateListDto) {
    @IsOptional() // Make categoryId optional for updates
    @IsInt()
    @IsPositive()
    categoryId?: number; // Allow changing the category
}

