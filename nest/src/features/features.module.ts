import { Module } from '@nestjs/common';
import { FeaturesController } from './features.controller';
import { FeaturesService } from './features.service';
import { PrismaSchemaParserService } from './prisma-schema-parser.service';



@Module({
  imports: [

  ],
  controllers: [FeaturesController],
  providers: [FeaturesService,PrismaSchemaParserService],
  exports: [

  ]
})
export class FeaturesModule {}