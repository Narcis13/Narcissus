import { Module } from '@nestjs/common';
import { ArticlesController } from './articles.controller';
import { ArticlesService } from './articles.service';
import { FilteringService } from './filtering.service';

@Module({

  controllers: [ArticlesController],
  providers: [ArticlesService, FilteringService]
 
})
export class ArticlesModule {}