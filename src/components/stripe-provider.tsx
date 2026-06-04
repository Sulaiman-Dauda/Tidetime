"use client";

import { loadStripe } from "@stripe/stripe-js";
import { Elements } from "@stripe/react-stripe-js";
import { useEffect, useState } from "react";

const stripePromises = new Map<string, ReturnType<typeof loadStripe>>();

function getStripe(publishableKey: string) {
  if (!stripePromises.has(publishableKey)) {
    stripePromises.set(publishableKey, loadStripe(publishableKey));
  }
  return stripePromises.get(publishableKey)!;
}

export function StripeProvider({
  clientSecret,
  publishableKey,
  children,
}: {
  clientSecret: string;
  publishableKey: string;
  children: React.ReactNode;
}) {
  const [stripe, setStripe] = useState<Awaited<ReturnType<typeof getStripe>> | null>(null);

  useEffect(() => {
    getStripe(publishableKey).then((s) => setStripe(s));
  }, [publishableKey]);

  if (!stripe) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <Elements stripe={stripe} options={{ clientSecret }}>
      {children}
    </Elements>
  );
}
