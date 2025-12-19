import { PlanFeatures } from './payment.types.js';

import { prisma } from '../../prisma.js';

interface PlanSeed {
  code: string;
  name: string;
  price: number;
  durationDays: number;
  isInviteOnly: boolean;
  category: string,
  features: PlanFeatures;
}

// const plans: PlanSeed[] = [
//   {
//     code: 'ALAAP',
//     name: 'Alaap',
//     price: 0,
//     durationDays: 30,
//     isInviteOnly: false,
//     features: {
//       photos: 3,
//       messaging: false,
//       icebreakersPerMonth: 3,
//       parentIcebreakers: 3,
//       filters: ['age', 'religion', 'district'],
//       verification: 'selfie',
//       stealth: false,
//       boosts: 0,
//       spotlight: 0,
//     },
//   },
//   {
//     code: 'JATRA',
//     name: 'Jatra',
//     price: 999,
//     durationDays: 30,
//     isInviteOnly: false,
//     features: {
//       photos: 6,
//       messaging: {
//         newChatsPerMonth: 5,
//         messagesPerChat: 40,
//       },
//       boosts: 2,
//       spotlight: 1,
//       filters: ['age', 'religion', 'district', 'education', 'profession', 'lifestyle'],
//       verification: 'silver',
//       stealth: false,
//       icebreakersPerMonth: 10,
//       parentIcebreakers: 10,
//     },
//   },
//   {
//     code: 'AALOK',
//     name: 'Aalok',
//     price: 2499,
//     durationDays: 30,
//     isInviteOnly: false,
//     features: {
//       photos: 10,
//       video: true,
//       messaging: 'unlimited',
//       stealth: true,
//       spotlightDays: 3,
//       pauseAllowed: true,
//       verification: 'gold',
//       boosts: 5,
//       spotlight: 3,
//       icebreakersPerMonth: 30,
//       parentIcebreakers: 30,
//       filters: ['age', 'religion', 'district', 'education', 'profession', 'lifestyle', 'income', 'family'],
//     },
//   },
//   {
//     code: 'OBHIJAAT',
//     name: 'Obhijaat',
//     price: 9999,
//     durationDays: 30,
//     isInviteOnly: true,
//     features: {
//       photos: 12,
//       video: true,
//       messaging: 'unlimited',
//       signatureFeed: true,
//       founderConsult: true,
//       aiIntroductions: 3,
//       familyMessaging: true,
//       stealth: true,
//       pauseAllowed: true,
//       verification: 'gold',
//       boosts: 10,
//       spotlight: 5,
//       spotlightDays: 7,
//       icebreakersPerMonth: 100,
//       parentIcebreakers: 100,
//       filters: ['age', 'religion', 'district', 'education', 'profession', 'lifestyle', 'income', 'family', 'premium'],
//     },
//   },
// ];

const plans: PlanSeed[] = [
  {
    code: 'ALAAP',
    name: 'Alaap',
    price: 999, // Updated from 0 to 999
    durationDays: 30,
    isInviteOnly: false,
    category: 'subscription',
    features: {
      photos: 3,
      video: false,
      messaging: false,
      icebreakersPerMonth: 3,
      parentIcebreakers: 3,
      filters: ['age', 'religion', 'district'],
      verification: 'selfie',
      stealth: false,
      boosts: 0,
      spotlight: 0,
      aiIntroductions: 0,
      familyMessaging: false,
      signatureFeed: false,
      pauseAllowed: false,
    },
  },
  {
    code: 'JATRA',
    name: 'Jatra',
    price: 2999, // Updated from 999 to 2999
    durationDays: 30,
    isInviteOnly: false,
    category: 'subscription',
    features: {
      photos: 6,
      video: false,
      messaging: {
        newChatsPerMonth: 5,
        messagesPerChat: 40,
      },
      boosts: 2,
      spotlight: 1,
      spotlightDays: 1,
      filters: ['age', 'religion', 'district', 'education', 'profession', 'lifestyle'],
      verification: 'silver',
      stealth: false,
      icebreakersPerMonth: 10,
      parentIcebreakers: 10,
      aiIntroductions: 0,
      familyMessaging: false,
      signatureFeed: false,
      pauseAllowed: false,
    },
  },
  {
    code: 'AALOK',
    name: 'Aalok',
    price: 5999, // Updated from 2499 to 5999
    durationDays: 30,
    isInviteOnly: false,
    category: 'subscription',
    features: {
      photos: 10,
      video: true,
      messaging: 'unlimited',
      stealth: true,
      spotlightDays: 3,
      pauseAllowed: true,
      verification: 'gold',
      boosts: 5,
      spotlight: 3,
      icebreakersPerMonth: 30,
      parentIcebreakers: 30,
      filters: ['age', 'religion', 'district', 'education', 'profession', 'lifestyle', 'income', 'family'],
      aiIntroductions: 3,
      familyMessaging: false,
      signatureFeed: false,
      founderConsult: false,
    },
  },
  {
    code: 'OBHIJAAT',
    name: 'Obhijaat',
    price: 14999,
    durationDays: 30,
    isInviteOnly: true,
    category: 'subscription',
    features: {
      photos: 12,
      video: true,
      messaging: 'unlimited',
      signatureFeed: true,
      founderConsult: true,
      aiIntroductions: 3,
      familyMessaging: true,
      stealth: true,
      pauseAllowed: true,
      verification: 'gold',
      boosts: 10,
      spotlight: 5,
      spotlightDays: 7,
      icebreakersPerMonth: 100,
      parentIcebreakers: 100,
      filters: ['age', 'religion', 'district', 'education', 'profession', 'lifestyle', 'income', 'family', 'premium'],
    },
  },
];

// , vendor, feature, etc.

export async function seedPlans(): Promise<void> {
  console.log('Seeding plans...');

  for (const plan of plans) {
    await prisma.plan.upsert({
      where: { code: plan.code },
      update: {
        name: plan.name,
        price: plan.price,
        durationDays: plan.durationDays,
        isInviteOnly: plan.isInviteOnly,
        category: plan.category,
        features: plan.features as any,
      },
      create: {
        code: plan.code,
        name: plan.name,
        price: plan.price,
        durationDays: plan.durationDays,
        isInviteOnly: plan.isInviteOnly,
        category: plan.category,
        features: plan.features as any,
      },
    });

    console.log(`  - ${plan.code} plan seeded`);
  }

  console.log('Plans seeded successfully!');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  seedPlans()
    .catch((e) => {
      console.error('Error seeding plans:', e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
