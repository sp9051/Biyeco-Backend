import { Request, Response, NextFunction } from 'express';
import { AnyZodObject, ZodError } from 'zod';
import { sendError } from '../utils/response.js';

export function validate(schema: AnyZodObject) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await schema.parseAsync(
        req.body
      );
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        sendError(
          res,
          'Validation failed',
          400,
          'VALIDATION_ERROR',
          error.errors
        );
        return;
      }
      next(error);
    }
  };
}
