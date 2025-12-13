import { Router } from 'express';
import { paymentController } from './payment.controller.js';
import { webhookController } from './webhook.controller.js';
import { authMiddleware } from '../../middleware/authMiddleware.js';
import { validate } from '../../middleware/validate.js';
import { checkoutSchema, pauseSubscriptionSchema } from './payment.dto.js';

const router = Router();

router.get('/plans', paymentController.getPlans.bind(paymentController));
router.get('/plans/:code', paymentController.getPlanByCode.bind(paymentController));

router.post(
  '/subscriptions/checkout',
  authMiddleware,
  validate(checkoutSchema),
  paymentController.checkout.bind(paymentController)
);

router.get(
  '/subscriptions/:profileId',
  authMiddleware,
  paymentController.getActiveSubscription.bind(paymentController)
);

router.get(
  '/subscriptions/:profileId/history',
  authMiddleware,
  paymentController.getSubscriptionHistory.bind(paymentController)
);

router.post(
  '/subscriptions/:profileId/pause',
  authMiddleware,
  validate(pauseSubscriptionSchema),
  paymentController.pauseSubscription.bind(paymentController)
);

router.post(
  '/subscriptions/:profileId/resume',
  authMiddleware,
  paymentController.resumeSubscription.bind(paymentController)
);

router.post(
  '/subscriptions/:profileId/cancel',
  authMiddleware,
  paymentController.cancelSubscription.bind(paymentController)
);

router.get(
  '/payments/:profileId/history',
  authMiddleware,
  paymentController.getPaymentHistory.bind(paymentController)
);

router.get(
  '/entitlements/:profileId/usage',
  authMiddleware,
  paymentController.getUsageStats.bind(paymentController)
);

router.post(
  '/entitlements/:profileId/check',
  authMiddleware,
  paymentController.checkEntitlement.bind(paymentController)
);

router.get('/callback/:status', paymentController.handlePaymentCallback.bind(paymentController));

router.post('/webhooks/sslcommerz', webhookController.handleSSLCommerz.bind(webhookController));
router.post('/webhooks/stripe', webhookController.handleStripe.bind(webhookController));
router.post('/webhooks/bkash', webhookController.handleBkash.bind(webhookController));
router.post('/webhooks/applepay', webhookController.handleApplePay.bind(webhookController));
router.post('/webhooks/visa-mastercard', webhookController.handleVisaMastercard.bind(webhookController));

export default router;
