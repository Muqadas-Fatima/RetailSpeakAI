"use client";
/**
 * Users & Permissions repository.
 *
 * This is the ONLY place that knows where management users come from. Today it
 * is a local, empty-by-default store that mimics network latency; tomorrow each
 * function body becomes a `fetch` / server function call. No user, role,
 * permission, email, phone or timestamp is hardcoded here.
 */
import seedUsers from "@/data/owner/users.json";
import {
  type Access,
  type PermissionKey,
  type RoleId,
  findRole,
  normalisePermissions,
} from "./permissions";

export type UserStatus = "active" | "invited" | "inactive";

export type ManagedUser = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  roleId: RoleId;
  status: UserStatus;
  permissions: PermissionKey[];
  /** ISO timestamp or null when the user has never signed in. */
  lastActiveAt: string | null;
  avatarUrl?: string;
};

export type CreateUserInput = {
  name: string;
  email: string | null;
  phone: string | null;
  roleId: RoleId;
  permissions: PermissionKey[];
};

const USERS_KEY = "retailai.owner.users";
const PREVIEW_KEY = "retailai.owner.access-preview";

/** Simulated request latency so loading/skeleton states are real. */
const LATENCY = 320;

function delay<T>(value: T, ms = LATENCY): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

/** Mock seed data — replace with `GET /owner/users`. */
const SEED_USERS = seedUsers as unknown as ManagedUser[];

function readUsers(): ManagedUser[] {
  if (typeof window === "undefined") return SEED_USERS;
  try {
    const raw = window.localStorage.getItem(USERS_KEY);
    if (!raw) {
      writeUsers(SEED_USERS);
      return SEED_USERS;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as ManagedUser[]) : SEED_USERS;
  } catch {
    return SEED_USERS;
  }
}

function writeUsers(users: ManagedUser[]) {
  try {
    window.localStorage.setItem(USERS_KEY, JSON.stringify(users));
  } catch {
    /* storage unavailable in this prototype */
  }
}

function createId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `usr_${Math.random().toString(36).slice(2, 10)}`;
}

/* ---------------------------------- Queries -------------------------------- */

export async function listUsers(): Promise<ManagedUser[]> {
  return delay(readUsers());
}

export async function getUser(id: string): Promise<ManagedUser | null> {
  const user = readUsers().find((candidate) => candidate.id === id) ?? null;
  return delay(user);
}

/* --------------------------------- Mutations ------------------------------- */

export async function createUser(input: CreateUserInput): Promise<ManagedUser> {
  const role = findRole(input.roleId);
  if (!role || !role.assignable) {
    throw new Error("This role cannot be assigned from the Add User flow.");
  }
  const contact = (input.email ?? input.phone ?? "").trim().toLowerCase();
  const users = readUsers();
  const duplicate = users.some((user) =>
    [user.email, user.phone].filter(Boolean).some((value) => value?.toLowerCase() === contact),
  );
  if (contact && duplicate) {
    throw new Error("A user with this email or phone already exists.");
  }

  const user: ManagedUser = {
    id: createId(),
    name: input.name.trim(),
    email: input.email?.trim() || null,
    phone: input.phone?.trim() || null,
    roleId: input.roleId,
    status: "invited",
    permissions: normalisePermissions(input.permissions),
    lastActiveAt: null,
  };
  writeUsers([...users, user]);
  return delay(user);
}

export async function updateUserPermissions(
  id: string,
  permissions: PermissionKey[],
): Promise<ManagedUser> {
  const users = readUsers();
  const index = users.findIndex((user) => user.id === id);
  if (index === -1) throw new Error("This user no longer exists.");
  const current = users[index] as ManagedUser;
  const updated: ManagedUser = { ...current, permissions: normalisePermissions(permissions) };
  users[index] = updated;
  writeUsers(users);
  return delay(updated);
}

export async function updateUserStatus(id: string, status: UserStatus): Promise<ManagedUser> {
  const users = readUsers();
  const index = users.findIndex((user) => user.id === id);
  if (index === -1) throw new Error("This user no longer exists.");
  const current = users[index] as ManagedUser;
  const updated: ManagedUser = { ...current, status };
  users[index] = updated;
  writeUsers(users);
  return delay(updated);
}

/* ------------------------------ Session access ----------------------------- */

/**
 * Effective access of the signed-in dashboard user.
 *
 * Replace with the authenticated user endpoint (`GET /me/access`). The optional
 * preview id lets the owner inspect the dashboard exactly as a co-owner or
 * manager sees it — the same code path a real session would take.
 */
export async function fetchCurrentAccess(): Promise<
  Access & { userId: string | null; name: string | null }
> {
  const previewId = readPreviewId();
  if (previewId) {
    const user = readUsers().find((candidate) => candidate.id === previewId);
    if (user) {
      const role = findRole(user.roleId);
      return delay({
        userId: user.id,
        name: user.name,
        roleId: user.roleId,
        fullAccess: role?.fullAccess ?? false,
        permissions: user.status === "active" || user.status === "invited" ? user.permissions : [],
      });
    }
  }
  return delay({
    userId: null,
    name: null,
    roleId: "owner",
    fullAccess: true,
    permissions: [],
  });
}

export function readPreviewId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(PREVIEW_KEY);
  } catch {
    return null;
  }
}

export function writePreviewId(id: string | null) {
  try {
    if (id) window.localStorage.setItem(PREVIEW_KEY, id);
    else window.localStorage.removeItem(PREVIEW_KEY);
  } catch {
    /* storage unavailable in this prototype */
  }
}
