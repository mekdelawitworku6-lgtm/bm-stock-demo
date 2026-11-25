import { Injectable, Inject, Logger } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';

@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);

  constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) {}

  async get<T>(key: string): Promise<T | undefined> {
    try {
      return await this.cacheManager.get<T>(key);
    } catch (error) {
      this.logger.warn('Cache get error: ' + error.message);
      return undefined;
    }
  }

  async set(key: string, value: any, ttl?: number): Promise<void> {
    try {
      await this.cacheManager.set(key, value, ttl);
    } catch (error) {
      this.logger.warn('Cache set error: ' + error.message);
    }
  }

  async del(key: string): Promise<void> {
    try {
      const store = this.getStore();
      if (store && typeof store.del === 'function') {
        await store.del(key);
      }
    } catch (error) {
      this.logger.warn('Cache del error: ' + error.message);
    }
  }

  async deletePattern(pattern: string): Promise<number> {
    try {
      const store = this.getStore();
      let keys: string[] = [];

      if (store) {
        if (typeof store.keys === 'function') {
          keys = await store.keys(pattern);
        } else if (store.client && typeof store.client.keys === 'function') {
          keys = await store.client.keys(pattern);
        } else if (store.client && typeof store.client.sendCommand === 'function') {
          keys = await store.client.sendCommand(['KEYS', pattern]);
        }
      }

      if (keys && keys.length > 0) {
        if (typeof store.del === 'function') {
          await Promise.all(keys.map((key: string) => store.del(key)));
        } else {
          await (this.cacheManager as any).clear();
        }
        return keys.length;
      }

      if (store && typeof store.reset === 'function') {
        await store.reset();
        return 1;
      }
      if (typeof (this.cacheManager as any).clear === 'function') {
        await (this.cacheManager as any).clear();
        return 1;
      }

      return 0;
    } catch (error) {
      this.logger.warn('Error deleting cache pattern: ' + error.message);
      try {
        if (typeof (this.cacheManager as any).clear === 'function') {
          await (this.cacheManager as any).clear();
        }
      } catch (_) {}
      return 0;
    }
  }

  private getStore(): any {
    const mgr = this.cacheManager as any;
    if (mgr.stores && mgr.stores.length > 0) {
      return mgr.stores[0];
    }
    return mgr.store;
  }

  generateKey(...args: string[]): string {
    return args.join(':');
  }
}