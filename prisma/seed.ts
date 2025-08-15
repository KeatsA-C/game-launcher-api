// prisma/seed.ts
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const db = new PrismaClient();
const ROUNDS = 12;

function makeLicense(): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const pick = (n: number) =>
    Array.from(
      { length: n },
      () => alphabet[Math.floor(Math.random() * alphabet.length)],
    ).join('');
  return `${pick(5)}-${pick(5)}-${pick(5)}-${pick(5)}`;
}

async function main() {
  // Games: total desired = 5; "PluginEnvironment" already exists, so we seed 4 more
  const games = [
    { name: 'AssetHub', license: makeLicense() },
    { name: 'PhotonRunner', license: makeLicense() },
    { name: 'MapForge', license: makeLicense() },
    { name: 'NetArena', license: makeLicense() },
  ];

  // Users: one each role; "admin" already exists
  const users = [
    {
      username: 'user',
      role: 'User',
      passwordHash: await bcrypt.hash('user12345', ROUNDS),
    },
    {
      username: 'dev',
      role: 'Dev',
      passwordHash: await bcrypt.hash('dev12345', ROUNDS),
    },
  ];

  // Insert without pre-checks; skipDuplicates avoids unique-violation throws
  const g = await db.game.createMany({ data: games, skipDuplicates: true });
  const u = await db.user.createMany({ data: users, skipDuplicates: true });

  console.log(`Seeded games inserted: ${g.count}, users inserted: ${u.count}`);
}

main()
  .then(() => db.$disconnect())
  .catch(async (e) => {
    console.error('[seed] failed:', e);
    await db.$disconnect();
    process.exit(1);
  });
