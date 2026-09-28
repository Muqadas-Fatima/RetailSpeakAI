"use client";
import { Link, useRouterState } from "@/lib/router-compat";
import { MoreHorizontal } from "lucide-react";
import { OwnerIcon } from "@/components/owner/icons";
import { OWNER_NAV, OWNER_PRIMARY_NAV_IDS } from "@/lib/owner/nav";
import { useAccess } from "@/lib/owner/access";
import { cn } from "@/lib/utils";

/**
 * Mobile-only bottom navigation. Primary destinations come from the nav config
 * so no labels/routes are hardcoded here; everything else lives in the drawer.
 */
export function OwnerBottomNav({ onOpenMore }: { onOpenMore: () => void }) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const { can } = useAccess();

  const items = OWNER_PRIMARY_NAV_IDS.map((id) => OWNER_NAV.find((item) => item.id === id))
    .filter((item): item is (typeof OWNER_NAV)[number] => Boolean(item))
    .filter((item) => can(item.module, "view"));

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-brand-navy-deep pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      <ul className="grid grid-cols-5">
        {items.map((item) => {
          const active =
            item.to === "/owner" ? pathname === "/owner" : pathname.startsWith(item.to);
          return (
            <li key={item.id}>
              <Link
                to={item.to}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex flex-col items-center gap-1 px-1 py-2.5 text-[11px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-cyan",
                  active ? "text-brand-cyan" : "text-white/60",
                )}
              >
                <OwnerIcon name={item.icon} className="h-5 w-5" />
                <span className="max-w-full truncate">{item.label}</span>
              </Link>
            </li>
          );
        })}
        <li>
          <button
            type="button"
            onClick={onOpenMore}
            aria-label="More menus"
            className="flex w-full flex-col items-center gap-1 px-1 py-2.5 text-[11px] font-semibold text-white/60 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-cyan"
          >
            <MoreHorizontal className="h-5 w-5" />
            <span>More</span>
          </button>
        </li>
      </ul>
    </nav>
  );
}
