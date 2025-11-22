import { PrismaClient } from '@prisma/client';
import { SearchRequestDTO } from '../discovery/search.dto.js';
import { validateQueryCost } from '../../utils/queryCostGuard.js';
import { decodeCursor, createPaginationResult } from '../../utils/pagination.js';
import { profilePermissions } from '../profile/profile.permissions.js';
import { cacheService } from '../../utils/cache.service.js';
import { logger } from '../../utils/logger.js';

const prisma = new PrismaClient();

export class SearchService {
  async search(userId: string, dto: SearchRequestDTO) {
    const costCheck = validateQueryCost({ basic: dto.basic, advanced: dto.advanced });

    if (!costCheck.allowed) {
      logger.warn('Query cost limit exceeded', {
        userId,
        cost: costCheck.cost,
        maxCost: costCheck.maxCost,
      });
      throw new Error(`QUERY_TOO_EXPENSIVE: Cost ${costCheck.cost} exceeds maximum ${costCheck.maxCost}`);
    }

    const cursor = dto.cursor ? decodeCursor(dto.cursor) : null;

    const useCache = this.shouldCacheQuery(dto);
    
    if (useCache) {
      const cacheKey = this.buildCacheKey(userId, dto);
      const cached = await cacheService.get(cacheKey);
      if (cached) {
        logger.info('Returning cached search results', { userId, cacheKey });
        return cached;
      }
    }

    const whereClause = this.buildWhereClause(userId, dto, cursor);

    const profiles = await prisma.profile.findMany({
      where: whereClause,
      take: dto.limit + 1,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      include: {
        photos: {
          where: {
            moderationStatus: 'approved',
            deletedAt: null,
          },
        },
        preferences: true,
      },
    });

    const maskedProfiles = profiles.map((profile) =>
      profilePermissions.maskProfile(profile as any, { userId })
    );

    const result = createPaginationResult(profiles, dto.limit);

    if (useCache) {
      const cacheKey = this.buildCacheKey(userId, dto);
      await cacheService.set(cacheKey, { ...result, data: maskedProfiles }, 30);
    }

    logger.info('Search completed', {
      userId,
      resultCount: result.data.length,
      hasNextCursor: !!result.nextCursor,
      queryCost: costCheck.cost,
    });

    return { ...result, data: maskedProfiles };
  }

  private buildWhereClause(userId: string, dto: SearchRequestDTO, cursor: any): any {
    const where: any = {
      published: true,
      deletedAt: null,
      userId: { not: userId },
    };

    if (cursor) {
      where.OR = [
        {
          createdAt: { lt: cursor.createdAt },
        },
        {
          createdAt: cursor.createdAt,
          id: { lt: cursor.id },
        },
      ];
    }

    if (dto.basic) {
      if (dto.basic.ageRange) {
        const [minAge, maxAge] = dto.basic.ageRange;
        const maxDate = this.getDateFromAge(minAge);
        const minDate = this.getDateFromAge(maxAge);
        where.dob = { gte: minDate, lte: maxDate };
      }

      if (dto.basic.maritalStatus && dto.basic.maritalStatus.length > 0) {
      }

      if (dto.basic.religion) {
      }

      if (dto.basic.location) {
        const locationFilters = [];
        if (dto.basic.location.city) {
          locationFilters.push({
            location: {
              path: ['city'],
              equals: dto.basic.location.city,
            },
          });
        }
        if (dto.basic.location.state) {
          locationFilters.push({
            location: {
              path: ['state'],
              equals: dto.basic.location.state,
            },
          });
        }
        if (dto.basic.location.country) {
          locationFilters.push({
            location: {
              path: ['country'],
              equals: dto.basic.location.country,
            },
          });
        }

        if (locationFilters.length > 0) {
          where.AND = locationFilters;
        }
      }
    }

    return where;
  }

  private getDateFromAge(age: number): Date {
    const date = new Date();
    date.setFullYear(date.getFullYear() - age);
    return date;
  }

  private shouldCacheQuery(dto: SearchRequestDTO): boolean {
    if (dto.advanced) {
      return false;
    }

    if (dto.cursor) {
      return false;
    }

    return true;
  }

  private buildCacheKey(userId: string, dto: SearchRequestDTO): string {
    const parts = [
      'search',
      'user',
      userId,
      JSON.stringify(dto.basic || {}),
      dto.limit.toString(),
    ];
    return parts.join(':');
  }
}

export const searchService = new SearchService();
