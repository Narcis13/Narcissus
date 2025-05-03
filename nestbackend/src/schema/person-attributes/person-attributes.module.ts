import { Module } from '@nestjs/common';
import { PersonAttributesService } from './person-attributes.service';
import { PersonAttributesController } from './person-attributes.controller';
import { FilteringService } from 'src/shared/services/filtering.service';

@Module({
  controllers: [PersonAttributesController],
  providers: [PersonAttributesService, FilteringService],
})
export class PersonAttributesModule {}