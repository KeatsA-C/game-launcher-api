import { Body, Controller, HttpCode, Post, Req } from '@nestjs/common';
import { AuthService } from './auth.service';
import { Public } from './public.decorator';
import { TokenBlocklistService } from './token-blocklist.service';
import { LoginDto } from './dto/login.dto';

@Controller('auth')
export class AuthController {
  constructor(
    private auth: AuthService,
    private readonly blocklist: TokenBlocklistService,
  ) {}

  @Public()
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto.username, dto.password);
  }

  @Post('logout')
  @HttpCode(204)
  async logout(@Req() req: any) {
    const { jti, exp } = req.user ?? {};
    if (!jti || !exp) return; // idempotent no-op
    const now = Math.floor(Date.now() / 1000);
    await this.blocklist.block(jti, Math.max(exp - now, 0));
  }
}
