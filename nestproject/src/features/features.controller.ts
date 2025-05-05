import { Controller, Get, Param, NotFoundException } from '@nestjs/common';
import { FeaturesService } from './features.service';

@Controller('features')
export class FeaturesController {
  constructor(private readonly featuresService: FeaturesService) {}

  @Get('models/:modelName')
  async getModelMetadata(@Param('modelName') modelName: string) {
    try {
      return await this.featuresService.getModelMetadata(modelName);
    } catch (error) {
      throw new NotFoundException(`Model ${modelName} not found`);
    }
  }

  @Get('models')
  async getAllModels() {
    return await this.featuresService.getAllModels();
  }

  @Get('prisma/models')
  async prismaAllModels() {
    return await this.featuresService.prismaAllModels();
  }

  @Get('prisma/models/:modelName')
  async prismaModel(@Param('modelName') modelName: string) {
    return await this.featuresService.prismaModel(modelName);
  }

  @Get('prisma/modelenums')
  async prismaEnums() {
    return await this.featuresService.prismaEnums();
  }

}