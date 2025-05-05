import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database/database.module';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { FeaturesModule } from './features/features.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { ProductModule } from './product/product.module';
import { EmailModule } from './email/email.module';
import { FileUploadModule } from './file-upload/file-upload.module';
@Module({
  imports: [
    UsersModule,
    AuthModule,
    ProductModule,
    EmailModule,
    FileUploadModule,
    DatabaseModule, FeaturesModule, ConfigModule.forRoot(), ScheduleModule.forRoot()],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
