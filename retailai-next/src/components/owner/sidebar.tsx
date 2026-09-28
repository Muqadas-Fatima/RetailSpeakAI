"use client";
import { Link, useRouterState } from "@/lib/router-compat";
import { LogOut, Settings, User, X } from "lucide-react";
import { useState } from "react";
import { RetailAILogo } from "@/components/brand/RetailAILogo";
import { OwnerIcon } from "@/components/owner/icons";
import { Avatar } from "@/components/owner/primitives";
import { OWNER_NAV } from "@/lib/owner/nav";
import { useAccess } from "@/lib/owner/access";
import type { OwnerProfile } from "@/lib/owner/types";
import { cn } from "@/lib/utils";

type SidebarProps = {
  profile: OwnerProfile;
  /** Drawer state (all breakpoints). */
  mobileOpen: boolean;
  onCloseMobile: () => void;
  onLogout: () => void;
};

export function OwnerSidebar(props: SidebarProps) {
  const { mobileOpen, onCloseMobile } = props;

  return (
    <>
      {/* Drawer overlay */}
      <div
        role="presentation"
        onClick={onCloseMobile}
        className={cn(
          "fixed inset-0 z-40 bg-brand-navy-deep/50 backdrop-blur-sm transition-opacity",
          mobileOpen ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      />

      {/* Slide-in drawer, available at every breakpoint */}
      <aside
        aria-label="Owner navigation"
        aria-hidden={!mobileOpen}
        className={cn(
          "fixed inset-y-0 start-0 z-50 flex w-[268px] max-w-[86vw] flex-col bg-brand-navy-deep transition-transform duration-300 lg:w-[288px]",
          mobileOpen ? "translate-x-0" : "-translate-x-full rtl:translate-x-full",
        )}
      >
        <div className="flex items-center justify-between px-4 py-4">
          <RetailAILogo className="h-9 w-auto text-[22px] text-white [--brand-ink:#ffffff]" />
          <button
            type="button"
            onClick={onCloseMobile}
            aria-label="Close navigation"
            className="rounded-lg p-1.5 text-white/70 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <SidebarBody {...props} />
      </aside>
    </>
  );
}

function SidebarBody({ profile, onCloseMobile, onLogout }: SidebarProps) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const [menuOpen, setMenuOpen] = useState(false);
  const { can, isLoading } = useAccess();
  // Navigation renders only modules the authenticated user may view.
  const items = OWNER_NAV.filter((item) => can(item.module, "view"));

  return (
    <>
      <nav className="scroll-touch flex-1 space-y-1 overflow-y-auto px-2.5 pb-4">
        {isLoading
          ? Array.from({ length: 6 }).map((_, index) => (
              <span
                key={index}
                aria-hidden="true"
                className="block h-10 animate-pulse rounded-xl bg-white/10"
              />
            ))
          : null}
        {items.map((item) => {
          const active =
            item.to === "/owner" ? pathname === "/owner" : pathname.startsWith(item.to);
          return (
            <Link
              key={item.id}
              to={item.to}
              onClick={onCloseMobile}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan",
                active
                  ? "bg-white/10 text-white"
                  : "text-white/65 hover:bg-white/5 hover:text-white",
              )}
            >
              <span className="relative flex shrink-0 items-center">
                {active ? (
                  <span className="bg-brand-gradient absolute -start-3 h-5 w-1 rounded-full" />
                ) : null}
                <OwnerIcon
                  name={item.icon}
                  className={cn("h-5 w-5", active ? "text-brand-cyan" : "")}
                />
              </span>
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-white/10 p-2.5">
        <button
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          aria-expanded={menuOpen}
          className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-start transition-colors hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan"
        >
          <Avatar name={profile.name} src={profile.avatarUrl} className="h-9 w-9" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-bold text-white">{profile.name}</span>
            <span className="block truncate text-xs text-white/55">{profile.role}</span>
          </span>
        </button>

        {menuOpen ? (
          <div className="mt-1.5 space-y-0.5 rounded-xl bg-white/5 p-1.5">
            <ProfileMenuLink
              to="/owner/profile"
              hash="profile"
              icon={<User className="h-4 w-4" />}
              label="Profile"
              onClick={onCloseMobile}
            />
            <ProfileMenuLink
              to="/owner/profile"
              hash="account-settings"
              icon={<Settings className="h-4 w-4" />}
              label="Account Settings"
              onClick={onCloseMobile}
            />
            <button
              type="button"
              onClick={onLogout}
              className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-semibold text-white/70 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan"
            >
              <LogOut className="h-4 w-4" />
              Logout
            </button>
          </div>
        ) : null}
      </div>
    </>
  );
}

function ProfileMenuLink({
  to,
  icon,
  label,
  onClick,
  hash,
}: {
  to: string;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  hash?: string;
}) {
  return (
    <Link
      to={to}
      {...(hash ? { hash } : {})}
      onClick={onClick}
      className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-semibold text-white/70 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan"
    >
      {icon}
      {label}
    </Link>
  );
}
