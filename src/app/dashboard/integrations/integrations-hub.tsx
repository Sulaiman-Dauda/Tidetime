"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/empty-state";
import { Video, Users } from "lucide-react";
import type { IntegrationProvider, ProviderCredentialStatus } from "@/server/integration-credentials";
import { AppCard, type AppCardData } from "./app-card";
import { CredentialsEditor } from "./credentials-editor";
import { GoogleCalendarSettings } from "@/app/dashboard/settings/google-calendar-settings";
import { MicrosoftCalendarSettings } from "@/app/dashboard/settings/microsoft-calendar-settings";
import { CaldavCalendarSettings } from "@/app/dashboard/settings/caldav-calendar-settings";
import { EmailSettings } from "@/app/dashboard/settings/email-settings";
import { PaymentSettings } from "@/app/dashboard/settings/payment-settings";

interface Props {
  appUrl: string;
  video: AppCardData[];
  crm: AppCardData[];
  credentialStatuses: Record<IntegrationProvider, ProviderCredentialStatus>;
  isAdmin: boolean;
  edition: { licensed: boolean; plan: string | null };
}

function SectionIntro({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-muted-foreground">{children}</p>;
}

export function IntegrationsHub({ appUrl, video, crm, credentialStatuses, isAdmin, edition }: Props) {
  return (
    <Tabs defaultValue="calendars" className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <TabsList className="flex-wrap">
          <TabsTrigger value="calendars">Calendars</TabsTrigger>
          <TabsTrigger value="video">Video</TabsTrigger>
          <TabsTrigger value="crm">CRM</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
          <TabsTrigger value="email">Email</TabsTrigger>
          {isAdmin ? <TabsTrigger value="setup">Setup</TabsTrigger> : null}
        </TabsList>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Badge variant={edition.licensed ? "success" : "secondary"}>
            {edition.licensed ? "Licensed" : "Community"}
          </Badge>
          {edition.plan ? <span>· {edition.plan}</span> : null}
        </div>
      </div>

      <TabsContent value="calendars" className="space-y-4">
        <SectionIntro>
          Two-way sync: read busy times so you&apos;re never double-booked, and add each booking to
          your calendar. Apple / CalDAV needs no admin setup — just a server URL and app password.
        </SectionIntro>
        <div className="grid gap-4 lg:grid-cols-3">
          <GoogleCalendarSettings />
          <MicrosoftCalendarSettings />
          <CaldavCalendarSettings />
        </div>
      </TabsContent>

      <TabsContent value="video" className="space-y-4">
        <SectionIntro>Attach a meeting link to every booking automatically.</SectionIntro>
        {video.length === 0 ? (
          <EmptyState icon={Video} title="No video apps available" />
        ) : (
          <div className="grid gap-4 lg:grid-cols-3">
            {video.map((app) => (
              <AppCard key={app.slug} app={app} />
            ))}
          </div>
        )}
      </TabsContent>

      <TabsContent value="crm" className="space-y-4">
        <SectionIntro>Log every booking to your CRM as a contact and meeting.</SectionIntro>
        {crm.length === 0 ? (
          <EmptyState icon={Users} title="No CRM apps available" />
        ) : (
          <div className="grid gap-4 lg:grid-cols-3">
            {crm.map((app) => (
              <AppCard key={app.slug} app={app} />
            ))}
          </div>
        )}
      </TabsContent>

      <TabsContent value="payments" className="space-y-4">
        <SectionIntro>Collect deposits or full payment at booking time with Stripe.</SectionIntro>
        <PaymentSettings />
      </TabsContent>

      <TabsContent value="email" className="space-y-4">
        <SectionIntro>
          Send confirmations, reminders and cancellations over your own SMTP server.
        </SectionIntro>
        <EmailSettings />
      </TabsContent>

      {isAdmin ? (
        <TabsContent value="setup" className="space-y-4">
          <CredentialsEditor appUrl={appUrl} statuses={credentialStatuses} />
        </TabsContent>
      ) : null}
    </Tabs>
  );
}
