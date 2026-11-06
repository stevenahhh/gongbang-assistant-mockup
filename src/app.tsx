import { useEffect, useState } from "preact/hooks";
import type { ComponentType } from "preact";
import { CalendarDays, CheckCheck, Ellipsis, FileBarChart, Inbox, Megaphone, Package, Settings, Sparkles, Sun, CircleHelp } from "lucide-preact";
import { computed } from "./signals";
import { go, onboardingOpen, phoneTabs, preload, route, screens, visited, type ScreenKey } from "./router";
import { openInquiries, role, toasts, unreadNotices, visibleTasks } from "./store";
import { Mascot, MicIcon, Skeleton, SheetHost } from "./ui";
import { openAssistant } from "./assistant";


const meta: Record<ScreenKey, { label: string; Icon: typeof Sun }> = {
  today: { label: "오늘", Icon: Sun },
  inbox: { label: "문의", Icon: Inbox },
  booking: { label: "예약", Icon: CalendarDays },
  approvals: { label: "승인", Icon: CheckCheck },
  more: { label: "더보기", Icon: Ellipsis },
  opp: { label: "기회", Icon: Sparkles },
  mkt: { label: "홍보", Icon: Megaphone },
  dlv: { label: "배송", Icon: Package },
  rpt: { label: "리포트", Icon: FileBarChart },
  settings: { label: "설정", Icon: Settings },
  help: { label: "도움말", Icon: CircleHelp },
};

const hiddenFor: Record<string, ScreenKey[]> = {
  OWNER: [],
  STAFF: [],
  VIEWER: ["inbox", "booking", "approvals", "opp", "mkt", "dlv"],
};

const railKeys = computed(() =>
  (["today", "inbox", "booking", "approvals", "opp", "mkt", "dlv", "rpt", "settings", "help"] as ScreenKey[]).filter((k) => !hiddenFor[role.value]!.includes(k)),
);
const tabKeys = computed(() => phoneTabs.filter((k) => !hiddenFor[role.value]!.includes(k)));

const badge = (k: ScreenKey) => (k === "inbox" ? openInquiries.value.length : k === "approvals" ? visibleTasks.value.length : k === "more" ? unreadNotices.value : 0);

function NavButton({ k, current }: { k: ScreenKey; current: boolean }) {
  const { label, Icon } = meta[k];
  const n = badge(k);
  return (
    <button
      type="button"
      class="tab"
      aria-current={current ? "page" : undefined}
      onPointerDown={() => void preload(k)}
      onClick={() => go(`/${k}`)}
    >
      <Icon size={22} strokeWidth={current ? 2.4 : 1.9} />
      <span>{label}</span>
      {n > 0 ? <span class="count" aria-label={`${n}건`}>{n > 99 ? "99+" : n}</span> : null}
    </button>
  );
}

function Rail() {
  const key = route.value.key;
  return (
    <nav class="rail" aria-label="주 메뉴">
      <div class="logo">
        <Mascot size={38} />
      </div>
      {railKeys.value.map((k) => (
        <NavButton key={k} k={k} current={k === key} />
      ))}
    </nav>
  );
}

const moreKeys = new Set<ScreenKey>(["more", "opp", "mkt", "dlv", "rpt", "settings", "help"]);

function Dock() {
  const { key, path } = route.value;
  const def = screens.value[key];
  const sub = path.length > 0;
  return (
    <>
      <button type="button" class="fab icon-btn solid" data-on={sub ? "" : undefined} aria-label="비서에게 말하기" onClick={() => openAssistant()}>
        <Mascot size={30} />
      </button>
      <div class="dock" data-sub={sub ? "" : undefined} data-split={def?.split ? "" : undefined}>
      <button type="button" class="ask-bar press" onClick={() => openAssistant()} aria-label="비서에게 말하기">
        <Mascot size={32} />
        <span class="label clamp1">비서에게 말하기</span>
        <span class="mic">
          <MicIcon />
        </span>
      </button>
      <nav class="tabbar" aria-label="하단 메뉴" data-phone-tabs>
        {tabKeys.value.map((k) => (
          <NavButton key={k} k={k} current={k === key || (k === "more" && moreKeys.has(key))} />
        ))}
      </nav>
      </div>
    </>
  );
}

function Pane({ k }: { k: ScreenKey }) {
  const { key, path } = route.value;
  const def = screens.value[k];
  const active = k === key;
  if (!def) return active ? <div class="pane" style={{ padding: "16px" }}><Skeleton /></div> : null;
  const { Master, Detail } = def;
  const showDetail = active ? path.length > 0 : false;
  return (
    <section class="pane" data-off={active ? undefined : ""} data-split={def.split ? "" : undefined} data-detail={showDetail ? "" : undefined}>
      <div class="master">
        <Master />
      </div>
      {Detail ? <div class="detail">{active && path.length ? <Detail path={path} /> : def.split ? <PickHint /> : null}</div> : null}
    </section>
  );
}

function PickHint() {
  return (
    <div class="scene-empty">
      <p>왼쪽에서 하나를 고르면 여기에 열려요.</p>
    </div>
  );
}

function Toasts() {
  return (
    <div class="toasts" role="status" aria-live="polite">
      {toasts.value.map((t) => (
        <div key={t.id} class="toast">
          <span>{t.text}</span>
          {t.undo ? (
            <button type="button" onClick={t.undo}>
              되돌리기
            </button>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function OnboardingGate() {
  const [Screen, setScreen] = useState<ComponentType | null>(null);
  useEffect(() => {
    void import("./screens/onboarding").then((m) => setScreen(() => m.default));
  }, []);
  return Screen ? <Screen /> : <div style={{ padding: "24px" }}><Skeleton /></div>;
}

export function App() {
  useEffect(() => {
    void preload(route.value.key);
  }, []);

  if (onboardingOpen.value) {
    return (
      <>
        <OnboardingGate />
        <SheetHost />
        <Toasts />
      </>
    );
  }

  return (
    <div class="app">
      <Rail />
      <main class="stage">
        {visited.value.map((k) => (
          <Pane key={k} k={k} />
        ))}
      </main>
      <Dock />
      <SheetHost />
      <Toasts />
    </div>
  );
}
