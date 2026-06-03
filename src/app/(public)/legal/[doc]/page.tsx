import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import { getCompanySettings } from "@/server/company-settings";

type Doc = "terms" | "privacy";

const TITLES: Record<Doc, string> = {
  terms: "Terms & Conditions",
  privacy: "Privacy Policy",
};

function isDoc(value: string): value is Doc {
  return value === "terms" || value === "privacy";
}

async function resolve(doc: string) {
  if (!isDoc(doc)) return null;
  const { legal, profile } = await getCompanySettings();
  const enabled = doc === "terms" ? legal.termsEnabled : legal.privacyEnabled;
  const content = doc === "terms" ? legal.termsContent : legal.privacyContent;
  if (!enabled || !content.trim()) return null;
  return { title: TITLES[doc], content, company: profile.name };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ doc: string }>;
}): Promise<Metadata> {
  const { doc } = await params;
  const data = await resolve(doc);
  if (!data) return { title: "Not found" };
  return { title: `${data.title} · ${data.company}` };
}

export default async function LegalDocPage({ params }: { params: Promise<{ doc: string }> }) {
  const { doc } = await params;
  const data = await resolve(doc);
  if (!data) notFound();

  return (
    <main className="min-h-screen bg-grid">
      <div className="mx-auto max-w-2xl px-4 py-16 sm:py-24">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>
        <h1 className="mt-6 text-2xl font-semibold tracking-tight">{data.title}</h1>
        <div className="mt-6 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
          {data.content}
        </div>
      </div>
    </main>
  );
}
