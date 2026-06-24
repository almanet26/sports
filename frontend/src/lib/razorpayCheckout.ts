// Shared Razorpay checkout flow used by both the in-app upgrade prompt and the
// billing page. Free plans are activated directly via /subscriptions/subscribe;
// paid plans open the Razorpay modal and verify the payment server-side.
//
// Requires the Razorpay checkout script in index.html:
//   <script src="https://checkout.razorpay.com/v1/checkout.js"></script>
// and RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET configured on the backend.

import { billingApi, subscriptionApi } from './api';

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open(): void };
  }
}

export interface PlanCheckoutArgs {
  planKey: string;
  isFree: boolean;
  displayName: string;
  userEmail?: string;
  onSuccess: () => void | Promise<void>;
  onError: (message: string) => void;
  /** Called when the user closes the Razorpay modal without completing payment. */
  onDismiss?: () => void;
}

interface RazorpayHandlerResponse {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

export async function startPlanCheckout({
  planKey,
  isFree,
  displayName,
  userEmail,
  onSuccess,
  onError,
  onDismiss,
}: PlanCheckoutArgs): Promise<void> {
  try {
    // Free plan → activate immediately, no payment.
    if (isFree) {
      await subscriptionApi.subscribe(planKey);
      await onSuccess();
      return;
    }

    const { data: order } = await billingApi.createOrder(planKey);

    if (typeof window === 'undefined' || !window.Razorpay) {
      onError('Payment system is unavailable. Please refresh and try again.');
      onDismiss?.();
      return;
    }

    const rzp = new window.Razorpay({
      key: order.razorpay_key,
      amount: order.amount,
      currency: order.currency,
      order_id: order.order_id,
      name: 'PitchVision',
      description: `${displayName} subscription`,
      prefill: { email: userEmail ?? '' },
      theme: { color: '#F59E0B' },
      handler: async (response: RazorpayHandlerResponse) => {
        try {
          await billingApi.verifyPayment({
            order_id: response.razorpay_order_id,
            payment_id: response.razorpay_payment_id,
            signature: response.razorpay_signature,
            plan_key: planKey,
          });
          await onSuccess();
        } catch {
          onError(
            `Payment succeeded but activation failed. Contact support with payment ID: ${response.razorpay_payment_id}`,
          );
        }
      },
      modal: { ondismiss: () => onDismiss?.() },
    });

    rzp.open();
  } catch {
    onError('Could not start the upgrade. Please try again.');
    onDismiss?.();
  }
}
