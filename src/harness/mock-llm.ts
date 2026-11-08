import type { Block, Reply } from "./catalog";
import {
  bookings,
  classes,
  connections,
  customers,
  failedTasks,
  openInquiries,
  opportunities,
  role,
  runningTasks,
  scenario,
  seatsTaken,
  slots,
  todaySlots,
  unpaidBookings,
  visibleTasks,
} from "../store";
import { DAY, at, dDay, dayKey, hhmm, relative } from "../lib/time";

export interface TurnInput {
  text: string;
  context?: { screen: string; path: string[] };
  role: string;
}

const out = (r: Reply) => JSON.stringify(r);

export function briefing(): string {
  const today = todaySlots();
  const people = today.reduce((n, s) => n + seatsTaken(s.id), 0);
  const pending = visibleTasks.value;
  const open = openInquiries.value;
  const failed = failedTasks.value;
  const broken = connections.value.filter((c) => c.status === "오류");
  const soon = opportunities.value.filter((o) => o.deadline > Date.now() && o.deadline - Date.now() < 7 * DAY && o.verdict !== "안 맞음");
  if (scenario.value === "empty") {
    return out({ say: "좋은 아침이에요.", blocks: [{ ui: "summary", headline: "할 일을 다 끝냈어요", stats: [] }, { ui: "text", body: "새로운 일이 생기면 여기에 모아 둘게요." }], suggest: ["이번 주 예약 보여 줘"] });
  }
  const items: Extract<Block, { ui: "todo_list" }>["items"] = [];
  if (failed.length) items.push({ title: `실패한 발송 ${failed.length}건`, sub: failed[0]!.failReason, tone: "err", action: { type: "go", to: "/approvals?tab=fail" } });
  if (broken[0]) items.push({ title: `${broken[0].name} 연결 오류`, sub: broken[0].error, tone: "err", action: { type: "go", to: `/settings/connections/${broken[0].id}` } });
  if (pending.length) items.push({ title: `승인 기다리는 일 ${pending.length}건`, sub: `가장 빠른 실행 ${relative(pending[0]!.runAt)}`, action: { type: "ask", text: "승인할 일 보여 줘" } });
  if (open.length) items.push({ title: `답하지 않은 문의 ${open.length}건`, sub: `가장 오래 기다린 손님 ${relative(Math.min(...open.map((q) => q.messages[0]!.at)))}`, action: { type: "ask", text: "답 안 한 문의 보여 줘" } });
  if (unpaidBookings.value.length) items.push({ title: `예약금 미입금 ${unpaidBookings.value.length}건`, action: { type: "go", to: "/booking?status=unpaid" } });
  if (role.value === "OWNER" && soon[0]) items.push({ title: `마감 임박 기회 ${soon.length}건`, sub: `${soon[0].title} · ${dDay(soon[0].deadline)}`, action: { type: "go", to: `/opp/${soon[0].id}` } });
  const blocks: Block[] = [
    {
      ui: "summary",
      headline: `오늘 수업 ${today.length}개, ${people}명 와요`,
      stats: [
        { label: "승인 대기", value: `${pending.length}건`, tone: pending.length ? "run" : undefined },
        { label: "새 문의", value: `${open.length}건`, tone: open.length ? "warn" : undefined },
        { label: "실패", value: `${failed.length}건`, tone: failed.length ? "err" : undefined },
      ],
    },
    ...runningTasks.value.map((t): Block => ({ ui: "progress", taskId: t.id })),
  ];
  if (items.length) blocks.push({ ui: "todo_list", title: "먼저 할 일", items });
  blocks.push(scheduleBlock("오늘 수업", today));
  return out({ say: `문의 ${open.filter((q) => q.status === "답장 초안 있음").length}건에 답장 초안을 만들어 두었어요.`, blocks, suggest: ["승인할 일 보여 줘", "내일 2시 머그 2명 김민지 예약 잡아 줘", "이번 주 숫자 보여 줘"] });
}

function scheduleBlock(title: string, list: ReturnType<typeof todaySlots>): Block {
  return {
    ui: "schedule",
    title,
    empty: "수업이 없어요",
    rows: list.map((s) => {
      const c = classes.value.find((x) => x.id === s.classId);
      const unpaid = bookings.value.filter((b) => b.slotId === s.id && b.status === "예약금 대기").length;
      return {
        time: hhmm(s.start),
        title: c?.name ?? "클래스",
        meta: `${seatsTaken(s.id)}/${s.cap}명${unpaid ? ` · 예약금 대기 ${unpaid}건` : ""}`,
        dim: s.start + (c?.mins ?? 60) * 60_000 < Date.now(),
        action: { type: "go", to: `/booking/slot/${s.id}` },
      };
    }),
  };
}

function plan(input: TurnInput): Reply | string {
  const t = input.text;
  if (/잘못된 출력/.test(t)) {
    return '{"say":"출력 검사 시험이에요.","blocks":[{"ui":"marquee","html":"<script>alert(1)</script>"},{"ui":"choices","options":[{"label":"환불해","action":{"type":"refund","amount":50000}},{"label":"승인함 열기","action":{"type":"go","to":"/approvals"}}]},{"ui":"text","body":"카탈로그에 없는 블록과 허용하지 않은 action은 걸러졌어요."}]}';
  }
  if (t.includes("[가린 값]")) {
    return { say: "비밀번호나 키는 여기에 적지 마세요.", blocks: [{ ui: "notice", tone: "warn", title: "입력한 키를 가렸어요", body: "비서에게는 가린 글자만 전달했어요. 키는 연결 화면의 전용 칸에 넣어 주세요.", action: { label: "연결 화면 열기", action: { type: "go", to: "/settings/connections" } } }] };
  }
  if (/긁어|크롤|수집/.test(t)) {
    return { say: "그건 할 수 없어요.", blocks: [{ ui: "notice", tone: "refuse", title: "네이버 리뷰 자동 수집은 할 수 없어요", body: "네이버 정책이 자동 수집을 금지해요. 리뷰를 붙여 넣으면 답글 초안을 만들어 드려요.", action: { label: "리뷰 답글 만들기", action: { type: "go", to: "/mkt" } } }] };
  }
  if (/인스타|DM/i.test(t)) {
    return { say: "아직은 할 수 없어요.", blocks: [{ ui: "notice", tone: "refuse", title: "인스타그램 DM 자동 응답은 할 수 없어요", body: "대화를 붙여 넣으면 문의로 정리하고 답장 초안을 만들어요.", action: { label: "문의함 열기", action: { type: "go", to: "/inbox" } } }] };
  }
  const booking = t.match(/(\d+)\s*시.*?(\d+)\s*명\s*([가-힣]{2,4})?/);
  if (booking && /예약/.test(t)) {
    const [, hour, party, name] = booking;
    const want = /머그/.test(t) ? "c2" : /커플/.test(t) ? "c3" : "c1";
    const day = /모레/.test(t) ? 2 : /오늘/.test(t) ? 0 : 1;
    const key = dayKey(at(day));
    const slot = slots.value.find((s) => s.classId === want && dayKey(s.start) === key) ?? slots.value.find((s) => s.classId === want && s.start > Date.now());
    const known = customers.value.find((c) => c.name === name);
    return {
      say: `${hour}시 ${party}명 ${name ?? "손님"} 예약을 채워 뒀어요. 저장은 사장님이 눌러 주세요.`,
      blocks: [{ ui: "booking_draft", slotId: slot?.id, name, phone: known?.phone, party: Number(party), note: slot && hhmm(slot.start) !== `${hour.padStart(2, "0")}:00` ? `${hour}시 회차가 없어 가장 가까운 회차를 골랐어요.` : undefined }],
      suggest: ["승인할 일 보여 줘"],
    };
  }
  const ctx = input.context;
  if (/옮겨|변경/.test(t) && ctx?.screen === "booking" && ctx.path[0] && ctx.path[0] !== "slot") {
    return { say: "보고 계시던 예약을 옮길게요.", blocks: [{ ui: "choices", question: "변경 화면에서 새 회차를 골라 주세요.", options: [{ label: "변경 화면 열기", action: { type: "go", to: `/booking/${ctx.path[0]}?edit=1` } }] }] };
  }
  if (/승인|대기/.test(t)) {
    const list = visibleTasks.value.filter((x) => !x.batch).slice(0, 3);
    const batch = visibleTasks.value.filter((x) => x.batch);
    if (!list.length && !batch.length) return { say: "승인할 일이 없어요.", blocks: [] };
    const blocks: Block[] = list.map((x) => ({ ui: "approval", taskId: x.id }));
    if (batch.length) blocks.push({ ui: "choices", question: `내일 리마인드 ${batch.length}건은 승인함에서 한꺼번에 승인할 수 있어요.`, options: [{ label: "승인함 열기", action: { type: "go", to: "/approvals" } }] });
    return { say: `가장 먼저 실행될 ${list.length}건이에요.`, blocks, suggest: ["답 안 한 문의 보여 줘"] };
  }
  if (/문의/.test(t)) {
    const open = openInquiries.value;
    if (!open.length) return { say: "답하지 않은 문의가 없어요.", blocks: [] };
    return {
      say: `답하지 않은 문의 ${open.length}건이에요.`,
      blocks: [{ ui: "todo_list", items: open.slice(0, 6).map((q) => ({ title: `${q.customerName} · ${q.channel}`, sub: q.messages[0]!.text.slice(0, 40), tone: q.status === "새 문의" ? "warn" : "run", action: { type: "go", to: `/inbox/${q.id}` } })) }],
    };
  }
  if (/리포트.*열/.test(t)) return { say: "리포트를 열게요.", blocks: [{ ui: "choices", options: [{ label: "리포트 열기", action: { type: "go", to: "/rpt" } }] }] };
  if (/숫자|매출|리포트|이번 주/.test(t)) {
    const blocks: Block[] = [{ ui: "bars", title: "이번 주", rows: [{ label: "확정 인원", value: 32, max: 48, tail: "32명" }, { label: "문의 답한 비율", value: 18, max: 23, tail: "18/23건" }] }];
    if (role.value === "STAFF") blocks.push({ ui: "notice", tone: "info", title: "매출은 사장님만 볼 수 있어요" });
    else blocks.push({ ui: "kv", title: "매출", rows: [{ label: "이번 주", value: "1,485,000원" }, { label: "지난주", value: "1,230,000원" }], total: { label: "늘어난 금액", value: "+255,000원" } });
    return { say: "이번 주 숫자예요.", blocks, suggest: ["리포트 열어 줘"] };
  }
  if (/내일|수업|일정/.test(t)) {
    const key = dayKey(at(1));
    return { say: "내일 수업이에요.", blocks: [scheduleBlock("내일 수업", slots.value.filter((s) => dayKey(s.start) === key).toSorted((a, b) => a.start - b.start))] };
  }
  if (/할 일|오늘/.test(t)) return briefing();
  return {
    say: "이 목업은 예시 문장으로 동작해요.",
    blocks: [{ ui: "choices", question: "이렇게 말해 보세요.", options: [{ label: "승인할 일", action: { type: "ask", text: "승인할 일 보여 줘" } }, { label: "내일 수업", action: { type: "ask", text: "내일 수업 보여 줘" } }, { label: "예약 잡기", action: { type: "ask", text: "내일 2시 머그 2명 김민지 예약 잡아 줘" } }] }],
  };
}

export async function respond(input: TurnInput): Promise<string> {
  await new Promise((r) => setTimeout(r, 450));
  const r = plan(input);
  return typeof r === "string" ? r : out(r);
}
