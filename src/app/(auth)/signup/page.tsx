import type { Metadata } from "next";
import Link from "next/link";
import { SignupForm } from "./signup-form";

export const metadata: Metadata = { title: "Sign up" };

export default function SignupPage() {
  return (
    <div className="w-full max-w-sm space-y-7">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Create an account</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Claim your booking link and start scheduling in minutes.
        </p>
      </div>

      <SignupForm />

      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link
          href="/login"
          className="font-medium text-foreground underline-offset-4 hover:underline"
        >
          Log in
        </Link>
      </p>
    </div>
  );
}
