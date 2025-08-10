import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { jwtConstants } from './constants';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UserModule } from '../user/user.module';
import { JwtStrategy } from './jwt.strategy';
import { TokenBlocklistService } from './token-blocklist.service';
import { RedisModule } from 'src/redis/redis.module';

@Module({
  imports: [
    UserModule,
    PassportModule,
    JwtModule.register({ secret: jwtConstants.secret }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, TokenBlocklistService],
  exports: [TokenBlocklistService],
})
export class AuthModule {}
