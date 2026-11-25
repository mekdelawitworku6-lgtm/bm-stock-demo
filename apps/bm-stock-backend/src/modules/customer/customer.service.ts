import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Customer } from './entities/customer.entity';
import { CreateCustomerDto, UpdateCustomerDto, CustomerQueryDto, CustomerResponseDto } from './dto';
import { PaginatedResult } from '../../common/interfaces';
import { Company } from '../company/entities/company.entity';

@Injectable()
export class CustomerService {
  constructor(
    @InjectRepository(Customer)
    private readonly customerRepository: Repository<Customer>,
    @InjectRepository(Company)
    private readonly companyRepository: Repository<Company>,
  ) {}

  async create(createCustomerDto: CreateCustomerDto, companyId?: string): Promise<CustomerResponseDto> {
    if (createCustomerDto.phoneNumber) {
      const phone = createCustomerDto.phoneNumber.trim();
      if (!phone) {
        delete createCustomerDto.phoneNumber;
      } else {
        createCustomerDto.phoneNumber = phone;
        const where: Record<string, unknown> = { phoneNumber: phone };
        if (companyId) {
          where.company = { id: companyId };
        }
        const existingCustomer = await this.customerRepository.findOne({ where });
        if (existingCustomer) {
          throw new ConflictException('Customer with this phone number already exists');
        }
      }
    }

    const customer = this.customerRepository.create(createCustomerDto);
    if (companyId) {
      customer.company = { id: companyId } as Company;
    }
    const savedCustomer = await this.customerRepository.save(customer);
    return this.mapToResponseDto(savedCustomer);
  }

  async findAll(query: CustomerQueryDto, companyId?: string): Promise<PaginatedResult<CustomerResponseDto>> {
    if (!companyId) {
      return { data: [], total: 0, page: 1, limit: 10, totalPages: 0 };
    }

    const { search, page = 1, limit = 50 } = query;
    const pageNum = Number(page) || 1;
    const limitNum = Number(limit) || 50;

    const queryBuilder = this.customerRepository.createQueryBuilder('customer')
      .leftJoin('customer.company', 'company')
      .where('company.id = :companyId', { companyId });

    if (search) {
      queryBuilder.andWhere('(customer.name ILIKE :search OR customer.phoneNumber ILIKE :search)', { search: `%${search}%` });
    }

    const [customers, total] = await queryBuilder
      .orderBy('customer.createdAt', 'DESC')
      .skip((pageNum - 1) * limitNum)
      .take(limitNum)
      .getManyAndCount();

    const customerIds = customers.map(c => c.id);
    const creditMap = new Map<string, number>();

    if (customerIds.length > 0) {
      try {
        const salesCredits = await this.customerRepository.manager
          .createQueryBuilder()
          .select('s.customer_id', 'customerId')
          .addSelect('COALESCE(SUM(s.remaining_balance), 0)', 'totalCredit')
          .from('sales', 's')
          .where('s.customer_id IN (:...customerIds)', { customerIds })
          .andWhere('s.payment_type = :paymentType', { paymentType: 'credit' })
          .andWhere('s.remaining_balance > 0')
          .andWhere("s.status != 'cancelled'")
          .groupBy('s.customer_id')
          .getRawMany();

        salesCredits.forEach(sc => {
          const cid = sc.customerId || sc.customerid;
          if (cid) {
            creditMap.set(cid, parseFloat(sc.totalCredit || sc.totalcredit) || 0);
          }
        });
      } catch (_) {}
    }

    return {
      data: customers.map(c => ({
        ...this.mapToResponseDto(c),
        totalCredit: creditMap.get(c.id) || 0,
      })),
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
    };
  }

  async findOne(id: string, companyId?: string): Promise<CustomerResponseDto> {
    const customer = await this.customerRepository.findOne({
      where: { id },
      relations: ['company'],
    });
    if (!customer) throw new NotFoundException('Customer not found');
    if (companyId && customer.company?.id !== companyId) {
      throw new NotFoundException('Customer not found');
    }
    return this.mapToResponseDto(customer);
  }

  async update(id: string, updateCustomerDto: UpdateCustomerDto, companyId?: string): Promise<CustomerResponseDto> {
    const customer = await this.customerRepository.findOne({
      where: { id },
      relations: ['company'],
    });
    if (!customer) throw new NotFoundException('Customer not found');
    if (companyId && customer.company?.id !== companyId) {
      throw new NotFoundException('Customer not found');
    }
    Object.assign(customer, updateCustomerDto);
    const updatedCustomer = await this.customerRepository.save(customer);
    return this.mapToResponseDto(updatedCustomer);
  }

  async remove(id: string, companyId?: string): Promise<void> {
    const customer = await this.customerRepository.findOne({
      where: { id },
      relations: ['company'],
    });
    if (!customer) throw new NotFoundException('Customer not found');
    if (companyId && customer.company?.id !== companyId) {
      throw new NotFoundException('Customer not found');
    }
    const result = await this.customerRepository.delete(id);
    if (result.affected === 0) throw new NotFoundException('Customer not found');
  }

//   async addLoyaltyPoints(id: string, points: number): Promise<CustomerResponseDto> {
//     const customer = await this.customerRepository.findOne({ where: { id } });
//     if (!customer) throw new NotFoundException('Customer not found');
//     customer.loyaltyPoints += points;
//     const updatedCustomer = await this.customerRepository.save(customer);
//     return this.mapToResponseDto(updatedCustomer);
//   }

  private mapToResponseDto(customer: Customer): CustomerResponseDto {
    return {
      id: customer.id,
      name: customer.name,
      phoneNumber: customer.phoneNumber,
      address: customer.address,
      status: customer.status,
    //   loyaltyPoints: customer.loyaltyPoints,
      createdAt: customer.createdAt,
      updatedAt: customer.updatedAt,
    };
  }
}