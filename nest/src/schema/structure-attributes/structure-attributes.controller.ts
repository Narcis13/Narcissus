import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Query } from '@nestjs/common';
import { StructureAttributesService } from './structure-attributes.service';
import { Prisma } from '@prisma/client';
import { AuthGuard } from '@nestjs/passport';
import { FilterStructureAttributeDto } from './dto/filter-structure-attribute.dto';
@Controller('structure-attributes')
export class StructureAttributesController {
  constructor(private readonly structureAttributesService: StructureAttributesService) {}

  @Post()
  @UseGuards(AuthGuard('jwt'))
  create(@Body() createStructureAttributeDto: Prisma.StructureAttributesCreateInput) {
    return this.structureAttributesService.create(createStructureAttributeDto);
  }

  @Get()
  findAll(@Query() filters: FilterStructureAttributeDto) {
    return this.structureAttributesService.findAll(filters);
  }

  @Get('structure')
  findAllStructures() {
    return this.structureAttributesService.findAllStructures();  
  }
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.structureAttributesService.findOne(+id);
  }

  @Patch(':id')
  @UseGuards(AuthGuard('jwt'))
  update(
    @Param('id') id: string,
    @Body() updateStructureAttributeDto: Prisma.StructureAttributesUpdateInput,
  ) {
    return this.structureAttributesService.update(+id, updateStructureAttributeDto);
  }

  @Delete(':id')
  @UseGuards(AuthGuard('jwt'))
  remove(@Param('id') id: string) {
    return this.structureAttributesService.remove(+id);
  }
}