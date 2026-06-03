"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { can, canAssignRole } from "@/lib/rbac";
import type { MembershipRole } from "@/db/schema";
import {
  changeMemberRoleAction,
  removeMemberAction,
  bulkImportMembersAction,
  type TeamState,
  type ImportState,
} from "../actions";
import { createInviteAction, type InviteState } from "../invite-actions";
import { Trash2, UserPlus, Upload, Loader2 } from "lucide-react";

interface Member {
  membershipId: number;
  role: MembershipRole;
  accepted: boolean;
  name: string | null;
  email: string;
}

const ASSIGNABLE: MembershipRole[] = ["admin", "manager", "provider", "receptionist", "member"];

export function TeamMembers({
  teamId,
  viewerRole,
  members,
}: {
  teamId: number;
  viewerRole: MembershipRole;
  members: Member[];
}) {
  const router = useRouter();
  const { toast } = useToast();

  const canInvite = can(viewerRole, "member.invite");
  const canManageRoles = can(viewerRole, "member.role.assign");
  const canRemove = can(viewerRole, "member.remove");

  const [inviteState, invite, inviting] = useActionState<InviteState, FormData>(createInviteAction, null);
  const [importState, runImport, importing] = useActionState<ImportState, FormData>(bulkImportMembersAction, null);
  const [inviteRole, setInviteRole] = useState<MembershipRole>("provider");

  useEffect(() => {
    if (inviteState?.ok) {
      toast({ title: "Invitation sent" });
      router.refresh();
    } else if (inviteState?.error) {
      toast({ title: inviteState.error, variant: "destructive" });
    }
  }, [inviteState, toast, router]);

  useEffect(() => {
    if (importState?.ok) {
      toast({ title: `Imported ${importState.added ?? 0} member(s)` });
      router.refresh();
    } else if (importState?.error) {
      toast({ title: importState.error, variant: "destructive" });
    }
  }, [importState, toast, router]);

  const assignableRoles = ASSIGNABLE.filter((r) => canAssignRole(viewerRole, r));

  return (
    <div className="space-y-6">
      <Card className="p-5">
        <h2 className="text-sm font-semibold">Members</h2>
        <div className="mt-4 space-y-2">
          {members.map((m) => (
            <div key={m.membershipId} className="flex items-center justify-between gap-3 rounded-md border p-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{m.name ?? m.email}</p>
                <p className="truncate text-xs text-muted-foreground">{m.email}</p>
              </div>
              <div className="flex items-center gap-2">
                {!m.accepted ? <Badge variant="secondary">Pending</Badge> : null}
                {canManageRoles && m.role !== "owner" && canAssignRole(viewerRole, m.role) ? (
                  <RoleSelect
                    teamId={teamId}
                    membershipId={m.membershipId}
                    current={m.role}
                    options={assignableRoles}
                    onDone={() => router.refresh()}
                  />
                ) : (
                  <Badge variant="outline" className="capitalize">
                    {m.role}
                  </Badge>
                )}
                {canRemove && m.role !== "owner" && canAssignRole(viewerRole, m.role) ? (
                  <RemoveButton teamId={teamId} membershipId={m.membershipId} onDone={() => router.refresh()} />
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {canInvite ? (
        <Card className="p-5">
          <h2 className="text-sm font-semibold">Invite a member</h2>
          <form action={invite} className="mt-4 flex flex-wrap items-end gap-3">
            <input type="hidden" name="teamId" value={teamId} />
            <input type="hidden" name="role" value={inviteRole} />
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="invite-email">Email</Label>
              <Input id="invite-email" name="email" type="email" placeholder="person@company.com" required />
            </div>
            <div className="space-y-1.5">
              <Label>Role</Label>
              <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as MembershipRole)}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {assignableRoles.map((r) => (
                    <SelectItem key={r} value={r} className="capitalize">
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" disabled={inviting}>
              {inviting ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
              Invite
            </Button>
          </form>
        </Card>
      ) : null}

      {canInvite ? (
        <Card className="p-5">
          <h2 className="text-sm font-semibold">Bulk import</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Paste CSV with columns: <code>email,name,role</code>. Existing users only.
          </p>
          <form action={runImport} className="mt-3 space-y-3">
            <input type="hidden" name="teamId" value={teamId} />
            <Textarea
              name="csv"
              rows={5}
              placeholder={"email,name,role\njane@acme.co,Jane,provider"}
              required
            />
            <Button type="submit" variant="outline" disabled={importing}>
              {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              Import
            </Button>
          </form>
          {importState?.errors && importState.errors.length > 0 ? (
            <ul className="mt-3 space-y-0.5 text-xs text-destructive">
              {importState.errors.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          ) : null}
        </Card>
      ) : null}
    </div>
  );
}

function RoleSelect({
  teamId,
  membershipId,
  current,
  options,
  onDone,
}: {
  teamId: number;
  membershipId: number;
  current: MembershipRole;
  options: MembershipRole[];
  onDone: () => void;
}) {
  const { toast } = useToast();
  const [state, action] = useActionState<TeamState, FormData>(changeMemberRoleAction, null);

  useEffect(() => {
    if (state?.ok) {
      toast({ title: "Role updated" });
      onDone();
    } else if (state?.error) {
      toast({ title: state.error, variant: "destructive" });
    }
  }, [state, toast, onDone]);

  return (
    <form action={action}>
      <input type="hidden" name="teamId" value={teamId} />
      <input type="hidden" name="membershipId" value={membershipId} />
      <Select
        defaultValue={current}
        onValueChange={(v) => {
          const fd = new FormData();
          fd.set("teamId", String(teamId));
          fd.set("membershipId", String(membershipId));
          fd.set("role", v);
          action(fd);
        }}
      >
        <SelectTrigger className="h-8 w-36 capitalize">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((r) => (
            <SelectItem key={r} value={r} className="capitalize">
              {r}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </form>
  );
}

function RemoveButton({
  teamId,
  membershipId,
  onDone,
}: {
  teamId: number;
  membershipId: number;
  onDone: () => void;
}) {
  const { toast } = useToast();
  const [state, action, pending] = useActionState<TeamState, FormData>(removeMemberAction, null);

  useEffect(() => {
    if (state?.ok) {
      toast({ title: "Member removed" });
      onDone();
    } else if (state?.error) {
      toast({ title: state.error, variant: "destructive" });
    }
  }, [state, toast, onDone]);

  return (
    <form action={action}>
      <input type="hidden" name="teamId" value={teamId} />
      <input type="hidden" name="membershipId" value={membershipId} />
      <Button type="submit" variant="ghost" size="icon" className="h-8 w-8" disabled={pending}>
        <Trash2 className="h-4 w-4" />
      </Button>
    </form>
  );
}
