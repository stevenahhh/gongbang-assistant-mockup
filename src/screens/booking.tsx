import { Fragment } from "preact";
import { computed, effect, signal } from "@preact/signals";
import { useEffect, useRef, useState } from "preact/hooks";
import { ArrowRight, CalendarPlus, Check, ChevronLeft, ChevronRight, FileUp, Layers, Link2, Lock, LockOpen, Plus, Search, Trash2, Undo2, Users } from "lucide-preact";
import { back, go, route, type DetailProps, type ScreenDef } from "../router";
import { actorKind, actorName, addBooking, addTask, bookings, byId, classOf, classes, currentPolicy, customers, log, newId, patch, role, scenario, slots, toast } from "../store";
import type { Booking, BookingSource, BookingStatus, ClassItem, Customer, Slot, Tone } from "../types";
import { BarRow, Btn, Chips, Empty, Field, IconBtn, NavLink, Page, Segmented, Status, Stepper, Switch, TextArea, TextInput, openSheet } from "../ui";
import { DAY, MIN, at, dateLabel, dayKey, hhmm, lastFour, maskPhone, startOfToday, won } from "../lib/time";
import {
  bookingTone,
  customerOf,
  dayNum,
  digits,
  ensureCustomer,
  holdsSeat,
  monthLabel,
  openBookingForm,
  policyOf,
  queueConfirmTask,
  refundFor,
  seatInfo,
  slotEnd,
  slotTime,
  startOfDay,
  validPhone,
  weekStartOf,
  weekdayLabel,
} from "./booking-form";

const views = ["캘린더", "목록"] as const;
type View = (typeof views)[number];
const view = signal<View>("캘린더");
const day = signal(startOfToday());
const weekStart = computed(() => weekStartOf(day.value));

const periods = ["전체", "오늘", "이번 주", "이번 달", "지난 수업"] as const;
type Period = (typeof periods)[number];
const statusOptions: BookingStatus[] = ["예약금 대기", "확정", "대기", "출석", "노쇼", "취소"];
const sourceOptions: BookingSource[] = ["직접", "문의", "네이버 엑셀", "플랫폼"];
const period = signal<Period>("전체");
const classSel = signal<string[]>([]);
const statusSel = signal<BookingStatus[]>([]);
const sourceSel = signal<BookingSource[]>([]);
const q = signal("");
const moreFilters = signal(false);

const slotsPerDay = computed(() => {
  const map = new Map<string, Slot[]>();
  for (const s of slots.value.toSorted((a, b) => a.start - b.start)) {
    const key = dayKey(s.start);
    const list = map.get(key);
    if (list) list.push(s);
    else map.set(key, [s]);
  }
  return map;
});

function monthRange(now: number): [number, number] {
  const key = dayKey(now);
  const y = Number(key.slice(0, 4));
  const m = Number(key.slice(5, 7));
  const first = new Date(`${key.slice(0, 7)}-01T00:00:00+09:00`).getTime();
  const nextKey = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
  return [first, new Date(`${nextKey}-01T00:00:00+09:00`).getTime()];
}

interface ListRow {
  b: Booking;
  slot: Slot;
  cls: ClassItem | undefined;
  customer: Customer | undefined;
}

const listRows = computed<ListRow[]>(() => {
  const term = q.value.trim();
  const termDigits = digits(term);
  const numeric = term.length > 0 && term === termDigits;
  const now = Date.now();
  const today0 = startOfToday();
  const p = period.value;
  const range: [number, number] | undefined =
    p === "오늘" ? [today0, today0 + DAY] : p === "이번 주" ? [weekStartOf(now), weekStartOf(now) + 7 * DAY] : p === "이번 달" ? monthRange(now) : p === "지난 수업" ? [0, now] : undefined;
  const slotMap = new Map(slots.value.map((s) => [s.id, s] as const));
  const rows: ListRow[] = [];
  for (const b of bookings.value) {
    const slot = slotMap.get(b.slotId);
    if (!slot) continue;
    if (range && (slot.start < range[0] || slot.start >= range[1])) continue;
    const cls = byId(classes.value, slot.classId);
    if (classSel.value.length && !classSel.value.includes(cls?.name ?? "")) continue;
    if (statusSel.value.length && !statusSel.value.includes(b.status)) continue;
    if (sourceSel.value.length && !sourceSel.value.includes(b.source)) continue;
    const customer = byId(customers.value, b.customerId);
    if (term) {
      const hit = numeric ? digits(customer?.phone ?? "").endsWith(termDigits) : (customer?.name ?? "").includes(term);
      if (!hit) continue;
    }
    rows.push({ b, slot, cls, customer });
  }
  return rows.toSorted((a, b) => a.slot.start - b.slot.start);
});

const filtering = computed(() => Boolean(q.value || period.value !== "전체" || classSel.value.length || statusSel.value.length || sourceSel.value.length));

function clearFilters() {
  q.value = "";
  period.value = "전체";
  classSel.value = [];
  statusSel.value = [];
  sourceSel.value = [];
}

effect(() => {
  const r = route.value;
  if (r.key !== "booking") return;
  const params = new URLSearchParams(r.raw.split("?")[1] ?? "");
  if (params.get("status") === "unpaid") {
    view.value = "목록";
    statusSel.value = ["예약금 대기"];
  }
});

const selectedSlotId = () => (route.value.key === "booking" && route.value.path[0] === "slot" ? route.value.path[1] : undefined);
const selectedBookingId = () => (route.value.key === "booking" && route.value.path.length === 1 ? route.value.path[0] : undefined);

function Forbidden({ sub }: { sub?: boolean }) {
  return (
    <Page title="예약" backTo={sub ? "/today" : undefined}>
      <Empty title="이 화면은 사장님만 볼 수 있어요" action={<Btn small onClick={() => go("/today")}>돌아가기</Btn>}>
        예약 장부는 사장님과 직원만 열 수 있어요.
      </Empty>
    </Page>
  );
}

function SlotBlock({ s }: { s: Slot }) {
  const info = seatInfo(s);
  const cls = classOf(s);
  const past = slotEnd(s) < Date.now();
  return (
    <button type="button" class="bk-block" data-past={past || undefined} aria-current={selectedSlotId() === s.id || undefined} onClick={() => go(`/booking/slot/${s.id}`)}>
      <span class="bk-block-time num">
        <span class="strong">{hhmm(s.start)}</span>
        <span class="cap muted">{cls?.mins ?? 0}분</span>
      </span>
      <span class="grow">
        <span class="strong clamp1">{cls?.name ?? "클래스"}</span>
        <span class="sm muted num">
          확정 {info.taken}/{s.cap}
          {info.waiting ? ` · 대기 ${info.waiting}` : ""}
        </span>
      </span>
      <Status tone={info.tone}>{info.label}</Status>
    </button>
  );
}

function DayStrip() {
  const sel = day.value;
  const today = startOfToday();
  const per = slotsPerDay.value;
  const ref = useRef<HTMLDivElement>(null);
  const first = sel >= today - 2 * DAY && sel < today + 26 * DAY ? today - 2 * DAY : sel - 2 * DAY;
  return (
    <div class="bk-strip" ref={ref} role="listbox" aria-label="날짜 고르기">
      {Array.from({ length: 28 }, (_, i) => first + i * DAY).map((t) => {
        const n = per.get(dayKey(t))?.length ?? 0;
        return (
          <button key={t} type="button" class="bk-day" role="option" aria-selected={t === sel} data-today={t === today || undefined} onClick={() => (day.value = t)}>
            <span class="cap">{weekdayLabel(t)}</span>
            <span class="bk-daynum num">{dayNum(t)}</span>
            <span class="bk-dots" aria-label={n ? `회차 ${n}개` : "회차 없음"}>
              {Array.from({ length: Math.min(n, 3) }, (_, j) => (
                <i key={j} />
              ))}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function DayList() {
  const sel = day.value;
  const list = slotsPerDay.value.get(dayKey(sel)) ?? [];
  return (
    <div class="bk-dayview">
      <DayStrip />
      <p class="row between bk-dayhead">
        <span class="strong">{dateLabel(sel)}</span>
        <span class="sm muted num">{list.length ? `회차 ${list.length}개` : ""}</span>
      </p>
      {list.length ? (
        <div class="stack" style={{ "--gap": "var(--s2)" }}>
          {list.map((s) => (
            <SlotBlock key={s.id} s={s} />
          ))}
        </div>
      ) : (
        <Empty title="이 날은 회차가 없어요" action={<Btn small onClick={() => go("/booking/classes")}>회차 만들기</Btn>} />
      )}
    </div>
  );
}

function MiniBlock({ s }: { s: Slot }) {
  const info = seatInfo(s);
  return (
    <button type="button" class={`bk-mini ${info.tone}`} aria-current={selectedSlotId() === s.id || undefined} onClick={() => go(`/booking/slot/${s.id}`)}>
      <span class="num strong">{hhmm(s.start)}</span>
      <span class="clamp1 grow">{classOf(s)?.name ?? "클래스"}</span>
      <span class="num bk-mini-seat">
        {info.taken}/{s.cap} · {info.label}
      </span>
    </button>
  );
}

function WeekView() {
  const start = weekStart.value;
  const per = slotsPerDay.value;
  const today = startOfToday();
  return (
    <div class="bk-week">
      {Array.from({ length: 7 }, (_, i) => start + i * DAY).map((t) => {
        const list = per.get(dayKey(t)) ?? [];
        return (
          <div key={t} class="bk-wrow" data-today={t === today || undefined}>
            <button type="button" class="bk-wday" aria-pressed={t === day.value} onClick={() => (day.value = t)}>
              <span class="cap">{weekdayLabel(t)}</span>
              <span class="bk-daynum num">{dayNum(t)}</span>
            </button>
            <div class="bk-wblocks">
              {list.length ? list.map((s) => <MiniBlock key={s.id} s={s} />) : <span class="bk-wempty cap muted">회차 없음</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CalendarView() {
  const start = weekStart.value;
  const end = start + 6 * DAY;
  const today = startOfToday();
  const range = monthLabel(start) === monthLabel(end) ? `${dayNum(start)}일 ~ ${dayNum(end)}일` : `${monthLabel(start)} ${dayNum(start)}일 ~ ${monthLabel(end)} ${dayNum(end)}일`;
  return (
    <div class="stack" style={{ "--gap": "var(--s3)" }}>
      <div class="row between bk-calhead">
        <IconBtn label="지난주" class="bk-weeknav" onClick={() => (day.value -= 7 * DAY)}>
          <ChevronLeft size={22} />
        </IconBtn>
        <span class="grow bk-caltitle">
          <span class="strong">{monthLabel(day.value)}</span>
          <span class="cap muted num bk-weekrange">{range}</span>
        </span>
        <IconBtn label="다음주" class="bk-weeknav" onClick={() => (day.value += 7 * DAY)}>
          <ChevronRight size={22} />
        </IconBtn>
        {day.value !== today ? (
          <Btn small variant="outline" onClick={() => (day.value = today)}>
            오늘
          </Btn>
        ) : null}
      </div>
      <DayList />
      <WeekView />
    </div>
  );
}

function BookingRow({ row, current }: { row: ListRow; current: boolean }) {
  const { b, slot, cls, customer } = row;
  return (
    <button type="button" class="bk-row" aria-current={current || undefined} onClick={() => go(`/booking/${b.id}`)}>
      <span class="bk-row-when num">
        <span class="strong">{dateLabel(slot.start).replace(/ \(.\)$/, "")}</span>
        <span class="sm muted">
          {weekdayLabel(slot.start)} {hhmm(slot.start)}
        </span>
      </span>
      <span class="bk-row-who">
        <span class="row" style={{ "--gap": "6px" }}>
          <span class="strong clamp1">{customer?.name ?? "손님"}</span>
          <span class="cap muted num">끝 {lastFour(customer?.phone ?? "")}</span>
        </span>
        <span class="sm muted clamp1">{cls?.name ?? "클래스"}</span>
      </span>
      <span class="bk-row-party num strong">{b.party}명</span>
      <span class="bk-row-tags row" style={{ "--gap": "6px" }}>
        <Status tone={bookingTone(b.status)}>{b.status}</Status>
        <span class="cap muted clamp1">
          {b.source}
          {b.naverNo ? ` ${b.naverNo}` : ""}
        </span>
      </span>
    </button>
  );
}

function ListView() {
  const rows = scenario.value === "empty" ? [] : listRows.value;
  const selected = selectedBookingId();
  const classNames = classes.value.map((c) => c.name);
  const hiddenActive = classSel.value.length + sourceSel.value.length;
  return (
    <div class="stack" style={{ "--gap": "var(--s2)" }}>
      <div class="field bk-search">
        <Search size={18} class="bk-search-icon" />
        <input class="input" type="search" aria-label="이름이나 번호 끝 4자리로 찾기" placeholder="이름이나 번호 끝 4자리" value={q.value} onInput={(e) => (q.value = e.currentTarget.value)} />
      </div>
      <Chips label="기간" options={periods} value={[period.value]} onChange={(v) => (period.value = v[v.length - 1] ?? "전체")} />
      <Chips label="상태" options={statusOptions} value={statusSel.value} onChange={(v) => (statusSel.value = v)} />
      {moreFilters.value ? (
        <>
          <Chips label="클래스" options={classNames} value={classSel.value} onChange={(v) => (classSel.value = v)} />
          <Chips label="출처" options={sourceOptions} value={sourceSel.value} onChange={(v) => (sourceSel.value = v)} />
        </>
      ) : null}
      <div class="row between">
        <p class="sm muted num">{rows.length}건 · 수업 날짜 순</p>
        <Btn small onClick={() => (moreFilters.value = !moreFilters.value)}>
          {moreFilters.value ? "필터 접기" : hiddenActive ? `클래스·출처 필터 ${hiddenActive}` : "클래스·출처 필터"}
        </Btn>
      </div>
      {rows.length ? (
        <div class="bk-rows">
          {rows.map((r) => (
            <BookingRow key={r.b.id} row={r} current={r.b.id === selected} />
          ))}
        </div>
      ) : filtering.value ? (
        <Empty title="조건에 맞는 예약이 없어요" action={<Btn small onClick={clearFilters}>필터 지우기</Btn>} />
      ) : (
        <Empty title="아직 예약이 없어요" action={<Btn small onClick={() => openBookingForm()}>첫 예약 등록하기</Btn>} />
      )}
    </div>
  );
}

function HeaderActions() {
  return (
    <span class="row" style={{ "--gap": "var(--s2)" }}>
      <IconBtn label="클래스·회차 관리" onClick={() => go("/booking/classes")}>
        <Layers size={20} />
      </IconBtn>
      <IconBtn label="네이버 예약 가져오기" onClick={() => go("/booking/import")}>
        <FileUp size={20} />
      </IconBtn>
      <IconBtn label="예약 등록" solid onClick={() => openBookingForm()}>
        <Plus size={22} />
      </IconBtn>
    </span>
  );
}

function Master() {
  if (role.value === "VIEWER") return <Forbidden />;
  const v = view.value;
  return (
    <Page title="예약" right={<HeaderActions />}>
      <div class="bk-master stack" style={{ "--gap": "var(--s3)" }}>
        <Segmented label="보기" options={views} value={v} onChange={(x) => (view.value = x)} />
        {v === "캘린더" ? <CalendarView /> : <ListView />}
      </div>
    </Page>
  );
}

function Detail({ path }: DetailProps) {
  if (role.value === "VIEWER") return <Forbidden sub />;
  const [head, second] = path;
  if (head === "slot" && second) return <SlotDetail id={second} />;
  if (head === "import") return <ImportScreen />;
  if (head === "classes") return <ClassesScreen />;
  return <BookingDetail id={head ?? ""} />;
}

const LATE = "지각";
const isLate = (b: Booking) => b.status === "출석" && b.memo.endsWith(LATE);
const tagLate = (memo: string) => (memo.endsWith(LATE) ? memo : memo ? `${memo} · ${LATE}` : LATE);
const untagLate = (memo: string) => memo.replace(/( · )?지각$/, "");
const canUndoCheck = (b: Booking) => (b.status === "출석" || b.status === "노쇼") && Boolean(b.checkedAt) && Date.now() - (b.checkedAt ?? 0) < DAY;

function undoCheck(id: string) {
  const fresh = byId(bookings.value, id);
  if (!fresh || !canUndoCheck(fresh)) {
    toast("24시간이 지나서 되돌릴 수 없어요");
    return;
  }
  if (fresh.status === "노쇼") patch(customers, fresh.customerId, (c) => ({ noShows: Math.max(0, c.noShows - 1) }));
  patch(bookings, id, { status: "확정", checkedAt: undefined, memo: untagLate(fresh.memo) });
  log({ actorKind: actorKind(), actor: actorName(), action: "출석 기록을 되돌림", target: customerOf(fresh)?.name ?? "손님", targetType: "예약", result: "되돌림" });
}

function markCheck(b: Booking, kind: "출석" | "지각" | "노쇼") {
  if (b.status !== "확정") return;
  const status: BookingStatus = kind === "노쇼" ? "노쇼" : "출석";
  patch(bookings, b.id, { status, checkedAt: Date.now(), memo: kind === "지각" ? tagLate(b.memo) : b.memo });
  if (kind === "노쇼") patch(customers, b.customerId, (c) => ({ noShows: c.noShows + 1 }));
  const name = customerOf(b)?.name ?? "손님";
  log({ actorKind: actorKind(), actor: actorName(), action: `${kind}으로 기록`, target: name, targetType: "예약", result: "완료" });
  toast(`${name}님을 ${kind}으로 기록했어요`, () => undoCheck(b.id));
}

function CheckButtons({ b }: { b: Booking }) {
  if (b.status === "확정") {
    return (
      <div class="bk-att" role="group" aria-label="출석 체크">
        <button type="button" class="bk-attbtn ok" onClick={() => markCheck(b, "출석")}>
          출석
        </button>
        <button type="button" class="bk-attbtn warn" onClick={() => markCheck(b, "지각")}>
          지각
        </button>
        <button type="button" class="bk-attbtn err" onClick={() => markCheck(b, "노쇼")}>
          노쇼
        </button>
      </div>
    );
  }
  if (b.status === "출석" || b.status === "노쇼") {
    return (
      <div class="row between bk-checked">
        <span class="row" style={{ "--gap": "6px" }}>
          <Status tone={bookingTone(b.status)}>{isLate(b) ? "지각" : b.status}</Status>
          {b.checkedAt ? <span class="cap muted num">{hhmm(b.checkedAt)} 기록</span> : null}
        </span>
        {canUndoCheck(b) ? (
          <Btn small onClick={() => undoCheck(b.id)}>
            <Undo2 size={16} /> 되돌리기
          </Btn>
        ) : (
          <span class="cap muted">24시간이 지나 바꿀 수 없어요</span>
        )}
      </div>
    );
  }
  return null;
}

function openPolicySheet(b: Booking) {
  const p = policyOf(b);
  openSheet(`규정 v${p.version} 사본`, () => (
    <div class="stack bk-sheet" style={{ "--gap": "var(--s4)" }}>
      <p class="sm muted">이 예약을 받을 때 붙인 규정이에요. 나중에 규정을 바꿔도 이 예약은 이 내용을 따라요.</p>
      <dl class="kv">
        <dt>예약금</dt>
        <dd class="num">{p.deposit.use ? `${won(p.deposit.amount)} · ${p.deposit.hours}시간 안에 입금` : "안 받아요"}</dd>
        <dt>기한 지나면</dt>
        <dd>{p.deposit.overdue}</dd>
        {p.bands.map((bd) => (
          <Fragment key={bd.label}>
            <dt>{bd.label}</dt>
            <dd class="num">{bd.percent}% 환불</dd>
          </Fragment>
        ))}
        <dt>공방 사유</dt>
        <dd>{p.shopFault}</dd>
        <dt>지각 기준</dt>
        <dd class="num">{p.lateMins ? `${p.lateMins}분` : "없음"}</dd>
        {p.noShow ? (
          <>
            <dt>노쇼</dt>
            <dd>{p.noShow}</dd>
          </>
        ) : null}
        <dt>바꾼 사람</dt>
        <dd>
          {p.editor} · {dateLabel(p.at)}
        </dd>
      </dl>
      <p class="sm muted">{p.changes}</p>
    </div>
  ));
}

function confirmDeposit(b: Booking) {
  if (b.status !== "예약금 대기") return;
  patch(bookings, b.id, { status: "확정", depositPaid: true });
  const name = customerOf(b)?.name ?? "손님";
  log({ actorKind: actorKind(), actor: actorName(), action: "입금 확인", target: name, targetType: "예약", result: "완료" });
  toast(`${name}님 예약을 확정했어요`, () => {
    patch(bookings, b.id, { status: "예약금 대기", depositPaid: false });
    log({ actorKind: actorKind(), actor: actorName(), action: "입금 확인을 취소", target: name, targetType: "예약", result: "되돌림" });
  });
}

function notifyWaiter(b: Booking, slot: Slot) {
  const name = customerOf(b)?.name ?? "손님";
  const info = seatInfo(slot);
  addTask({
    kind: "대기 자리 안내",
    title: `${name}님께 빈자리를 알려요`,
    to: `${name} · 알림톡`,
    runAt: Date.now() + 10 * MIN,
    body: `${name}님, ${slotTime(slot)} ${classOf(slot)?.name ?? "클래스"} 수업에 자리가 났어요. 6시간 안에 답장 주시면 예약을 잡아 드릴게요.`,
    reason: "대기 순서 1번이에요. 응답 기한은 6시간으로 잡았어요.",
    evidence: [
      { label: "남은 자리", value: `${info.left}자리` },
      { label: "대기 순서", value: "1번" },
    ],
  });
  log({ actorKind: actorKind(), actor: actorName(), action: "대기 손님에게 자리 안내 초안을 만듦", target: name, targetType: "예약", result: "대기" });
}

function openPromote(b: Booking, slot: Slot) {
  openSheet("빈자리에 올리기", (close) => {
    const info = seatInfo(slot);
    const fits = info.left >= b.party;
    const name = customerOf(b)?.name ?? "손님";
    return (
      <div class="stack bk-sheet" style={{ "--gap": "var(--s4)" }}>
        <p class="num">
          남은 자리 {info.left}명, 이 예약은 {b.party}명이에요.{fits ? "" : " 아직 자리가 모자라요."}
        </p>
        <Btn
          variant="outline"
          disabled={!fits}
          onClick={() => {
            notifyWaiter(b, slot);
            toast("자리 안내 초안을 승인함에 두었어요");
            close();
          }}
        >
          자리 안내만 보내기
        </Btn>
        <Btn
          variant="primary"
          disabled={!fits}
          onClick={() => {
            const status: BookingStatus = currentPolicy.value.deposit.use && !b.depositPaid ? "예약금 대기" : "확정";
            patch(bookings, b.id, { status });
            const fresh = byId(bookings.value, b.id);
            if (fresh) queueConfirmTask(fresh, name);
            log({ actorKind: actorKind(), actor: actorName(), action: `대기 손님을 ${status}으로 올림`, target: name, targetType: "예약", result: "완료" });
            toast(`${name}님을 ${status}으로 올렸어요`);
            close();
          }}
        >
          손님이 수락했어요. 자리 올리기
        </Btn>
        <p class="cap muted">응답 기한이 지나면 다음 대기 손님에게 넘겨요.</p>
      </div>
    );
  });
}

function CancelForm({ b, slot, close }: { b: Booking; slot: Slot | undefined; close: () => void }) {
  const [who, setWho] = useState<"손님" | "공방">("손님");
  const [reason, setReason] = useState("");
  const refund = refundFor(b, slot, who);
  const staffBlocked = role.value === "STAFF" && refund.amount > 0;
  const name = customerOf(b)?.name ?? "손님";
  const waiting = slot ? bookings.value.filter((x) => x.slotId === slot.id && x.status === "대기").length : 0;
  const doCancel = () => {
    const fresh = byId(bookings.value, b.id);
    if (!fresh || (fresh.status !== "확정" && fresh.status !== "예약금 대기")) {
      toast("방금 다른 곳에서 바뀌었어요. 최신 내용으로 다시 볼게요");
      close();
      return;
    }
    patch(bookings, b.id, { status: "취소", refunded: refund.amount > 0 ? false : undefined });
    addTask({
      kind: "취소 안내",
      title: `${name}님 예약 취소를 알려요`,
      to: `${name} · 알림톡`,
      runAt: Date.now() + 10 * MIN,
      body: `${name}님, ${slot ? slotTime(slot) : ""} 예약이 취소됐어요.${refund.amount > 0 ? ` 환불 예정 금액은 ${won(refund.amount)}이에요.` : ""}`,
      evidence: [
        { label: "취소 주체", value: who },
        { label: "환불 예정", value: won(refund.amount) },
        { label: "규정", value: `v${b.policyVersion}` },
      ],
      moneyRelated: refund.amount > 0,
    });
    log({ actorKind: actorKind(), actor: actorName(), action: `예약 취소 (${who} 사유${reason.trim() ? `: ${reason.trim()}` : ""})`, target: name, targetType: "예약", result: "완료" });
    toast(waiting ? `취소했어요. 대기 손님 ${waiting}명이 있어요` : "예약을 취소했어요");
    close();
  };
  return (
    <div class="stack bk-sheet" style={{ "--gap": "var(--s4)" }}>
      <div class="field">
        <span class="field-label">누가 취소하나요</span>
        <Segmented label="취소 주체" options={["손님", "공방"] as const} value={who} onChange={setWho} />
      </div>
      <Field label="사유 (선택)">
        <TextInput value={reason} onValue={setReason} placeholder="일정 변경, 몸이 안 좋아서 등" />
      </Field>
      <div class="card stack" style={{ "--gap": "var(--s2)" }}>
        <span class="sm strong">환불 예정 금액</span>
        <span class="bk-money num">{won(refund.amount)}</span>
        <dl class="kv">
          <dt>결제액</dt>
          <dd class="num">{won(refund.paid)}</dd>
          <dt>적용 구간</dt>
          <dd>{refund.band}</dd>
          <dt>규정</dt>
          <dd>v{b.policyVersion} 사본 기준</dd>
        </dl>
        {refund.fixed ? <span class="sm muted">학원 등록 공방은 이 금액을 바꿀 수 없어요.</span> : null}
        {refund.amount > 0 ? <span class="sm muted">실제 환불은 사장님이 계좌이체로 처리한 뒤 예약 상세에서 환불함에 체크해요.</span> : null}
      </div>
      {staffBlocked ? (
        <div class="card bk-note stack" style={{ "--gap": "var(--s1)" }}>
          <span class="strong">환불이 걸린 취소는 사장님만 할 수 있어요</span>
          <span class="sm muted">사장님께 승인을 요청해 주세요. 환불이 없는 취소는 바로 할 수 있어요.</span>
        </div>
      ) : null}
      {waiting ? <p class="sm muted num">대기 손님 {waiting}명이 있어요. 취소하면 첫 대기 손님에게 자리 안내를 제안해요.</p> : null}
      <Btn variant="danger" disabled={staffBlocked} onClick={doCancel}>
        예약 취소
      </Btn>
    </div>
  );
}

function openCancel(b: Booking, slot: Slot | undefined) {
  openSheet("예약 취소", (close) => <CancelForm b={b} slot={slot} close={close} />);
}

function openSlotEditor(slot: Slot) {
  openSheet("회차 정원", (close) => <SlotCapForm slot={slot} close={close} />);
}

function SlotCapForm({ slot, close }: { slot: Slot; close: () => void }) {
  const [cap, setCap] = useState(slot.cap);
  const info = seatInfo(slot);
  const tooSmall = cap < info.taken;
  return (
    <div class="stack bk-sheet" style={{ "--gap": "var(--s4)" }}>
      <div class="field">
        <span class="field-label">정원</span>
        <Stepper label="정원" value={cap} min={1} max={50} onChange={setCap} />
        {tooSmall ? <span class="error-text" role="alert">이미 확정 {info.taken}명이 있어서 그보다 줄일 수 없어요</span> : <span class="help-text">1~50명 사이로 정해요</span>}
      </div>
      <Btn
        variant="primary"
        disabled={tooSmall || cap === slot.cap}
        onClick={() => {
          patch(slots, slot.id, { cap });
          log({ actorKind: actorKind(), actor: actorName(), action: `회차 정원을 ${cap}명으로 바꿈`, target: slotTime(slot), targetType: "예약", result: "완료" });
          toast("정원을 바꿨어요");
          close();
        }}
      >
        저장
      </Btn>
    </div>
  );
}

function toggleSlotOpen(slot: Slot) {
  patch(slots, slot.id, { open: !slot.open });
  log({ actorKind: actorKind(), actor: actorName(), action: slot.open ? "회차를 닫음" : "회차를 다시 열음", target: slotTime(slot), targetType: "예약", result: "완료" });
  toast(slot.open ? "회차를 닫았어요. 새 예약을 받지 않아요" : "회차를 다시 열었어요");
}

function deleteSlot(slot: Slot, after?: () => void) {
  const active = bookings.value.filter((b) => b.slotId === slot.id && b.status !== "취소").length;
  if (active) {
    toast(`예약 ${active}건을 먼저 옮겨 주세요`);
    return false;
  }
  slots.value = slots.value.filter((s) => s.id !== slot.id);
  log({ actorKind: actorKind(), actor: actorName(), action: "회차를 지움", target: slotTime(slot), targetType: "예약", result: "완료" });
  toast("회차를 지웠어요");
  after?.();
  return true;
}

function SlotDetail({ id }: { id: string }) {
  const slot = byId(slots.value, id);
  if (!slot) {
    return (
      <Page title="회차" backTo="/booking">
        <Empty title="이 회차를 찾지 못했어요" />
      </Page>
    );
  }
  const cls = classOf(slot);
  const info = seatInfo(slot);
  const now = Date.now();
  const ended = slotEnd(slot) <= now;
  const past = slot.start < now;
  const all = bookings.value.filter((b) => b.slotId === slot.id);
  const active = all.filter((b) => b.status !== "취소" && b.status !== "대기");
  const waiting = all.filter((b) => b.status === "대기").toReversed();
  const cancelled = all.filter((b) => b.status === "취소");
  const toCheck = active.filter((b) => b.status === "확정" || b.status === "출석" || b.status === "노쇼");
  const title = cls?.name ?? "회차";
  return (
    <Page
      title={title}
      backTo="/booking"
      sub
      foot={
        <>
          <Btn onClick={() => toggleSlotOpen(slot)}>
            {slot.open ? <Lock size={18} /> : <LockOpen size={18} />} {slot.open ? "회차 닫기" : "다시 열기"}
          </Btn>
          <Btn variant="primary" disabled={past || !slot.open} onClick={() => openBookingForm({ slotId: slot.id })}>
            <Plus size={18} /> 예약 추가
          </Btn>
        </>
      }
    >
      <div class="wide stack bk-detail" style={{ "--gap": "var(--s4)" }}>
        <div class="card stack" style={{ "--gap": "var(--s3)" }}>
          <div class="row between">
            <span class="strong num">{slotTime(slot)}</span>
            <Status tone={info.tone}>{info.label}</Status>
          </div>
          <BarRow label="확정 인원" value={info.taken} max={slot.cap} tail={`${info.taken}/${slot.cap}`} tone={info.left === 0 ? "warn" : "ok"} />
          <div class="row wrap" style={{ "--gap": "6px" }}>
            <Status>{cls?.mins ?? 0}분</Status>
            <Status>{won(cls?.price ?? 0)}</Status>
            {info.waiting ? <Status tone="warn">대기 {info.waiting}명</Status> : null}
            {!slot.open ? <Status>새 예약 안 받음</Status> : null}
            {ended ? <Status>수업 끝남</Status> : past ? <Status tone="run">수업 중</Status> : null}
          </div>
          <div class="row">
            <Btn small class="grow" onClick={() => openSlotEditor(slot)}>
              <Users size={16} /> 정원 {slot.cap}명
            </Btn>
            <Btn small variant="danger" class="grow" onClick={() => deleteSlot(slot, () => back("/booking"))}>
              <Trash2 size={16} /> 회차 지우기
            </Btn>
          </div>
          {active.length ? <p class="cap muted num">지우려면 예약 {active.length}건을 먼저 옮기거나 취소해야 해요.</p> : null}
        </div>

        <section class="section">
          <h2>손님 {active.length}명</h2>
          {active.length ? (
            <div class="list">
              {active.map((b) => {
                const c = customerOf(b);
                return (
                  <button key={b.id} type="button" class="rowitem" aria-current={selectedBookingId() === b.id || undefined} onClick={() => go(`/booking/${b.id}`)}>
                    <span class="glyph num strong">{b.party}</span>
                    <span class="grow">
                      <span class="strong clamp1">{c?.name ?? "손님"}</span>
                      <span class="sm muted num clamp1">
                        끝 {lastFour(c?.phone ?? "")} · {b.source}
                        {b.memo ? ` · ${b.memo}` : ""}
                      </span>
                    </span>
                    {c && c.noShows > 0 ? <Status tone="warn">노쇼 {c.noShows}회</Status> : null}
                    <Status tone={bookingTone(b.status)}>{isLate(b) ? "지각" : b.status}</Status>
                  </button>
                );
              })}
            </div>
          ) : (
            <p class="muted">아직 예약이 없어요.</p>
          )}
        </section>

        {waiting.length ? (
          <section class="section">
            <h2>대기 {waiting.length}명</h2>
            <div class="list">
              {waiting.map((b, i) => {
                const c = customerOf(b);
                return (
                  <button key={b.id} type="button" class="rowitem" onClick={() => go(`/booking/${b.id}`)}>
                    <span class="glyph num strong">{i + 1}</span>
                    <span class="grow">
                      <span class="strong clamp1">{c?.name ?? "손님"}</span>
                      <span class="sm muted num">{b.party}명 · 끝 {lastFour(c?.phone ?? "")}</span>
                    </span>
                    <Status tone="warn">대기</Status>
                  </button>
                );
              })}
            </div>
          </section>
        ) : null}

        <section class="section">
          <h2>출석 체크</h2>
          {!ended ? (
            <div class="card">
              <p class="strong">수업이 끝나면 출석을 체크할 수 있어요</p>
              <p class="sm muted num">종료 예정 {hhmm(slotEnd(slot))}. 끝나고 30분 뒤에 오늘 화면에 출석 체크 카드가 생겨요.</p>
            </div>
          ) : toCheck.length ? (
            <div class="stack" style={{ "--gap": "var(--s3)" }}>
              {toCheck.map((b) => {
                const c = customerOf(b);
                return (
                  <div key={b.id} class="card stack" style={{ "--gap": "var(--s2)" }}>
                    <div class="row between">
                      <span class="strong">
                        {c?.name ?? "손님"} <span class="muted num sm">{b.party}명</span>
                      </span>
                      {b.status === "확정" ? <Status tone="run">체크 전</Status> : null}
                    </div>
                    <CheckButtons b={b} />
                  </div>
                );
              })}
              <p class="cap muted">잘못 눌렀으면 24시간 안에 되돌릴 수 있어요. 노쇼는 손님 기록에만 쌓이고 손님에게 알리지 않아요.</p>
            </div>
          ) : (
            <p class="muted">체크할 손님이 없어요.</p>
          )}
        </section>

        {cancelled.length ? (
          <section class="section">
            <h2 class="muted">취소된 예약 {cancelled.length}건</h2>
            <div class="list">
              {cancelled.map((b) => (
                <button key={b.id} type="button" class="rowitem muted" onClick={() => go(`/booking/${b.id}`)}>
                  <span class="grow clamp1">
                    {customerOf(b)?.name ?? "손님"} · {b.party}명
                  </span>
                  <Status>취소</Status>
                </button>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </Page>
  );
}

function BookingDetail({ id }: { id: string }) {
  const b = byId(bookings.value, id);
  const raw = route.value.raw;
  useEffect(() => {
    if (!b || !raw.includes("edit=1")) return;
    go(`/booking/${b.id}`, { replace: true });
    if (b.status === "확정") openBookingForm({ bookingId: b.id });
    else toast("확정된 예약만 옮길 수 있어요");
  }, [raw, b?.id]);
  if (!b) {
    return (
      <Page title="예약" backTo="/booking">
        <Empty title="이 예약을 찾지 못했어요" />
      </Page>
    );
  }
  const slot = byId(slots.value, b.slotId);
  const cls = classOf(slot);
  const c = customerOf(b);
  const name = c?.name ?? "손님";
  const ended = slot ? slotEnd(slot) <= Date.now() : false;
  const policy = policyOf(b);
  const refund = b.status === "취소" ? refundFor(b, slot, "손님") : undefined;
  const owner = role.value === "OWNER";
  const waitingHere = slot ? bookings.value.filter((x) => x.slotId === slot.id && x.status === "대기").toReversed() : [];
  const firstWaiter = waitingHere[0];
  const seat = slot ? seatInfo(slot) : undefined;

  const foot =
    b.status === "확정" ? (
      <>
        <Btn variant="danger" onClick={() => openCancel(b, slot)}>
          취소
        </Btn>
        <Btn variant="primary" onClick={() => openBookingForm({ bookingId: b.id })}>
          변경
        </Btn>
      </>
    ) : b.status === "예약금 대기" ? (
      <>
        <Btn variant="danger" onClick={() => openCancel(b, slot)}>
          취소
        </Btn>
        <Btn variant="primary" onClick={() => confirmDeposit(b)}>
          <Check size={18} /> 입금 확인
        </Btn>
      </>
    ) : b.status === "대기" && slot ? (
      <Btn variant="primary" disabled={!seat || seat.left < b.party} onClick={() => openPromote(b, slot)}>
        빈자리에 올리기
      </Btn>
    ) : canUndoCheck(b) ? (
      <Btn onClick={() => undoCheck(b.id)}>
        <Undo2 size={18} /> 확정으로 되돌리기
      </Btn>
    ) : undefined;

  return (
    <Page title={name} backTo="/booking" sub foot={foot}>
      <div class="wide stack bk-detail" style={{ "--gap": "var(--s4)" }}>
        <div class="row wrap" style={{ "--gap": "6px" }}>
          <Status tone={bookingTone(b.status)}>{isLate(b) ? "출석 · 지각" : b.status}</Status>
          <button type="button" class="bk-pill" onClick={() => openPolicySheet(b)} aria-label={`규정 v${b.policyVersion} 보기`}>
            <Status tone="run">규정 v{b.policyVersion}</Status>
          </button>
          <Status>{b.source}{b.naverNo ? ` ${b.naverNo}` : ""}</Status>
          {c && c.noShows > 0 ? <Status tone="warn">노쇼 {c.noShows}회</Status> : null}
        </div>

        {slot ? (
          <button type="button" class="card tap row" onClick={() => go(`/booking/slot/${slot.id}`)}>
            <span class="glyph num strong">{hhmm(slot.start).slice(0, 2)}</span>
            <span class="grow">
              <span class="strong clamp1">{cls?.name ?? "클래스"}</span>
              <span class="sm muted num">
                {slotTime(slot)} · 확정 {seat?.taken}/{slot.cap}
              </span>
            </span>
            <ChevronRight size={20} />
          </button>
        ) : (
          <div class="card alert">회차가 지워졌어요. 다른 회차로 옮겨 주세요.</div>
        )}

        <dl class="kv bk-kv">
          <dt>인원</dt>
          <dd class="num">{b.party}명</dd>
          <dt>연락처</dt>
          <dd class="num">{owner ? c?.phone ?? "" : maskPhone(c?.phone ?? "")}</dd>
          <dt>금액</dt>
          <dd class="num">{won((cls?.price ?? 0) * b.party)}</dd>
          <dt>예약금</dt>
          <dd class="num">{policy.deposit.use ? (b.depositPaid ? `${won(policy.deposit.amount)} 입금 완료` : `${won(policy.deposit.amount)} 입금 기다리는 중`) : "안 받아요"}</dd>
          <dt>메모</dt>
          <dd>{b.memo || "없음"}</dd>
          {b.inquiryId ? (
            <>
              <dt>연결된 문의</dt>
              <dd>
                <NavLink to={`/inbox/${b.inquiryId}`} class="bk-link">
                  <Link2 size={14} /> 문의 보기
                </NavLink>
              </dd>
            </>
          ) : null}
          {b.checkedAt ? (
            <>
              <dt>출석 기록</dt>
              <dd class="num">
                {dateLabel(b.checkedAt)} {hhmm(b.checkedAt)}
              </dd>
            </>
          ) : null}
        </dl>

        {b.status === "예약금 대기" ? (
          <div class="card stack" style={{ "--gap": "var(--s2)" }}>
            <span class="strong">예약금 {won(policy.deposit.amount)}을 기다리고 있어요</span>
            <span class="sm muted">입금을 확인하면 확정으로 바뀌어요. 잘못 눌렀으면 바로 되돌릴 수 있어요. 기한이 지나면 {policy.deposit.overdue} 규정을 따라요.</span>
          </div>
        ) : null}

        {b.status === "대기" && slot && seat ? (
          <div class="card stack" style={{ "--gap": "var(--s2)" }}>
            <span class="strong">대기 {waitingHere.findIndex((x) => x.id === b.id) + 1}번</span>
            <span class="sm muted num">{seat.left >= b.party ? `남은 자리 ${seat.left}명이라 올릴 수 있어요.` : `남은 자리 ${seat.left}명이에요. 자리가 나면 순서대로 안내해요.`}</span>
          </div>
        ) : null}

        {b.status === "확정" && slot ? (
          <section class="section">
            <h2>출석 체크</h2>
            {ended ? (
              <div class="card stack" style={{ "--gap": "var(--s2)" }}>
                <CheckButtons b={b} />
                <span class="cap muted">24시간 안에 되돌릴 수 있어요.</span>
              </div>
            ) : (
              <p class="sm muted num">수업이 {hhmm(slotEnd(slot))}에 끝나면 체크할 수 있어요.</p>
            )}
          </section>
        ) : null}

        {b.status === "출석" || b.status === "노쇼" ? (
          <div class="card">
            <CheckButtons b={b} />
          </div>
        ) : null}

        {b.status === "취소" && refund ? (
          <div class="card stack" style={{ "--gap": "var(--s2)" }}>
            <span class="strong">취소된 예약이에요</span>
            {refund.paid > 0 ? (
              <>
                <dl class="kv">
                  <dt>결제액</dt>
                  <dd class="num">{won(refund.paid)}</dd>
                  <dt>환불 예정</dt>
                  <dd class="num">{won(refund.amount)}</dd>
                  <dt>적용 구간</dt>
                  <dd>{refund.band}</dd>
                </dl>
                {refund.amount > 0 ? (
                  owner ? (
                    <Switch
                      label="환불함"
                      hint="계좌이체로 돌려드린 뒤 체크해요"
                      on={Boolean(b.refunded)}
                      onChange={(v) => {
                        patch(bookings, b.id, { refunded: v });
                        log({ actorKind: actorKind(), actor: actorName(), action: v ? "환불 처리함" : "환불 체크를 해제", target: name, targetType: "예약", result: "완료" });
                      }}
                    />
                  ) : (
                    <span class="sm muted">{b.refunded ? "사장님이 환불을 끝냈어요." : "환불은 사장님이 처리해요."}</span>
                  )
                ) : null}
              </>
            ) : (
              <span class="sm muted">결제된 금액이 없어서 환불할 것도 없어요.</span>
            )}
            {firstWaiter && slot && seat && seat.left > 0 ? (
              <div class="row between wrap" style={{ "--gap": "var(--s2)" }}>
                <span class="sm num">대기 손님 {waitingHere.length}명이 있어요.</span>
                <Btn small variant="outline" onClick={() => { notifyWaiter(firstWaiter, slot); toast(`${customerOf(firstWaiter)?.name ?? "손님"}님께 자리 안내 초안을 만들었어요`); }}>
                  첫 대기 손님에게 자리 안내
                </Btn>
              </div>
            ) : null}
          </div>
        ) : null}

        {b.status === "대기" ? <p class="cap muted">대기 손님은 자리가 나면 올려요. 다른 상태로 바로 바꾸는 길은 없어요.</p> : null}
        {role.value === "STAFF" && (b.status === "확정" || b.status === "예약금 대기") ? <p class="cap muted">환불이 걸린 취소는 사장님만 할 수 있어요.</p> : null}
      </div>
    </Page>
  );
}

interface ImportRow {
  no: string;
  start: number;
  product: string;
  name: string;
  phone: string;
  party: number;
  naverStatus: "확정" | "취소";
}

type RowKind = "추가" | "변경" | "건너뜀" | "오류";

interface Analyzed {
  row: ImportRow;
  kind: RowKind;
  note: string;
  slot?: Slot;
  existing?: Booking;
  changes?: Partial<Booking>;
}

const sampleRows = (): ImportRow[] => [
  { no: "N-20482", start: at(0, 11), product: "물레 원데이 클래스", name: "이서연", phone: "010-3456-7892", party: 2, naverStatus: "확정" },
  { no: "N-20519", start: at(1, 11), product: "물레 원데이 클래스", name: "한지우", phone: "010-2233-4455", party: 2, naverStatus: "확정" },
  { no: "N-20601", start: at(4, 14), product: "핸드빌딩 머그컵", name: "문가영", phone: "010-9988-7766", party: 2, naverStatus: "확정" },
  { no: "N-20602", start: at(7, 14), product: "물레 원데이 클래스", name: "류하진", phone: "010-5544-3322", party: 1, naverStatus: "확정" },
  { no: "N-20603", start: at(5, 11), product: "물레 원데이 클래스", name: "배수진", phone: "010-1212-3434", party: 2, naverStatus: "취소" },
  { no: "N-20604", start: at(3, 9), product: "커플 물레", name: "고은별", phone: "010-77", party: 2, naverStatus: "확정" },
];

const bigrams = (s: string) => {
  const t = s.replace(/\s+/g, "");
  const out = new Set<string>();
  for (let i = 0; i < t.length - 1; i++) out.add(t.slice(i, i + 2));
  return out;
};

function suggestClass(product: string): string | undefined {
  const a = bigrams(product);
  let best: { id: string; score: number } | undefined;
  for (const c of classes.value) {
    let score = 0;
    for (const g of bigrams(c.name)) if (a.has(g)) score += 1;
    if (score > 0 && (!best || score > best.score)) best = { id: c.id, score };
  }
  return best?.id;
}

function analyze(rows: ImportRow[], pairing: Record<string, string | undefined>): Analyzed[] {
  const seatDelta = new Map<string, number>();
  return rows.map((row) => {
    if (row.naverStatus === "취소") return { row, kind: "건너뜀", note: "네이버에서 취소된 예약" };
    if (!validPhone(row.phone)) return { row, kind: "오류", note: "연락처 형식이 맞지 않아요" };
    const classId = pairing[row.product];
    if (!classId) return { row, kind: "오류", note: "짝이 되는 클래스를 골라 주세요" };
    const slot = slots.value.find((s) => s.classId === classId && s.start === row.start);
    if (!slot) return { row, kind: "오류", note: "그 시간에 회차가 없어요. 회차를 먼저 만들어 주세요" };
    const existing = bookings.value.find((b) => b.naverNo === row.no);
    const taken = seatInfo(slot).taken + (seatDelta.get(slot.id) ?? 0);
    if (existing) {
      const changes: Partial<Booking> = {};
      if (existing.party !== row.party) changes.party = row.party;
      if (existing.slotId !== slot.id) changes.slotId = slot.id;
      if (!Object.keys(changes).length) return { row, kind: "건너뜀", note: "바뀐 값 없음", slot, existing };
      const own = existing.slotId === slot.id && holdsSeat(existing.status) ? existing.party : 0;
      if (taken - own + row.party > slot.cap) return { row, kind: "오류", note: `정원을 넘어요. 확정 ${taken}/${slot.cap}`, slot, existing };
      seatDelta.set(slot.id, (seatDelta.get(slot.id) ?? 0) + row.party - own);
      return { row, kind: "변경", note: changes.party ? `인원 ${existing.party}명 → ${row.party}명` : "회차 변경", slot, existing, changes };
    }
    if (taken + row.party > slot.cap) return { row, kind: "오류", note: `정원을 넘어요. 확정 ${taken}/${slot.cap}`, slot };
    seatDelta.set(slot.id, (seatDelta.get(slot.id) ?? 0) + row.party);
    return { row, kind: "추가", note: "새 예약으로 들어가요", slot };
  });
}

const kindTone = (k: RowKind): Tone => (k === "추가" ? "ok" : k === "변경" ? "run" : k === "오류" ? "err" : "muted");

interface ImportSummary {
  added: number;
  changed: number;
  skipped: number;
  errors: number;
}

function Tile({ label, n, tone }: { label: string; n: number; tone?: "ok" | "run" | "err" }) {
  return (
    <div class={`bk-tile ${tone ?? ""}`}>
      <span class="cap">{label}</span>
      <span class="bk-tile-n num">{n}</span>
    </div>
  );
}

function openClassPicker(product: string, current: string | undefined, onPick: (id: string | undefined) => void) {
  openSheet(`“${product}” 짝 고르기`, (close) => (
    <div class="list">
      {classes.value.map((c) => (
        <button
          key={c.id}
          type="button"
          class="rowitem"
          aria-current={c.id === current || undefined}
          onClick={() => {
            onPick(c.id);
            close();
          }}
        >
          <span class="grow">
            <span class="strong clamp1">{c.name}</span>
            <span class="sm muted num">
              {c.mins}분 · 정원 {c.cap}명
            </span>
          </span>
          {c.id === current ? <Check size={20} /> : null}
        </button>
      ))}
      <button
        type="button"
        class="rowitem"
        onClick={() => {
          onPick(undefined);
          close();
        }}
      >
        <span class="grow muted">짝 없음 · 이 상품은 건너뛰어요</span>
      </button>
    </div>
  ));
}

function ImportScreen() {
  const [file, setFile] = useState<{ name: string; rows: ImportRow[] } | null>(null);
  const [pairing, setPairing] = useState<Record<string, string | undefined>>({});
  const [result, setResult] = useState<ImportSummary | null>(null);
  const analyzed = file ? analyze(file.rows, pairing) : [];
  const counts: ImportSummary = {
    added: analyzed.filter((a) => a.kind === "추가").length,
    changed: analyzed.filter((a) => a.kind === "변경").length,
    skipped: analyzed.filter((a) => a.kind === "건너뜀").length,
    errors: analyzed.filter((a) => a.kind === "오류").length,
  };
  const products = file ? [...new Set(file.rows.map((r) => r.product))] : [];

  const load = (name: string) => {
    const rows = sampleRows();
    setFile({ name, rows });
    setPairing(Object.fromEntries([...new Set(rows.map((r) => r.product))].map((p) => [p, suggestClass(p)])));
    setResult(null);
  };

  const cancel = () => {
    setFile(null);
    setResult(null);
    toast("가져오기를 취소했어요. 장부는 그대로예요");
  };

  const run = () => {
    if (!file) return;
    let added = 0;
    let changed = 0;
    for (const a of analyzed) {
      if (a.kind === "추가" && a.slot) {
        const cust = ensureCustomer(a.row.name, a.row.phone);
        addBooking({ slotId: a.slot.id, customerId: cust.id, party: a.row.party, status: "확정", depositPaid: true, source: "네이버 엑셀", policyVersion: currentPolicy.value.version, memo: "", naverNo: a.row.no });
        added += 1;
      } else if (a.kind === "변경" && a.existing && a.changes) {
        patch(bookings, a.existing.id, a.changes);
        changed += 1;
      }
    }
    const summary = { added, changed, skipped: counts.skipped, errors: counts.errors };
    log({ actorKind: actorKind(), actor: actorName(), action: `네이버 예약 엑셀 가져오기 · 새로 추가 ${added}, 변경 ${changed}`, target: file.name, targetType: "예약", result: summary.errors ? "부분 완료" : "완료" });
    setResult(summary);
    toast(added || changed ? `장부를 맞췄어요. 새로 추가 ${added}건, 변경 ${changed}건` : "새로 넣을 예약이 없었어요");
  };

  return (
    <Page
      title="네이버 예약 가져오기"
      backTo="/booking"
      sub
      foot={
        file ? (
          <>
            <Btn onClick={cancel}>취소</Btn>
            <Btn variant="primary" disabled={counts.added + counts.changed === 0 && result !== null} onClick={run}>
              가져오기 {counts.added + counts.changed}건
            </Btn>
          </>
        ) : undefined
      }
    >
      <div class="wide stack bk-detail" style={{ "--gap": "var(--s4)" }}>
        {!file ? (
          <>
            <label class="card bk-file">
              <input
                type="file"
                accept=".xlsx,.csv"
                class="vh"
                onChange={(e) => {
                  const f = e.currentTarget.files?.[0];
                  if (!f) return;
                  if (f.size > 5 * 1024 * 1024) {
                    toast("5MB까지 올릴 수 있어요");
                    return;
                  }
                  load(f.name);
                }}
              />
              <span class="glyph">
                <FileUp size={22} />
              </span>
              <span class="strong">네이버 예약 관리자에서 내려받은 엑셀을 올려요</span>
              <span class="sm muted">.xlsx, .csv · 5MB까지 · 한 번에 1,000행까지</span>
            </label>
            <Btn variant="outline" onClick={() => load("naver-booking-sample.xlsx")}>
              예시 파일로 해 보기
            </Btn>
            <p class="cap muted">네이버 예약은 공개 API가 없어서 사장님이 내려받은 파일로 장부를 맞춰요. 미리 보기에서 가져오기를 누르기 전에는 장부가 바뀌지 않아요.</p>
          </>
        ) : (
          <>
            <div class="row between">
              <span class="strong clamp1">{file.name}</span>
              <span class="sm muted num">{file.rows.length}행 읽음</span>
            </div>
            <div class="bk-counts">
              <Tile label="새로 추가" n={counts.added} tone="ok" />
              <Tile label="변경" n={counts.changed} tone="run" />
              <Tile label="건너뜀" n={counts.skipped} />
              <Tile label="오류" n={counts.errors} tone="err" />
            </div>
            {result ? (
              <div class="card bk-done stack" style={{ "--gap": "var(--s1)" }}>
                <span class="strong">장부를 맞췄어요</span>
                <span class="sm num">
                  새로 추가 {result.added}건 · 변경 {result.changed}건 · 건너뜀 {result.skipped}건 · 오류 {result.errors}건
                </span>
                <span class="cap muted">같은 파일을 다시 가져오면 새로 추가 0건으로 나와요. 네이버 예약번호로 구별해요.</span>
              </div>
            ) : null}
            <section class="section">
              <h2>클래스 짝 맞추기</h2>
              <div class="list">
                {products.map((p) => {
                  const cls = byId(classes.value, pairing[p]);
                  return (
                    <button key={p} type="button" class="rowitem" onClick={() => openClassPicker(p, pairing[p], (id) => setPairing({ ...pairing, [p]: id }))}>
                      <span class="grow">
                        <span class="strong clamp1">{p}</span>
                        <span class="sm muted">파일의 상품명</span>
                      </span>
                      <ArrowRight size={18} class="muted" />
                      <span class={cls ? "strong" : "muted"}>{cls?.name ?? "고르기"}</span>
                    </button>
                  );
                })}
              </div>
              <p class="cap muted">이름이 비슷한 클래스를 짝으로 제안했어요. 눌러서 바꿀 수 있어요.</p>
            </section>
            <section class="section">
              <h2>미리 보기</h2>
              <div class="list">
                {analyzed.map((a) => (
                  <div key={a.row.no} class="rowitem">
                    <span class="bk-time num">
                      <span class="strong">{dateLabel(a.row.start).replace(/ \(.+\)/, "")}</span>
                      <span class="cap muted">{hhmm(a.row.start)}</span>
                    </span>
                    <span class="grow">
                      <span class="strong clamp1">
                        {a.row.name} <span class="muted num sm">{a.row.party}명</span>
                      </span>
                      <span class="sm muted clamp1">
                        {a.row.no} · {a.note}
                      </span>
                    </span>
                    <Status tone={kindTone(a.kind)}>{a.kind}</Status>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}
      </div>
    </Page>
  );
}

const pickups = ["현장 수령", "소성 후 픽업·택배"] as const;

const futureBookingCount = (classId: string) => {
  const now = Date.now();
  const ids = new Set(slots.value.filter((s) => s.classId === classId && s.start > now).map((s) => s.id));
  return bookings.value.filter((b) => ids.has(b.slotId) && b.status !== "취소").length;
};

function ClassForm({ item, close }: { item?: ClassItem; close: () => void }) {
  const [name, setName] = useState(item?.name ?? "");
  const [mins, setMins] = useState(String(item?.mins ?? 90));
  const [cap, setCap] = useState(item?.cap ?? 6);
  const [price, setPrice] = useState(String(item?.price ?? 40000));
  const [pickup, setPickup] = useState<ClassItem["pickup"]>(item?.pickup ?? "현장 수령");
  const [fireDays, setFireDays] = useState(item?.fireDays ? String(item.fireDays) : "");
  const [note, setNote] = useState(item?.note ?? "");
  const [onSale, setOnSale] = useState(item?.onSale ?? true);
  const [tried, setTried] = useState(false);
  const minsN = Number(mins);
  const priceN = Number(price);
  const fireN = Number(fireDays);
  const firing = pickup === "소성 후 픽업·택배";
  const nameErr = !name.trim() && "이름을 적어 주세요";
  const minsErr = (!Number.isInteger(minsN) || minsN < 30 || minsN > 480) && "30~480분 사이로 적어 주세요";
  const capErr = (cap < 1 || cap > 50) && "정원은 1~50명이에요";
  const priceErr = (!Number.isFinite(priceN) || priceN <= 0) && "가격을 적어 주세요";
  const fireErr = firing && (!Number.isInteger(fireN) || fireN < 1) && "소성 기간을 일 단위로 적어 주세요";
  const ok = !nameErr && !minsErr && !capErr && !priceErr && !fireErr;
  const future = item ? futureBookingCount(item.id) : 0;

  const save = () => {
    setTried(true);
    if (!ok) return;
    const row: ClassItem = { id: item?.id ?? newId("c"), name: name.trim(), mins: minsN, cap, price: priceN, pickup, fireDays: firing ? fireN : undefined, note: note.trim(), onSale };
    if (item) patch(classes, item.id, row);
    else classes.value = [...classes.value, row];
    log({ actorKind: actorKind(), actor: actorName(), action: item ? "클래스를 고침" : "클래스를 만듦", target: row.name, targetType: "예약", result: "완료" });
    toast(item ? "클래스를 고쳤어요" : "클래스를 만들었어요");
    close();
  };

  const stopSale = () => {
    if (!item) return;
    patch(classes, item.id, { onSale: false });
    log({ actorKind: actorKind(), actor: actorName(), action: "클래스 판매 중지", target: item.name, targetType: "예약", result: "완료" });
    toast("판매를 중지했어요. 기존 예약은 그대로 둬요");
    close();
  };

  const remove = () => {
    if (!item || future > 0) return;
    const used = new Set(bookings.value.map((b) => b.slotId));
    slots.value = slots.value.filter((s) => s.classId !== item.id || used.has(s.id));
    classes.value = classes.value.filter((c) => c.id !== item.id);
    log({ actorKind: actorKind(), actor: actorName(), action: "클래스를 지움", target: item.name, targetType: "예약", result: "완료" });
    toast("클래스를 지웠어요");
    close();
  };

  return (
    <div class="stack bk-sheet" style={{ "--gap": "var(--s4)" }}>
      <Field label="클래스 이름" error={tried && nameErr}>
        <TextInput value={name} onValue={setName} placeholder="원데이 물레 체험" />
      </Field>
      <div class="bk-two">
        <Field label="소요 시간(분)" error={(tried || mins !== String(item?.mins ?? 90)) && minsErr}>
          <TextInput value={mins} onValue={setMins} inputMode="numeric" />
        </Field>
        <Field label="가격(원)" error={(tried || price !== String(item?.price ?? 40000)) && priceErr}>
          <TextInput value={price} onValue={setPrice} inputMode="numeric" />
        </Field>
      </div>
      <div class="field">
        <span class="field-label">정원</span>
        <Stepper label="정원" value={cap} min={1} max={50} onChange={setCap} />
        {capErr ? <span class="error-text" role="alert">{capErr}</span> : <span class="help-text">1~50명 사이로 정해요. 회차를 만들 때 기본값이 돼요.</span>}
      </div>
      <div class="field">
        <span class="field-label">수령 방식</span>
        <Segmented label="수령 방식" options={pickups} value={pickup} onChange={setPickup} />
      </div>
      {firing ? (
        <Field label="소성 기간(일)" error={(tried || fireDays !== "") && fireErr} hint="배송 화면이 수령 예정일을 계산할 때 써요">
          <TextInput value={fireDays} onValue={setFireDays} inputMode="numeric" placeholder="21" />
        </Field>
      ) : null}
      <Field label="안내 문구">
        <TextArea value={note} onValue={setNote} placeholder="준비물, 주차, 동반 기준 같은 안내" />
      </Field>
      <Switch label="판매 중" hint="끄면 새 회차를 만들 수 없고 기존 예약은 그대로 둬요" on={onSale} onChange={setOnSale} />
      <Btn variant="primary" disabled={tried && !ok} onClick={save}>
        {item ? "저장" : "클래스 만들기"}
      </Btn>
      {item ? (
        future > 0 ? (
          <div class="card bk-note stack" style={{ "--gap": "var(--s2)" }}>
            <span class="strong num">미래 예약 {future}건이 있어서 지울 수 없어요</span>
            <span class="sm muted">대신 판매를 중지하면 새 회차만 막고 예약은 그대로 둬요.</span>
            {item.onSale ? (
              <Btn variant="outline" onClick={stopSale}>
                판매 중지
              </Btn>
            ) : null}
          </div>
        ) : (
          <Btn variant="danger" onClick={remove}>
            <Trash2 size={18} /> 클래스 지우기
          </Btn>
        )
      ) : null}
    </div>
  );
}

function openClassEditor(item?: ClassItem) {
  openSheet(item ? "클래스 고치기" : "새 클래스", (close) => <ClassForm item={item} close={close} />);
}

function SlotForm({ close }: { close: () => void }) {
  const sellable = classes.value.filter((c) => c.onSale);
  const [classId, setClassId] = useState(sellable[0]?.id);
  const cls = byId(classes.value, classId);
  const [date, setDate] = useState(() => {
    const base = Math.max(day.value, startOfToday());
    return dayKey(base + 11 * 60 * MIN < Date.now() ? base + DAY : base);
  });
  const [time, setTime] = useState("11:00");
  const [cap, setCap] = useState(cls?.cap ?? 6);
  const [repeat, setRepeat] = useState(false);
  const [weeks, setWeeks] = useState(4);
  const first = /^\d{4}-\d{2}-\d{2}$/.test(date) && /^\d{2}:\d{2}$/.test(time) ? new Date(`${date}T${time}:00+09:00`).getTime() : NaN;
  const starts = Number.isFinite(first) ? Array.from({ length: repeat ? weeks : 1 }, (_, i) => first + i * 7 * DAY) : [];
  const mins = cls?.mins ?? 120;
  const past = starts.length > 0 && starts[0]! < Date.now();
  const overlaps = starts.reduce((n, st) => n + slots.value.filter((s) => s.start < st + mins * MIN && st < slotEnd(s)).length, 0);
  const ok = Boolean(cls) && starts.length > 0 && !past && cap >= 1 && cap <= 50;

  const pickClass = (names: string[]) => {
    const picked = sellable.find((c) => c.name === names[names.length - 1]);
    if (!picked) return;
    setClassId(picked.id);
    setCap(picked.cap);
  };

  const save = () => {
    if (!ok || !cls) return;
    const rows: Slot[] = starts.map((st) => ({ id: newId("s"), classId: cls.id, start: st, cap, open: true }));
    slots.value = [...slots.value, ...rows];
    day.value = startOfDay(rows[0]!.start);
    log({ actorKind: actorKind(), actor: actorName(), action: rows.length > 1 ? `회차 ${rows.length}개를 만듦` : "회차를 만듦", target: `${cls.name} · ${slotTime(rows[0]!)}`, targetType: "예약", result: "완료" });
    toast(rows.length > 1 ? `회차 ${rows.length}개를 매주 같은 시간에 만들었어요` : "회차를 만들었어요");
    close();
  };

  if (!sellable.length) return <p class="muted">판매 중인 클래스가 없어요. 클래스를 먼저 만들거나 판매를 다시 열어 주세요.</p>;

  return (
    <div class="stack bk-sheet" style={{ "--gap": "var(--s4)" }}>
      <div class="field">
        <span class="field-label">클래스</span>
        <Chips label="클래스" options={sellable.map((c) => c.name)} value={cls ? [cls.name] : []} onChange={pickClass} />
        <span class="help-text">판매 중지된 클래스는 새 회차를 만들 수 없어요.</span>
      </div>
      <div class="bk-two">
        <label class="field">
          <span class="field-label">날짜</span>
          <input class="input" type="date" value={date} min={dayKey(Date.now())} onInput={(e) => setDate(e.currentTarget.value)} />
        </label>
        <label class="field">
          <span class="field-label">시간</span>
          <input class="input" type="time" value={time} step={1800} onInput={(e) => setTime(e.currentTarget.value)} />
        </label>
      </div>
      {past ? <span class="error-text" role="alert">지나간 시간에는 회차를 만들 수 없어요</span> : null}
      <div class="field">
        <span class="field-label">정원</span>
        <Stepper label="정원" value={cap} min={1} max={50} onChange={setCap} />
        <span class="help-text num">클래스 기본 정원은 {cls?.cap ?? 0}명이에요.</span>
      </div>
      <Switch label="매주 같은 요일에 반복" hint="최대 12주까지 한 번에 만들어요" on={repeat} onChange={setRepeat} />
      {repeat ? (
        <div class="field">
          <span class="field-label">반복 주 수</span>
          <Stepper label="반복 주 수" value={weeks} min={2} max={12} onChange={setWeeks} />
          {starts.length ? (
            <span class="help-text num">
              {dateLabel(starts[0]!)}부터 {dateLabel(starts[starts.length - 1]!)}까지 {starts.length}개
            </span>
          ) : null}
        </div>
      ) : null}
      {overlaps > 0 ? (
        <div class="card bk-note stack" style={{ "--gap": "var(--s1)" }}>
          <span class="strong num">같은 시간에 다른 회차 {overlaps}개가 있어요</span>
          <span class="sm muted">작업대가 여럿이라면 그대로 저장해도 괜찮아요.</span>
        </div>
      ) : null}
      <Btn variant="primary" disabled={!ok} onClick={save}>
        {starts.length > 1 ? `회차 ${starts.length}개 만들기` : "회차 만들기"}
      </Btn>
    </div>
  );
}

function openSlotCreator() {
  openSheet("회차 만들기", (close) => <SlotForm close={close} />);
}

function ClassesScreen() {
  const list = classes.value;
  const now = Date.now();
  const upcoming = slots.value.filter((s) => s.start >= now).toSorted((a, b) => a.start - b.start);
  let lastDay = "";
  return (
    <Page
      title="클래스·회차"
      backTo="/booking"
      sub
      right={
        <IconBtn label="새 클래스" onClick={() => openClassEditor()}>
          <Plus size={22} />
        </IconBtn>
      }
      foot={
        <Btn variant="primary" onClick={openSlotCreator}>
          <CalendarPlus size={18} /> 회차 만들기
        </Btn>
      }
    >
      <div class="wide stack bk-detail" style={{ "--gap": "var(--s4)" }}>
        <section class="section">
          <h2>클래스 {list.length}개</h2>
          <div class="stack" style={{ "--gap": "var(--s2)" }}>
            {list.map((c) => {
              const next = slots.value.filter((s) => s.classId === c.id && s.start >= now).length;
              return (
                <button key={c.id} type="button" class="card tap row" onClick={() => openClassEditor(c)}>
                  <span class="grow stack" style={{ "--gap": "2px" }}>
                    <span class="row" style={{ "--gap": "6px" }}>
                      <span class="strong clamp1">{c.name}</span>
                      {!c.onSale ? <Status tone="warn">판매 중지</Status> : null}
                    </span>
                    <span class="sm muted num">
                      {c.mins}분 · 정원 {c.cap}명 · {won(c.price)}
                    </span>
                    <span class="cap muted num">
                      {c.pickup}
                      {c.fireDays ? ` ${c.fireDays}일` : ""} · 다음 회차 {next}개 · 미래 예약 {futureBookingCount(c.id)}건
                    </span>
                  </span>
                  <ChevronRight size={20} />
                </button>
              );
            })}
          </div>
        </section>
        <section class="section">
          <h2>다음 회차 {upcoming.length}개</h2>
          {upcoming.length ? (
            <div class="list">
              {upcoming.map((s) => {
                const key = dayKey(s.start);
                const head = key !== lastDay;
                lastDay = key;
                const info = seatInfo(s);
                const active = bookings.value.filter((b) => b.slotId === s.id && b.status !== "취소").length;
                return (
                  <Fragment key={s.id}>
                    {head ? <p class="bk-pick-day sm strong muted">{dateLabel(s.start)}</p> : null}
                    <div class="rowitem bk-slotrow">
                      <button type="button" class="row grow bk-slotrow-main" onClick={() => go(`/booking/slot/${s.id}`)}>
                        <span class="bk-time num strong">{hhmm(s.start)}</span>
                        <span class="grow">
                          <span class="clamp1">{classOf(s)?.name ?? "클래스"}</span>
                          <span class="sm muted num">
                            확정 {info.taken}/{s.cap}
                            {info.waiting ? ` · 대기 ${info.waiting}` : ""}
                          </span>
                        </span>
                        <Status tone={info.tone}>{info.label}</Status>
                      </button>
                      <IconBtn label={active ? `예약 ${active}건이 있어 지울 수 없음` : "회차 지우기"} plain class={active ? "muted" : ""} onClick={() => deleteSlot(s)}>
                        <Trash2 size={18} />
                      </IconBtn>
                    </div>
                  </Fragment>
                );
              })}
            </div>
          ) : (
            <Empty title="다음 회차가 없어요" action={<Btn small onClick={openSlotCreator}>회차 만들기</Btn>} />
          )}
          <p class="cap muted">예약이 있는 회차는 예약을 먼저 옮기거나 취소해야 지울 수 있어요. 회차를 닫으려면 회차 상세에서 닫기를 눌러요.</p>
        </section>
      </div>
    </Page>
  );
}

export const screen: ScreenDef = { split: true, Master, Detail };
