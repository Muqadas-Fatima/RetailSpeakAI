"use client";

import { useNavigate } from "@/lib/router-compat";import { useState } from "react";
import { toast } from "sonner";
import { BottomNav } from "@/components/shop/nav";
import { FilterTabs, OrderList } from "@/components/shop/collections";
import { Screen, ScreenHeader } from "@/components/shop/primitives";
import { useCart } from "@/lib/cart";
import { ORDER_TABS, getOrderStatusLabel } from "@/lib/catalog";
import { useOrders } from "@/lib/orders";



function OrdersScreen() {
  const navigate = useNavigate();
  const { replaceWith } = useCart();
  const { orders: allOrders } = useOrders();
  const [tabId, setTabId] = useState<string>(ORDER_TABS[0]?.id ?? "all");
  const activeTab = ORDER_TABS.find((tab) => tab.id === tabId);
  const orders = activeTab?.status
    ? allOrders.filter((order) => order.status === activeTab.status)
    : allOrders;

  return (
    <>
      <Screen>
        <ScreenHeader title="My Orders" backTo="/home" />

        <FilterTabs tabs={ORDER_TABS} activeId={tabId} onChange={(tab) => setTabId(tab.id)} />

        <OrderList
          orders={orders}
          statusLabel={getOrderStatusLabel}
          onViewDetails={(order) => navigate({ to: "/track", search: { order: order.id } })}
          onReorder={(order) => {
            replaceWith(order.productIds);
            toast.success("Previous order added to your cart");
            navigate({ to: "/cart" });
          }}
        />
      </Screen>
      <BottomNav />
    </>
  );
}

export default OrdersScreen;
