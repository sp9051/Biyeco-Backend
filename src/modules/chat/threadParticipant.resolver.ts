// services/threadParticipant.resolver.ts
import { prisma } from '../../prisma.js';

export class ThreadParticipantResolver {
  static async resolveProfilesByUserIds(
    otherUserIds: string[]
  ): Promise<Map<string, any>> {
    if (otherUserIds.length === 0) {
      return new Map();
    }

    // 1️⃣ Fetch users
    const users = await prisma.user.findMany({
      where: { id: { in: otherUserIds } },
    });

    const userMap = new Map(users.map(u => [u.id, u]));

    // 2️⃣ Separate roles
    const parentIds: string[] = [];
    const guardianIds: string[] = [];
    const directUserIds: string[] = [];

    for (const user of users) {
      if (user.role === 'self' || user.role === 'candidate') {
        directUserIds.push(user.id);
      } else if (user.role === 'parent') {
        parentIds.push(user.id);
      } else if (user.role === 'guardian') {
        guardianIds.push(user.id);
      }
    }

    // 3️⃣ Fetch candidate links
    const links = await prisma.candidateLink.findMany({
      where: {
        status: 'active',
        OR: [
          { parentUserId: { in: parentIds } },
          { childUserId: { in: guardianIds } },
        ],
      },
      include: { profile: true },
    });

    const resolvedCandidateUserId = new Map<string, string>();

    for (const link of links) {
      if (link.parentUserId) {
        resolvedCandidateUserId.set(
          link.parentUserId,
          link.profile.userId
        );
      }
      if (link.childUserId) {
        resolvedCandidateUserId.set(
          link.childUserId,
          link.profile.userId
        );
      }
    }

    // 4️⃣ Final candidate userIds
    const finalUserIds = [
      ...directUserIds,
      ...Array.from(resolvedCandidateUserId.values()),
    ];

    // 5️⃣ Fetch profiles
    const profiles = await prisma.profile.findMany({
      where: {
        userId: { in: finalUserIds },
      },
    });

    const profileMap = new Map(profiles.map(p => [p.userId, p]));

    // 6️⃣ Map original userId → profile
    const result = new Map<string, any>();

    for (const userId of otherUserIds) {
      const user = userMap.get(userId);

      if (!user) {
        result.set(userId, null);
        continue;
      }

      if (user.role === 'self' || user.role === 'candidate') {
        result.set(userId, profileMap.get(user.id) ?? null);
      } else {
        const candidateUserId = resolvedCandidateUserId.get(user.id);
        result.set(
          userId,
          candidateUserId ? profileMap.get(candidateUserId) ?? null : null
        );
      }
    }

    return result;
  }
}
