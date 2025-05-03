import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { Prisma } from '@prisma/client';
//import { getRomanianDate } from 'src/utils/timezone';

@Injectable()
export class PersonService {
  constructor(private readonly databaseService: DatabaseService) {}

  async create(createPersonDto: Prisma.PersonCreateInput) {
    return this.databaseService.person.create({
      data: createPersonDto,
    });
  }

  findAll() {
    return this.databaseService.person.findMany({});
  }

  findOne(id: number) {
    return this.databaseService.person.findUnique({
      where: { id },
    });
  }

  async update(id: number, updatePersonDto: Prisma.PersonUpdateInput) {
   // console.log('update ',getRomanianDate())
    return this.databaseService.person.update({
      where: { id },
      data: 
        updatePersonDto
   
      
    });
  }

  remove(id: number) {
    return this.databaseService.person.delete({
      where: { id },
    });
  }
}