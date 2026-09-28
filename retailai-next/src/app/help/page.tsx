"use client";

import { Link } from "@/lib/router-compat";import { useMemo, useState } from "react";
import {
  ArrowRight,
  ChevronDown,
  CreditCard,
  Headset,
  Home,
  type LucideIcon,
  Mail,
  MessageSquare,
  Phone,
  Rocket,
  Search,
  Ticket,
  User,
  Wrench,
} from "lucide-react";
import { BottomNav } from "@/components/shop/nav";
import { Screen, ScreenHeader } from "@/components/shop/primitives";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import helpData from "@/data/help.json";
import { cn } from "@/lib/utils";



const ICONS: Record<string, LucideIcon> = {
  home: Home,
  ticket: Ticket,
  "message-square": MessageSquare,
  user: User,
  mail: Mail,
  phone: Phone,
};

const TOPIC_ICONS: Record<string, LucideIcon> = {
  "getting-started": Rocket,
  billing: CreditCard,
  technical: Wrench,
};

function SupportNav({ onNavigate }: { onNavigate?: () => void }) {
  const [active, setActive] = useState("home");
  return (
    <nav aria-label={helpData.navTitle} className="flex flex-col gap-2">
      <ul className="space-y-1">
        {helpData.nav.map((item) => {
          const Icon = ICONS[item.icon] ?? Home;
          const content = (
            <>
              <Icon className="h-5 w-5 shrink-0 text-brand-accent" aria-hidden="true" />
              <span className="truncate">{item.label}</span>
            </>
          );
          const classes = cn(
            "flex w-full min-w-0 items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold text-brand-navy-deep transition-colors",
            active === item.id ? "bg-brand-teal/20" : "hover:bg-brand-teal/12",
          );
          return (
            <li key={item.id}>
              {item.to ? (
                <Link to={item.to} onClick={onNavigate} className={classes}>
                  {content}
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setActive(item.id);
                    onNavigate?.();
                  }}
                  className={classes}
                >
                  {content}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function HelpScreen() {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<string | null>(helpData.faqs[0]?.id ?? null);
  const [supportOpen, setSupportOpen] = useState(false);

  const faqs = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return helpData.faqs;
    return helpData.faqs.filter(
      (f) => f.q.toLowerCase().includes(q) || f.a.toLowerCase().includes(q),
    );
  }, [query]);

  return (
    <>
      <Screen>
        <ScreenHeader
          title="Help & Support"
          backTo="/profile"
          right={
            <button
              type="button"
              onClick={() => setSupportOpen(true)}
              aria-label="Open support center"
              className="grid h-9 w-9 place-items-center rounded-full border border-brand-border-subtle bg-white text-brand-accent transition-colors hover:bg-brand-teal/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan"
            >
              <Headset className="h-5 w-5" />
            </button>
          }
        />

        {/* Support Center drawer (left side menu) */}
        <Sheet open={supportOpen} onOpenChange={setSupportOpen}>
          <SheetContent side="left" className="w-[80vw] max-w-xs gap-0 p-0 sm:max-w-xs">
            <SheetHeader className="bg-brand-accent px-5 py-4 text-start">
              <SheetTitle className="text-xs font-bold uppercase tracking-[0.18em] text-brand-on-dark">
                {helpData.navTitle}
              </SheetTitle>
            </SheetHeader>
            <div className="bg-brand-teal/8 flex-1 overflow-y-auto p-3">
              <SupportNav onNavigate={() => setSupportOpen(false)} />
            </div>
          </SheetContent>
        </Sheet>

        <div className="mx-auto w-full max-w-3xl pt-5">
          <div className="min-w-0 space-y-5">
              {/* Search */}
              <div className="relative">
                <Search
                  className="pointer-events-none absolute start-4 top-1/2 h-5 w-5 -translate-y-1/2 text-brand-muted"
                  aria-hidden="true"
                />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={helpData.search.placeholder}
                  aria-label="Search help articles"
                  className="h-13 w-full rounded-2xl border border-brand-border bg-white py-3.5 ps-12 pe-4 text-sm text-brand-navy-deep placeholder:text-brand-muted shadow-[0_10px_24px_-18px_rgba(7,27,51,0.3)] focus:border-brand-teal focus:outline-none focus:ring-2 focus:ring-brand-cyan/40"
                />
              </div>

              {/* Topic cards */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {helpData.topics.map((topic) => {
                  const Icon = TOPIC_ICONS[topic.id] ?? Rocket;
                  return (
                    <button
                      key={topic.id}
                      type="button"
                      onClick={() => setQuery("")}
                      className="group flex min-h-[132px] flex-col items-start gap-3 rounded-2xl border border-brand-teal/25 bg-brand-teal/12 p-4 text-start transition-colors hover:bg-brand-teal/20"
                    >
                      <Icon
                        className="h-8 w-8 text-brand-accent"
                        aria-hidden="true"
                        strokeWidth={1.75}
                      />
                      <span className="flex w-full min-w-0 items-end justify-between gap-2">
                        <span className="text-base font-bold leading-snug text-brand-navy-deep">
                          {topic.title}
                        </span>
                        <ArrowRight
                          className="mb-0.5 h-5 w-5 shrink-0 text-brand-accent transition-transform group-hover:translate-x-1 rtl:-scale-x-100"
                          aria-hidden="true"
                        />
                      </span>
                      <span className="text-xs leading-relaxed text-brand-secondary-text">
                        {topic.body}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* FAQs */}
              <section>
                <h2 className="text-lg font-bold text-brand-navy-deep sm:text-xl">
                  {helpData.faqTitle}
                </h2>
                <div className="mt-3 space-y-2.5">
                  {faqs.map((faq) => {
                    const isOpen = open === faq.id;
                    return (
                      <div
                        key={faq.id}
                        className="overflow-hidden rounded-2xl border border-brand-border-subtle bg-white shadow-[0_10px_24px_-20px_rgba(7,27,51,0.3)]"
                      >
                        <button
                          type="button"
                          aria-expanded={isOpen}
                          onClick={() => setOpen(isOpen ? null : faq.id)}
                          className="flex w-full items-center gap-3 px-4 py-4 text-start"
                        >
                          <span className="min-w-0 flex-1 text-sm font-semibold text-brand-navy-deep sm:text-[15px]">
                            {faq.q}
                          </span>
                          <ChevronDown
                            className={cn(
                              "h-5 w-5 shrink-0 text-brand-secondary-text transition-transform",
                              isOpen && "rotate-180",
                            )}
                            aria-hidden="true"
                          />
                        </button>
                        {isOpen ? (
                          <p className="border-t border-brand-border-subtle px-4 py-3.5 text-xs leading-relaxed text-brand-secondary-text sm:text-sm">
                            {faq.a}
                          </p>
                        ) : null}
                      </div>
                    );
                  })}
                  {faqs.length === 0 ? (
                    <p className="rounded-2xl border border-brand-border-subtle bg-white px-4 py-6 text-center text-sm text-brand-secondary-text">
                      No articles match your search.
                    </p>
                  ) : null}
                </div>
              </section>

              {/* Contact */}
              <section className="rounded-3xl border border-brand-border-subtle bg-brand-surface-2/80 p-5 sm:p-6">
                <h2 className="text-lg font-bold text-brand-navy-deep sm:text-xl">
                  {helpData.contactTitle}
                </h2>
                <p className="mt-1 text-sm text-brand-secondary-text">{helpData.contactSubtitle}</p>
                <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                  {helpData.contacts.map((c) => {
                    const Icon = ICONS[c.icon] ?? Mail;
                    return (
                      <li
                        key={c.id}
                        className="flex min-w-0 items-center gap-3 rounded-2xl border border-brand-border-subtle bg-white px-4 py-3.5"
                      >
                        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-teal/12">
                          <Icon className="h-5 w-5 text-brand-accent" aria-hidden="true" />
                        </span>
                        <span className="min-w-0">
                          <span className="block text-sm font-bold text-brand-navy-deep">
                            {c.label}
                          </span>
                          <span className="block truncate text-xs text-brand-secondary-text">
                            {c.value}
                          </span>
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </section>
            </div>
        </div>
      </Screen>
      <BottomNav />
    </>
  );
}

export default HelpScreen;
