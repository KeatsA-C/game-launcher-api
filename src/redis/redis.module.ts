// src/redis/redis.module.ts
import { Module } from '@nestjs/common';
import Redis from 'ioredis';

@Module({
  providers: [
    {
      provide: 'REDIS',
      useFactory: () =>
        new Redis(process.env.REDIS_URL ?? 'redis://127.0.0.1:6379'),
    },
  ],
  exports: ['REDIS'],
})
export class RedisModule {}
