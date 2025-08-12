// src/redis/redis.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { redisProvider, REDIS } from './redis.provider';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true })],
  providers: [redisProvider],
  exports: [REDIS],
})
export class RedisModule {}
