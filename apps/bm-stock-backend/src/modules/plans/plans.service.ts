import { Injectable, NotFoundException, OnModuleInit, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Plan } from './entities/plan.entity';
import { CreatePlanDto, UpdatePlanDto, PlanResponseDto } from './dto/plan.dto';

const DEFAULT_PLANS: Array<Partial<Plan>> = [
  {
    title: 'Free Trial',
    price: '0',
    amount: 0,
    period: 'trial',
    features: [
      '14-Day Free Trial',
      'All features included for evaluation',
      'Up to 1 store',
      'Up to 1 warehouse',
      'Up to 1 staff account',
      'Single product entry',
      'Mobile app access only',
      'No payment required',
    ],
    moreCount: 0,
    sortOrder: 0,
    isActive: true,
  },
  {
    title: 'Small Business',
    price: '7,999',
    amount: 7999,
    period: 'small',
    features: [
      'Up to 1 store',
      'Up to 1 warehouse',
      'Up to 1 staff account',
      'Single product entry only (No bulk/import)',
      'Mobile app access only',
      'Basic analytics & reports',
    ],
    moreCount: 0,
    sortOrder: 1,
    isActive: true,
  },
  {
    title: 'Medium Business',
    price: '10,999',
    amount: 10999,
    period: 'medium',
    features: [
      'Up to 5 stores',
      'Up to 5 shops',
      'Up to 5 staff accounts',
      'Bulk product entry',
      'Mobile app access only',
      'Advanced analytics & reports',
    ],
    moreCount: 0,
    sortOrder: 2,
    isActive: true,
  },
  {
    title: 'Large Business',
    price: '15,999',
    amount: 15999,
    period: 'large',
    features: [
      'Unlimited stores',
      'Unlimited shops',
      'Unlimited staff accounts',
      'Bulk product entry',
      'CSV & PDF product importing',
      'Commission management',
      'Product borrowing',
      'Full Web App & Mobile Access',
      'Advanced analytics & custom reports',
      '24/7 priority support',
    ],
    moreCount: 0,
    sortOrder: 3,
    isActive: true,
  },
  {
    title: 'Verification Test',
    price: '1',
    amount: 1,
    period: 'verification_test',
    features: [
      'Instant receipt-verified activation',
      'No admin approval required',
      'Up to 1 store',
      'Up to 1 shop',
      'Up to 1 staff account',
    ],
    moreCount: 0,
    sortOrder: 4,
    isActive: true,
  },
];

@Injectable()
export class PlansService implements OnModuleInit {
  private readonly logger = new Logger(PlansService.name);

  constructor(
    @InjectRepository(Plan)
    private readonly plansRepository: Repository<Plan>,
  ) {}

  async onModuleInit() {
    const count = await this.plansRepository.count();
    if (count === 0) {
      this.logger.log('No plans found, seeding default plans');
      await this.plansRepository.save(this.plansRepository.create(DEFAULT_PLANS));
    } else {
      // Sync existing plan prices with hardcoded defaults or insert missing default plans
      const validPeriods = DEFAULT_PLANS.map((p) => p.period).filter(Boolean);

      for (const defaultPlan of DEFAULT_PLANS) {
        if (!defaultPlan.period) continue;
        const existing = await this.plansRepository.findOne({ where: { period: defaultPlan.period } });
        if (!existing) {
          await this.plansRepository.save(this.plansRepository.create(defaultPlan));
          this.logger.log(`Seeded missing default plan "${defaultPlan.title}" (${defaultPlan.period})`);
        } else {
          const needsUpdate =
            existing.price !== defaultPlan.price ||
            existing.amount !== defaultPlan.amount ||
            existing.title !== defaultPlan.title ||
            JSON.stringify(existing.features) !== JSON.stringify(defaultPlan.features);
          if (needsUpdate) {
            existing.price = defaultPlan.price!;
            existing.amount = defaultPlan.amount!;
            existing.title = defaultPlan.title!;
            existing.features = defaultPlan.features!;
            await this.plansRepository.save(existing);
            this.logger.log(`Updated plan "${existing.title}" (${defaultPlan.period})`);
          }
        }
      }

      // Deactivate old plans that no longer match the new tier system
      const allPlans = await this.plansRepository.find();
      for (const plan of allPlans) {
        if (!validPeriods.includes(plan.period) && plan.isActive) {
          plan.isActive = false;
          await this.plansRepository.save(plan);
          this.logger.log(`Deactivated legacy plan "${plan.title}" (${plan.period})`);
        }
      }
    }
  }

  private isBillablePlan(plan: Plan): boolean {
    return plan.isActive;
  }

  async findAllPublic(): Promise<PlanResponseDto[]> {
    const plans = await this.plansRepository.find({
      where: { isActive: true },
      order: { sortOrder: 'ASC' },
    });
    return plans.map((p) => this.mapToResponseDto(p));
  }

  async findAll(): Promise<PlanResponseDto[]> {
    const plans = await this.plansRepository.find({
      order: { sortOrder: 'ASC' },
    });
    return plans.map((p) => this.mapToResponseDto(p));
  }

  async findBillableById(idOrPeriod: string): Promise<PlanResponseDto> {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrPeriod);
    const plan = isUuid
      ? await this.plansRepository.findOne({ where: { id: idOrPeriod } })
      : await this.plansRepository.findOne({ where: { period: idOrPeriod } });

    if (!plan || !this.isBillablePlan(plan)) {
      throw new NotFoundException('Plan not found');
    }
    return this.mapToResponseDto(plan);
  }

  async findOneById(idOrPeriod: string): Promise<PlanResponseDto | null> {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrPeriod);
    const plan = isUuid
      ? await this.plansRepository.findOne({ where: { id: idOrPeriod } })
      : await this.plansRepository.findOne({ where: { period: idOrPeriod } });

    return plan ? this.mapToResponseDto(plan) : null;
  }

  async create(dto: CreatePlanDto): Promise<PlanResponseDto> {
    const plan = this.plansRepository.create({
      ...dto,
      period: dto.period || '',
      moreCount: dto.moreCount ?? 0,
      sortOrder: dto.sortOrder ?? 0,
      isActive: dto.isActive ?? true,
    });
    const saved = await this.plansRepository.save(plan);
    return this.mapToResponseDto(saved);
  }

  async update(id: string, dto: UpdatePlanDto): Promise<PlanResponseDto> {
    const plan = await this.plansRepository.findOne({ where: { id } });
    if (!plan) {
      throw new NotFoundException('Plan not found');
    }
    Object.assign(plan, dto);
    const saved = await this.plansRepository.save(plan);
    return this.mapToResponseDto(saved);
  }

  async remove(id: string): Promise<{ success: boolean }> {
    const plan = await this.plansRepository.findOne({ where: { id } });
    if (!plan) {
      throw new NotFoundException('Plan not found');
    }
    await this.plansRepository.remove(plan);
    return { success: true };
  }

  private mapToResponseDto(plan: Plan): PlanResponseDto {
    const dto = new PlanResponseDto();
    Object.assign(dto, plan, {
      amount: Number(plan.amount),
    });
    return dto;
  }
}
