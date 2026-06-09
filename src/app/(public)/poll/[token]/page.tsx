import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { CalendarCheck, XCircle } from "lucide-react";
import { getPublicPoll } from "@/server/polls";
import { rankOptions, projectPoll, isPollVisibility, type PollChoice } from "@/lib/polls";
import { CompanyBrandHeader } from "../../_components/company-brand-header";
import { PublicLegal } from "../../_components/public-legal";
import { PollVoteForm } from "./vote-form";

interface Props {
  params: Promise<{ token: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;
  const data = await getPublicPoll(token);
  if (!data) return { title: "Not found" };
  return { title: data.poll.title, description: data.poll.description ?? "Vote on a meeting time." };
}

export default async function PublicPollPage({ params }: Props) {
  const { token } = await params;
  const data = await getPublicPoll(token);
  if (!data) notFound();

  const { poll, options, votes } = data;
  const ranked = rankOptions(
    options.map((o) => o.id),
    votes.map((v) => ({ optionId: v.optionId, choice: v.choice as PollChoice })),
  );
  const tally = new Map(ranked.map((t) => [t.optionId, t]));

  // Honour the poll's result-visibility setting. Public viewers are never the
  // owner here; tallies stay accurate, but the per-participant grid only renders
  // when the host allowed it ("full").
  const visibility = isPollVisibility(poll.visibility) ? poll.visibility : "full";
  const projection = projectPoll(
    options.map((o) => o.id),
    votes.map((v) => ({
      optionId: v.optionId,
      choice: v.choice as PollChoice,
      voterName: v.voterName,
      voterEmail: v.voterEmail,
    })),
    { visibility, hideParticipants: poll.hideParticipants, viewerEmail: null, isOwner: false },
  );
  const optionTimes = new Map(options.map((o) => [o.id, o.startTime]));
  const voterRows = projection.showVoters
    ? Object.values(
        projection.votes.reduce<Record<string, { label: string; choices: Map<number, string> }>>(
          (acc, v) => {
            (acc[v.voterLabel] ??= { label: v.voterLabel, choices: new Map() }).choices.set(
              v.optionId,
              v.choice,
            );
            return acc;
          },
          {},
        ),
      )
    : [];

  const closed = poll.status !== "open";

  return (
    <main className="min-h-screen bg-grid">
      <CompanyBrandHeader />
      <div className="mx-auto max-w-xl px-4 py-12">
        <div className="rounded-2xl border border-border/60 bg-card p-6 shadow-sm">
          <h1 className="text-xl font-semibold tracking-tight">{poll.title}</h1>
          {poll.description ? (
            <p className="mt-1.5 text-sm text-muted-foreground">{poll.description}</p>
          ) : null}
          <p className="mt-2 text-xs text-muted-foreground">
            {poll.durationMinutes}-minute meeting · times shown in {poll.timeZone}
            {poll.location ? ` · ${poll.location}` : ""}
          </p>

          {closed ? (
            <div className="mt-6 flex items-center gap-2 rounded-lg border border-border/60 bg-secondary/40 px-4 py-3 text-sm">
              {poll.status === "finalized" ? (
                <>
                  <CalendarCheck className="h-4 w-4 text-emerald-600" />
                  A time has been chosen — voting is closed.
                </>
              ) : (
                <>
                  <XCircle className="h-4 w-4 text-muted-foreground" />
                  This poll is closed.
                </>
              )}
            </div>
          ) : (
            <div className="mt-6">
              <PollVoteForm
                token={poll.token}
                timeZone={poll.timeZone}
                options={options.map((o) => {
                  const t = tally.get(o.id);
                  return {
                    id: o.id,
                    start: o.startTime.toISOString(),
                    yes: t?.yes ?? 0,
                    ifNeedBe: t?.ifNeedBe ?? 0,
                  };
                })}
              />
            </div>
          )}

          {projection.participantCount > 0 ? (
            <div className="mt-6 border-t border-border/60 pt-4">
              <p className="text-xs font-medium text-muted-foreground">
                {projection.participantCount}{" "}
                {projection.participantCount === 1 ? "person has" : "people have"} responded
                {!projection.showVoters ? " · individual votes are hidden" : ""}
              </p>
              {voterRows.length > 0 ? (
                <div className="mt-3 space-y-1.5">
                  {voterRows.map((row) => (
                    <div key={row.label} className="flex items-center gap-2 text-xs">
                      <span className="w-28 shrink-0 truncate font-medium text-foreground">
                        {row.label}
                      </span>
                      <span className="flex flex-wrap gap-1">
                        {options
                          .filter((o) => row.choices.get(o.id) && row.choices.get(o.id) !== "no")
                          .map((o) => (
                            <span
                              key={o.id}
                              className={
                                row.choices.get(o.id) === "yes"
                                  ? "rounded bg-emerald-500/15 px-1.5 py-0.5 text-emerald-700"
                                  : "rounded bg-amber-500/15 px-1.5 py-0.5 text-amber-700"
                              }
                            >
                              {(optionTimes.get(o.id) ?? new Date()).toLocaleString("en-US", {
                                timeZone: poll.timeZone,
                                month: "short",
                                day: "numeric",
                                hour: "numeric",
                              })}
                              {row.choices.get(o.id) === "if_need_be" ? " (maybe)" : ""}
                            </span>
                          ))}
                      </span>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
      <PublicLegal />
    </main>
  );
}
