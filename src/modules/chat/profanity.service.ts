import { logger } from '../../utils/logger.js';

const PROFANITY_PATTERNS = [
  /badword1/gi,
  /badword2/gi,
];

export class ProfanityService {
  private patterns: RegExp[];

  constructor(customPatterns?: RegExp[]) {
    this.patterns = customPatterns || PROFANITY_PATTERNS;
  }

  isClean(text: string): boolean {
    if (!text) return true;

    for (const pattern of this.patterns) {
      if (pattern.test(text)) {
        logger.warn('Profanity detected in message');
        return false;
      }
    }

    return true;
  }

  containsProfanity(text: string): boolean {
    return !this.isClean(text);
  }

  filter(text: string, replacement: string = '***'): string {
    let filtered = text;
    for (const pattern of this.patterns) {
      filtered = filtered.replace(pattern, replacement);
    }
    return filtered;
  }

  addPattern(pattern: RegExp): void {
    this.patterns.push(pattern);
  }
}

export const profanityService = new ProfanityService();
