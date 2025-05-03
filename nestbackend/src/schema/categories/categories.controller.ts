
import {
    Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards, ParseIntPipe, HttpCode, HttpStatus, DefaultValuePipe, ParseBoolPipe
  } from '@nestjs/common';
  import { CategoriesService } from './categories.service';
  // DTOs are now siblings
  import { CreateCategoryDto } from './dto/create-category.dto'; 
  import {  UpdateCategoryDto } from './dto/update-category.dto'; 
  import {  FilterCategoryDto } from './dto/filter-category.dto'; // Adjust DTO imports
  import { CreateListDto } from './dto/create-list.dto';   
  import { UpdateListDto } from './dto/update-list.dto';   
  import { FilterListDto } from './dto/filter-list.dto'; 
  import { AuthGuard } from '@nestjs/passport'; // Assuming JWT strategy
  
// Apply guard globally for this controller
  @Controller('categories')
  export class CategoriesController {
    constructor(private readonly categoriesService: CategoriesService) {}
  
    // --- Category Routes ---
  
    @Post()
    @UseGuards(AuthGuard('jwt')) 
    @HttpCode(HttpStatus.CREATED)
    createCategory(@Body() createCategoryDto: CreateCategoryDto) {
      return this.categoriesService.createCategory(createCategoryDto);
    }
  
    @Get()
    @HttpCode(HttpStatus.OK)
    findAllCategories(@Query() filterCategoryDto: FilterCategoryDto) {
      // Public access or keep controller guard? Assuming protected for now.
      return this.categoriesService.findAllCategories(filterCategoryDto);
    }
  
    @Get(':categoryId')
    @HttpCode(HttpStatus.OK)
    findOneCategory(
        @Param('categoryId', ParseIntPipe) categoryId: number,
        // Optional query param to include lists
        @Query('includeLists', new DefaultValuePipe(false), ParseBoolPipe) includeLists: boolean
    ) {
       // Public access or keep controller guard? Assuming protected for now.
      return this.categoriesService.findOneCategory(categoryId, includeLists);
    }
  
    @Patch(':categoryId')
    @UseGuards(AuthGuard('jwt')) 
    @HttpCode(HttpStatus.OK)
    updateCategory(
      @Param('categoryId', ParseIntPipe) categoryId: number,
      @Body() updateCategoryDto: UpdateCategoryDto,
    ) {
      return this.categoriesService.updateCategory(categoryId, updateCategoryDto);
    }
  
    @Delete(':categoryId')
    @UseGuards(AuthGuard('jwt')) 
    @HttpCode(HttpStatus.NO_CONTENT)
    async removeCategory(@Param('categoryId', ParseIntPipe) categoryId: number): Promise<void> {
      await this.categoriesService.removeCategory(categoryId);
    }
  
    // --- List Item Routes (Nested under Category) ---
  
    @Post(':categoryId/lists')
    @UseGuards(AuthGuard('jwt')) 
    @HttpCode(HttpStatus.CREATED)
    createList(
        @Param('categoryId', ParseIntPipe) categoryId: number,
        @Body() createListDto: CreateListDto
    ) {
        // categoryId from the route is passed to the service
        return this.categoriesService.createList(categoryId, createListDto);
    }
  
    @Get(':categoryId/lists')
    @HttpCode(HttpStatus.OK)
    findAllListsForCategory(
        @Param('categoryId', ParseIntPipe) categoryId: number,
        @Query() filterListDto: FilterListDto
    ) {
        // Public access or keep controller guard? Assuming protected for now.
        return this.categoriesService.findAllListsForCategory(categoryId, filterListDto);
    }
  
    // --- List Item Routes (Direct access via list ID) ---
    // Note: These are still under the '/categories' base path because the controller is mounted there.
  
    @Get('lists/:listId') // Route: GET /categories/lists/:listId
    @HttpCode(HttpStatus.OK)
    findOneList(@Param('listId', ParseIntPipe) listId: number) {
      // Public access or keep controller guard? Assuming protected for now.
      return this.categoriesService.findOneList(listId);
    }
  
    @Patch('lists/:listId')
    @UseGuards(AuthGuard('jwt'))  // Route: PATCH /categories/lists/:listId
    @HttpCode(HttpStatus.OK)
    updateList(
        @Param('listId', ParseIntPipe) listId: number,
        @Body() updateListDto: UpdateListDto
    ) {
        return this.categoriesService.updateList(listId, updateListDto);
    }
  
    @Delete('lists/:listId') // Route: DELETE /categories/lists/:listId
    @UseGuards(AuthGuard('jwt')) 
    @HttpCode(HttpStatus.NO_CONTENT)
    async removeList(@Param('listId', ParseIntPipe) listId: number): Promise<void> {
        await this.categoriesService.removeList(listId);
    }
  }