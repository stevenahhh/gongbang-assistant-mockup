import type { ScreenKey } from "../router";

export type Tone = "run" | "ok" | "warn" | "err";

export type Action =
  | { type: "go"; to: string }
  | { type: "ask"; text: string }
  | { type: "open_booking"; slotId?: string; name?: string; phone?: string; party?: number };

export type Block =
  | { ui: "text"; body: string }
  | { ui: "summary"; headline: string; stats: { label: string; value: string; tone?: Tone }[] }
  | { ui: "todo_list"; title?: string; items: { title: string; sub?: string; tone?: Tone; action: Action }[] }
  | { ui: "schedule"; title: string; rows: { time: string; title: string; meta?: string; dim?: boolean; action?: Action }[]; empty?: string }
  | { ui: "approval"; taskId: string }
  | { ui: "progress"; taskId: string }
  | { ui: "kv"; title: string; rows: { label: string; value: string }[]; total?: { label: string; value: string } }
  | { ui: "bars"; title: string; rows: { label: string; value: number; max: number; tail?: string }[] }
  | { ui: "booking_draft"; slotId?: string; name?: string; phone?: string; party?: number; note?: string }
  | { ui: "notice"; tone: "info" | "warn" | "refuse"; title: string; body?: string; action?: { label: string; action: Action } }
  | { ui: "choices"; question?: string; options: { label: string; action: Action }[] };

export type BlockUi = Block["ui"];

export interface Reply {
  say: string;
  blocks: Block[];
  suggest?: string[];
}

export interface CatalogEntry {
  ui: BlockUi;
  when: string;
  props: string;
}

export const catalog: CatalogEntry[] = [
  { ui: "text", when: "짧은 설명 한 문단. 다른 템플릿으로 표현할 수 없을 때만 쓴다.", props: "body: 문자열(400자 이하)" },
  { ui: "summary", when: "하루 브리핑이나 결과 요약. 맨 위에 한 번만 둔다.", props: "headline: 한 줄, stats: [{label, value, tone?}] 최대 4개" },
  { ui: "todo_list", when: "사장님이 처리할 일 목록. 눌러서 해당 화면으로 간다.", props: "title?, items: [{title, sub?, tone?, action}] 최대 6개" },
  { ui: "schedule", when: "시간순 수업·회차 목록.", props: "title, rows: [{time, title, meta?, dim?, action?}] 최대 8개, empty?: 0건 문구" },
  { ui: "approval", when: "승인을 기다리는 비서 작업 한 건. 승인·거절 버튼이 붙는다. 금액·받는 사람은 저장소에서 읽으므로 taskId만 준다.", props: "taskId" },
  { ui: "progress", when: "실행 중인 비서 작업의 진행률.", props: "taskId" },
  { ui: "kv", when: "항목과 값 표. 금액·조건 확인용.", props: "title, rows: [{label, value}] 최대 8개, total?: {label, value}" },
  { ui: "bars", when: "숫자 비교. 막대 그래프. 파이·게이지는 없다.", props: "title, rows: [{label, value, max, tail?}] 최대 6개" },
  { ui: "booking_draft", when: "말로 맡긴 예약을 화면에 채워 보여 준다. 저장은 사장님이 한다. 클래스·시간·남은 자리는 slotId로 저장소에서 읽는다.", props: "slotId?, name?, phone?, party?, note?" },
  { ui: "notice", when: "할 수 없는 일 안내(refuse), 주의(warn), 참고(info).", props: "tone, title, body?, action?: {label, action}" },
  { ui: "choices", when: "다음 행동 버튼 묶음.", props: "question?, options: [{label, action}] 최대 4개" },
];

export const actionDoc =
  'action은 {"type":"go","to":"/inbox"}, {"type":"ask","text":"..."}, {"type":"open_booking","slotId","name","phone","party"} 중 하나다. 승인·발송·환불·취소처럼 바깥에 영향을 주는 action은 없다. 승인은 approval 템플릿의 버튼으로만 일어난다.';

export function systemPrompt(): string {
  const rows = catalog.map((c) => `- ${c.ui}: ${c.when} props = ${c.props}`).join("\n");
  return [
    "너는 공방 AI 비서다. 사장님 말에 답할 때 HTML이나 마크다운을 직접 쓰지 않는다.",
    "반드시 아래 JSON 하나만 출력한다: {\"say\": 한두 문장, \"blocks\": [템플릿 블록...], \"suggest\": [다음에 할 말 최대 3개]}",
    "블록은 아래 카탈로그에서 골라 ui 값과 props만 채운다. 카탈로그에 없는 ui는 화면에 나오지 않는다.",
    "금액·인원·날짜 같은 사실은 지어내지 말고 도구 결과에서 그대로 옮긴다. 저장소에 있는 대상은 id로만 가리킨다.",
    "말투는 해요체, 이모지는 쓰지 않는다.",
    "",
    "카탈로그:",
    rows,
    "",
    actionDoc,
  ].join("\n");
}

const screenKeys: ScreenKey[] = ["today", "inbox", "booking", "approvals", "more", "opp", "mkt", "dlv", "rpt", "settings", "help"];
const tones = new Set<Tone>(["run", "ok", "warn", "err"]);
const noticeTones = new Set(["info", "warn", "refuse"]);

type Issues = string[];
type Obj = Record<string, unknown>;

const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const text = (v: unknown, max: number) => (typeof v === "string" && v.trim() ? v.replace(/[\u0000-\u001f]+/g, " ").trim().slice(0, max) : undefined);
const optText = (v: unknown, max: number) => (v === undefined ? undefined : text(v, max));
const int = (v: unknown, min: number, max: number) => (typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(min, Math.round(v))) : undefined);
const tone = (v: unknown) => (typeof v === "string" && tones.has(v as Tone) ? (v as Tone) : undefined);
const list = (v: unknown, max: number) => (Array.isArray(v) ? v.slice(0, max) : []);

export function checkAction(v: unknown, issues: Issues): Action | undefined {
  if (!isObj(v)) return issues.push("action 형식이 아니에요"), undefined;
  if (v.type === "go") {
    const to = text(v.to, 120);
    const head = to?.split(/[/?]/)[1] as ScreenKey | undefined;
    if (!to || !/^\/[a-z]+(\/[\w-]+)*(\?[\w=&-]+)?$/.test(to) || !head || !screenKeys.includes(head)) return issues.push(`허용하지 않는 이동 경로: ${String(v.to)}`), undefined;
    return { type: "go", to };
  }
  if (v.type === "ask") {
    const t = text(v.text, 200);
    return t ? { type: "ask", text: t } : (issues.push("ask에 문장이 없어요"), undefined);
  }
  if (v.type === "open_booking") {
    return { type: "open_booking", slotId: optText(v.slotId, 20), name: optText(v.name, 20), phone: optText(v.phone, 20), party: int(v.party, 1, 50) };
  }
  issues.push(`허용하지 않는 action: ${String(v.type)}`);
  return undefined;
}

function checkBlock(raw: unknown, issues: Issues): Block | undefined {
  if (!isObj(raw)) return issues.push("블록이 객체가 아니에요"), undefined;
  const ui = raw.ui;
  switch (ui) {
    case "text": {
      const body = text(raw.body, 400);
      return body ? { ui, body } : undefined;
    }
    case "summary": {
      const headline = text(raw.headline, 120);
      if (!headline) return issues.push("summary.headline 없음"), undefined;
      const stats = list(raw.stats, 4).flatMap((s) => (isObj(s) && text(s.label, 20) && text(s.value, 20) ? [{ label: text(s.label, 20)!, value: text(s.value, 20)!, tone: tone(s.tone) }] : []));
      return { ui, headline, stats };
    }
    case "todo_list": {
      const items = list(raw.items, 6).flatMap((s) => {
        if (!isObj(s) || !text(s.title, 60)) return [];
        const action = checkAction(s.action, issues);
        return action ? [{ title: text(s.title, 60)!, sub: optText(s.sub, 80), tone: tone(s.tone), action }] : [];
      });
      return items.length ? { ui, title: optText(raw.title, 40), items } : undefined;
    }
    case "schedule": {
      const title = text(raw.title, 40);
      if (!title) return undefined;
      const rows = list(raw.rows, 8).flatMap((r) =>
        isObj(r) && text(r.time, 10) && text(r.title, 40)
          ? [{ time: text(r.time, 10)!, title: text(r.title, 40)!, meta: optText(r.meta, 60), dim: r.dim === true, action: r.action === undefined ? undefined : checkAction(r.action, issues) }]
          : [],
      );
      return { ui, title, rows, empty: optText(raw.empty, 60) };
    }
    case "approval":
    case "progress": {
      const taskId = text(raw.taskId, 20);
      return taskId ? { ui, taskId } : (issues.push(`${ui}.taskId 없음`), undefined);
    }
    case "kv": {
      const title = text(raw.title, 40);
      const rows = list(raw.rows, 8).flatMap((r) => (isObj(r) && text(r.label, 30) && text(r.value, 60) ? [{ label: text(r.label, 30)!, value: text(r.value, 60)! }] : []));
      if (!title || !rows.length) return undefined;
      const total = isObj(raw.total) && text(raw.total.label, 30) && text(raw.total.value, 60) ? { label: text(raw.total.label, 30)!, value: text(raw.total.value, 60)! } : undefined;
      return { ui, title, rows, total };
    }
    case "bars": {
      const title = text(raw.title, 40);
      const rows = list(raw.rows, 6).flatMap((r) => {
        const max = isObj(r) ? int(r.max, 1, 1e9) : undefined;
        const value = isObj(r) ? int(r.value, 0, max ?? 0) : undefined;
        return isObj(r) && text(r.label, 30) && max !== undefined && value !== undefined ? [{ label: text(r.label, 30)!, value, max, tail: optText(r.tail, 20) }] : [];
      });
      return title && rows.length ? { ui, title, rows } : undefined;
    }
    case "booking_draft":
      return { ui, slotId: optText(raw.slotId, 20), name: optText(raw.name, 20), phone: optText(raw.phone, 20), party: int(raw.party, 1, 50), note: optText(raw.note, 120) };
    case "notice": {
      const title = text(raw.title, 80);
      if (!title || typeof raw.tone !== "string" || !noticeTones.has(raw.tone)) return issues.push("notice 형식 오류"), undefined;
      const act = isObj(raw.action) && text(raw.action.label, 24) ? checkAction(raw.action.action, issues) : undefined;
      return { ui, tone: raw.tone as "info" | "warn" | "refuse", title, body: optText(raw.body, 300), action: act ? { label: text((raw.action as Obj).label, 24)!, action: act } : undefined };
    }
    case "choices": {
      const options = list(raw.options, 4).flatMap((o) => {
        if (!isObj(o) || !text(o.label, 24)) return [];
        const action = checkAction(o.action, issues);
        return action ? [{ label: text(o.label, 24)!, action }] : [];
      });
      return options.length ? { ui, question: optText(raw.question, 80), options } : undefined;
    }
    default:
      issues.push(`카탈로그에 없는 템플릿: ${String(ui)}`);
      return undefined;
  }
}

export function parseReply(raw: string): { reply: Reply; issues: Issues } {
  const issues: Issues = [];
  let data: unknown;
  try {
    data = JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1));
  } catch {
    return { reply: { say: "답을 화면에 맞게 정리하지 못했어요. 다시 말씀해 주세요.", blocks: [] }, issues: ["JSON으로 읽을 수 없어요"] };
  }
  if (!isObj(data)) return { reply: { say: "답을 정리하지 못했어요.", blocks: [] }, issues: ["최상위가 객체가 아니에요"] };
  const blocks = list(data.blocks, 8).flatMap((b) => {
    const ok = checkBlock(b, issues);
    return ok ? [ok] : [];
  });
  const say = text(data.say, 300) ?? (blocks.length ? "" : "답을 정리하지 못했어요.");
  const suggest = list(data.suggest, 3).flatMap((s) => (text(s, 40) ? [text(s, 40)!] : []));
  return { reply: { say, blocks, suggest }, issues };
}
