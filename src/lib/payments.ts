/**
 * Pure payment-amount logic, isolated from the Stripe SDK so it can be tested
 * without network or secrets.
 */

export interface PriceConfig {
  /** full price in the smallest currency unit (e.g. cents) */
  price: number;
  /** deposit to charge up-front; 0 = charge the full price */
  depositAmount: number;
  currency: string;
}

export interface ChargePlan {
  /** amount to charge now */
  amount: number;
  currency: string;
  /** whether this is a partial (deposit) charge */
  isDeposit: boolean;
  /** remaining balance owed after this charge */
  balanceDue: number;
}

/** Compute what to charge at booking time for a paid service. */
export function computeCharge(config: PriceConfig): ChargePlan | null {
  const { price, depositAmount, currency } = config;
  if (price <= 0) return null; // free event — nothing to charge

  if (depositAmount > 0 && depositAmount < price) {
    return { amount: depositAmount, currency, isDeposit: true, balanceDue: price - depositAmount };
  }
  // Deposit >= price (or unset) collapses to a full charge.
  return { amount: price, currency, isDeposit: false, balanceDue: 0 };
}

/** Refund amount given a payment and an optional partial request. */
export function computeRefund(paidAmount: number, requested?: number): number {
  if (paidAmount <= 0) return 0;
  if (requested == null) return paidAmount; // full refund
  return Math.max(0, Math.min(requested, paidAmount));
}

export type PaymentStatus = "pending" | "paid" | "failed" | "refunded";

/** Map a Stripe PaymentIntent status to our internal payment status. */
export function mapStripeStatus(stripeStatus: string): PaymentStatus {
  switch (stripeStatus) {
    case "succeeded":
      return "paid";
    case "canceled":
      return "failed";
    case "requires_payment_method":
    case "requires_action":
    case "requires_confirmation":
    case "processing":
      return "pending";
    default:
      return "pending";
  }
}
