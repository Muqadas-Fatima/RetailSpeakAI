"use client";

import {
  BarChart3,
  CalendarDays,
  Check,
  CheckCircle2,
  ClipboardList,
  Info,
  type LucideIcon,
  MapPin,
  Package,
  ShieldCheck,
  ShoppingBag,
  TrendingUp,
  Users,
} from "lucide-react";
import { BottomNav } from "@/components/shop/nav";
import { Screen, ScreenHeader } from "@/components/shop/primitives";
import { resolveImage } from "@/lib/catalog/assets";
import aboutData from "@/data/about.json";
import { cn } from "@/lib/utils";



const ICONS: Record<string, LucideIcon> = {
  "shopping-bag": ShoppingBag,
  "calendar-days": CalendarDays,
  "map-pin": MapPin,
  "shield-check": ShieldCheck,
  "bar-chart-3": BarChart3,
  package: Package,
  "clipboard-list": ClipboardList,
  users: Users,
  "trending-up": TrendingUp,
};

function FeatureIcon({ name, className }: { name: string; className?: string }) {
  const Icon = ICONS[name] ?? Info;
  return <Icon className={className} aria-hidden="true" strokeWidth={1.75} />;
}

/** Decorative voice waveform used on both sides of the hero illustration. */
function WaveBars({ className, mirrored }: { className?: string; mirrored?: boolean }) {
  const heights = [10, 20, 34, 26, 44, 18, 30, 12];
  const bars = mirrored ? [...heights].reverse() : heights;
  return (
    <div className={cn("flex items-center gap-1.5", className)} aria-hidden="true">
      {bars.map((h, i) => (
        <span
          key={i}
          className="w-[3px] rounded-full bg-brand-teal/45"
          style={{ height: `${h}px` }}
        />
      ))}
    </div>
  );
}

/** Phone mockup illustrating a voice-ordering conversation. */
function HeroIllustration() {
  const { chat, orderLabel } = aboutData.hero;
  return (
    <div className="relative mx-auto flex w-full max-w-sm items-center justify-center">
      <div
        aria-hidden="true"
        className="absolute h-56 w-56 rounded-full bg-brand-teal/10 blur-2xl sm:h-72 sm:w-72"
      />
      <WaveBars className="absolute start-0 hidden sm:flex" />
      <WaveBars className="absolute end-0 hidden sm:flex" mirrored />

      <div className="relative w-[190px] rounded-[2rem] border-[5px] border-brand-navy-deep bg-white p-2.5 shadow-brand-card sm:w-[210px]">
        <span
          aria-hidden="true"
          className="mx-auto mb-2 block h-1 w-10 rounded-full bg-brand-border"
        />
        <div className="space-y-2">
          {chat.map((message) => (
            <p
              key={message.id}
              className={cn(
                "max-w-[85%] rounded-xl px-2.5 py-2 text-[10px] font-medium leading-snug",
                message.from === "user"
                  ? "border border-brand-border-subtle bg-white text-brand-navy-deep"
                  : "ms-auto bg-brand-teal/12 text-brand-accent",
              )}
            >
              {message.text}
            </p>
          ))}

          <div className="rounded-xl border border-brand-border-subtle bg-white p-2">
            <p className="text-[9px] font-semibold text-brand-secondary-text">{orderLabel}</p>
            <div className="mt-1.5 flex items-center gap-2">
              <img
                src={resolveImage("food-fries")}
                alt=""
                aria-hidden="true"
                loading="lazy"
                className="h-7 w-7 object-contain"
              />
              <img
                src={resolveImage("item-cola")}
                alt=""
                aria-hidden="true"
                loading="lazy"
                className="h-7 w-7 object-contain"
              />
              <Check className="ms-auto h-4 w-4 text-brand-teal" aria-hidden="true" />
            </div>
          </div>
        </div>

        <div className="mt-3 grid place-items-center pb-1">
          <span className="bg-voice-orb grid h-11 w-11 place-items-center rounded-full text-white shadow-[0_10px_20px_-8px_rgba(0,150,145,0.7)]">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
              <rect x="9" y="3" width="6" height="11" rx="3" stroke="currentColor" strokeWidth="2" />
              <path
                d="M5 12a7 7 0 0 0 14 0M12 19v2"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </span>
        </div>
      </div>
    </div>
  );
}

function AboutScreen() {
  const { hero, features, owners, trusted, version } = aboutData;

  return (
    <>
      <Screen>
        <ScreenHeader title="About RetailAI" backTo="/profile" />

        <div className="mx-auto w-full max-w-5xl space-y-5 pt-5">
          {/* Hero */}
          <section className="rounded-3xl border border-brand-border-subtle bg-white/70 p-5 shadow-[0_10px_24px_-16px_rgba(7,27,51,0.25)] backdrop-blur-sm sm:p-7 lg:p-9">
            <div className="grid items-center gap-7 lg:grid-cols-2 lg:gap-10">
              <div className="min-w-0">
                <p dir="ltr" className="text-4xl font-extrabold tracking-tight sm:text-5xl">
                  <span className="text-brand-navy-deep">Retail</span>
                  <span className="text-brand-teal">AI</span>
                </p>
                <h2 className="mt-3 text-xl font-bold leading-snug text-brand-navy-deep sm:text-2xl">
                  {hero.tagline1}
                  <span className="block text-brand-accent">{hero.tagline2}</span>
                </h2>
                <div className="mt-4 space-y-3">
                  {hero.paragraphs.map((text) => (
                    <p
                      key={text.slice(0, 24)}
                      className="text-sm leading-relaxed text-brand-secondary-text sm:text-[15px]"
                    >
                      {text}
                    </p>
                  ))}
                </div>
              </div>
              <HeroIllustration />
            </div>
          </section>

          {/* Why RetailAI */}
          <section>
            <h2 className="text-lg font-bold text-brand-navy-deep sm:text-xl">
              {features.title.replace("RetailAI?", "Retail")}
              <span className="text-brand-teal">AI</span>?
            </h2>
            <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
              {features.items.map((item) => (
                <article
                  key={item.id}
                  className="flex flex-col items-center rounded-2xl border border-brand-border-subtle bg-white px-4 py-6 text-center shadow-[0_10px_24px_-16px_rgba(7,27,51,0.25)]"
                >
                  <FeatureIcon name={item.icon} className="h-9 w-9 text-brand-teal" />
                  <h3 className="mt-4 text-sm font-bold text-brand-navy-deep">{item.title}</h3>
                  <p className="mt-2 text-xs leading-relaxed text-brand-secondary-text sm:text-[13px]">
                    {item.body}
                  </p>
                </article>
              ))}
            </div>
          </section>

          {/* For Business Owners */}
          <section className="rounded-3xl border border-brand-border-subtle bg-brand-surface-2/80 p-5 sm:p-7">
            <h2 className="text-lg font-bold text-brand-navy-deep sm:text-xl">{owners.title}</h2>
            <p className="mt-1 text-sm text-brand-secondary-text">{owners.subtitle}</p>
            <ul className="mt-5 grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 lg:grid-cols-5">
              {owners.items.map((item) => (
                <li key={item.id} className="flex flex-col items-center gap-2 text-center">
                  <FeatureIcon name={item.icon} className="h-8 w-8 text-brand-teal" />
                  <span className="text-xs font-semibold leading-snug text-brand-navy-deep sm:text-[13px]">
                    {item.label}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          {/* Trusted by */}
          <section className="py-2 text-center">
            <h2 className="text-base font-bold text-brand-navy-deep sm:text-lg">{trusted.title}</h2>
            <ul className="mt-2 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-sm text-brand-secondary-text">
              {trusted.industries.map((name, i) => (
                <li key={name} className="flex items-center gap-3">
                  {i > 0 ? (
                    <span aria-hidden="true" className="h-1 w-1 rounded-full bg-brand-teal/60" />
                  ) : null}
                  {name}
                </li>
              ))}
            </ul>
          </section>

          {/* Version */}
          <section className="grid grid-cols-1 items-center gap-4 rounded-2xl border border-brand-border-subtle bg-white p-4 shadow-[0_10px_24px_-16px_rgba(7,27,51,0.25)] sm:grid-cols-[minmax(0,1fr)_auto] sm:p-5">
            <div className="flex min-w-0 items-start gap-3">
              <Info className="mt-0.5 h-7 w-7 shrink-0 text-brand-teal" aria-hidden="true" />
              <p className="text-xs leading-relaxed text-brand-secondary-text sm:text-sm">
                {version.note}
              </p>
            </div>
            <div className="rounded-xl border border-brand-border-subtle bg-brand-surface px-4 py-3 text-center">
              <p className="text-sm font-bold text-brand-navy-deep">{version.label}</p>
              <p className="mt-1 flex items-center justify-center gap-1.5 text-xs font-semibold text-brand-accent">
                {version.status}
                <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              </p>
            </div>
          </section>
        </div>
      </Screen>
      <BottomNav />
    </>
  );
}

export default AboutScreen;
