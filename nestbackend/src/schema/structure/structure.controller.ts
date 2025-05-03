import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { StructureService } from './structure.service';
import { Prisma } from '@prisma/client';
import { AuthGuard } from '@nestjs/passport';

@Controller('structure')
export class StructureController {
  constructor(private readonly structureService: StructureService) {}

  @Post()
  @UseGuards(AuthGuard('jwt'))
  create(@Body() createStructureDto: Prisma.StructureCreateInput) {
    return this.structureService.create(createStructureDto);
  }

  @Get()
  findAll() {
    return this.structureService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.structureService.findOne(+id);
  }

  @Patch(':id')
  @UseGuards(AuthGuard('jwt'))
  update(@Param('id') id: string, @Body() updateStructureDto: Prisma.StructureUpdateInput) {
    return this.structureService.update(+id, updateStructureDto);
  }

  @Delete(':id')
  @UseGuards(AuthGuard('jwt'))
  remove(@Param('id') id: string) {
    return this.structureService.remove(+id);
  }
}