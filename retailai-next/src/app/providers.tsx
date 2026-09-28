"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { Toaster } from "@/components/ui/sonner";
import { LanguageProvider } from "@/lib/i18n";
import { CartProvider } from "@/lib/cart";
import { OrdersProvider } from "@/lib/orders";
import { ScheduledOrdersProvider } from "@/lib/scheduled-orders";
import { CustomerProfileProvider } from "@/lib/customer-profile";
import { SavedAddressesProvider } from "@/lib/saved-addresses";

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <CustomerProfileProvider>
          <SavedAddressesProvider>
            <CartProvider>
              <OrdersProvider>
                <ScheduledOrdersProvider>
                  {children}
                  <Toaster />
                </ScheduledOrdersProvider>
              </OrdersProvider>
            </CartProvider>
          </SavedAddressesProvider>
        </CustomerProfileProvider>
      </LanguageProvider>
    </QueryClientProvider>
  );
}
