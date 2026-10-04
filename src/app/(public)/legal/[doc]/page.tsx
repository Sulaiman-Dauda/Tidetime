import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import { getCompanySettings } from "@/server/company-settings";
import { LegalContent } from "../../_components/legal-content";
import { CompanyBrandHeader } from "../../_components/company-brand-header";
import { PublicLegal } from "../../_components/public-legal";

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
    <main className="flex min-h-screen flex-col bg-canvas">
      <CompanyBrandHeader />
      <div className="mx-auto w-full max-w-2xl flex-1 px-4 py-8 sm:py-14">
        <article className="rounded-2xl bg-card px-5 py-8 text-card-foreground shadow-popover sm:px-12 sm:py-12">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" aria-hidden />
            Back
          </Link>
          <h1 className="mt-6 border-b pb-6 text-2xl font-semibold tracking-tight">{data.title}</h1>
          <div className="pt-6">
            <LegalContent content={data.content} />
          </div>
        </article>
      </div>
      <PublicLegal />
    </main>
  );
}
