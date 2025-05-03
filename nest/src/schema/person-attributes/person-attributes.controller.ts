import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Query } from '@nestjs/common';
import { PersonAttributesService } from './person-attributes.service';
import { Prisma } from '@prisma/client';
import { AuthGuard } from '@nestjs/passport';
import { FilterPersonAttributeDto } from './dto/filter-person-attributes.dto';
@Controller('person-attributes')
export class PersonAttributesController {
  constructor(private readonly personAttributesService: PersonAttributesService) {}

  @Post()
  @UseGuards(AuthGuard('jwt'))
  create(@Body() createPersonAttributeDto: Prisma.PersonAttributesCreateInput) {
    return this.personAttributesService.create(createPersonAttributeDto);
  }

  @Get()
  findAll(@Query() filters: FilterPersonAttributeDto) {
    return this.personAttributesService.findAll(filters);
  }

  @Get('person')
  findAllStructures() {
    return this.personAttributesService.findAllPersons();  
  }
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.personAttributesService.findOne(+id);
  }

  @Patch(':id')
  @UseGuards(AuthGuard('jwt'))
  update(
    @Param('id') id: string,
    @Body() updatePersonAttributeDto: Prisma.PersonAttributesUpdateInput,
  ) {
    return this.personAttributesService.update(+id, updatePersonAttributeDto);
  }

  @Delete(':id')
  @UseGuards(AuthGuard('jwt'))
  remove(@Param('id') id: string) {
    return this.personAttributesService.remove(+id);
  }
}