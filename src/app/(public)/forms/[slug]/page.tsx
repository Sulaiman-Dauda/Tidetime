import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getPublicRoutingForm } from "@/server/routing-forms";
import { CompanyBrandHeader } from "../../_components/company-brand-header";
import { PublicLegal } from "../../_components/public-legal";
import { PublicRoutingForm } from "./routing-form";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const form = await getPublicRoutingForm(slug);
  if (!form) return { title: "Not found" };
  return { title: form.name, description: form.description ?? `Fill out ${form.name}.` };
}

export default async function PublicRoutingFormPage({ params }: Props) {
  const { slug } = await params;
  const form = await getPublicRoutingForm(slug);
  if (!form) notFound();

  return (
    <main className="min-h-screen bg-grid">
      <CompanyBrandHeader />
      <div className="mx-auto max-w-lg px-4 py-12">
        <div className="rounded-2xl border border-border/60 bg-card p-6 shadow-sm">
          <h1 className="text-xl font-semibold tracking-tight">{form.name}</h1>
          {form.description ? (
            <p className="mt-1.5 text-sm text-muted-foreground">{form.description}</p>
          ) : null}
          <div className="mt-6">
            <PublicRoutingForm slug={form.slug} fields={form.fields} />
          </div>
        </div>
      </div>
      <PublicLegal />
    </main>
  );
}
