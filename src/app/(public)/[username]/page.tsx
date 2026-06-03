import Link from "next/link";
import type { Route } from "next";
import { notFound } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { users, eventTypes, serviceCategories } from "@/db/schema";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatDuration, initials } from "@/lib/format";
import { locationLabel } from "@/lib/locations";
import { Clock, ArrowRight, Video } from "lucide-react";
import type { Metadata } from "next";
import { PublicLegal } from "../_components/public-legal";
import { CompanyBrandHeader } from "../_components/company-brand-header";

interface Props {
  params: Promise<{ username: string }>;
}

async function loadProfile(username: string) {
  const [user] = await db
    .select({
      id: users.id,
      username: users.username,
      name: users.name,
      avatarUrl: users.avatarUrl,
      bio: users.bio,
      brandColor: users.brandColor,
    })
    .from(users)
    .where(eq(users.username, username))
    .limit(1);
  if (!user) return null;

  const types = await db
    .select()
    .from(eventTypes)
    .where(and(eq(eventTypes.userId, user.id), eq(eventTypes.hidden, false)))
    .orderBy(asc(eventTypes.position), asc(eventTypes.id));

  const categories = await db
    .select({
      id: serviceCategories.id,
      name: serviceCategories.name,
      position: serviceCategories.position,
    })
    .from(serviceCategories)
    .orderBy(asc(serviceCategories.position), asc(serviceCategories.id));

  return { user, types, categories };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username } = await params;
  const data = await loadProfile(username);
  if (!data) return { title: "Not found" };
  const name = data.user.name ?? data.user.username;
  return { title: `${name} · Tidetime`, description: data.user.bio ?? `Book a meeting with ${name}.` };
}

export default async function PublicProfilePage({ params }: Props) {
  const { username } = await params;
  const data = await loadProfile(username);
  if (!data) notFound();

  const { user, types, categories } = data;
  const name = user.name ?? user.username;

  // Group services by category; categories with no visible services are skipped,
  // and uncategorised services fall into a trailing "Other" group.
  const groups: { key: string; title: string | null; items: typeof types }[] = [];
  for (const cat of categories) {
    const items = types.filter((t) => t.categoryId === cat.id);
    if (items.length > 0) groups.push({ key: `cat-${cat.id}`, title: cat.name, items });
  }
  const uncategorised = types.filter((t) => !t.categoryId);
  if (uncategorised.length > 0) {
    groups.push({
      key: "uncategorised",
      title: groups.length > 0 ? "Other" : null,
      items: uncategorised,
    });
  }

  function renderEventType(et: (typeof types)[number]) {
    const loc = et.locations[0];
    return (
      <Link
        key={et.id}
        href={`/${user.username}/${et.slug}` as Route}
        className="group flex items-center justify-between rounded-xl border bg-card p-5 transition-all hover:border-foreground/20 hover:shadow-sm"
      >
        <div className="min-w-0">
          <h2 className="truncate font-medium">{et.title}</h2>
          {et.description ? (
            <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{et.description}</p>
          ) : null}
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              {formatDuration(et.length)}
            </span>
            {loc ? (
              <span className="inline-flex items-center gap-1.5">
                <Video className="h-3.5 w-3.5" />
                {locationLabel(loc)}
              </span>
            ) : null}
          </div>
        </div>
        <ArrowRight className="ml-4 h-5 w-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
      </Link>
    );
  }

  return (
    <main className="min-h-screen bg-grid">
      <CompanyBrandHeader />
      <div className="mx-auto max-w-2xl px-4 py-16 sm:py-24">
        <div className="flex flex-col items-center text-center">
          <Avatar className="h-20 w-20 ring-1 ring-border">
            {user.avatarUrl ? <AvatarImage src={user.avatarUrl} alt={name} /> : null}
            <AvatarFallback className="text-lg">{initials(name)}</AvatarFallback>
          </Avatar>
          <h1 className="mt-5 text-2xl font-semibold tracking-tight">{name}</h1>
          {user.bio ? <p className="mt-2 max-w-md text-sm text-muted-foreground">{user.bio}</p> : null}
        </div>

        <div className="mt-10 space-y-8">
          {types.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground">No public event types yet.</p>
          ) : (
            groups.map((group) => (
              <div key={group.key} className="space-y-3">
                {group.title ? (
                  <h2 className="px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
                    {group.title}
                  </h2>
                ) : null}
                {group.items.map((et) => renderEventType(et))}
              </div>
            ))
          )}
        </div>

        <p className="mt-16 text-center text-xs text-muted-foreground">
          Powered by{" "}
          <Link href="/" className="font-medium text-foreground hover:underline">
            Tidetime
          </Link>
        </p>
      </div>
      <PublicLegal />
    </main>
  );
}
