"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { Trash2, UserPlus, Upload, Check, Copy, Link2, Send, Crown, MoreHorizontal } from "lucide-react";

interface Member {
  membershipId: number;
  role: MembershipRole;
  accepted: boolean;
  name: string | null;
  email: string;
  position: string | null;
  avatarUrl: string | null;
  isSelf: boolean;
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

const destructiveAction = buttonVariants({ variant: "destructive" });

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
      {canInvite ? (
        <Card>
          <CardHeader>
            <CardTitle>
              <h2>Invite a member</h2>
            </CardTitle>
            <CardDescription>They get an email with a link to create their account.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form action={invite} className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <input type="hidden" name="teamId" value={teamId} />
              <input type="hidden" name="role" value={inviteRole} />
              <Field label="Email" htmlFor="invite-email" className="flex-1">
                <Input id="invite-email" name="email" type="email" placeholder="person@company.com" required />
              </Field>
              <Field label="Role" htmlFor="invite-role" className="sm:w-40">
                <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as MembershipRole)}>
                  <SelectTrigger id="invite-role" className="capitalize">
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
              </Field>
              <Button type="submit" loading={inviting}>
                {inviting ? null : <UserPlus />}
                Invite
              </Button>
            </form>

            {inviteLink ? (
              <div className="space-y-3 rounded-lg border bg-muted/50 p-4">
                <div className="space-y-1">
                  <p className="flex items-center gap-2 text-sm font-medium">
                    <Link2 className="size-4 text-muted-foreground" />
                    Invitation link
                  </p>
                  <p className="text-meta text-muted-foreground">
                    We emailed this link, but email delivery isn&apos;t guaranteed on every setup. Share it
                    with the invitee directly, as they need it to create their account.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    readOnly
                    value={inviteLink}
                    aria-label="Invitation link"
                    className="h-8 flex-1 font-mono text-meta"
                  />
                  <Button type="button" size="sm" variant="outline" onClick={copyInviteLink}>
                    {linkCopied ? <Check className="text-success" /> : <Copy />}
                    {linkCopied ? "Copied" : "Copy"}
                  </Button>
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader className="flex-row items-baseline gap-2 border-b py-4">
          <CardTitle>
            <h2>Members</h2>
          </CardTitle>
          <span className="text-sm tabular-nums text-muted-foreground">{members.length}</span>
        </CardHeader>
        <ul className="divide-y">
          {members.map((m) => {
            const editable = m.role !== "owner" && canAssignRole(viewerRole, m.role);
            const showTransfer = viewerRole === "owner" && m.role !== "owner" && m.accepted;
            const showRemove = canRemove && editable;
            return (
              <li
                key={m.membershipId}
                className="flex flex-col gap-3 px-5 py-3 sm:flex-row sm:items-center sm:gap-4"
              >
                <MemberIdentity member={m} />
                <div className="flex items-center gap-3 pl-11 sm:gap-4 sm:pl-0">
                  <div className="sm:w-20">
                    {m.accepted ? (
                      <Badge variant="success" dot>
                        Active
                      </Badge>
                    ) : (
                      <Badge variant="pending" dot>
                        Pending
                      </Badge>
                    )}
                  </div>
                  <div className="w-32">
                    {canManageRoles && editable ? (
                      <RoleSelect
                        teamId={teamId}
                        membershipId={m.membershipId}
                        memberName={m.name ?? m.email}
                        current={m.role}
                        options={assignableRoles}
                      />
                    ) : (
                      <span className="flex h-8 items-center border border-transparent px-3 text-sm capitalize text-muted-foreground">
                        {m.role}
                      </span>
                    )}
                  </div>
                  <div className="ml-auto flex w-8 justify-end sm:ml-0">
                    {showTransfer || showRemove ? (
                      <MemberActions
                        teamId={teamId}
                        membershipId={m.membershipId}
                        memberName={m.name ?? m.email}
                        canTransfer={showTransfer}
                        canRemove={showRemove}
                      />
                    ) : null}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </Card>

      {canInvite && pendingInvites.length > 0 ? (
        <Card>
          <CardHeader className="border-b py-4">
            <div className="flex items-baseline gap-2">
              <CardTitle>
                <h2>Pending invitations</h2>
              </CardTitle>
              <span className="text-sm tabular-nums text-muted-foreground">{pendingInvites.length}</span>
            </div>
            <CardDescription>
              People invited who haven&apos;t created an account yet. Copy a link to share it directly,
              or revoke it to free up the email address for a fresh invite.
            </CardDescription>
          </CardHeader>
          <ul className="divide-y">
            {pendingInvites.map((inv) => (
              <InviteRow
                key={inv.id}
                invite={inv}
                teamId={teamId}
                copied={copiedId === inv.id}
                onCopy={() => copyPendingLink(inv.url, inv.id)}
              />
            ))}
          </ul>
        </Card>
      ) : null}

      {canInvite ? (
        <Card>
          <CardHeader>
            <CardTitle>
              <h2>Bulk import</h2>
            </CardTitle>
            <CardDescription>
              Paste CSV with the columns <code className="font-mono text-meta">email,name,role</code>.
              Existing accounts join the team straight away; unknown emails are reported so you can
              invite them individually.
            </CardDescription>
          </CardHeader>
          <form action={runImport}>
            <input type="hidden" name="teamId" value={teamId} />
            <CardContent className="space-y-3">
              <Textarea
                name="csv"
                rows={5}
                aria-label="CSV to import"
                className="font-mono text-meta"
                placeholder={"email,name,role\njane@acme.co,Jane,member"}
                required
              />
              {importState?.errors && importState.errors.length > 0 ? (
                <ul className="space-y-0.5 text-meta text-destructive">
                  {importState.errors.map((e, i) => (
                    <li key={i}>{e}</li>
                  ))}
                </ul>
              ) : null}
            </CardContent>
            <CardFooter>
              <Button type="submit" variant="outline" loading={importing}>
                {importing ? null : <Upload />}
                Import
              </Button>
            </CardFooter>
          </form>
        </Card>
      ) : null}
    </div>
  );
}

function MemberIdentity({ member: m }: { member: Member }) {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-3">
      <Avatar className="size-8">
        {m.avatarUrl ? <AvatarImage src={m.avatarUrl} alt="" /> : null}
        <AvatarFallback>{initials(m.name ?? m.email)}</AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-2">
          <p className="truncate text-sm font-medium">{m.name ?? m.email}</p>
          {m.isSelf ? <Badge variant="secondary">You</Badge> : null}
        </div>
        <p className="truncate text-meta text-muted-foreground">
          {m.position ? `${m.position} · ` : ""}
          {m.email}
        </p>
      </div>
    </div>
  );
}

function RoleSelect({
  teamId,
  membershipId,
  memberName,
  current,
  options,
}: {
  teamId: number;
  membershipId: number;
  memberName: string;
  current: MembershipRole;
  options: MembershipRole[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [state, action] = useActionState<TeamState, FormData>(changeMemberRoleAction, null);

  useEffect(() => {
    if (state?.ok) {
      toast({ title: "Role updated" });
      router.refresh();
    } else if (state?.error) {
      toast({ title: "Couldn't update role", description: state.error, variant: "destructive" });
    }
  }, [state, toast, router]);

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
        <SelectTrigger className="h-8 capitalize" aria-label={`Role for ${memberName}`}>
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

/** Row menu for transferring ownership and removing a member. Each item opens
 *  its own confirmation; the menu is non-modal so the dialog can take focus. */
function MemberActions({
  teamId,
  membershipId,
  memberName,
  canTransfer,
  canRemove,
}: {
  teamId: number;
  membershipId: number;
  memberName: string;
  canTransfer: boolean;
  canRemove: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [confirm, setConfirm] = useState<"transfer" | "remove" | null>(null);
  const [removeState, remove, removing] = useActionState<TeamState, FormData>(removeMemberAction, null);
  const [transferState, transfer, transferring] = useActionState<TeamState, FormData>(
    transferOwnershipAction,
    null,
  );

  useEffect(() => {
    if (removeState?.ok) {
      toast({ title: "Member removed" });
      router.refresh();
    } else if (removeState?.error) {
      toast({ title: "Couldn't remove member", description: removeState.error, variant: "destructive" });
    }
  }, [removeState, toast, router]);

  useEffect(() => {
    if (transferState?.ok) {
      toast({ title: "Ownership transferred", description: "You are now an admin of this company." });
      router.refresh();
    } else if (transferState?.error) {
      toast({ title: "Couldn't transfer ownership", description: transferState.error, variant: "destructive" });
    }
  }, [transferState, toast, router]);

  const confirmOpenChange = (which: "transfer" | "remove") => (open: boolean) =>
    setConfirm(open ? which : null);

  return (
    <>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            disabled={removing || transferring}
            aria-label={`Actions for ${memberName}`}
          >
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {canTransfer ? (
            <DropdownMenuItem onSelect={() => setConfirm("transfer")}>
              <Crown />
              Transfer ownership
            </DropdownMenuItem>
          ) : null}
          {canRemove ? (
            <DropdownMenuItem
              className="text-destructive focus:text-destructive [&_svg]:text-destructive"
              onSelect={() => setConfirm("remove")}
            >
              <Trash2 />
              Remove member
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirm === "transfer"} onOpenChange={confirmOpenChange("transfer")}>
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
            <form action={transfer}>
              <input type="hidden" name="teamId" value={teamId} />
              <input type="hidden" name="membershipId" value={membershipId} />
              <AlertDialogAction type="submit" disabled={transferring}>
                Transfer ownership
              </AlertDialogAction>
            </form>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirm === "remove"} onOpenChange={confirmOpenChange("remove")}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {memberName}?</AlertDialogTitle>
            <AlertDialogDescription>
              They lose access to the dashboard and are unassigned from all services. Their past
              bookings are kept.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <form action={remove}>
              <input type="hidden" name="teamId" value={teamId} />
              <input type="hidden" name="membershipId" value={membershipId} />
              <AlertDialogAction type="submit" className={destructiveAction} disabled={removing}>
                Remove member
              </AlertDialogAction>
            </form>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function formatShortDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
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
    <li className="flex flex-col gap-3 px-5 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-2">
          <p className="truncate text-sm font-medium">{inv.email}</p>
          <Badge variant="outline" className="capitalize">
            {inv.role}
          </Badge>
        </div>
        <p className="text-meta text-muted-foreground">
          {inv.invitedBy ? `Invited by ${inv.invitedBy} · ` : ""}
          {formatShortDate(inv.invitedAt)}
          {" · Expires "}
          {formatShortDate(inv.expiresAt)}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Button type="button" size="sm" variant="outline" onClick={onCopy}>
          {copied ? <Check className="text-success" /> : <Link2 />}
          {copied ? "Copied" : "Copy link"}
        </Button>
        <form action={resend}>
          <input type="hidden" name="inviteId" value={inv.id} />
          <input type="hidden" name="teamId" value={teamId} />
          <Button type="submit" size="sm" variant="outline" loading={resending}>
            {resending ? null : <Send />}
            {resending ? "Sending…" : "Resend"}
          </Button>
        </form>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="text-destructive hover:text-destructive"
              disabled={revoking}
            >
              <Trash2 />
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
                <AlertDialogAction type="submit" className={destructiveAction} disabled={revoking}>
                  Revoke
                </AlertDialogAction>
              </form>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </li>
  );
}
