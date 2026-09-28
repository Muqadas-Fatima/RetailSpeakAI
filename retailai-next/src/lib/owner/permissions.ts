"use client";
/**
 * Permission model for the shared management dashboard (Owner / Co-owner / Manager).
 *
 * Everything here is *configuration*, not business data: modules, the actions
 * that are meaningful for each module, role metadata and the dependency rules
 * between actions. A backend can later return the same shapes verbatim
 * (`GET /me/access`, `GET /permissions/schema`) and no UI needs to change.
 */

/* --------------------------------- Actions -------------------------------- */

export type ActionId =
  "view" | "create" | "edit" | "delete" | "approve" | "reject" | "record-payment";

export type PermissionAction = {
  id: ActionId;
  label: string;
  /** Compact label used by the matrix header on narrow screens. */
  short: string;
};

/** Column order of the permission matrix. Extend freely — the UI is generic. */
export const PERMISSION_ACTIONS: PermissionAction[] = [
  { id: "view", label: "View", short: "View" },
  { id: "create", label: "Create", short: "Create" },
  { id: "edit", label: "Edit", short: "Edit" },
  { id: "delete", label: "Delete", short: "Delete" },
  { id: "approve", label: "Approve", short: "Appr." },
  { id: "reject", label: "Reject", short: "Rej." },
  { id: "record-payment", label: "Record Payment", short: "Payment" },
];

export function actionLabel(id: ActionId): string {
  return PERMISSION_ACTIONS.find((action) => action.id === id)?.label ?? id;
}

/* --------------------------------- Modules -------------------------------- */

export type ModuleId = string;

export type PermissionModule = {
  id: ModuleId;
  label: string;
  description: string;
  /** Only the actions that are meaningful for this module. */
  actions: ActionId[];
};

export const PERMISSION_MODULES: PermissionModule[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    description: "Overview widgets and KPIs",
    actions: ["view"],
  },
  {
    id: "orders",
    label: "Orders",
    description: "Customer orders and fulfilment",
    actions: ["view", "create", "edit", "delete", "approve", "reject"],
  },
  {
    id: "products",
    label: "Products",
    description: "Catalog items and pricing",
    actions: ["view", "create", "edit", "delete"],
  },
  {
    id: "inventory",
    label: "Inventory",
    description: "Stock levels and adjustments",
    actions: ["view", "create", "edit"],
  },
  {
    id: "suppliers",
    label: "Suppliers",
    description: "Supplier directory and terms",
    actions: ["view", "create", "edit", "delete"],
  },
  {
    id: "purchase-orders",
    label: "Purchase Orders",
    description: "Raise, approve and receive POs",
    actions: ["view", "create", "edit", "delete", "approve", "reject"],
  },
  {
    id: "supplier-khata",
    label: "Supplier Khata",
    description: "Supplier ledger and payments",
    actions: ["view", "record-payment"],
  },
  {
    id: "riders",
    label: "Riders",
    description: "Delivery riders and assignments",
    actions: ["view", "create", "edit", "delete"],
  },
  {
    id: "analytics",
    label: "Analytics",
    description: "Sales and performance reports",
    actions: ["view"],
  },
  {
    id: "voice-analytics",
    label: "Voice Analytics",
    description: "Voice ordering insights",
    actions: ["view"],
  },
  {
    id: "ai-forecast",
    label: "AI Forecast",
    description: "Demand prediction and alerts",
    actions: ["view"],
  },
  {
    id: "ai-agent",
    label: "AI Agent",
    description: "Conversational business assistant",
    actions: ["view"],
  },
  {
    id: "imports",
    label: "Data Imports",
    description: "Bulk CSV uploads for catalog and stock",
    actions: ["view", "create"],
  },
  {
    id: "users",
    label: "Users & Permissions",
    description: "Team accounts and access control",
    actions: ["view", "create", "edit", "delete"],
  },
  {
    id: "settings",
    label: "Settings",
    description: "Business profile and preferences",
    actions: ["view", "edit"],
  },
];

export function findModule(id: ModuleId): PermissionModule | undefined {
  return PERMISSION_MODULES.find((module) => module.id === id);
}

export function moduleLabel(id: ModuleId): string {
  return findModule(id)?.label ?? id;
}

/* ------------------------------ Permission keys ---------------------------- */

/** Wire format for a single grant: `"purchase-orders:approve"`. */
export type PermissionKey = string;

export function permissionKey(moduleId: ModuleId, action: ActionId): PermissionKey {
  return `${moduleId}:${action}`;
}

export function parsePermissionKey(key: PermissionKey): { moduleId: ModuleId; action: ActionId } {
  const [moduleId = "", action = "view"] = key.split(":");
  return { moduleId, action: action as ActionId };
}

/* ------------------------------ Dependencies ------------------------------ */

export type PermissionDependency = {
  /** The grant being enabled. */
  key: PermissionKey;
  /** Grants that must also be enabled. */
  requires: PermissionKey[];
};

/**
 * Baseline rule: any action other than `view` on a module requires `view` on
 * that same module (Create PO needs View PO, Record Payment needs View Khata,
 * Edit Products needs View Products, ...). Derived from the module registry so
 * new modules/actions inherit the rule automatically.
 */
export function dependenciesFor(key: PermissionKey): PermissionKey[] {
  const { moduleId, action } = parsePermissionKey(key);
  if (action === "view") return [];
  const module = findModule(moduleId);
  if (!module || !module.actions.includes("view")) return [];
  return [permissionKey(moduleId, "view")];
}

/** Grants that become impossible when `key` is revoked. */
export function dependentsOf(key: PermissionKey): PermissionKey[] {
  const { moduleId, action } = parsePermissionKey(key);
  if (action !== "view") return [];
  const module = findModule(moduleId);
  if (!module) return [];
  return module.actions
    .filter((candidate) => candidate !== "view")
    .map((candidate) => permissionKey(moduleId, candidate));
}

/** Adds a grant plus everything it requires. Returns the normalised set. */
export function grantPermission(current: PermissionKey[], key: PermissionKey): PermissionKey[] {
  const next = new Set(current);
  next.add(key);
  for (const required of dependenciesFor(key)) next.add(required);
  return normalisePermissions([...next]);
}

/** Removes a grant plus everything that depends on it. */
export function revokePermission(current: PermissionKey[], key: PermissionKey): PermissionKey[] {
  const next = new Set(current);
  next.delete(key);
  for (const dependent of dependentsOf(key)) next.delete(dependent);
  return normalisePermissions([...next]);
}

export function togglePermission(
  current: PermissionKey[],
  key: PermissionKey,
  enabled: boolean,
): PermissionKey[] {
  return enabled ? grantPermission(current, key) : revokePermission(current, key);
}

/** Sorts by module/action registry order and drops unknown keys. */
export function normalisePermissions(keys: PermissionKey[]): PermissionKey[] {
  const valid: PermissionKey[] = [];
  for (const module of PERMISSION_MODULES) {
    for (const action of module.actions) {
      const key = permissionKey(module.id, action);
      if (keys.includes(key)) valid.push(key);
    }
  }
  return valid;
}

export function samePermissions(a: PermissionKey[], b: PermissionKey[]): boolean {
  const left = normalisePermissions(a);
  const right = normalisePermissions(b);
  return left.length === right.length && left.every((key, index) => key === right[index]);
}

/* ----------------------------------- Roles -------------------------------- */

export type RoleId = string;

export type ManagementRole = {
  id: RoleId;
  label: string;
  description: string;
  /** Owner has implicit access to everything; never granted through the UI. */
  fullAccess: boolean;
  /** Whether the role can be picked in the Add User flow. */
  assignable: boolean;
};

export const MANAGEMENT_ROLES: ManagementRole[] = [
  {
    id: "owner",
    label: "Owner",
    description: "Full access to every module. Managed by authentication, not this screen.",
    fullAccess: true,
    assignable: false,
  },
  {
    id: "co-owner",
    label: "Co-owner",
    description: "Shares the owner dashboard. Sees only what the owner grants.",
    fullAccess: false,
    assignable: true,
  },
  {
    id: "manager",
    label: "Manager",
    description: "Operational management access, defined entirely by permissions.",
    fullAccess: false,
    assignable: true,
  },
];

export function findRole(id: RoleId): ManagementRole | undefined {
  return MANAGEMENT_ROLES.find((role) => role.id === id);
}

export function roleLabel(id: RoleId): string {
  return findRole(id)?.label ?? id;
}

export const ASSIGNABLE_ROLES = MANAGEMENT_ROLES.filter((role) => role.assignable);

/* ---------------------------------- Access -------------------------------- */

/**
 * Effective access of the authenticated user. Backend authorization stays the
 * source of truth; this only shapes the UI.
 */
export type Access = {
  roleId: RoleId;
  fullAccess: boolean;
  permissions: PermissionKey[];
};

export function can(access: Access | null, moduleId: ModuleId, action: ActionId = "view"): boolean {
  if (!access) return false;
  if (access.fullAccess) return true;
  return access.permissions.includes(permissionKey(moduleId, action));
}

export function canAnyAction(access: Access | null, moduleId: ModuleId): boolean {
  if (!access) return false;
  if (access.fullAccess) return true;
  return access.permissions.some((key) => parsePermissionKey(key).moduleId === moduleId);
}

/** Human-readable summary used by the users table (`3 modules · 8 actions`). */
export function summarisePermissions(
  permissions: PermissionKey[],
  fullAccess = false,
): { modules: number; actions: number; label: string } {
  if (fullAccess) {
    return { modules: PERMISSION_MODULES.length, actions: 0, label: "Full access" };
  }
  const modules = new Set(permissions.map((key) => parsePermissionKey(key).moduleId));
  if (permissions.length === 0) return { modules: 0, actions: 0, label: "No access" };
  return {
    modules: modules.size,
    actions: permissions.length,
    label: `${modules.size} module${modules.size === 1 ? "" : "s"} · ${permissions.length} action${
      permissions.length === 1 ? "" : "s"
    }`,
  };
}

/** Module ids a permission set unlocks, in registry order. */
export function accessibleModules(access: Access | null): ModuleId[] {
  if (!access) return [];
  return PERMISSION_MODULES.filter((module) => can(access, module.id, "view")).map(
    (module) => module.id,
  );
}
