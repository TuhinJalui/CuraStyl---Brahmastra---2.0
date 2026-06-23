import { Suspense } from "react";
import CheckoutClient from "./CheckoutClient";

export const metadata = { title: "Checkout" };

export default function CheckoutPage() {
  return (
    <Suspense fallback={<div className="min-h-screen gradient-hero" />}>
      <CheckoutClient />
    </Suspense>
  );
}
