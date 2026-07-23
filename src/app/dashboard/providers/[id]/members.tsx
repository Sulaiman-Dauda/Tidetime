"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import { initials } from "@/lib/format";
import { can, canAssignRole } from "@/lib/rbac";
import type { MembershipRole } from "@/db/schema";
import {
  changeMemberRoleAction,
  removeMemberAction,
  bulkImportMembersAction,
  transferOwnershipAction,
  type TeamState,
  type ImportState,
} from "../actions";
import { createInviteAction, resendInviteAction, revokeInviteAction, type InviteState } from "../invite-actions";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Trash2, UserPlus, Upload, Loader2, Check, Copy, Link2, Send, Crown } from "lucide-react";

interface Member {
  membershipId: number;
  role: MembershipRole;
  accepted: boolean;
  name: string | null;
  email: string;
  position: string | null;
  avatarUrl: string | null;
}

interface PendingInvite {
  id: number;
  email: string;
  role: MembershipRole;
  url: string;
  expiresAt: string;
  invitedAt: string;
  invitedBy: string | null;
}

const ASSIGNABLE: MembershipRole[] = ["admin", "scheduler", "member"];

export function TeamMembers({
  teamId,
  viewerRole,
  members,
  pendingInvites = [],
}: {
  teamId: number;
  viewerRole: MembershipRole;
  members: Member[];
  pendingInvites?: PendingInvite[];
}) {
  const router = useRouter();
  const { toast } = useToast();

  const canInvite = can(viewerRole, "member.invite");
  const canManageRoles = can(viewerRole, "member.role.assign");
  const canRemove = can(viewerRole, "member.remove");
  const [copiedId, setCopiedId] = useState<number | null>(null);

  const [inviteState, invite, inviting] = useActionState<InviteState, FormData>(createInviteAction, null);
  const [importState, runImport, importing] = useActionState<ImportState, FormData>(bulkImportMembersAction, null);
  const [inviteRole, setInviteRole] = useState<MembershipRole>("member");
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);

  useEffect(() => {
    if (inviteState?.ok) {
      toast({
        title: "Invitation created",
        description: "Share the link below so they can create their account.",
      });
      setInviteLink(inviteState.inviteUrl ?? null);
      setLinkCopied(false);
      router.refresh();
    } else if (inviteState?.error) {
      toast({
        title: "Couldn't send invitation",
        description: inviteState.error,
        variant: "destructive",
      });
    }
  }, [inviteState, toast, router]);

  async function copyInviteLink() {
    if (!inviteLink) return;
    try {
      await navigator.clipboard.writeText(inviteLink);
      setLinkCopied(true);
      window.setTimeout(() => setLinkCopied(false), 1600);
    } catch {
      /* clipboard unavailable */
    }
  }

  async function copyPendingLink(url: string, id: number) {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(id);
      window.setTimeout(() => setCopiedId((c) => (c === id ? null : c)), 1600);
    } catch {
      /* clipboard unavailable */
    }
  }

  useEffect(() => {
    if (importState?.ok) {
      const n = importState.added ?? 0;
      toast({ title: `Imported ${n} member${n === 1 ? "" : "s"}` });
      router.refresh();
    } else if (importState?.error) {
      toast({
        title: "Couldn't import members",
        description: importState.error,
        variant: "destructive",
      });
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
              <div className="flex min-w-0 items-center gap-3">
                <Avatar className="h-9 w-9 shrink-0">
                  {m.avatarUrl ? <AvatarImage src={m.avatarUrl} alt="" /> : null}
                  <AvatarFallback className="text-xs">{initials(m.name ?? m.email)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {m.name ?? m.email}
                    {m.position ? (
                      <span className="font-normal text-muted-foreground"> · {m.position}</span>
                    ) : null}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">{m.email}</p>
                </div>
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
                {viewerRole === "owner" && m.role !== "owner" && m.accepted ? (
                  <TransferOwnershipButton
                    teamId={teamId}
                    membershipId={m.membershipId}
                    memberName={m.name ?? m.email}
                    onDone={() => router.refresh()}
                  />
                ) : null}
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

          {inviteLink ? (
            <div className="mt-4 rounded-lg border border-primary/20 bg-primary/[0.04] p-3">
              <div className="flex items-center gap-2 text-xs font-medium text-foreground">
                <Link2 className="h-3.5 w-3.5 text-primary" />
                Invitation link
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                We emailed this link, but email delivery isn&apos;t guaranteed on every setup. Share it
                directly with the invitee — they need it to create their account.
              </p>
              <div className="mt-2 flex items-center gap-2">
                <Input readOnly value={inviteLink} className="h-8 flex-1 font-mono text-xs" />
                <Button type="button" size="sm" variant="outline" className="h-8 shrink-0 gap-1.5" onClick={copyInviteLink}>
                  {linkCopied ? <Check className="h-3.5 w-3.5 text-primary" /> : <Copy className="h-3.5 w-3.5" />}
                  {linkCopied ? "Copied" : "Copy"}
                </Button>
              </div>
            </div>
          ) : null}
        </Card>
      ) : null}

      {canInvite && pendingInvites.length > 0 ? (
        <Card className="p-5">
          <h2 className="text-sm font-semibold">Pending invitations</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Invited people who haven&apos;t created an account yet. Copy a link to share it directly,
            or revoke it to free up the email address for a fresh invite.
          </p>
          <div className="mt-4 space-y-2">
            {pendingInvites.map((inv) => (
              <InviteRow
                key={inv.id}
                invite={inv}
                teamId={teamId}
                copied={copiedId === inv.id}
                onCopy={() => copyPendingLink(inv.url, inv.id)}
              />
            ))}
          </div>
        </Card>
      ) : null}

      {canInvite ? (
        <Card className="p-5">
          <h2 className="text-sm font-semibold">Bulk import</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Paste CSV with columns: <code>email,name,role</code>. Existing accounts join the team
            immediately; unknown emails are reported so you can invite them individually.
          </p>
          <form action={runImport} className="mt-3 space-y-3">
            <input type="hidden" name="teamId" value={teamId} />
            <Textarea
              name="csv"
              rows={5}
              placeholder={"email,name,role\njane@acme.co,Jane,member"}
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
      toast({ title: "Couldn't update role", description: state.error, variant: "destructive" });
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
      toast({ title: "Couldn't remove member", description: state.error, variant: "destructive" });
    }
  }, [state, toast, onDone]);

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8" disabled={pending} aria-label="Remove member">
          <Trash2 className="h-4 w-4" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove this member?</AlertDialogTitle>
          <AlertDialogDescription>
            They lose access to the dashboard and are unassigned from all services. Their past
            bookings are kept.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <form action={action}>
            <input type="hidden" name="teamId" value={teamId} />
            <input type="hidden" name="membershipId" value={membershipId} />
            <AlertDialogAction
              type="submit"
              className="bg-destructive text-destructive-foreground hover:bg-destructive/88"
              disabled={pending}
            >
              Remove member
            </AlertDialogAction>
          </form>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function TransferOwnershipButton({
  teamId,
  membershipId,
  memberName,
  onDone,
}: {
  teamId: number;
  membershipId: number;
  memberName: string;
  onDone: () => void;
}) {
  const { toast } = useToast();
  const [state, action, pending] = useActionState<TeamState, FormData>(transferOwnershipAction, null);

  useEffect(() => {
    if (state?.ok) {
      toast({ title: "Ownership transferred", description: "You are now an admin of this company." });
      onDone();
    } else if (state?.error) {
      toast({ title: "Couldn't transfer ownership", description: state.error, variant: "destructive" });
    }
  }, [state, toast, onDone]);

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8" disabled={pending} aria-label="Transfer ownership" title="Transfer ownership">
          <Crown className="h-4 w-4" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Make {memberName} the owner?</AlertDialogTitle>
          <AlertDialogDescription>
            They become the company owner and you become an admin. Only the new owner can transfer
            ownership back.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <form action={action}>
            <input type="hidden" name="teamId" value={teamId} />
            <input type="hidden" name="membershipId" value={membershipId} />
            <AlertDialogAction type="submit" disabled={pending}>
              Transfer ownership
            </AlertDialogAction>
          </form>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** One pending invitation with its own action state, so resending or revoking
 *  one invite never disables the others. */
function InviteRow({
  invite: inv,
  teamId,
  copied,
  onCopy,
}: {
  invite: PendingInvite;
  teamId: number;
  copied: boolean;
  onCopy: () => void;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [revokeState, revoke, revoking] = useActionState<InviteState, FormData>(revokeInviteAction, null);
  const [resendState, resend, resending] = useActionState<InviteState, FormData>(resendInviteAction, null);

  useEffect(() => {
    if (revokeState?.ok) {
      toast({ title: "Invitation revoked" });
      router.refresh();
    } else if (revokeState?.error) {
      toast({ title: "Couldn't revoke invitation", description: revokeState.error, variant: "destructive" });
    }
  }, [revokeState, toast, router]);

  useEffect(() => {
    if (resendState?.ok) {
      toast({ title: "Invitation re-sent", description: "The expiry was extended by 7 days." });
      router.refresh();
    } else if (resendState?.error) {
      toast({ title: "Couldn't resend invitation", description: resendState.error, variant: "destructive" });
    }
  }, [resendState, toast, router]);

  return (
    <div className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate text-sm font-medium">{inv.email}</p>
          <Badge variant="outline" className="capitalize">{inv.role}</Badge>
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {inv.invitedBy ? `Invited by ${inv.invitedBy} · ` : ""}
          {new Date(inv.invitedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
          {" · expires "}
          {new Date(inv.expiresAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Button type="button" size="sm" variant="outline" className="h-8 gap-1.5" onClick={onCopy}>
          {copied ? <Check className="h-3.5 w-3.5 text-primary" /> : <Link2 className="h-3.5 w-3.5" />}
          {copied ? "Copied" : "Copy link"}
        </Button>
        <form action={resend}>
          <input type="hidden" name="inviteId" value={inv.id} />
          <input type="hidden" name="teamId" value={teamId} />
          <Button type="submit" size="sm" variant="outline" className="h-8 gap-1.5" disabled={resending}>
            <Send className="h-3.5 w-3.5" />
            {resending ? "Sending…" : "Resend"}
          </Button>
        </form>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-8 gap-1.5 text-destructive hover:text-destructive"
              disabled={revoking}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Revoke
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Revoke this invitation?</AlertDialogTitle>
              <AlertDialogDescription>
                The signup link for {inv.email} stops working immediately. You can invite them
                again later.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <form action={revoke}>
                <input type="hidden" name="inviteId" value={inv.id} />
                <input type="hidden" name="teamId" value={teamId} />
                <AlertDialogAction
                  type="submit"
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/88"
                  disabled={revoking}
                >
                  Revoke
                </AlertDialogAction>
              </form>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
