import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Query } from '@nestjs/common';
import { ArticlesService } from './articles.service';
import { Prisma } from '@prisma/client';
import { AuthGuard } from '@nestjs/passport';
import { FilterArticleDto } from './dto/filter-article.dto';
@Controller('articles')
export class ArticlesController {
  constructor(private readonly articlesService: ArticlesService) {}

  @Post()
  @UseGuards(AuthGuard('jwt'))
  create(@Body() createArticleDto: Prisma.ArticleCreateInput) {
    return this.articlesService.create(createArticleDto);
  }

  @Get()
  findAll(@Query() filters: FilterArticleDto) {
    return this.articlesService.findAll(filters);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.articlesService.findOne(+id);
  }

  @Patch(':id')
  @UseGuards(AuthGuard('jwt'))
  update(@Param('id') id: string, @Body() updateArticleDto: Prisma.ArticleUpdateInput) {
    return this.articlesService.update(+id, updateArticleDto);
  }

  @Delete(':id')
  @UseGuards(AuthGuard('jwt'))
  remove(@Param('id') id: string) {
    return this.articlesService.remove(+id);
  }
}