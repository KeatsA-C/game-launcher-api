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
import { AUTH_SERVICE } from './auth.tokens';

@Module({
  imports: [
    UserModule,
    PassportModule,
    JwtModule.register({ secret: jwtConstants.secret }),
    RedisModule,
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    { provide: AUTH_SERVICE, useExisting: AuthService },
    JwtStrategy,
    TokenBlocklistService,
  ],
  exports: [TokenBlocklistService, AUTH_SERVICE],
})
export class AuthModule {}
