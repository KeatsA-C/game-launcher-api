// prisma/seed.ts
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const db = new PrismaClient();
const ROUNDS = 12;

async function ensureGame(name: string, license: string) {
  const existing = await db.game.findUnique({ where: { name } });
  if (existing) return { created: false };
  await db.game.create({ data: { name, license } });
  return { created: true };
}

async function ensureUser(username: string, role: string, password: string) {
  const existing = await db.user.findUnique({ where: { username } });
  if (existing) return { created: false };
  const passwordHash = await bcrypt.hash(password, ROUNDS);
  await db.user.create({ data: { username, role, passwordHash } });
  return { created: true };
}

async function main() {
  // Game: only PluginEnvironment
  const lic = process.env.PLUGINENV_LICENSE ?? 'PE-LIC-0001-DEFAULT';
  const g = await ensureGame('PluginEnvironment', lic);

  // Users: Admin, Dev, User
  const a = await ensureUser('admin', 'Admin', 'Admin123!');
  const d = await ensureUser('dev', 'Dev', 'dev12345');
  const u = await ensureUser('user', 'User', 'user12345');

  console.log(
    `Seed: game created=${g.created}, users created: ` +
      `admin=${a.created}, dev=${d.created}, user=${u.created}`,
  );
}

main()
  .catch(async (e) => {
    console.error('[seed] failed:', e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
