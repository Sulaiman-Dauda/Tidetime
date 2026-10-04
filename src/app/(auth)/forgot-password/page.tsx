import type { Metadata } from "next";
import { AuthCard, AuthLink } from "../_components/auth-card";
import { ForgotPasswordForm } from "./forgot-form";

export const metadata: Metadata = { title: "Forgot password" };

export default function ForgotPasswordPage() {
  return (
    <AuthCard
      title="Reset your password"
      description="Enter your email and we'll send you a link to set a new one."
      footer={
        <>
          Remembered it? <AuthLink href="/login">Back to log in</AuthLink>
        </>
      }
    >
      <ForgotPasswordForm />
    </AuthCard>
  );
}
