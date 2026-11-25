import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../modules/users/entities/user.entity';
import { UserRole, UserStatus } from '../../common/enums';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AdminSeeder {
  private readonly logger = new Logger(AdminSeeder.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly configService: ConfigService,
  ) {}

  async seed(): Promise<void> {
    try {
      const defaultEmail = 'admin@example.com';
      const defaultPassword = 'admin123456';

      const envEmail = this.configService.get<string>('ADMIN_EMAIL');
      const envPassword = this.configService.get<string>('ADMIN_PASSWORD');
      const envFirstName = this.configService.get<string>('ADMIN_FIRST_NAME') || 'Admin';
      const envLastName = this.configService.get<string>('ADMIN_LAST_NAME') || 'User';

      const adminTargets = [
        {
          email: defaultEmail,
          password: defaultPassword,
          firstName: 'Admin',
          lastName: 'User',
        },
      ];

      if (envEmail && envPassword && envEmail.trim().toLowerCase() !== defaultEmail) {
        adminTargets.push({
          email: envEmail.trim().toLowerCase(),
          password: envPassword,
          firstName: envFirstName,
          lastName: envLastName,
        });
      }

      for (const target of adminTargets) {
        await this.seedTargetAdmin(target.email, target.password, target.firstName, target.lastName);
      }
    } catch (error) {
      this.logger.error('Error during admin seeding:', error);
      throw error;
    }
  }

  private async seedTargetAdmin(email: string, password: string, firstName: string, lastName: string): Promise<void> {
    const existingAdmin = await this.userRepository.findOne({
      where: { email: email.toLowerCase() },
    });

    const rounds = parseInt(this.configService.get<string>('BCRYPT_ROUNDS', '12'));

    if (existingAdmin) {
      let needsUpdate = false;
      if (existingAdmin.status !== UserStatus.ACTIVE || !existingAdmin.isEmailVerified || existingAdmin.role !== UserRole.SUPER_ADMIN) {
        existingAdmin.status = UserStatus.ACTIVE;
        existingAdmin.isEmailVerified = true;
        existingAdmin.role = UserRole.SUPER_ADMIN;
        needsUpdate = true;
      }
      let matches = false;
      try {
        matches = await bcrypt.compare(password, existingAdmin.password);
      } catch (_) {
        matches = false;
      }
      if (!matches) {
        existingAdmin.password = await bcrypt.hash(password, rounds);
        needsUpdate = true;
      }
      if (needsUpdate) {
        await this.userRepository.save(existingAdmin);
        this.logger.log(`Admin user refreshed: ${email}`);
      } else {
        this.logger.log(`Admin user already exists and credentials match: ${email}`);
      }
      return;
    }

    const hashedPassword = await bcrypt.hash(password, rounds);
    const adminUser = this.userRepository.create({
      email: email.toLowerCase(),
      password: hashedPassword,
      firstName,
      lastName,
      role: UserRole.SUPER_ADMIN,
      status: UserStatus.ACTIVE,
      isEmailVerified: true,
    });

    await this.userRepository.save(adminUser);
    this.logger.log(`Admin user created: ${email}`);
  }
}
