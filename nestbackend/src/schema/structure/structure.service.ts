import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { Prisma } from '@prisma/client';
import { getRomanianDate } from 'src/utils/timezone';

@Injectable()
export class StructureService {
  constructor(private readonly databaseService: DatabaseService) {}

  async create(createStructureDto: Prisma.StructureCreateInput) {
    return this.databaseService.structure.create({
      data: createStructureDto,
    });
  }

  findAll() {
    return this.databaseService.structure.findMany({});
  }

  findOne(id: number) {
    return this.databaseService.structure.findUnique({
      where: { id },
    });
  }

  async update(id: number, updateStructureDto: Prisma.StructureUpdateInput) {
    console.log('update ',getRomanianDate())
    return this.databaseService.structure.update({
      where: { id },
      data: 
        updateStructureDto
   
      
    });
  }

  remove(id: number) {
    return this.databaseService.structure.delete({
      where: { id },
    });
  }
}