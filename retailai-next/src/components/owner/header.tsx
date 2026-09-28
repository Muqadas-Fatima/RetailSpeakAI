"use client";
import { Menu } from "lucide-react";
import { NotificationCenter } from "@/components/owner/notifications";
import type { OwnerProfile } from "@/lib/owner/types";

export function OwnerHeader({
  title,
  greeting,
  profile,
  onOpenSidebar,
}: {
  title: string;
  greeting: string;
  profile: OwnerProfile;
  onOpenSidebar: () => void;
}) {
  return (
    <header className="sticky top-0 z-30 border-b border-brand-border-subtle bg-brand-surface/90 backdrop-blur-md ">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={onOpenSidebar}
            aria-label="Open navigation"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-brand-border bg-white text-brand-navy-deep transition-colors hover:bg-brand-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan "
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="min-w-0">
            <h1 className="truncate text-base font-black text-brand-navy-deep sm:text-lg">
              {title}
            </h1>
            <p className="truncate text-xs text-brand-secondary-text sm:text-sm">
              {greeting}, {profile.name}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <NotificationCenter />
        </div>
      </div>
    </header>
  );
}
