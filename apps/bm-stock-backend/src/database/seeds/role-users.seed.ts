import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../modules/users/entities/user.entity';
import { Company } from '../../modules/company/entities/company.entity';
import { Warehouse } from '../../modules/warehouse/entities/warehouse.entity';
import { Shop } from '../../modules/shops/entities/shops.entity';
import { UserRole, UserStatus, CompanyStatus } from '../../common/enums';
import { UsersService } from '../../modules/users/services/users.service';
import * as bcrypt from 'bcrypt';

/**
 * Fixed (randomly generated) Ethiopian phone numbers used as the login
 * identifier for each seeded role account. Phone is the credential testers use
 * to sign in (POST /auth/login accepts phone OR email). The email column is nullable
 * and no synthetic emails are generated.
 */
interface SeedRoleAccount {
  role: UserRole;
  phone: string;
  password: string;
  firstName: string;
  lastName: string;
  jobTitle?: string;
  attachCompany?: boolean;
  attachWarehouse?: boolean;
  attachShop?: boolean;
}

const SEED_COMPANY_NAME = 'BM Seed Demo Company';
const SEED_WAREHOUSE_NAME = 'Seed Main Warehouse';
const SEED_SHOP_NAME = 'Seed Main Shop';

const SEED_ROLE_ACCOUNTS: SeedRoleAccount[] = [
  {
    role: UserRole.SUPER_ADMIN,
    phone: '+251954068503',
    password: 'SuperAdmin2026!',
    firstName: 'Seed',
    lastName: 'SuperAdmin',
    jobTitle: 'Platform Super Admin',
  },
  {
    role: UserRole.ADMIN,
    phone: '+251911315781',
    password: 'AdminRole2026!',
    firstName: 'Seed',
    lastName: 'Admin',
    jobTitle: 'Platform Admin',
  },
  {
    role: UserRole.COMPANY_ADMIN,
    phone: '+251975211884',
    password: 'CompanyAdmin2026!',
    firstName: 'Seed',
    lastName: 'CompanyAdmin',
    jobTitle: 'Company Admin',
    attachCompany: true,
  },
  {
    role: UserRole.MANAGER,
    phone: '+251973007562',
    password: 'ManagerRole2026!',
    firstName: 'Seed',
    lastName: 'Manager',
    jobTitle: 'Manager',
    attachCompany: true,
    attachWarehouse: true,
    attachShop: true,
  },
  {
    role: UserRole.SHOP_EMPLOYEE,
    phone: '+251984932630',
    password: 'ShopStaff2026!',
    firstName: 'Seed',
    lastName: 'ShopEmployee',
    jobTitle: 'Shop Employee',
    attachCompany: true,
    attachShop: true,
  },
  {
    role: UserRole.WAREHOUSE_EMPLOYEE,
    phone: '+251990422502',
    password: 'WarehouseStaff2026!',
    firstName: 'Seed',
    lastName: 'WarehouseEmployee',
    jobTitle: 'Warehouse Employee',
    attachCompany: true,
    attachWarehouse: true,
  },
  {
    role: UserRole.USER,
    phone: '+251992308403',
    password: 'BasicUser2026!',
    firstName: 'Seed',
    lastName: 'User',
    attachCompany: true,
  },
];

@Injectable()
export class RoleUsersSeeder {
  private readonly logger = new Logger(RoleUsersSeeder.name);

  constructor(
    private readonly usersService: UsersService,
    @InjectRepository(Company)
    private readonly companyRepository: Repository<Company>,
    @InjectRepository(Warehouse)
    private readonly warehouseRepository: Repository<Warehouse>,
    @InjectRepository(Shop)
    private readonly shopRepository: Repository<Shop>,
  ) {}

  async seed(): Promise<void> {
    try {
      const company = await this.ensureCompany();
      const warehouse = await this.ensureWarehouse(company);
      const shop = await this.ensureShop(company, warehouse);

      for (const account of SEED_ROLE_ACCOUNTS) {
        try {
          const hashedPassword = await bcrypt.hash(account.password, 10);
          const existing = await this.usersService.findUserByPhone(account.phone);
          if (existing) {
            const isAlreadyHashed = existing.password && (existing.password.startsWith('$2a$') || existing.password.startsWith('$2b$'));
            let passwordMatches = false;
            if (isAlreadyHashed) {
              try {
                passwordMatches = await bcrypt.compare(account.password, existing.password);
              } catch (_) {
                passwordMatches = false;
              }
            }
            let updated = false;
            if (!passwordMatches || existing.status !== UserStatus.ACTIVE || !existing.isEmailVerified) {
              existing.password = hashedPassword;
              existing.status = UserStatus.ACTIVE;
              existing.isEmailVerified = true;
              updated = true;
            }
            if (account.attachCompany && !existing.companyId) {
              existing.company = company;
              existing.companyId = company.id;
              updated = true;
            }
            if (account.attachWarehouse && !existing.warehouseId) {
              existing.warehouse = warehouse;
              existing.warehouseId = warehouse.id;
              updated = true;
            }
            if (account.attachShop && !existing.shopId) {
              existing.shop = shop;
              existing.shopId = shop.id;
              updated = true;
            }
            if (account.role === UserRole.COMPANY_ADMIN) {
              if (!existing.subscriptionExpiresAt || new Date(existing.subscriptionExpiresAt) < new Date()) {
                const oneYearFromNow = new Date();
                oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);
                existing.subscriptionExpiresAt = oneYearFromNow;
                existing.planId = 'large';
                existing.planTitle = 'Large Business (Demo)';
                existing.planAmount = 15999;
                existing.planPeriod = 'large';
                existing.paymentStatus = 'CONFIRMED';
                updated = true;
              }
              if (!company.createdById) {
                company.createdById = existing.id;
                await this.companyRepository.save(company);
              }
            }
            if (updated) {
              await this.usersService.saveUser(existing);
              this.logger.log(`Updated credentials and status for existing role account: ${account.role} (${account.phone})`);
            } else {
              this.logger.log(`Role account already exists: ${account.role} (${account.phone})`);
            }
            continue;
          }

          const user = await this.usersService.create({
            password: hashedPassword,
            firstName: account.firstName,
            lastName: account.lastName,
            phone: account.phone,
            role: account.role,
            companyId: account.attachCompany ? company.id : undefined,
            warehouseId: account.attachWarehouse ? warehouse.id : undefined,
            shopId: account.attachShop ? shop.id : undefined,
          });

          user.status = UserStatus.ACTIVE;
          user.isEmailVerified = true;
          if (account.role === UserRole.COMPANY_ADMIN) {
            user.planId = 'large';
            user.planTitle = 'Large Business (Demo)';
            user.planAmount = 15999;
            user.planPeriod = 'large';
            user.numCompanies = 3;
            user.paymentStatus = 'CONFIRMED';
            user.paymentRef = 'SEED_DEMO_ACCOUNT';
            const oneYearFromNow = new Date();
            oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);
            user.subscriptionExpiresAt = oneYearFromNow;
            user.subscriptionStartDate = new Date();
          }
          await this.usersService.saveUser(user);

          if (account.role === UserRole.COMPANY_ADMIN) {
            company.createdById = user.id;
            await this.companyRepository.save(company);
          }

          this.logger.log(`Seeded role account: ${account.role} (${account.phone})`);
        } catch (error) {
          this.logger.error(`Failed to seed role ${account.role}: ${(error as Error)?.message || error}`);
        }
      }

      this.logger.log('Role users seeding completed');
    } catch (error) {
      this.logger.error('Error during role users seeding:', error);
      throw error;
    }
  }

  private async ensureCompany(): Promise<Company> {
    let company = await this.companyRepository.findOne({ where: { name: SEED_COMPANY_NAME } });
    if (!company) {
      company = this.companyRepository.create({
        name: SEED_COMPANY_NAME,
        address: 'Addis Ababa, Ethiopia',
        phoneNumber: SEED_ROLE_ACCOUNTS[2].phone,
        description: 'Seed company used to provision one demo account per user role.',
        status: CompanyStatus.ACTIVE,
      });
      company = await this.companyRepository.save(company);
      this.logger.log('Seed company created');
    }
    return company;
  }

  private async ensureWarehouse(company: Company): Promise<Warehouse> {
    let warehouse = await this.warehouseRepository.findOne({ where: { name: SEED_WAREHOUSE_NAME } });
    if (!warehouse) {
      warehouse = this.warehouseRepository.create({
        name: SEED_WAREHOUSE_NAME,
        location: 'Addis Ababa',
        description: 'Seed warehouse for role accounts',
        company,
      });
      warehouse = await this.warehouseRepository.save(warehouse);
      this.logger.log('Seed warehouse created');
    }
    return warehouse;
  }

  private async ensureShop(company: Company, warehouse: Warehouse): Promise<Shop> {
    let shop = await this.shopRepository.findOne({ where: { name: SEED_SHOP_NAME } });
    if (!shop) {
      shop = this.shopRepository.create({
        name: SEED_SHOP_NAME,
        location: 'Addis Ababa',
        company,
        warehouse,
      });
      shop = await this.shopRepository.save(shop);
      this.logger.log('Seed shop created');
    }
    return shop;
  }
}
