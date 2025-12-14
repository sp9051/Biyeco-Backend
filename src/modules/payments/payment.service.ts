import { PrismaClient } from '@prisma/client';
import {
  // PaymentStatus,
  PaymentGateway,
  CheckoutRequest,
  CheckoutResponse,
  PaymentResponse,
  GatewayPaymentRequest,
} from './payment.types.js';
import { planService } from './plan.service.js';
import { subscriptionService } from './subscription.service.js';
import { sslcommerzGateway } from './gateways/sslcommerz.gateway.js';
import { stripeGateway } from './gateways/stripe.gateway.js';
import { bkashGateway } from './gateways/bkash.gateway.js';
import { applepayGateway } from './gateways/applepay.gateway.js';
import { eventBus } from '../../events/eventBus.js';
import { logger } from '../../utils/logger.js';
import { currencyService } from './currency.service.js';

const prisma = new PrismaClient();

export class PaymentService {
  async initiateCheckout(
    request: CheckoutRequest,
    userId: string,
    requestIp?: string
  ): Promise<CheckoutResponse> {
    const { profileId, planCode, gateway, currency: requestedCurrency } = request;

    // Get user's detected currency
    // const requestIp = req?.ip || req?.socket?.remoteAddress;
    const currencyResult = await currencyService.detectCurrency(profileId, requestIp);

    // Use requested currency if provided, otherwise detected currency
    const currency = requestedCurrency || currencyResult.currency;

    // Check for potential cheating
    if (!currencyResult.allSourcesMatch) {
      logger.warn('Currency mismatch detected', {
        profileId,
        currencyResult,
        requestedCurrency,
      });
    }

    const plan = await planService.getPlanByCode(planCode);
    if (!plan) {
      throw new Error('Plan not found');
    }

    // Convert amount based on currency if needed
    let amount = plan.price;
    if (currency !== 'BDT') {
      // Implement currency conversion logic here
      amount = await this.convertCurrency(plan.price, 'BDT', currency);
    }

    const validation = await planService.validatePlanAccess(planCode, false);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    const payment = await prisma.payment.create({
      data: {
        profileId,
        gateway,
        amount,
        currency,
        status: 'initiated',
      },
    });


    logger.info('Payment initiated', {
      paymentId: payment.id,
      profileId,
      planCode,
      gateway,
      amount: plan.price,
    });

    const baseUrl = process.env.APP_BASE_URL || 'http://localhost:5000';
    const gatewayRequest: GatewayPaymentRequest = {
      paymentId: payment.id,
      amount,
      currency, // Use detected currency
      profileId,
      planCode: plan.code,
      planName: plan.name,
      successUrl: `${baseUrl}/api/v1/payments/callback/success`,
      failUrl: `${baseUrl}/api/v1/payments/callback/fail`,
      cancelUrl: `${baseUrl}/api/v1/payments/callback/cancel`,
      currencyInfo: {
        code: currency,
        symbol: this.getCurrencySymbol(currency),
        countryCode: currencyResult.countryCode,
      },
    };

    const gatewayResponse = await this.processGatewayRequest(gateway, gatewayRequest);

    if (!gatewayResponse.success) {
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: 'failed',
          rawResponse: gatewayResponse.rawResponse || {},
        },
      });
      throw new Error(gatewayResponse.error || 'Payment gateway error');
    }

    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        gatewayTxnId: gatewayResponse.gatewayTxnId,
        rawResponse: gatewayResponse.rawResponse || {},
      },
    });

    return {
      paymentId: payment.id,
      paymentUrl: gatewayResponse.paymentUrl!,
      gateway,
    };
  }

  async handlePaymentSuccess(
    paymentId: string,
    gatewayTxnId: string,
    rawResponse: Record<string, any>
  ): Promise<void> {
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
    });



    if (!payment) {
      throw new Error('Payment not found');
    }
    //       await currencyService.updateCurrencyFromPayment(
    //   payment.profileId,
    //   payment.currency,  // The currency they actually paid in
    //   this.getCountryFromGateway(rawResponse) // Country from payment method
    // );

    if (payment.status === 'success') {
      logger.warn('Payment already processed', { paymentId });
      return;
    }

    const plan = await this.getPlanFromPaymentContext(payment);
    if (!plan) {
      throw new Error('Could not determine plan for payment');
    }

    const profile = await prisma.profile.findUnique({
      where: { id: payment.profileId },
      select: { userId: true },
    });

    if (!profile) {
      throw new Error('Profile not found');
    }

    const subscription = await subscriptionService.createSubscription(
      payment.profileId,
      plan.id,
      profile.userId
    );

    await prisma.payment.update({
      where: { id: paymentId },
      data: {
        status: 'success',
        subscriptionId: subscription.id,
        gatewayTxnId,
        rawResponse,
      },
    });

    logger.info('Payment successful', {
      paymentId,
      subscriptionId: subscription.id,
      profileId: payment.profileId,
    });
  }

  async handlePaymentFailure(
    paymentId: string,
    rawResponse: Record<string, any>
  ): Promise<void> {
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
    });

    if (!payment) {
      throw new Error('Payment not found');
    }

    await prisma.payment.update({
      where: { id: paymentId },
      data: {
        status: 'failed',
        rawResponse,
      },
    });

    const profile = await prisma.profile.findUnique({
      where: { id: payment.profileId },
      select: { userId: true },
    });

    if (profile) {
      eventBus.emitNotification({
        userId: profile.userId,
        type: 'payment_failed',
        metadata: {
          paymentId,
          gateway: payment.gateway,
          amount: payment.amount,
        },
        priority: 'HIGH',
      });
    }

    logger.warn('Payment failed', { paymentId, profileId: payment.profileId });
  }

  async getPaymentById(paymentId: string): Promise<PaymentResponse | null> {
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
    });

    if (!payment) return null;

    return this.formatPaymentResponse(payment);
  }

  async getPaymentHistory(profileId: string): Promise<PaymentResponse[]> {
    const payments = await prisma.payment.findMany({
      where: { profileId },
      orderBy: { createdAt: 'desc' },
    });

    return payments.map((p) => this.formatPaymentResponse(p));
  }

  async refundPayment(paymentId: string): Promise<PaymentResponse> {
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
    });

    if (!payment) {
      throw new Error('Payment not found');
    }

    if (payment.status !== 'success') {
      throw new Error('Only successful payments can be refunded');
    }

    const updated = await prisma.payment.update({
      where: { id: paymentId },
      data: { status: 'refunded' },
    });

    if (payment.subscriptionId) {
      await prisma.subscription.update({
        where: { id: payment.subscriptionId },
        data: { status: 'cancelled' },
      });
    }

    logger.info('Payment refunded', { paymentId, subscriptionId: payment.subscriptionId });

    return this.formatPaymentResponse(updated);
  }

  // private async validateProfileAccess(profileId: string, userId: string): Promise<boolean> {
  //   const profile = await prisma.profile.findFirst({
  //     where: { id: profileId, userId },
  //   });

  //   if (profile) return true;

  //   const candidateLink = await prisma.candidateLink.findFirst({
  //     where: {
  //       profileId,
  //       parentUserId: userId,
  //       status: 'active',
  //     },
  //   });

  //   return !!candidateLink;
  // }

  private async processGatewayRequest(
    gateway: PaymentGateway,
    request: GatewayPaymentRequest
  ) {
    switch (gateway) {
      case 'sslcommerz':
        return sslcommerzGateway.initiatePayment(request);
      case 'stripe':
        return stripeGateway.initiatePayment(request);
      case 'bkash':
        return bkashGateway.initiatePayment(request);
      case 'applepay':
        return applepayGateway.initiatePayment(request);
      default:
        throw new Error(`Unsupported payment gateway: ${gateway}`);
    }
  }

  private async getPlanFromPaymentContext(payment: any) {
    const rawResponse = payment.rawResponse as Record<string, any>;
    const planCode = rawResponse?.planCode || rawResponse?.product_name;

    if (planCode) {
      return planService.getPlanByCode(planCode);
    }

    return null;
  }

  private formatPaymentResponse(payment: any): PaymentResponse {
    return {
      id: payment.id,
      subscriptionId: payment.subscriptionId,
      profileId: payment.profileId,
      gateway: payment.gateway,
      amount: payment.amount,
      currency: payment.currency,
      status: payment.status,
      gatewayTxnId: payment.gatewayTxnId,
      createdAt: payment.createdAt,
    };
  }

  private async convertCurrency(
    amount: number,
    fromCurrency: string,
    toCurrency: string
  ): Promise<number> {
    if (fromCurrency === toCurrency) return amount;

    // Implement currency conversion API call
    // For now, return a fixed conversion (you should use a real API)
    const conversionRates: Record<string, number> = {
      USD: 0.0091, // 1 BDT = 0.0091 USD
      EUR: 0.0084,
      GBP: 0.0072,
      INR: 0.76,
    };

    const rate = conversionRates[toCurrency] || 1;
    return Math.round(amount * rate * 100) / 100; // Round to 2 decimal places
  }

  private getCurrencySymbol(currency: string): string {
    const symbols: Record<string, string> = {
      BDT: '৳',
      USD: '$',
      EUR: '€',
      GBP: '£',
      INR: '₹',
    };

    return symbols[currency] || currency;
  }
}

export const paymentService = new PaymentService();
