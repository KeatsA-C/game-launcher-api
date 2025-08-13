// src/launcher/launcher.module.ts
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { RedisModule } from '../redis/redis.module';
import { LauncherController } from './launcher.controller';
import { LauncherService } from './launcher.service';
import { LauncherTokenIssuerService } from './launcher-token-issuer.service';
import { LauncherWsModule } from './ws/launcher.ws.module';
@Module({
  imports: [
    RedisModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET, // or privateKey/publicKey if you use RSA/ECDSA
      signOptions: {
        issuer: process.env.JWT_ISSUER,
        audience: process.env.JWT_AUDIENCE,
      },
    }),
    LauncherWsModule,
  ],
  controllers: [LauncherController],
  providers: [LauncherService, LauncherTokenIssuerService], // <- concrete class provided here
  exports: [], // nothing needed outside
})
export class LauncherModule {}
