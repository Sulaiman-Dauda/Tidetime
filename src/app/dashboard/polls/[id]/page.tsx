import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getPollForOwner } from "@/server/polls";
import { rankOptions, type PollChoice } from "@/lib/polls";
import { env } from "@/lib/env";
import { PollResults } from "./results";

export const metadata = { title: "Poll results" };

export default async function PollResultsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const pollId = Number(id);
  if (!Number.isFinite(pollId)) notFound();

  const data = await getPollForOwner(pollId, user.id);
  if (!data) notFound();

  const optionIds = data.options.map((o) => o.id);
  const ranked = rankOptions(
    optionIds,
    data.votes.map((v) => ({ optionId: v.optionId, choice: v.choice as PollChoice })),
  );
  const tallyById = new Map(ranked.map((t) => [t.optionId, t]));
  const bestId = ranked[0]?.optionId ?? null;

  // Distinct voters for a quick participation stat.
  const voters = new Set(data.votes.map((v) => v.voterEmail));

  return (
    <PollResults
      appUrl={env.appUrl}
      poll={{
        id: data.poll.id,
        token: data.poll.token,
        title: data.poll.title,
        status: data.poll.status,
        timeZone: data.poll.timeZone,
        finalizedOptionId: data.poll.finalizedOptionId,
        finalizedBookingUid: data.poll.finalizedBookingUid,
      }}
      voterCount={voters.size}
      bestOptionId={bestId}
      options={data.options.map((o) => {
        const t = tallyById.get(o.id);
        return {
          id: o.id,
          start: o.startTime.toISOString(),
          end: o.endTime.toISOString(),
          yes: t?.yes ?? 0,
          ifNeedBe: t?.ifNeedBe ?? 0,
          no: t?.no ?? 0,
        };
      })}
    />
  );
}
