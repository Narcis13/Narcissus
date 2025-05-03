import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { CreateUserDto } from './dto/create-user.dto';
import { EmailService } from '../email/email.service';
import * as bcrypt from 'bcrypt';
import { Cron } from '@nestjs/schedule';

@Injectable()
export class UsersService {
  constructor(private readonly databaseService: DatabaseService, private readonly emailService:EmailService) {}

  private readonly logger = new Logger(UsersService.name);

  async findByUsername(username: string) {
    return this.databaseService.user.findUnique({
      where: { username },
    });
  }

  async findById(id: number) {
    return this.databaseService.user.findUnique({
      where: { id },
    });
  }
  async sendMailToUser(userData:any){
    await this.emailService.sendEmail(
      userData.email,
      'Welcome to Our Platform',
      'Thank you for joining our platform!!',
      '<h1>Welcome!</h1><p>Thank you for joining our platform!</p>',
    );
  }
  async create(createUserDto: CreateUserDto) {
    const hashedPassword = await bcrypt.hash(createUserDto.password, 10);
    const { password, ...result } = await this.databaseService.user.create({
      data: {
        ...createUserDto,
        password: hashedPassword,
      },
    });
    return result;
  }

  @Cron('15 * * * * *')
  handleCron() {
    this.logger.debug('Called when the current second is 15');
  }
}
