import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface PlanSeed {
  code: string;
  name: string;
  price: number;
  durationDays: number;
  isInviteOnly: boolean;
  category: string;
}

const plans: PlanSeed[] = [
  {
    code: 'ALAAP',
    name: 'Alaap',
    price: 999,
    durationDays: 30,
    isInviteOnly: false,
    category: 'subscription',
  },
  {
    code: 'JATRA',
    name: 'Jatra',
    price: 2999,
    durationDays: 30,
    isInviteOnly: false,
    category: 'subscription',
  },
  {
    code: 'AALOK',
    name: 'Aalok',
    price: 5999,
    durationDays: 30,
    isInviteOnly: false,
    category: 'subscription',
  },
  {
    code: 'OBHIJAAT',
    name: 'Obhijaat',
    price: 14999,
    durationDays: 30,
    isInviteOnly: true,
    category: 'subscription',
  },
];

export async function seedPlans() {
  console.log('🌱 Seeding plans...');

  for (const plan of plans) {
    await prisma.plan.upsert({
      where: { code: plan.code },
      update: {
        ...plan,
        features: {}, // ✅ REQUIRED
      },
      create: {
        ...plan,
        features: {}, // ✅ REQUIRED
      },
    });

    console.log(`✅ ${plan.code} seeded`);
  }

  console.log('🎉 Plan seeding complete');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  seedPlans()
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
