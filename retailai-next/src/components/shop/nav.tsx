"use client";
import { Link, useRouterState } from "@/lib/router-compat";
import { Home, ClipboardList, Mic, Truck, User } from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type NavItem = { to: string; labelKey: string; icon: typeof Home };

const NAV_ITEMS: NavItem[] = [
  { to: "/home", labelKey: "nav.home", icon: Home },
  { to: "/orders", labelKey: "nav.orders", icon: ClipboardList },
  { to: "/track", labelKey: "nav.track", icon: Truck },
  { to: "/profile", labelKey: "nav.profile", icon: User },
];

/**
 * Shared bottom navigation with the floating Voice Orb button in the middle.
 * Reused by every customer screen so navigation stays identical everywhere.
 */
export function BottomNav() {
  const { t } = useLanguage();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const left = NAV_ITEMS.slice(0, 2);
  const right = NAV_ITEMS.slice(2);

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-brand-border-subtle bg-white/90 backdrop-blur-md ">
      <div className="flex w-full items-end justify-between px-6 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 lg:px-10">
        {left.map((item) => (
          <NavLink key={item.to} item={item} active={pathname === item.to} />
        ))}

        <Link
          to="/voice"
          aria-label={t("nav.voice")}
          className="bg-voice-orb -mt-7 grid h-14 w-14 shrink-0 place-items-center rounded-full text-white shadow-[0_16px_30px_-10px_rgba(0,150,145,0.7)] transition-transform hover:scale-105 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan focus-visible:ring-offset-2 lg:h-16 lg:w-16"
        >
          <Mic className="h-6 w-6 lg:h-7 lg:w-7" />
        </Link>

        {right.map((item) => (
          <NavLink key={item.to} item={item} active={pathname === item.to} />
        ))}
      </div>
    </nav>
  );
}

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  const { t } = useLanguage();
  const Icon = item.icon;
  return (
    <Link
      to={item.to}
      className={cn(
        "flex min-w-14 flex-col items-center gap-1 rounded-xl py-1 text-[10px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan lg:text-xs",
        active ? "text-brand-accent" : "text-brand-secondary-text hover:text-brand-accent ",
      )}
    >
      <Icon className="h-5 w-5 lg:h-6 lg:w-6" />
      {t(item.labelKey)}
    </Link>
  );
}
