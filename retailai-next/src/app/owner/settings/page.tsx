"use client";

import { useEffect, useMemo, useState } from "react";
import { ConfirmDialog } from "@/components/owner/confirm-dialog";
import { Panel, PanelBody, PanelHeader, SkeletonBlock } from "@/components/owner/primitives";
import { SectionError } from "@/components/owner/states";
import {
  SelectSetting,
  SettingCard,
  TextAreaSetting,
  TextSetting,
  ToggleSetting,
} from "@/components/owner/settings-cards";
import {
  BUSINESS_TYPE_OPTIONS,
  CURRENCY_OPTIONS,
  type InventorySettings,
  type NotificationSettings,
  type StoreInformation,
  type StoreSettings,
} from "@/lib/owner/settings-repo";
import { useSaveStoreSettings, useStoreSettings } from "@/lib/owner/settings-hooks";
import { ownerToast, ownerToastMessages } from "@/lib/owner/toast";



function StoreSettingsPage() {
  const { data, isLoading, error, refetch } = useStoreSettings();
  const { save, isSaving } = useSaveStoreSettings();

  if (isLoading) return <SettingsSkeleton />;
  if (error) {
    return (
      <Panel>
        <PanelHeader
          title="Store Settings"
          description="Store profile, inventory and notifications."
        />
        <PanelBody>
          <SectionError message={error} onRetry={refetch} />
        </PanelBody>
      </Panel>
    );
  }
  if (!data) return null;

  return (
    <SettingsSections settings={data} isSaving={isSaving} onPersist={save} onSaved={refetch} />
  );
}

type PersistResult = { success: true } | { success: false; error: string };

function SettingsSections({
  settings,
  isSaving,
  onPersist,
  onSaved,
}: {
  settings: StoreSettings;
  isSaving: boolean;
  onPersist: (next: StoreSettings) => Promise<PersistResult>;
  onSaved: () => void;
}) {
  const [store, setStore] = useState<StoreInformation>(settings.store);
  const [inventory, setInventory] = useState<InventorySettings>(settings.inventory);
  const [notifications, setNotifications] = useState<NotificationSettings>(settings.notifications);
  const [pending, setPending] = useState<
    null | "store" | "inventory" | "notifications"
  >(null);

  useEffect(() => {
    setStore(settings.store);
    setInventory(settings.inventory);
    setNotifications(settings.notifications);
  }, [settings]);

  const dirty = useMemo(
    () => ({
      store: JSON.stringify(store) !== JSON.stringify(settings.store),
      inventory: JSON.stringify(inventory) !== JSON.stringify(settings.inventory),
      notifications: JSON.stringify(notifications) !== JSON.stringify(settings.notifications),
    }),
    [store, inventory, notifications, settings],
  );

  const storeErrors = validateStore(store);
  const inventoryErrors = validateInventory(inventory);

  const commit = async (label: string) => {
    const result = await onPersist({ ...settings, store, inventory, notifications });
    setPending(null);
    if (result.success) {
      ownerToast.success(ownerToastMessages.settingsSaved(label), {
        description: "Changes will sync once the settings service is connected.",
      });
      onSaved();
    } else {
      ownerToast.error("Could not save settings", { description: result.error });
    }
  };

  const requestSave = (section: NonNullable<typeof pending>, errors: Record<string, string>) => {
    if (Object.keys(errors).length > 0) {
      ownerToast.warning("Fix the highlighted fields before saving");
      return;
    }
    setPending(section);
  };

  return (
    <div className="space-y-4 sm:space-y-5">
      <header className="min-w-0">
        <h1 className="text-lg font-black text-brand-navy-deep sm:text-xl">Store Settings</h1>
        <p className="mt-0.5 text-sm text-brand-secondary-text ">
          Configure your store profile, inventory thresholds and alert preferences.
        </p>
      </header>

      <div className="grid gap-4 sm:gap-5 xl:grid-cols-2">
        <SettingCard
          title="Store Information"
          description="Business identity shown across the platform."
          dirty={dirty.store}
          saving={isSaving && pending === "store"}
          onSave={() => requestSave("store", storeErrors)}
          onReset={() => setStore(settings.store)}
        >
          <TextSetting
            id="store-name"
            label="Store name"
            value={store.storeName}
            onChange={(value) => setStore({ ...store, storeName: value })}
            placeholder="Enter store name"
            error={storeErrors["storeName"]}
          />
          <SelectSetting
            id="store-type"
            label="Business type"
            value={store.businessType}
            options={BUSINESS_TYPE_OPTIONS.map((type) => ({ value: type, label: type }))}
            onChange={(value) => setStore({ ...store, businessType: value })}
            hint="Determines the default catalog structure."
          />
          <TextSetting
            id="store-phone"
            label="Contact phone"
            type="tel"
            inputMode="tel"
            value={store.contactPhone}
            onChange={(value) => setStore({ ...store, contactPhone: value })}
            placeholder="Enter contact number"
            error={storeErrors["contactPhone"]}
          />
          <TextSetting
            id="store-email"
            label="Contact email"
            type="email"
            inputMode="email"
            value={store.contactEmail}
            onChange={(value) => setStore({ ...store, contactEmail: value })}
            placeholder="Enter contact email"
            error={storeErrors["contactEmail"]}
          />
          <TextAreaSetting
            id="store-address"
            label="Store address"
            value={store.address}
            onChange={(value) => setStore({ ...store, address: value })}
            placeholder="Enter full address"
          />
          <SelectSetting
            id="store-currency"
            label="Currency"
            value={store.currencyCode}
            options={CURRENCY_OPTIONS.map((code) => ({ value: code, label: code }))}
            onChange={(value) => setStore({ ...store, currencyCode: value })}
          />
          <TextSetting
            id="store-timezone"
            label="Time zone"
            value={store.timeZone}
            onChange={(value) => setStore({ ...store, timeZone: value })}
            placeholder="e.g. Asia/Karachi"
          />
        </SettingCard>

        <SettingCard
          title="Inventory Settings"
          description="Low-stock thresholds and stock behaviour."
          dirty={dirty.inventory}
          saving={isSaving && pending === "inventory"}
          onSave={() => requestSave("inventory", inventoryErrors)}
          onReset={() => setInventory(settings.inventory)}
        >
          <TextSetting
            id="low-stock"
            label="Low stock threshold"
            type="number"
            inputMode="numeric"
            value={inventory.lowStockThreshold}
            onChange={(value) => setInventory({ ...inventory, lowStockThreshold: value })}
            hint="Units at or below this level are flagged as low."
            placeholder="Enter units"
            error={inventoryErrors["lowStockThreshold"]}
          />
          <TextSetting
            id="critical-stock"
            label="Critical stock threshold"
            type="number"
            inputMode="numeric"
            value={inventory.criticalStockThreshold}
            onChange={(value) => setInventory({ ...inventory, criticalStockThreshold: value })}
            hint="Must be lower than the low-stock threshold."
            placeholder="Enter units"
            error={inventoryErrors["criticalStockThreshold"]}
          />
          <TextSetting
            id="reorder-qty"
            label="Default reorder quantity"
            type="number"
            inputMode="numeric"
            value={inventory.defaultReorderQuantity}
            onChange={(value) => setInventory({ ...inventory, defaultReorderQuantity: value })}
            placeholder="Enter units"
            error={inventoryErrors["defaultReorderQuantity"]}
          />
          <div className="space-y-2.5">
            <ToggleSetting
              label="Low stock alerts"
              description="Surface low-stock items on the dashboard and in notifications."
              checked={inventory.lowStockAlertsEnabled}
              onChange={(checked) => setInventory({ ...inventory, lowStockAlertsEnabled: checked })}
            />
            <ToggleSetting
              label="Allow overselling"
              description="Let orders be placed when stock reaches zero."
              checked={inventory.allowNegativeStock}
              onChange={(checked) => setInventory({ ...inventory, allowNegativeStock: checked })}
            />
          </div>
        </SettingCard>

        <SettingCard
          title="Notification Settings"
          description="Choose what you get alerted about and where."
          dirty={dirty.notifications}
          saving={isSaving && pending === "notifications"}
          onSave={() => requestSave("notifications", {})}
          onReset={() => setNotifications(settings.notifications)}
        >
          <div className="space-y-2.5">
            <ToggleSetting
              label="Low stock alerts"
              checked={notifications.lowStockAlerts}
              onChange={(checked) =>
                setNotifications({ ...notifications, lowStockAlerts: checked })
              }
            />
            <ToggleSetting
              label="Purchase order updates"
              checked={notifications.purchaseOrderUpdates}
              onChange={(checked) =>
                setNotifications({ ...notifications, purchaseOrderUpdates: checked })
              }
            />
            <ToggleSetting
              label="Supplier payment reminders"
              checked={notifications.supplierPaymentReminders}
              onChange={(checked) =>
                setNotifications({ ...notifications, supplierPaymentReminders: checked })
              }
            />
            <ToggleSetting
              label="AI insights and forecasts"
              checked={notifications.aiInsights}
              onChange={(checked) => setNotifications({ ...notifications, aiInsights: checked })}
            />
          </div>
          <div className="space-y-2.5 border-t border-brand-border-subtle pt-4 ">
            <ToggleSetting
              label="Email channel"
              checked={notifications.emailChannel}
              onChange={(checked) => setNotifications({ ...notifications, emailChannel: checked })}
            />
            <ToggleSetting
              label="Push channel"
              checked={notifications.pushChannel}
              onChange={(checked) => setNotifications({ ...notifications, pushChannel: checked })}
            />
          </div>
        </SettingCard>

      </div>

      <ConfirmDialog
        open={pending !== null}
        title="Save settings?"
        message="These preferences will be applied to your store once the settings service is connected."
        confirmLabel="Save changes"
        loading={isSaving}
        onCancel={() => setPending(null)}
        onConfirm={() => {
          if (!pending) return;
          void commit(SECTION_LABELS[pending]);
        }}
      />
    </div>
  );
}

const SECTION_LABELS: Record<"store" | "inventory" | "notifications", string> = {
  store: "Store information",
  inventory: "Inventory settings",
  notifications: "Notification settings",
};

/** Presentation-level validation only (formatting, not business rules). */
function validateStore(store: StoreInformation): Record<string, string> {
  const errors: Record<string, string> = {};
  if (store.storeName.trim().length > 0 && store.storeName.trim().length < 2) {
    errors["storeName"] = "Enter at least 2 characters.";
  }
  if (
    store.contactEmail.trim() &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(store.contactEmail.trim())
  ) {
    errors["contactEmail"] = "Enter a valid email address.";
  }
  if (store.contactPhone.trim() && !/^[+0-9()\s-]{7,20}$/.test(store.contactPhone.trim())) {
    errors["contactPhone"] = "Enter a valid phone number.";
  }
  return errors;
}

function validateInventory(inventory: InventorySettings): Record<string, string> {
  const errors: Record<string, string> = {};
  const asNumber = (value: string) => (value.trim() === "" ? null : Number(value));
  const low = asNumber(inventory.lowStockThreshold);
  const critical = asNumber(inventory.criticalStockThreshold);
  const reorder = asNumber(inventory.defaultReorderQuantity);

  for (const [key, value] of [
    ["lowStockThreshold", low],
    ["criticalStockThreshold", critical],
    ["defaultReorderQuantity", reorder],
  ] as const) {
    if (value !== null && (!Number.isFinite(value) || value < 0)) {
      errors[key] = "Enter a number of 0 or more.";
    }
  }
  if (
    low !== null &&
    critical !== null &&
    Number.isFinite(low) &&
    Number.isFinite(critical) &&
    critical > low
  ) {
    errors["criticalStockThreshold"] = "Must be lower than the low-stock threshold.";
  }
  return errors;
}

function SettingsSkeleton() {
  return (
    <div className="space-y-4 sm:space-y-5">
      <SkeletonBlock className="h-6 w-48" />
      <div className="grid gap-4 sm:gap-5 xl:grid-cols-2">
        {Array.from({ length: 3 }).map((_, index) => (
          <Panel key={index}>
            <PanelBody className="space-y-3">
              <SkeletonBlock className="h-4 w-1/3" />
              {Array.from({ length: 4 }).map((__, row) => (
                <SkeletonBlock key={row} className="h-10 w-full" />
              ))}
            </PanelBody>
          </Panel>
        ))}
      </div>
    </div>
  );
}

export default StoreSettingsPage;
