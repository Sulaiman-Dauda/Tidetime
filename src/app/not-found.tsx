import Link from "next/link";
import { ArrowLeft, Compass } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusScreen } from "./_components/status-screen";

export default function NotFound() {
  return (
    <StatusScreen
      icon={Compass}
      title="That page doesn't exist"
      description="The link may be wrong, expired or no longer public. If this is a booking page, ask the host for a fresh link."
    >
      <Button asChild>
        <Link href="/">Go to home</Link>
      </Button>
      <Button asChild variant="outline">
        <Link href="/login">
          <ArrowLeft aria-hidden /> Back to login
        </Link>
      </Button>
    </StatusScreen>
  );
}
