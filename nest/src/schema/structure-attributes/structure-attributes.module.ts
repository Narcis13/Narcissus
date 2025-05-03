import { Module } from '@nestjs/common';
import { StructureAttributesService } from './structure-attributes.service';
import { StructureAttributesController } from './structure-attributes.controller';
import { FilterService } from './filter.service';

@Module({
  controllers: [StructureAttributesController],
  providers: [StructureAttributesService, FilterService],
})
export class StructureAttributesModule {}