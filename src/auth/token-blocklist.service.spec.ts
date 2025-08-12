// test/token-blocklist.service.spec.ts
import RedisMock from 'ioredis-mock';
import { TokenBlocklistService } from './token-blocklist.service';

describe('TokenBlocklistService', () => {
  let redis: any;
  let svc: TokenBlocklistService;

  beforeEach(() => {
    redis = new RedisMock();
    // Patch injection contract
    svc = new TokenBlocklistService(redis as any);
  });

  it('blocks a jti with TTL', async () => {
    const jti = 'abc123';
    await svc.block(jti, 5);
    expect(await svc.isBlocked(jti)).toBe(true);
    const ttl = await svc.ttl(jti);
    expect(ttl).toBeGreaterThan(0);
  });

  it('no-op on non-positive ttl', async () => {
    const jti = 'noop';
    await svc.block(jti, 0);
    expect(await svc.isBlocked(jti)).toBe(false);
  });

  it('revocation expires automatically', async () => {
    const jti = 'short';
    await svc.block(jti, 1);
    expect(await svc.isBlocked(jti)).toBe(true);
    await new Promise((r) => setTimeout(r, 1100));
    expect(await svc.isBlocked(jti)).toBe(false);
  });
});
