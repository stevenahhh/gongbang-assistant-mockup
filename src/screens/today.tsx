import { useEffect, useRef } from "preact/hooks";
import { Bell, CheckCheck, CreditCard, Inbox, Link2, RefreshCw, Send, Sparkles, Unplug } from "lucide-preact";
import type { ComponentChildren } from "preact";
import { go, type ScreenDef } from "../router";
import {
  bookings,
  classes,
  connections,
  failedTasks,
  lastSync,
  notices,
  openInquiries,
  opportunities,
  refresh,
  refreshing,
  role,
  runningTasks,
  scenario,
  seatsTaken,
  todaySlots,
  unpaidBookings,
  unreadNotices,
  visibleTasks,
  patch,
} from "../store";
import { BarRow, Btn, Empty, IconBtn, LoadError, Mascot, NavLink, Page, Skeleton, Status, openSheet } from "../ui";
import { DAY, dDay, dateLabel, hhmm, relative } from "../lib/time";

function usePullToRefresh(ref: { current: HTMLDivElement | null }, dot: { current: HTMLDivElement | null }) {
  useEffect(() => {
    const el = ref.current!;
    const mark = dot.current!;
    let startY = 0;
    let pulling = false;
    let dy = 0;
    const start = (e: TouchEvent) => {
      pulling = el.scrollTop <= 0;
      startY = e.touches[0]!.clientY;
      dy = 0;
    };
    const move = (e: TouchEvent) => {
      if (!pulling) return;
      dy = Math.max(0, e.touches[0]!.clientY - startY) * 0.5;
      const p = Math.min(dy, 90);
      mark.style.opacity = String(Math.min(p / 50, 1));
      mark.style.transform = `translate3d(0, ${p}px, 0) rotate(${p * 4}deg)`;
    };
    const end = () => {
      if (pulling && dy > 56) refresh();
      pulling = false;
      mark.style.opacity = "0";
      mark.style.transform = "";
    };
    el.addEventListener("touchstart", start, { passive: true });
    el.addEventListener("touchmove", move, { passive: true });
    el.addEventListener("touchend", end, { passive: true });
    el.addEventListener("touchcancel", end, { passive: true });
    return () => {
      el.removeEventListener("touchstart", start);
      el.removeEventListener("touchmove", move);
      el.removeEventListener("touchend", end);
      el.removeEventListener("touchcancel", end);
    };
  }, []);
}

function TodoCard({ to, icon, title, sub, tone }: { to: string; icon: ComponentChildren; title: string; sub?: string; tone?: "alert" }) {
  return (
    <NavLink to={to} class={`card tap row ${tone ?? ""}`} style={{ textDecoration: "none" }}>
      <span class="glyph">{icon}</span>
      <span class="grow">
        <span class="strong num" style={{ display: "block" }}>{title}</span>
        {sub ? <span class="sm muted clamp1">{sub}</span> : null}
      </span>
    </NavLink>
  );
}

function Briefing() {
  const slots = todaySlots();
  const people = slots.reduce((sum, s) => sum + seatsTaken(s.id), 0);
  return (
    <div class="row" style={{ alignItems: "flex-start" }}>
      <Mascot size={44} />
      <p class="grow" style={{ fontSize: "1.0625rem", fontWeight: 600 }}>
        오늘 수업 {slots.length}개, {people}명 와요. 문의 {openInquiries.value.filter((q) => q.status === "답장 초안 있음").length}건에 답장 초안을 만들어 두었어요.
      </p>
    </div>
  );
}

function Running() {
  const rows = runningTasks.value;
  if (!rows.length) return null;
  return (
    <div class="stack">
      {rows.map((t) => {
        const p = t.progress ?? { done: 0, total: 1 };
        return (
          <div key={t.id} class="card stack">
            <span class="strong num">{t.kind} {p.total}건 보내는 중 · {p.done}/{p.total}</span>
            <div class="bar">
              <i style={{ transform: `scaleX(${p.done / p.total})` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Todos() {
  const pending = visibleTasks.value;
  const open = openInquiries.value;
  const oldest = open.length ? Math.min(...open.map((q) => q.messages[0]!.at)) : 0;
  const unpaid = unpaidBookings.value;
  const failed = failedTasks.value;
  const broken = connections.value.filter((c) => c.status === "오류");
  const soon = opportunities.value.filter((o) => o.deadline > Date.now() && o.deadline - Date.now() < 7 * DAY && o.verdict !== "안 맞음");

  if (scenario.value === "empty") return <Empty title="할 일을 다 끝냈어요">새로운 일이 생기면 여기에 모아 둘게요.</Empty>;

  const cards = [
    failed.length > 0 && <TodoCard key="fail" tone="alert" to="/approvals?tab=fail" icon={<Send size={22} />} title={`실패한 발송 ${failed.length}건`} sub={failed[0]!.failReason} />,
    broken[0] && <TodoCard key="conn" tone="alert" to={`/settings/connections/${broken[0].id}`} icon={<Unplug size={22} />} title={`${broken[0].name} 연결 오류`} sub={broken[0].error} />,
    pending.length > 0 && <TodoCard key="apr" to="/approvals" icon={<CheckCheck size={22} />} title={`승인 기다리는 일 ${pending.length}건`} sub={`가장 빠른 실행 ${relative(pending[0]!.runAt)}`} />,
    open.length > 0 && <TodoCard key="inq" to="/inbox" icon={<Inbox size={22} />} title={`답하지 않은 문의 ${open.length}건`} sub={`가장 오래 기다린 손님 ${relative(oldest)}`} />,
    unpaid.length > 0 && <TodoCard key="pay" to="/booking?status=unpaid" icon={<CreditCard size={22} />} title={`예약금 미입금 ${unpaid.length}건`} />,
    role.value === "OWNER" && soon.length > 0 && <TodoCard key="opp" to={`/opp/${soon[0]!.id}`} icon={<Sparkles size={22} />} title={`마감 임박 기회 ${soon.length}건`} sub={`${soon[0]!.title} · ${dDay(soon[0]!.deadline)}`} />,
  ];
  return <div class="stack">{cards}</div>;
}

function TodayClasses() {
  const slots = todaySlots();
  if (scenario.value === "error") return <LoadError what="오늘 수업" onRetry={() => (scenario.value = "normal")} />;
  if (!slots.length || scenario.value === "empty") {
    return (
      <Empty title="오늘은 수업이 없어요" action={<Btn small onClick={() => go("/booking")}>이번 주 예약 보기</Btn>} />
    );
  }
  return (
    <div class="list">
      {slots.map((s) => {
        const c = classes.value.find((x) => x.id === s.classId);
        const past = s.start + (c?.mins ?? 60) * 60_000 < Date.now();
        const unpaid = bookings.value.filter((b) => b.slotId === s.id && b.status === "예약금 대기").length;
        return (
          <NavLink key={s.id} class="rowitem" to={`/booking/slot/${s.id}`} style={{ opacity: past ? "0.55" : "1" }}>
            <span class="num strong" style={{ width: "52px" }}>{hhmm(s.start)}</span>
            <span class="grow">
              <span class="strong clamp1">{c?.name}</span>
              <span class="sm muted num">
                {seatsTaken(s.id)}/{s.cap}명 · 리마인드 보냄{unpaid ? ` · 예약금 대기 ${unpaid}건` : ""}
              </span>
            </span>
          </NavLink>
        );
      })}
    </div>
  );
}

function openNotices() {
  openSheet("알림", (close) => (
    <div class="list">
      {notices.value.map((n) => (
        <button
          key={n.id}
          type="button"
          class="rowitem"
          onClick={() => {
            patch(notices, n.id, { read: true });
            close();
            if (n.href) go(n.href);
          }}
        >
          <span class="grow">
            <span class={n.read ? "muted" : "strong"}>{n.text}</span>
            <span class="cap muted" style={{ display: "block" }}>{relative(n.at)}</span>
          </span>
          {!n.read ? <Status tone="run">새 소식</Status> : null}
        </button>
      ))}
    </div>
  ));
}

function ConnectHint() {
  const off = connections.value.some((c) => c.status === "해제됨" || c.status === "설정 중");
  if (!off) return null;
  return <TodoCard to="/settings/connections" icon={<Link2 size={22} />} title="연결하면 할 수 있는 일" sub="알림톡을 연결하면 리마인드를 보낼 수 있어요" />;
}

function Master() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const dotRef = useRef<HTMLDivElement>(null);
  usePullToRefresh(scrollRef, dotRef);
  const busy = refreshing.value;
  return (
    <div style={{ height: "100%", position: "relative" }}>
      <div class="ptr" ref={dotRef}>
        <RefreshCw size={20} />
      </div>
      <Page
        title="오늘"
        scrollRef={scrollRef}
        right={
          <>
            <IconBtn label={busy ? "새로 고치는 중" : "새로 고침"} onClick={refresh}>
              <RefreshCw size={20} class={busy ? "spin" : undefined} />
            </IconBtn>
            <IconBtn label="알림" class={unreadNotices.value ? "badge-dot" : undefined} onClick={openNotices}>
              <Bell size={20} />
            </IconBtn>
          </>
        }
      >
        <p class="sm muted num" style={{ marginBottom: "var(--s4)" }}>
          {dateLabel(Date.now())} · {hhmm(lastSync.value)} 기준
        </p>
        {busy ? (
          <Skeleton height={76} count={4} />
        ) : (
          <div class="today-grid">
            <div class="stack" style={{ "--gap": "var(--s4)" }}>
              <Briefing />
              <Running />
              <Todos />
              <ConnectHint />
            </div>
            <div>
              <h2 class="section-head">오늘 수업</h2>
              <TodayClasses />
              {role.value !== "STAFF" ? <Week /> : null}
            </div>
          </div>
        )}
      </Page>
    </div>
  );
}

function Week() {
  return (
    <div class="section">
      <h2 class="section-head">이번 주</h2>
      <div class="card stack">
        <BarRow label="확정 인원" value={32} max={48} tail="32명" tone="ok" />
        <BarRow label="문의 답한 비율" value={18} max={23} tail="18/23건" />
      </div>
    </div>
  );
}

export const screen: ScreenDef = { Master };
