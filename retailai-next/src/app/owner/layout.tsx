"use client";

import { useNavigate, useRouterState } from "@/lib/router-compat";
import { useEffect, useState, type ReactNode } from "react";
import { OwnerHeader } from "@/components/owner/header";
import { OwnerSidebar } from "@/components/owner/sidebar";
import { OwnerBottomNav } from "@/components/owner/bottom-nav";
import { useGreeting, useOwnerProfile } from "@/lib/owner/hooks";
import { OWNER_NAV } from "@/lib/owner/nav";
import { clearSession } from "@/lib/mock-accounts";
import { OwnerAccessProvider, useAccess } from "@/lib/owner/access";
import { ModuleGuard } from "@/components/owner/module-guard";

export default function OwnerRoute({ children }: { children: ReactNode }) {
  return (
    <OwnerAccessProvider>
      <OwnerLayout>{children}</OwnerLayout>
    </OwnerAccessProvider>
  );
}

function OwnerLayout({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();
  const profile = useOwnerProfile();
  const { previewName } = useAccess();
  const greeting = useGreeting();
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  useEffect(() => setMobileOpen(false), [pathname]);

  const active = [...OWNER_NAV]
    .sort((a, b) => b.to.length - a.to.length)
    .find((item) => pathname === item.to || pathname.startsWith(`${item.to}/`));

  const handleLogout = () => {
    clearSession();
    navigate({ to: "/signin" });
  };

  return (
    <div className="flex min-h-dvh flex-col bg-brand-surface-2 text-brand-navy-deep ">
      <OwnerSidebar
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
        profile={profile}
        onLogout={handleLogout}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <OwnerHeader
          title={active?.label ?? "Dashboard"}
          greeting={greeting}
          profile={previewName ? { ...profile, name: previewName, role: "Preview" } : profile}
          onOpenSidebar={() => setMobileOpen(true)}
        />
        <main className="w-full px-4 pb-24 pt-5 sm:px-5 sm:pt-6 lg:px-6 lg:pb-8 lg:pt-8">
          <ModuleGuard module={active?.module}>{children}</ModuleGuard>
        </main>
      </div>
      <OwnerBottomNav onOpenMore={() => setMobileOpen(true)} />
    </div>
  );
}
