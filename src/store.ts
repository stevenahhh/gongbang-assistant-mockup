import { computed, signal, type Signal } from "@preact/signals";
import * as seed from "./data";
import type { Activity, AgentTask, Booking, BookingStatus, Inquiry, Role, Slot } from "./types";
import { HOUR, MIN, dayKey } from "./lib/time";

export const shop = signal(seed.seedShop());
export const classes = signal(seed.seedClasses());
export const slots = signal(seed.seedSlots());
export const customers = signal(seed.seedCustomers());
export const bookings = signal(seed.seedBookings());
export const inquiries = signal(seed.seedInquiries());
export const tasks = signal(seed.seedTasks());
export const messages = signal(seed.seedMessages());
export const templates = signal(seed.seedTemplates());
export const policies = signal(seed.seedPolicies());
export const opportunities = signal(seed.seedOpportunities());
export const deliveries = signal(seed.seedDeliveries());
export const connections = signal(seed.seedConnections());
export const activity = signal(seed.seedActivity());
export const staff = signal(seed.seedStaff());
export const rules = signal(seed.seedRules());
export const notify = signal(seed.seedNotify());
export const notices = signal(seed.seedNotices());

export const role = signal<Role>("OWNER");
export const scenario = signal<"normal" | "empty" | "error">("normal");
export const lastSync = signal(Date.now());
export const autoSend = signal(false);
export const aiNotice = signal(true);
export const learnTone = signal(true);
export const quietHours = signal({ from: "22:00", to: "07:00" });

type WithId = { id: string };
export function patch<T extends WithId>(list: Signal<T[]>, id: string, change: Partial<T> | ((row: T) => Partial<T>)) {
  list.value = list.value.map((row) => (row.id === id ? { ...row, ...(typeof change === "function" ? change(row) : change) } : row));
}
export const byId = <T extends WithId>(list: T[], id: string | undefined) => list.find((r) => r.id === id);

let uid = 1000;
export const newId = (prefix: string) => `${prefix}${uid++}`;

export function log(entry: Omit<Activity, "id" | "at">) {
  activity.value = [{ ...entry, id: newId("ac"), at: Date.now() }, ...activity.value];
}

export const actorName = () => (role.value === "OWNER" ? "사장님" : "이보조");
export const actorKind = () => (role.value === "OWNER" ? ("사장님" as const) : ("직원" as const));

const holdsSeat = (s: BookingStatus) => s === "확정" || s === "예약금 대기" || s === "출석" || s === "노쇼";
export const seatMap = computed(() => {
  const map = new Map<string, number>();
  for (const b of bookings.value) if (holdsSeat(b.status)) map.set(b.slotId, (map.get(b.slotId) ?? 0) + b.party);
  return map;
});
export const seatsTaken = (slotId: string) => seatMap.value.get(slotId) ?? 0;
export const waitingCount = (slotId: string) => bookings.value.filter((b) => b.slotId === slotId && b.status === "대기").length;
export const classOf = (slot: Slot | undefined) => byId(classes.value, slot?.classId);
export const slotLabel = (slot: Slot) => `${classOf(slot)?.name ?? "클래스"}`;
export const currentPolicy = computed(() => policies.value[policies.value.length - 1]!);

export const pendingTasks = computed(() =>
  tasks.value.filter((t) => t.status === "승인 대기").toSorted((a, b) => a.runAt - b.runAt),
);
export const runningTasks = computed(() => tasks.value.filter((t) => t.status === "실행 중"));
export const failedTasks = computed(() => tasks.value.filter((t) => t.status === "실패" || t.status === "중단됨"));
export const openInquiries = computed(() => inquiries.value.filter((i) => i.status === "새 문의" || i.status === "답장 초안 있음"));
export const unpaidBookings = computed(() => bookings.value.filter((b) => b.status === "예약금 대기"));
export const unreadNotices = computed(() => notices.value.filter((n) => !n.read).length);

export function todaySlots() {
  const key = dayKey(Date.now());
  return slots.value.filter((s) => dayKey(s.start) === key).toSorted((a, b) => a.start - b.start);
}

const staffKinds = new Set(["답장", "리마인드", "확정 안내", "변경 안내", "취소 안내", "대기 자리 안내"]);
export const visibleTasks = computed(() =>
  role.value === "OWNER" ? pendingTasks.value : pendingTasks.value.filter((t) => staffKinds.has(t.kind)),
);

export interface Toast {
  id: number;
  text: string;
  undo?: () => void;
}
export const toasts = signal<Toast[]>([]);
let toastId = 0;
export function toast(text: string, undo?: () => void) {
  const id = ++toastId;
  toasts.value = [...toasts.value.slice(-1), { id, text, undo }];
  setTimeout(() => (toasts.value = toasts.value.filter((t) => t.id !== id)), 4000);
}

function runTask(ids: string[], onDone?: () => void) {
  const total = ids.length;
  const lead = ids[0]!;
  const task = byId(tasks.value, lead)!;
  log({ actorKind: "비서", actor: "비서", action: total > 1 ? `${task.kind} ${total}건 실행 시작` : `${task.kind} 실행 시작`, target: task.to, targetType: "문의", result: "대기", evidence: task.evidence });
  for (const id of ids) patch(tasks, id, { status: "승인됨" });
  patch(tasks, lead, { status: "실행 중", progress: { done: 0, total } });
  let done = 0;
  const tick = () => {
    done += 1;
    patch(tasks, lead, { progress: { done, total } });
    if (done < total) return void setTimeout(tick, 260);
    const result = total > 1 ? `${total}명 중 ${total}명에게 ${task.kind} 도착` : `${task.to.split(" · ")[0]}님께 ${task.kind} 전달`;
    for (const id of ids) patch(tasks, id, { status: "완료", result, progress: undefined });
    log({ actorKind: "비서", actor: "비서", action: total > 1 ? `${task.kind} ${total}건을 보냄` : `${task.kind}을 처리함`, target: task.to, targetType: "문의", result: "완료", evidence: task.evidence });
    onDone?.();
  };
  setTimeout(tick, 320);
}

export function approveTask(id: string, editedBody?: string) {
  const task = byId(tasks.value, id);
  if (!task || task.mismatch) return false;
  const edited = editedBody !== undefined && editedBody !== task.body;
  if (edited) patch(tasks, id, { originalBody: task.originalBody ?? task.body, body: editedBody });
  log({ actorKind: actorKind(), actor: actorName(), action: edited ? "사람이 수정 후 승인" : "승인", target: task.title, targetType: "문의", result: "완료" });
  runTask([id], () => {
    if (task.inquiryId) {
      const line = { from: "비서" as const, text: editedBody ?? task.body, at: Date.now() };
      const approved = { from: "시스템" as const, text: `${actorName()} 승인`, at: Date.now() };
      patch(inquiries, task.inquiryId, (q) => ({ status: "답함" as const, messages: [...q.messages, approved, line] }));
    }
  });
  return true;
}

export function approveBatch(ids: string[]) {
  const clean = ids.filter((id) => !byId(tasks.value, id)?.mismatch);
  if (clean.length) {
    log({ actorKind: actorKind(), actor: actorName(), action: `${clean.length}건 묶음 승인`, target: byId(tasks.value, clean[0])?.kind ?? "", targetType: "예약", result: "완료" });
    runTask(clean);
  }
  return clean.length;
}

export function rejectTask(id: string, reason: string) {
  const task = byId(tasks.value, id);
  patch(tasks, id, { status: "반려됨", result: `반려: ${reason}` });
  log({ actorKind: actorKind(), actor: actorName(), action: `반려(${reason})`, target: task?.title ?? "", targetType: "문의", result: "완료" });
}

export function retryTask(id: string) {
  const task = byId(tasks.value, id);
  if (!task) return;
  const failCount = (task.failCount ?? 0) + 1;
  if (failCount >= 2 && task.failCount) {
    patch(tasks, id, { status: "중단됨", failCount });
    toast("같은 오류가 또 나서 멈췄어요");
    return;
  }
  patch(tasks, id, { status: "승인 대기", failReason: undefined });
}

export function handOver(id: string) {
  const task = byId(tasks.value, id);
  patch(tasks, id, { status: "사람이 처리", result: "사장님이 직접 끝냈어요" });
  log({ actorKind: actorKind(), actor: actorName(), action: "사람이 처리", target: task?.title ?? "", targetType: "문의", result: "완료" });
}

export function addTask(task: Omit<AgentTask, "id" | "createdAt" | "status"> & Partial<Pick<AgentTask, "status">>) {
  const row: AgentTask = { status: "승인 대기", ...task, id: newId("t"), createdAt: Date.now() };
  tasks.value = [row, ...tasks.value];
  return row;
}

export function addInquiry(row: Omit<Inquiry, "id">) {
  const q: Inquiry = { ...row, id: newId("i") };
  inquiries.value = [q, ...inquiries.value];
  return q;
}

export function addBooking(row: Omit<Booking, "id">) {
  const b: Booking = { ...row, id: newId("b") };
  bookings.value = [b, ...bookings.value];
  return b;
}

export const refreshing = signal(false);
export function refresh() {
  if (refreshing.value) return;
  refreshing.value = true;
  setTimeout(() => {
    lastSync.value = Date.now();
    refreshing.value = false;
  }, 600);
}

export const nowSoon = (m: number) => Date.now() + m * MIN;
export const hoursAgo = (h: number) => Date.now() - h * HOUR;
