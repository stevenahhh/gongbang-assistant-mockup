import { useEffect, useRef } from "preact/hooks";
import { Bell, RefreshCw } from "lucide-preact";
import { go, type ScreenDef } from "../router";
import { notices, patch, unreadNotices } from "../store";
import { brief, send, showRaw, thread, type Msg } from "../chat";
import { RenderReply } from "../harness/render";
import { IconBtn, Mascot, Page, Status, openSheet } from "../ui";
import { dateLabel, hhmm, relative } from "../lib/time";

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
      if (pulling && dy > 56) void brief();
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

function BotMsg({ m, last }: { m: Msg; last: boolean }) {
  return (
    <div class="bot-row">
      <Mascot size={32} />
      <div class="grow stack" style={{ "--gap": "var(--s3)" }}>
        {m.pending ? (
          <div class="typing" aria-label="비서가 답을 쓰는 중">
            <i />
            <i />
            <i />
          </div>
        ) : m.reply ? (
          <RenderReply reply={m.reply} />
        ) : null}
        {showRaw.value && m.raw ? (
          <details class="raw">
            <summary class="cap">LLM 출력 원본{m.issues?.length ? ` · 걸러낸 것 ${m.issues.length}건` : ""}</summary>
            {m.issues?.length ? <ul class="cap raw-issues">{m.issues.map((x) => <li key={x}>{x}</li>)}</ul> : null}
            <pre>{m.raw}</pre>
          </details>
        ) : null}
        {last && m.reply?.suggest?.length ? (
          <div class="chips suggest" aria-label="이어서 할 말">
            {m.reply.suggest.map((s) => (
              <button key={s} type="button" class="chip" onClick={() => void send(s)}>
                {s}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Master() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const dotRef = useRef<HTMLDivElement>(null);
  usePullToRefresh(scrollRef, dotRef);
  const msgs = thread.value;
  const lastBot = msgs.findLastIndex((m) => m.from === "bot");

  useEffect(() => {
    if (!thread.peek().length) void brief();
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (el && msgs.length > 1) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [msgs.length, msgs[msgs.length - 1]?.pending]);

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
            <IconBtn label="새 브리핑" onClick={() => void brief()}>
              <RefreshCw size={20} />
            </IconBtn>
            <IconBtn label="알림" class={unreadNotices.value ? "badge-dot" : undefined} onClick={openNotices}>
              <Bell size={20} />
            </IconBtn>
          </>
        }
      >
        <div class="wide thread">
          <p class="sm muted num thread-date">{dateLabel(Date.now())}</p>
          {msgs.map((m, i) =>
            m.from === "me" ? (
              <div key={m.id} class="me-row">
                <div class="bubble mine">{m.text}</div>
                <span class="cap muted num">{hhmm(m.at)}</span>
              </div>
            ) : (
              <BotMsg key={m.id} m={m} last={i === lastBot} />
            ),
          )}
        </div>
      </Page>
    </div>
  );
}

export const screen: ScreenDef = { Master };
