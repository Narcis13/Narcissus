import { Module } from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { CategoriesController } from './categories.controller';
import { FilteringService } from '../../shared/services/filtering.service'; // Adjust path
// Import DatabaseModule if needed locally, or ensure it's global
// import { DatabaseModule } from '../../database/database.module';

@Module({
  // imports: [DatabaseModule], // Import if DatabaseService is provided by a module
  controllers: [CategoriesController], // Single controller
  providers: [CategoriesService, FilteringService], // Single service + shared filtering
  exports: [CategoriesService], // Export if other modules need it (less likely now)
})
export class CategoriesModule {}