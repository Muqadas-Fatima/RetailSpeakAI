"use client";
/**
 * Compatibility shim that lets code written against @tanstack/react-router's
 * API run unchanged on top of Next.js App Router primitives.
 */
import NextLink from "next/link";
import {
  useRouter,
  useParams as useNextParams,
  usePathname,
  useSearchParams,
} from "next/navigation";
import type { ReactNode, AnchorHTMLAttributes } from "react";

type SearchObj = Record<string, string | number | boolean | undefined | null>;
type ParamsObj = Record<string, string | number>;

function applyParams(path: string, params?: ParamsObj) {
  if (!params) return path;
  let out = path;
  for (const [key, value] of Object.entries(params)) {
    out = out.replace(`$${key}`, String(value)).replace(`:${key}`, String(value));
  }
  return out;
}

function applySearch(path: string, search?: SearchObj) {
  if (!search) return path;
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(search)) {
    if (value === undefined || value === null) continue;
    qs.set(key, String(value));
  }
  const qsStr = qs.toString();
  return qsStr ? `${path}?${qsStr}` : path;
}

export function buildHref(to: string, search?: SearchObj, params?: ParamsObj) {
  return applySearch(applyParams(to, params), search);
}

type LinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
  to?: string;
  href?: string;
  search?: SearchObj;
  params?: ParamsObj;
  children?: ReactNode;
  activeProps?: Record<string, unknown>;
  activeOptions?: Record<string, unknown>;
};

export function Link({ to, href, search, params, children, ...rest }: LinkProps) {
  const target = buildHref(to ?? href ?? "#", search, params);
  return (
    <NextLink href={target} {...rest}>
      {children}
    </NextLink>
  );
}

type NavigateOptions = {
  to: string;
  search?: SearchObj;
  params?: ParamsObj;
  replace?: boolean;
};

export function useNavigate() {
  const router = useRouter();
  return (opts: NavigateOptions | string) => {
    if (typeof opts === "string") {
      router.push(opts);
      return;
    }
    const href = buildHref(opts.to, opts.search, opts.params);
    if (opts.replace) router.replace(href);
    else router.push(href);
  };
}

export function useRouterState<T>(opts: {
  select: (state: { location: { pathname: string } }) => T;
}): T {
  const pathname = usePathname();
  return opts.select({ location: { pathname } });
}

export function useSearch(): Record<string, string> {
  const sp = useSearchParams();
  const out: Record<string, string> = {};
  sp.forEach((value, key) => {
    out[key] = value;
  });
  return out;
}

export function useParams(_opts?: { from?: string; strict?: boolean }): Record<string, string> {
  const params = useNextParams();
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(params ?? {})) {
    out[key] = Array.isArray(value) ? (value[0] ?? "") : ((value as string) ?? "");
  }
  return out;
}
