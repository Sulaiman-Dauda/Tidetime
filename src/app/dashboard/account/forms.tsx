"use client";

import { useActionState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { AvatarUpload } from "./avatar-upload";
import {
  updateProfileAction,
  updatePasswordAction,
  type SettingsState,
} from "./actions";
import { WEEKDAY_SHORT } from "@/lib/format";

interface UserView {
  name: string | null;
  username: string;
  email: string;
  bio: string | null;
  avatarUrl: string | null;
  timeZone: string;
  timeFormat: number;
  weekStart: number;
  hasPassword: boolean;
}

export function SettingsForms({ user, timeZones }: { user: UserView; timeZones: string[] }) {
  const { toast } = useToast();

  const [profileState, profileAction, profilePending] = useActionState<SettingsState, FormData>(
    updateProfileAction,
    null,
  );
  const [pwState, pwAction, pwPending] = useActionState<SettingsState, FormData>(updatePasswordAction, null);

  useEffect(() => {
    if (profileState?.ok) toast({ title: "Profile saved" });
    if (profileState?.error) toast({ title: profileState.error, variant: "destructive" });
  }, [profileState, toast]);

  useEffect(() => {
    if (pwState?.ok) toast({ title: "Password updated" });
    if (pwState?.error) toast({ title: pwState.error, variant: "destructive" });
  }, [pwState, toast]);

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <h2 className="text-base font-semibold">Profile</h2>
        <div className="mt-5">
          <AvatarUpload currentUrl={user.avatarUrl} name={user.name ?? user.username} />
        </div>
        <form action={profileAction} className="mt-5 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" defaultValue={user.name ?? ""} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="username">Username</Label>
              <Input id="username" name="username" defaultValue={user.username} required />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bio">Bio</Label>
            <Textarea id="bio" name="bio" rows={3} defaultValue={user.bio ?? ""} placeholder="A short intro shown on your booking page." />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label>Time zone</Label>
              <SelectField name="timeZone" defaultValue={user.timeZone} options={timeZones.map((t) => ({ value: t, label: t.replace(/_/g, " ") }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Time format</Label>
              <SelectField
                name="timeFormat"
                defaultValue={String(user.timeFormat)}
                options={[
                  { value: "12", label: "12-hour" },
                  { value: "24", label: "24-hour" },
                ]}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Week starts</Label>
              <SelectField
                name="weekStart"
                defaultValue={String(user.weekStart)}
                options={WEEKDAY_SHORT.map((d, i) => ({ value: String(i), label: d }))}
              />
            </div>
          </div>
          <Button type="submit" loading={profilePending}>
            Save changes
          </Button>
        </form>
      </Card>

      <Card className="p-6">
        <h2 className="text-base font-semibold">Email</h2>
        <p className="mt-1 text-sm text-muted-foreground">{user.email}</p>
      </Card>

      <Card className="p-6">
        <h2 className="text-base font-semibold">{user.hasPassword ? "Change password" : "Set password"}</h2>
        <form action={pwAction} className="mt-5 max-w-sm space-y-4">
          {user.hasPassword ? (
            <div className="space-y-1.5">
              <Label htmlFor="current">Current password</Label>
              <Input id="current" name="current" type="password" autoComplete="current-password" />
            </div>
          ) : null}
          <div className="space-y-1.5">
            <Label htmlFor="next">New password</Label>
            <Input id="next" name="next" type="password" autoComplete="new-password" required minLength={8} />
          </div>
          <Button type="submit" variant="outline" loading={pwPending}>
            Update password
          </Button>
        </form>
      </Card>
    </div>
  );
}

function SelectField({
  name,
  defaultValue,
  options,
}: {
  name: string;
  defaultValue: string;
  options: { value: string; label: string }[];
}) {
  return (
    <Select name={name} defaultValue={defaultValue}>
      <SelectTrigger>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
