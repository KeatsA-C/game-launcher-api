// src/redis/redis.provider.ts
import { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

export const REDIS = Symbol('REDIS');

export const redisProvider: Provider = {
  provide: REDIS,
  inject: [ConfigService],
  useFactory: (cfg: ConfigService) => {
    const url = cfg.get<string>('REDIS_URL');
    if (!url) throw new Error('REDIS_URL is required');
    return new Redis(url, { maxRetriesPerRequest: 2, lazyConnect: false });
  },
};
