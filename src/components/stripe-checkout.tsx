"use client";

import { useState } from "react";
import { PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/payments";
import { Loader2, CreditCard, AlertTriangle } from "lucide-react";

export function StripeCheckout({
  amount,
  currency,
  bookingUid,
  onSuccess,
  onError,
  onBack,
}: {
  amount: number;
  currency: string;
  bookingUid: string;
  onSuccess: () => void;
  onError: (msg: string) => void;
  onBack: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const displayAmount = formatMoney(amount, currency);

  async function finalizePayment(paymentIntentId: string) {
    const res = await fetch("/api/stripe/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bookingUid, paymentIntentId }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      throw new Error(data.error ?? "We couldn't confirm that payment yet.");
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;

    setProcessing(true);
    setError(null);

    try {
      const { error: submitError } = await elements.submit();
      if (submitError) {
        setError(submitError.message ?? "Payment failed");
        setProcessing(false);
        return;
      }

      const returnUrl = new URL(window.location.href);
      returnUrl.searchParams.set("payment", "1");
      returnUrl.searchParams.set("booking", bookingUid);

      const { error: confirmError, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: returnUrl.toString(),
        },
        redirect: "if_required",
      });

      if (confirmError) {
        setError(confirmError.message ?? "Payment confirmation failed");
        onError(confirmError.message ?? "Payment confirmation failed");
        setProcessing(false);
        return;
      }

      if (paymentIntent?.status === "succeeded") {
        await finalizePayment(paymentIntent.id);
        onSuccess();
        return;
      }

      if (paymentIntent?.status === "processing") {
        const message = "Your payment is processing. We’ll confirm the booking as soon as Stripe finishes.";
        setError(message);
        onError(message);
        setProcessing(false);
        return;
      }

      const message = "We couldn't verify the payment result yet. Please wait a moment and try again.";
      setError(message);
      onError(message);
      setProcessing(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Payment failed";
      setError(message);
      onError(message);
      setProcessing(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="mb-4 rounded-xl border bg-muted/40 px-4 py-3 text-sm">
        <div className="flex items-center justify-between">
          <span className="font-medium">Payment</span>
          <span className="text-base font-semibold">{displayAmount}</span>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Secure payment processed by Stripe. Your card details are never stored on our servers.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <PaymentElement />

        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        <div className="flex gap-3">
          <Button type="button" variant="outline" onClick={onBack} disabled={processing}>
            Back
          </Button>
          <Button type="submit" className="flex-1" disabled={!stripe || processing}>
            {processing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <CreditCard className="h-4 w-4" />
                Pay {displayAmount}
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
