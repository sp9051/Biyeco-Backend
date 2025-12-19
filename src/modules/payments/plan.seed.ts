import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const plans = [
  {
    code: "ALAAP",
    name: "Alaap",
    price: 999,
    durationDays: 30,
    isInviteOnly: false,
    category: "subscription",
    features: {},
  },
  {
    code: "JATRA",
    name: "Jatra",
    price: 2999,
    durationDays: 30,
    isInviteOnly: false,
    category: "subscription",
    features: {},
  },
  {
    code: "AALOK",
    name: "Aalok",
    price: 5999,
    durationDays: 30,
    isInviteOnly: false,
    category: "subscription",
    features: {},
  },
  {
    code: "OBHIJAAT",
    name: "Obhijaat",
    price: 14999,
    durationDays: 30,
    isInviteOnly: true,
    category: "subscription",
    features: {},
  },
];

async function seed() {
  console.log("🌱 Seeding plans...");

  for (const plan of plans) {
    await prisma.plan.upsert({
      where: { code: plan.code },
      update: plan,
      create: plan,
    });

    console.log(`✅ ${plan.code} seeded`);
  }

  await prisma.$disconnect();
  console.log("🎉 Plan seeding complete");
}

seed().catch((e) => {
  console.error(e);
  process.exit(1);
});
