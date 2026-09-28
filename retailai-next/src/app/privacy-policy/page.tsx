"use client";

import {
  Clock,
  Database,
  Download,
  Info,
  KeyRound,
  Lock,
  type LucideIcon,
  Mail,
  Pencil,
  ShieldCheck,
  Trash2,
  Eye,
} from "lucide-react";
import { BottomNav } from "@/components/shop/nav";
import { Screen, ScreenHeader } from "@/components/shop/primitives";
import privacyData from "@/data/privacy.json";
import { cn } from "@/lib/utils";



const PRINCIPLE_ICONS: Record<string, LucideIcon> = {
  lock: Lock,
  database: Database,
  "key-round": KeyRound,
  "shield-check": ShieldCheck,
};

const RIGHT_ICONS: Record<string, LucideIcon> = {
  access: Eye,
  correct: Pencil,
  export: Download,
  delete: Trash2,
};

function Glyph({
  map,
  name,
  className,
}: {
  map: Record<string, LucideIcon>;
  name: string;
  className?: string;
}) {
  const Icon = map[name] ?? Info;
  return <Icon className={className} aria-hidden="true" strokeWidth={1.75} />;
}

function PrivacyPolicyScreen() {
  const { hero, principles, sections, rights, contact } = privacyData;

  return (
    <>
      <Screen>
        <ScreenHeader title="Privacy Policy" backTo="/profile" />

        <div className="mx-auto w-full min-w-0 max-w-3xl overflow-x-hidden pb-8 pt-4 sm:pt-5 lg:max-w-5xl">
          {/* Document masthead — dark navy band, deliberately unlike the About hero */}
          <section className="relative overflow-hidden rounded-3xl bg-brand-navy-deep px-4 py-6 sm:px-8 sm:py-9 lg:px-10 lg:py-12">
            <span
              aria-hidden="true"
              className="absolute -end-10 -top-12 h-40 w-40 rounded-full bg-brand-teal/25 blur-3xl"
            />
            <div className="relative min-w-0">
              <p className="inline-flex max-w-full items-center gap-2 rounded-full border border-white/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-aqua">
                <ShieldCheck className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                {hero.eyebrow}
              </p>
              <h2 className="mt-4 max-w-xl text-[1.4rem] font-bold leading-tight text-brand-on-dark sm:text-3xl lg:text-4xl">
                {hero.title}
              </h2>
              <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/70 sm:text-[15px] lg:text-base">
                {hero.body}
              </p>
              <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-medium text-white/55">
                <span className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  {hero.readTime}
                </span>
                <span aria-hidden="true" className="hidden h-1 w-1 rounded-full bg-white/30 sm:block" />
                <span>{hero.updated}</span>
              </div>
            </div>
          </section>

          {/* Principles — stacked rows on mobile, 2-up cards from tablet */}
          <section className="mt-4 overflow-hidden rounded-2xl border border-brand-border-subtle bg-white divide-y divide-brand-border-subtle sm:mt-5 sm:grid sm:grid-cols-2 sm:divide-y-0 sm:border-0 sm:bg-transparent sm:gap-3">
            {principles.map((item) => (
              <div
                key={item.id}
                className="flex min-h-[3.5rem] items-start gap-3.5 px-4 py-4 sm:rounded-2xl sm:border sm:border-brand-border-subtle sm:bg-white sm:px-5 sm:py-5"
              >
                <span className="bg-brand-teal/10 mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-xl">
                  <Glyph map={PRINCIPLE_ICONS} name={item.icon} className="h-5 w-5 text-brand-accent" />
                </span>
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-brand-navy-deep sm:text-[15px]">{item.title}</h3>
                  <p className="mt-0.5 text-[13px] leading-relaxed text-brand-secondary-text sm:text-sm">
                    {item.body}
                  </p>
                </div>
              </div>
            ))}
          </section>


          {/* Numbered policy clauses — single column on mobile, 2-up from lg */}
          <section className="mt-6 sm:mt-8">
            <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-muted">
              The policy
            </h2>
            <ol className="mt-4 space-y-5 border-s border-brand-border ps-5 sm:ps-6 lg:grid lg:grid-cols-2 lg:gap-x-10 lg:gap-y-7 lg:space-y-0 lg:border-s-0 lg:ps-0">
              {sections.map((section, i) => (
                <li key={section.id} className="relative min-w-0 lg:ps-9">
                  <span className="bg-brand-gradient absolute -start-[1.9rem] top-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-bold text-white lg:start-0 lg:h-7 lg:w-7 lg:text-xs">
                    {i + 1}
                  </span>
                  <h3 className="text-[15px] font-bold text-brand-navy-deep sm:text-base">
                    {section.title}
                  </h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-brand-secondary-text sm:text-[15px]">
                    {section.body}
                  </p>
                  <ul className="mt-2.5 flex flex-wrap gap-1.5">
                    {section.points.map((point) => (
                      <li
                        key={point}
                        className="max-w-full break-words rounded-full border border-brand-border-subtle bg-brand-surface px-2.5 py-1 text-[11px] font-semibold text-brand-accent sm:text-xs"
                      >
                        {point}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ol>
          </section>

          {/* Your controls — 1-up mobile, 2-up tablet, 4-up desktop */}
          <section className="mt-6 rounded-3xl border border-brand-border-subtle bg-brand-surface-2/70 p-4 sm:mt-8 sm:p-6 lg:p-8">
            <h2 className="text-lg font-bold text-brand-navy-deep sm:text-xl">{rights.title}</h2>
            <p className="mt-1.5 text-sm leading-relaxed text-brand-secondary-text sm:text-[15px]">
              {rights.body}
            </p>
            <div className="mt-4 grid gap-2.5 sm:grid-cols-2 sm:gap-3 lg:grid-cols-4">
              {rights.items.map((item) => (
                <div
                  key={item.id}
                  className={cn(
                    "flex min-w-0 items-start gap-3 rounded-2xl border border-brand-border-subtle bg-white px-4 py-4",
                    "lg:flex-col lg:gap-2.5",
                  )}
                >
                  <Glyph
                    map={RIGHT_ICONS}
                    name={item.id}
                    className="mt-0.5 h-5 w-5 shrink-0 text-brand-teal"
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-brand-navy-deep sm:text-[15px]">
                      {item.label}
                    </p>
                    <p className="mt-0.5 text-xs leading-relaxed text-brand-secondary-text sm:text-[13px]">
                      {item.detail}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Contact strip */}
          <section className="mt-4 grid gap-4 rounded-2xl border border-brand-border-subtle bg-white p-4 sm:mt-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:p-6">
            <div className="min-w-0">
              <h2 className="text-[15px] font-bold text-brand-navy-deep sm:text-base">
                {contact.title}
              </h2>
              <p className="mt-1 text-[13px] leading-relaxed text-brand-secondary-text sm:text-sm">
                {contact.body}
              </p>
            </div>
            <a
              href={`mailto:${contact.email}`}
              className="bg-brand-gradient inline-flex min-h-[3rem] w-full shrink-0 items-center justify-center gap-2 rounded-full px-6 text-sm font-bold text-white shadow-brand-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan sm:w-auto"
            >

              <Mail className="h-4 w-4" aria-hidden="true" />
              {contact.cta}
            </a>
          </section>
        </div>
      </Screen>
      <BottomNav />
    </>
  );
}

export default PrivacyPolicyScreen;
