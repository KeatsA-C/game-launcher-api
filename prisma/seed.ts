import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const db = new PrismaClient();
const rounds = 12;

async function main() {
  const username = 'admin';
  const password = 'supersecret';

  const passwordHash = await bcrypt.hash(password, rounds);

  await db.user.upsert({
    where: { username },
    update: {},
    create: { username, passwordHash, role: 'Admin' },
  });
  console.log('Seeded admin:supersecret');
}

main().then(() => db.$disconnect());
