// file-upload/file-upload.controller.ts
import {
    Controller,
    Post,
    UseInterceptors,
    UploadedFile,
    UploadedFiles,
    BadRequestException,
    Param,
    Delete,
    Res,
    Get,
    Req,
  } from '@nestjs/common';
  import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
  import { Express } from 'express';
  import { FileUploadService } from './file-upload.service';
  import { Response } from 'express';
  import * as path from 'path';
  
  @Controller('upload')
  export class FileUploadController {
    constructor(private readonly fileUploadService: FileUploadService) {}
  
    @Post('single')
    @UseInterceptors(FileInterceptor('file'))
    async uploadFile(@UploadedFile() file: Express.Multer.File, @Req() req: any) {
      if (!file) {
        throw new BadRequestException('No file uploaded');
      }
  
      return {
        originalName: file.originalname,
        fileName: file.filename,
        size: file.size,
        path: file.path,
        url: this.fileUploadService.getFileUrl(file.filename, req),
      };
    }
  
    @Post('multiple')
    @UseInterceptors(FilesInterceptor('files', 10)) // Maximum 10 files
    async uploadMultipleFiles(@UploadedFiles() files: Express.Multer.File[], @Req() req: any) {
      if (!files || files.length === 0) {
        throw new BadRequestException('No files uploaded');
      }
  
      return files.map(file => ({
        originalName: file.originalname,
        fileName: file.filename,
        size: file.size,
        path: file.path,
        url: this.fileUploadService.getFileUrl(file.filename, req),
      }));
    }
  
    @Delete(':filename')
    async deleteFile(@Param('filename') filename: string) {
      const deleted = await this.fileUploadService.deleteFile(filename);
      if (!deleted) {
        throw new BadRequestException('File could not be deleted');
      }
      return { message: 'File deleted successfully' };
    }
  
    // Serve files (static file server)
    @Get(':filename')
    async getFile(@Param('filename') filename: string, @Res() res: Response) {
      return res.sendFile(filename, { root: './incarcari' });
    }
  }