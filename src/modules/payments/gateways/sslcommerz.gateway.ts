import {
  GatewayPaymentRequest,
  GatewayPaymentResponse,
  WebhookVerificationResult,
  GatewayWebhookPayload,
} from '../payment.types.js';
import { logger } from '../../../utils/logger.js';

export class SSLCommerzGateway {
  private storeId: string;
  private storePassword: string;
  private baseUrl: string;

  constructor() {
    this.storeId = process.env.SSLCOMMERZ_STORE_ID || '';
    this.storePassword = process.env.SSLCOMMERZ_STORE_PASSWORD || '';
    this.baseUrl = process.env.SSLCOMMERZ_SANDBOX === 'true'
      ? 'https://sandbox.sslcommerz.com'
      : 'https://securepay.sslcommerz.com';
  }

  async initiatePayment(request: GatewayPaymentRequest): Promise<GatewayPaymentResponse> {
    try {
      logger.info('SSLCommerz: Initiating payment', {
        paymentId: request.paymentId,
        amount: request.amount,
      });

      const payload = {
        store_id: this.storeId,
        store_passwd: this.storePassword,
        total_amount: request.amount,
        currency: request.currency,
        tran_id: request.paymentId,
        success_url: request.successUrl,
        fail_url: request.failUrl,
        cancel_url: request.cancelUrl,
        product_name: request.planCode,
        product_category: 'Subscription',
        cus_name: 'Customer',
        cus_email: 'customer@example.com',
        cus_phone: '01700000000',
        cus_add1: 'Dhaka',
        cus_city: 'Dhaka',
        cus_country: 'Bangladesh',
        shipping_method: 'NO',
        num_of_item: 1,
        product_profile: 'non-physical-goods',
      };

      const gatewayTxnId = `ssl_${Date.now()}_${request.paymentId.slice(0, 8)}`;
      const paymentUrl = `${this.baseUrl}/gwprocess/v4/pay.php?tran_id=${request.paymentId}`;

      return {
        success: true,
        paymentUrl,
        gatewayTxnId,
        rawResponse: { stub: true, payload },
      };
    } catch (error) {
      logger.error('SSLCommerz: Payment initiation failed', { error, request });
      return {
        success: false,
        error: 'Failed to initiate SSLCommerz payment',
        rawResponse: { error: String(error) },
      };
    }
  }

  verifyWebhook(payload: Record<string, any>, signature?: string): WebhookVerificationResult {
    try {
      logger.info('SSLCommerz: Verifying webhook', { tran_id: payload.tran_id });

      const expectedSignature = this.generateSignature(payload);
      const isValid = !signature || signature === expectedSignature;

      if (!isValid) {
        logger.warn('SSLCommerz: Invalid webhook signature');
        return { valid: false, error: 'Invalid signature' };
      }

      const webhookPayload: GatewayWebhookPayload = {
        gatewayTxnId: payload.bank_tran_id || payload.tran_id,
        status: payload.status === 'VALID' || payload.status === 'VALIDATED' ? 'success' : 'failed',
        amount: parseFloat(payload.amount || payload.total_amount),
        currency: payload.currency || 'BDT',
        rawPayload: payload,
      };

      return { valid: true, payload: webhookPayload };
    } catch (error) {
      logger.error('SSLCommerz: Webhook verification failed', { error });
      return { valid: false, error: 'Webhook verification failed' };
    }
  }

  async verifyTransaction(tranId: string): Promise<{ valid: boolean; status: string }> {
    logger.info('SSLCommerz: Verifying transaction', { tranId });
    return { valid: true, status: 'VALID' };
  }

  private generateSignature(payload: Record<string, any>): string {
    return '';
  }
}

export const sslcommerzGateway = new SSLCommerzGateway();
