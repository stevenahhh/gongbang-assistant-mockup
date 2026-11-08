import { signal } from "@preact/signals";
import { useEffect, useRef, useState } from "preact/hooks";
import { ArrowUp, Mic, X } from "lucide-preact";
import { go, route } from "./router";
import { role } from "./store";
import { parseReply, type Action, type Reply } from "./harness/catalog";
import { IconBtn, Mascot } from "./ui";

export interface Msg {
  id: number;
  from: "me" | "bot";
  at: number;
  text?: string;
  reply?: Reply;
  raw?: string;
  issues?: string[];
  pending?: boolean;
}

export interface AskContext {
  screen: string;
  path: string[];
}

export const thread = signal<Msg[]>([]);
export const pendingContext = signal<AskContext | null>(null);
export const focusTick = signal(0);
export const showRaw = signal(false);

const contextLabel: Record<string, string> = {
  inbox: "문의함",
  booking: "예약",
  approvals: "승인함",
  opp: "기회",
  mkt: "홍보",
  dlv: "배송",
  rpt: "리포트",
  settings: "설정",
  help: "도움말",
  more: "더보기",
};

let seq = 0;
const secret = /(sk-|ntn_|ghp_|xox[bp]-)[\w-]{6,}|\b(token|토큰|비밀번호|api[ _-]?key)\s*[:=]?\s*\S+/gi;
export const maskSecrets = (t: string) => t.replace(secret, "[가린 값]");

function push(m: Omit<Msg, "id" | "at">) {
  const msg: Msg = { ...m, id: ++seq, at: Date.now() };
  thread.value = [...thread.value, msg];
  return msg.id;
}

function settle(id: number, raw: string) {
  const { reply, issues } = parseReply(raw);
  thread.value = thread.value.map((m) => (m.id === id ? { ...m, pending: false, reply, raw, issues } : m));
}

export async function brief() {
  const id = push({ from: "bot", pending: true });
  const { briefing } = await import("./harness/mock-llm");
  settle(id, briefing());
}

export async function send(raw: string) {
  const text = maskSecrets(raw.trim()).slice(0, 2000);
  if (!text) return;
  const context = pendingContext.value ?? undefined;
  pendingContext.value = null;
  push({ from: "me", text });
  const id = push({ from: "bot", pending: true });
  const { respond } = await import("./harness/mock-llm");
  settle(id, await respond({ text, context, role: role.value }));
}

export function askFrom(ctx?: AskContext) {
  pendingContext.value = ctx && ctx.screen !== "today" ? ctx : null;
  if (route.value.key !== "today" || route.value.path.length) go("/today");
  focusTick.value++;
}

export function runAction(a: Action) {
  if (a.type === "go") go(a.to);
  else if (a.type === "ask") void send(a.text);
  else void import("./screens/booking-form").then((m) => m.openBookingForm({ slotId: a.slotId, name: a.name, phone: a.phone, party: a.party }));
}

const examples = ["내일 2시 머그 2명 김민지 예약 잡아 줘", "승인할 일 보여 줘"];

export function Composer() {
  const [text, setText] = useState("");
  const [listening, setListening] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const tick = focusTick.value;
  useEffect(() => {
    if (tick) input.current?.focus();
  }, [tick]);
  const ctx = pendingContext.value;
  return (
    <form
      class="ask-bar composer"
      onSubmit={(e) => {
        e.preventDefault();
        void send(text);
        setText("");
      }}
    >
      <Mascot size={30} />
      <div class="grow composer-field">
        {ctx ? (
          <span class="ctx-chip cap">
            {contextLabel[ctx.screen] ?? ctx.screen}에서 이어서
            <button type="button" class="ctx-x" aria-label="맥락 지우기" onClick={() => (pendingContext.value = null)}>
              <X size={14} />
            </button>
          </span>
        ) : null}
        <input
          ref={input}
          class="composer-input"
          aria-label="비서에게 말하기"
          placeholder="비서에게 말하기"
          enterKeyHint="send"
          autoComplete="off"
          value={text}
          onInput={(e) => setText(e.currentTarget.value)}
        />
      </div>
      {text.trim() ? (
        <IconBtn label="보내기" solid type="submit">
          <ArrowUp size={20} />
        </IconBtn>
      ) : (
        <IconBtn
          label={listening ? "듣는 중" : "말로 하기"}
          solid
          onClick={() => {
            setListening(true);
            setTimeout(() => {
              setListening(false);
              void send(examples[0]!);
            }, 700);
          }}
        >
          <Mic size={20} class={listening ? "spin" : undefined} />
        </IconBtn>
      )}
    </form>
  );
}
