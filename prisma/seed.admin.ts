import { PrismaClient, AdminRole } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('Admin@123', 10);

  await prisma.admin.upsert({
    where: { email: 'admin@biyeco.com' },
    update: {},
    create: {
      email: 'admin@biyeco.com',
      password: passwordHash,
      role: AdminRole.SUPER_ADMIN,
    },
  });

  console.log('✅ Super admin created');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
