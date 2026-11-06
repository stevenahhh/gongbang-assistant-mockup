import { computed, signal, type ComponentType } from "./signals";

export type ScreenKey = "today" | "inbox" | "booking" | "approvals" | "more" | "opp" | "mkt" | "dlv" | "rpt" | "settings" | "help";

export interface DetailProps {
  path: string[];
}

export interface ScreenDef {
  split?: boolean;
  Master: ComponentType;
  Detail?: ComponentType<DetailProps>;
}

const loaders: Record<ScreenKey, () => Promise<{ screen: ScreenDef }>> = {
  today: () => import("./screens/today"),
  inbox: () => import("./screens/inbox"),
  booking: () => import("./screens/booking"),
  approvals: () => import("./screens/approvals"),
  more: () => import("./screens/more"),
  opp: () => import("./screens/opp"),
  mkt: () => import("./screens/mkt"),
  dlv: () => import("./screens/dlv"),
  rpt: () => import("./screens/rpt"),
  settings: () => import("./screens/settings"),
  help: () => import("./screens/help"),
};

const keys = Object.keys(loaders) as ScreenKey[];

interface Route {
  key: ScreenKey;
  path: string[];
  raw: string;
}

function parse(hash: string): Route {
  const raw = hash.replace(/^#/, "") || "/today";
  const [head, ...path] = raw.split("?")[0]!.split("/").filter(Boolean);
  const key = keys.includes(head as ScreenKey) ? (head as ScreenKey) : "today";
  return { key, path, raw };
}

export const route = signal(parse(location.hash));
export const screens = signal<Partial<Record<ScreenKey, ScreenDef>>>({});
export const visited = signal<ScreenKey[]>([route.value.key]);
export const onboardingOpen = computed(() => route.value.raw.startsWith("/onboarding"));

const pending = new Map<ScreenKey, Promise<void>>();

export function preload(key: ScreenKey) {
  if (screens.value[key]) return Promise.resolve();
  let job = pending.get(key);
  if (!job) {
    job = loaders[key]().then((m) => {
      screens.value = { ...screens.value, [key]: m.screen };
    });
    pending.set(key, job);
  }
  return job;
}

function apply(next: Route) {
  route.value = next;
  if (!visited.value.includes(next.key)) visited.value = [...visited.value, next.key];
  void preload(next.key);
}

let depth = 0;

export function go(to: string, opts: { replace?: boolean } = {}) {
  const next = parse(to);
  if (opts.replace) history.replaceState({ depth }, "", `#${to}`);
  else history.pushState({ depth: ++depth }, "", `#${to}`);
  apply(next);
}

export function back(fallback: string) {
  if (depth > 0) history.back();
  else go(fallback, { replace: true });
}

addEventListener("popstate", () => {
  depth = (history.state as { depth?: number } | null)?.depth ?? 0;
  apply(parse(location.hash));
});

export function preloadAllWhenIdle() {
  const idle = window.requestIdleCallback ?? ((fn: () => void) => setTimeout(fn, 200));
  idle(() => keys.forEach((k, i) => setTimeout(() => void preload(k), i * 16)));
}

export const phoneTabs: ScreenKey[] = ["today", "inbox", "booking", "approvals", "more"];
