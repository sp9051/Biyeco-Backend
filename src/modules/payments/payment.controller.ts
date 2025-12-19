import { Request, Response, NextFunction } from 'express';
import { planService } from './plan.service.js';
import { subscriptionService } from './subscription.service.js';
import { paymentService } from './payment.service.js';
import { entitlementService } from './entitlement.service.js';
import { CheckoutDTO, PauseSubscriptionDTO } from './payment.dto.js';
import { sendSuccess, sendError } from '../../utils/response.js';
import { logger } from '../../utils/logger.js';

export class PaymentController {
  async getPlans(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const includeInvite = req.query.includeInvite === 'false';
      const plans = await planService.getAllPlans(includeInvite);

      res.json(sendSuccess(res, plans, 'Plans retrieved successfully', 200));

    } catch (error) {
      next(error);
    }
  }

  async getPlanByCode(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { code } = req.params;
      const plan = await planService.getPlanByCode(code);

      if (!plan) {
        sendError(res, 'Plan not found', 404);
        // res.status(404).json(sendError(res, 'Unauthorized', 401);errorResponse('Plan not found', 'NOT_FOUND'));
        return;
      }

      res.json(sendSuccess(res, plan, 'Plans retrieved successfully', 200));
    } catch (error) {
      next(error);
    }
  }

  async checkout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.userId!;
      const dto: CheckoutDTO = req.body;

      const requestIp = this.extractClientIp(req);

      const result = await paymentService.initiateCheckout(dto, userId, requestIp);

      res.json(sendSuccess(res, result, 'Checkout initiated successfully', 200));
    } catch (error) {
      next(error);
    }
  }

  private extractClientIp(req: Request): string {
    // Get IP from various headers (for proxy/load balancer setups)
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) {
      return Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0];
    }

    // Get from socket
    const socketIp = req.socket?.remoteAddress;
    if (socketIp) {
      return socketIp;
    }

    // Fallback
    return req.ip || '127.0.0.1';
  }

  async getActiveSubscription(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { profileId } = req.params;
      const subscription = await subscriptionService.getActiveSubscription(profileId);

      if (!subscription) {
        sendError(res, 'No active subscription found', 404);

        // res.status(404).json(errorResponse('No active subscription found', 'NOT_FOUND'));
        return;
      }

      res.json(sendSuccess(res, subscription, 'Subscription retrieved successfully', 200));
    } catch (error) {
      next(error);
    }
  }

  async getSubscriptionHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { profileId } = req.params;
      const subscriptions = await subscriptionService.getSubscriptionHistory(profileId);

      res.json(sendSuccess(res, subscriptions, 'Subscription history retrieved successfully', 200));
    } catch (error) {
      next(error);
    }
  }

  async pauseSubscription(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { profileId } = req.params;
      const { pauseDays }: PauseSubscriptionDTO = req.body;
      const userId = req.userId!;

      const subscription = await subscriptionService.pauseSubscription(profileId, pauseDays, userId);

      res.json(sendSuccess(res, subscription, 'Subscription paused successfully', 200));
    } catch (error) {
      next(error);
    }
  }

  async resumeSubscription(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { profileId } = req.params;
      const userId = req.userId!;

      const subscription = await subscriptionService.resumeSubscription(profileId, userId);

      res.json(sendSuccess(res, subscription, 'Subscription resumed successfully', 200));
    } catch (error) {
      next(error);
    }
  }

  async cancelSubscription(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { profileId } = req.params;
      const userId = req.userId!;

      const subscription = await subscriptionService.cancelSubscription(profileId, userId);

      res.json(sendSuccess(res, subscription, 'Subscription cancelled successfully', 200));
    } catch (error) {
      next(error);
    }
  }

  async getPaymentHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { profileId } = req.params;
      const payments = await paymentService.getPaymentHistory(profileId);

      res.json(sendSuccess(res, payments, 'Payment history retrieved successfully', 200));
    } catch (error) {
      next(error);
    }
  }

  async getUsageStats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { profileId } = req.params;

      const [features, usage] = await Promise.all([
        entitlementService.getProfileFeatures(profileId),
        entitlementService.getUsageStats(profileId),
      ]);

      if (!features) {
        sendError(res, 'No active subscription found', 404);
        // res.status(404).json(errorResponse('No active subscription found', 'NOT_FOUND'));
        return;
      }

      res.json(
        sendSuccess(res,
          {
            features,
            usage,
          },
          'Usage stats retrieved successfully', 200
        )
      );
    } catch (error) {
      next(error);
    }
  }

  async checkEntitlement(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { profileId } = req.params;
      const { action, context } = req.body;

      const canPerform = await entitlementService.can(profileId, action, context);

      res.json(
        sendSuccess(res,
          { allowed: canPerform, action },
          canPerform ? 'Action allowed' : 'Action not allowed', 200
        )
      );
    } catch (error) {
      next(error);
    }
  }

  async handlePaymentCallback(req: Request, res: Response): Promise<void> {
    try {
      const { status } = req.params;
      const { paymentId, session_id, tran_id } = req.query;

      const resolvedPaymentId = (paymentId || tran_id || session_id) as string;

      if (!resolvedPaymentId) {
        res.redirect('/payment/error?reason=missing_id');
        return;
      }

      if (status === 'success') {
        await paymentService.handlePaymentSuccess(
          resolvedPaymentId,
          req.query.gatewayTxnId as string || '',
          req.query as Record<string, any>
        );
        res.redirect(`/payment/success?paymentId=${resolvedPaymentId}`);
      } else if (status === 'fail') {
        await paymentService.handlePaymentFailure(resolvedPaymentId, req.query as Record<string, any>);
        res.redirect(`/payment/failed?paymentId=${resolvedPaymentId}`);
      } else {
        res.redirect(`/payment/cancelled?paymentId=${resolvedPaymentId}`);
      }
    } catch (error) {
      logger.error('Payment callback error', { error });
      res.redirect('/payment/error');
    }
  }
}

export const paymentController = new PaymentController();
