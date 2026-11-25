import { Module, Global } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { createCache } from 'cache-manager';
import { redisStore } from 'cache-manager-redis-yet';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CacheService } from '@/shared/cache/cache.service';
import { redisConfig } from '@/config';

@Global()
@Module({
  imports: [
    ConfigModule.forRoot({
      load: [redisConfig],
    }),
  ],
  providers: [
    {
      provide: CACHE_MANAGER,
      useFactory: async (configService: ConfigService) => {
        const rc = configService.get('redis');
        const url = `redis://${rc.host}:${rc.port}`;
        const redisStoreInstance = await redisStore({
          url,
          password: rc.password,
          database: rc.db,
          ttl: rc.ttl,
        });
        return createCache({ stores: [redisStoreInstance as any], ttl: (rc.ttl || 3600) * 1000 });
      },
      inject: [ConfigService],
    },
    CacheService,
  ],
  exports: [CACHE_MANAGER, CacheService],
})
export class RedisCacheModule {}