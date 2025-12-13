import { Request, Response, NextFunction } from 'express';
import { planService } from './plan.service.js';
import { subscriptionService } from './subscription.service.js';
import { paymentService } from './payment.service.js';
import { entitlementService } from './entitlement.service.js';
import { CheckoutDTO, PauseSubscriptionDTO } from './payment.dto.js';
import { successResponse, errorResponse } from '../../utils/response.js';
import { logger } from '../../utils/logger.js';

export class PaymentController {
  async getPlans(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const includeInvite = req.query.includeInvite === 'true';
      const plans = await planService.getAllPlans(includeInvite);

      res.json(successResponse(plans, 'Plans retrieved successfully'));
    } catch (error) {
      next(error);
    }
  }

  async getPlanByCode(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { code } = req.params;
      const plan = await planService.getPlanByCode(code);

      if (!plan) {
        res.status(404).json(errorResponse('Plan not found', 'NOT_FOUND'));
        return;
      }

      res.json(successResponse(plan, 'Plan retrieved successfully'));
    } catch (error) {
      next(error);
    }
  }

  async checkout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.userId!;
      const dto: CheckoutDTO = req.body;

      const result = await paymentService.initiateCheckout(dto, userId);

      res.json(successResponse(result, 'Checkout initiated successfully'));
    } catch (error) {
      next(error);
    }
  }

  async getActiveSubscription(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { profileId } = req.params;
      const subscription = await subscriptionService.getActiveSubscription(profileId);

      if (!subscription) {
        res.status(404).json(errorResponse('No active subscription found', 'NOT_FOUND'));
        return;
      }

      res.json(successResponse(subscription, 'Subscription retrieved successfully'));
    } catch (error) {
      next(error);
    }
  }

  async getSubscriptionHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { profileId } = req.params;
      const subscriptions = await subscriptionService.getSubscriptionHistory(profileId);

      res.json(successResponse(subscriptions, 'Subscription history retrieved successfully'));
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

      res.json(successResponse(subscription, 'Subscription paused successfully'));
    } catch (error) {
      next(error);
    }
  }

  async resumeSubscription(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { profileId } = req.params;
      const userId = req.userId!;

      const subscription = await subscriptionService.resumeSubscription(profileId, userId);

      res.json(successResponse(subscription, 'Subscription resumed successfully'));
    } catch (error) {
      next(error);
    }
  }

  async cancelSubscription(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { profileId } = req.params;
      const userId = req.userId!;

      const subscription = await subscriptionService.cancelSubscription(profileId, userId);

      res.json(successResponse(subscription, 'Subscription cancelled successfully'));
    } catch (error) {
      next(error);
    }
  }

  async getPaymentHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { profileId } = req.params;
      const payments = await paymentService.getPaymentHistory(profileId);

      res.json(successResponse(payments, 'Payment history retrieved successfully'));
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
        res.status(404).json(errorResponse('No active subscription found', 'NOT_FOUND'));
        return;
      }

      res.json(
        successResponse(
          {
            features,
            usage,
          },
          'Usage stats retrieved successfully'
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
        successResponse(
          { allowed: canPerform, action },
          canPerform ? 'Action allowed' : 'Action not allowed'
        )
      );
    } catch (error) {
      next(error);
    }
  }

  async handlePaymentCallback(req: Request, res: Response, next: NextFunction): Promise<void> {
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
