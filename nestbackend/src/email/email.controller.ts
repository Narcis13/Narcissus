import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { EmailService } from './email.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'; // Adjust path as needed

// Define a DTO for email requests
class SendEmailDto {
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
  attachments?: any[];
}

@Controller('email')
export class EmailController {
  constructor(private readonly emailService: EmailService) {}

  @Post('send')
  @UseGuards(JwtAuthGuard) // Add authentication guard for security
  async sendEmail(@Body() emailDto: SendEmailDto) {
    return this.emailService.sendEmail(
      emailDto.to,
      emailDto.subject,
      emailDto.text,
      emailDto.html,
      emailDto.attachments,
    );
  }
}