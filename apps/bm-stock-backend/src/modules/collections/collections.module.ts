import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CollectionsController } from './collections.controller';
import { CollectionsService } from './collections.service';
import { Branch } from './entities/branch.entity';
import { Supplier } from './entities/supplier.entity';
import { ProductGroup } from './entities/product-group.entity';
import { Product } from '../products/entities/product.entity';
import { Company } from '../company/entities/company.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Branch, Supplier, ProductGroup, Product, Company])],
  controllers: [CollectionsController],
  providers: [CollectionsService],
  exports: [CollectionsService]
})
export class CollectionsModule {}
