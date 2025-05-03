// file-upload/file-upload.service.ts
import { Injectable } from '@nestjs/common';
import { unlinkSync } from 'fs';

@Injectable()
export class FileUploadService {
  /**
   * Deletes a file from the uploads directory
   * @param filePath Path to the file relative to the uploads directory
   * @returns true if file deleted successfully, false otherwise
   */
  async deleteFile(filePath: string): Promise<boolean> {
    try {
      unlinkSync(`./incarcari/${filePath}`);
      return true;
    } catch (error) {
      console.error('Error deleting file:', error);
      return false;
    }
  }

  /**
   * Gets the full URL for a file
   * @param fileName Filename stored in the database
   * @param req Express request object
   * @returns Full URL to access the file
   */
  getFileUrl(fileName: string, req: any): string {
    // You can customize this based on your application setup
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    return `${baseUrl}/incarcari/${fileName}`;
  }
}