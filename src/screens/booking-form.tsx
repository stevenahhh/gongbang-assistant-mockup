import { Fragment } from "preact";
import { useState } from "preact/hooks";
import { Check, ChevronRight } from "lucide-preact";
import { go } from "../router";
import {
  actorKind,
  actorName,
  addBooking,
  addTask,
  bookings,
  byId,
  classOf,
  currentPolicy,
  customers,
  inquiries,
  log,
  newId,
  patch,
  policies,
  role,
  seatsTaken,
  shop,
  slots,
  toast,
  waitingCount,
} from "../store";
import type { Booking, BookingSource, BookingStatus, Customer, Policy, Slot, Tone } from "../types";
import { Btn, Field, Segmented, Status, Stepper, Switch, TextArea, TextInput, openSheet } from "../ui";
import { DAY, HOUR, MIN, dateLabel, dayKey, hhmm, startOfToday, won } from "../lib/time";

export interface BookingPrefill {
  slotId?: string;
  name?: string;
  phone?: string;
  party?: number;
  inquiryId?: string;
  bookingId?: string;
}

const KST = "Asia/Seoul";
const fWeekday = new Intl.DateTimeFormat("ko-KR", { timeZone: KST, weekday: "short" });
const fDayNum = new Intl.DateTimeFormat("en-US", { timeZone: KST, day: "numeric" });
const fMonth = new Intl.DateTimeFormat("ko-KR", { timeZone: KST, month: "long" });

export const startOfDay = (t: number) => new Date(`${dayKey(t)}T00:00:00+09:00`).getTime();
export const weekdayOf = (t: number) => new Date(t + 9 * HOUR).getUTCDay();
export const weekStartOf = (t: number) => startOfDay(t) - ((weekdayOf(t) + 6) % 7) * DAY;
export const weekdayLabel = (t: number) => fWeekday.format(t);
export const dayNum = (t: number) => fDayNum.format(t);
export const monthLabel = (t: number) => fMonth.format(t);

export const digits = (p: string) => p.replace(/\D/g, "");
export const validPhone = (p: string) => /^01\d[- ]?\d{3,4}[- ]?\d{4}$/.test(p.trim());
export const holdsSeat = (s: BookingStatus) => s === "확정" || s === "예약금 대기" || s === "출석" || s === "노쇼";
export const slotEnd = (s: Slot) => s.start + (classOf(s)?.mins ?? 120) * MIN;
export const slotTime = (s: Slot) => `${dateLabel(s.start)} ${hhmm(s.start)}`;
export const policyOf = (b: Booking): Policy => policies.value.find((p) => p.version === b.policyVersion) ?? currentPolicy.value;
export const customerOf = (b: Booking) => byId(customers.value, b.customerId);

export const bookingTone = (s: BookingStatus): Tone =>
  s === "확정" || s === "출석" ? "ok" : s === "예약금 대기" ? "run" : s === "대기" ? "warn" : s === "노쇼" ? "err" : "muted";

export type SeatLabel = "여유" | "마감" | "대기 있음" | "닫힘";

export function seatInfo(s: Slot) {
  const taken = seatsTaken(s.id);
  const waiting = waitingCount(s.id);
  const left = Math.max(0, s.cap - taken);
  const label: SeatLabel = !s.open ? "닫힘" : waiting > 0 ? "대기 있음" : left === 0 ? "마감" : "여유";
  const tone: Tone = label === "여유" ? "ok" : label === "마감" ? "err" : label === "대기 있음" ? "warn" : "muted";
  return { taken, waiting, left, label, tone };
}

export interface Refund {
  paid: number;
  percent: number;
  amount: number;
  band: string;
  fixed?: boolean;
}

export function refundFor(b: Booking, slot: Slot | undefined, who: "손님" | "공방"): Refund {
  const policy = policyOf(b);
  const cls = classOf(slot);
  const paid = !b.depositPaid ? 0 : policy.deposit.use ? policy.deposit.amount : (cls?.price ?? 0) * b.party;
  if (paid === 0) return { paid, percent: 0, amount: 0, band: "아직 결제된 금액이 없어요" };
  if (who === "공방") return { paid, percent: 100, amount: paid, band: `공방 사유 · ${policy.shopFault}` };
  if (shop.value.types.includes("학원 등록") && slot && slot.start > Date.now()) {
    return { paid, percent: 100, amount: paid, band: "학원 등록 공방은 수업 전 취소에 전액 환불해요", fixed: true };
  }
  const daysBefore = slot ? Math.floor((startOfDay(slot.start) - startOfToday()) / DAY) : 0;
  const parsed = policy.bands
    .map((bd) => ({ ...bd, min: /당일/.test(bd.label) ? 0 : Number(bd.label.match(/(\d+)일/)?.[1] ?? 0) }))
    .toSorted((a, b) => b.min - a.min);
  const band = parsed.find((bd) => daysBefore >= bd.min) ?? parsed[parsed.length - 1]!;
  return { paid, percent: band.percent, amount: Math.round((paid * band.percent) / 100), band: `${band.label} · ${band.percent}% 환불` };
}

export function ensureCustomer(name: string, phone: string): Customer {
  const d = digits(phone);
  const found = customers.value.find((c) => digits(c.phone) === d);
  if (found) return found;
  const row: Customer = { id: newId("u"), name, phone, noShows: 0, adOptIn: false };
  customers.value = [...customers.value, row];
  return row;
}

export function queueConfirmTask(b: Booking, name: string) {
  const slot = byId(slots.value, b.slotId);
  const cls = classOf(slot);
  const policy = policyOf(b);
  const when = slot ? slotTime(slot) : "";
  const body =
    b.status === "예약금 대기"
      ? `${name}님, ${cls?.name ?? "클래스"} 예약을 접수했어요. 예약금 ${won(policy.deposit.amount)}을 ${policy.deposit.hours}시간 안에 입금해 주시면 자리를 확정해 드려요. ${when}에 만나요.`
      : `${name}님, ${cls?.name ?? "클래스"} 예약이 확정됐어요. ${when}에 만나요. 금액은 ${won((cls?.price ?? 0) * b.party)}이에요.`;
  return addTask({
    kind: "확정 안내",
    title: `${name}님 예약 확정을 알려요`,
    to: `${name} · 알림톡`,
    runAt: Date.now() + 10 * MIN,
    body,
    evidence: [
      { label: "회차", value: when },
      { label: "인원", value: `${b.party}명` },
      { label: "클래스 가격", value: won(cls?.price ?? 0) },
      { label: "규정", value: `v${b.policyVersion}` },
    ],
    moneyRelated: true,
  });
}

function SlotPicker({ current, onPick }: { current?: string; onPick: (id: string) => void }) {
  const now = Date.now();
  const rows = slots.value.filter((s) => s.open && s.start >= now).toSorted((a, b) => a.start - b.start);
  let lastDay = "";
  if (!rows.length) return <p class="muted">열려 있는 다음 회차가 없어요. 클래스·회차 화면에서 회차를 먼저 만들어 주세요.</p>;
  return (
    <div class="list">
      {rows.map((s) => {
        const key = dayKey(s.start);
        const head = key !== lastDay;
        lastDay = key;
        const info = seatInfo(s);
        return (
          <Fragment key={s.id}>
            {head ? <p class="bk-pick-day sm strong muted">{dateLabel(s.start)}</p> : null}
            <button type="button" class="rowitem" aria-current={s.id === current || undefined} onClick={() => onPick(s.id)}>
              <span class="bk-time num strong">{hhmm(s.start)}</span>
              <span class="grow">
                <span class="clamp1">{classOf(s)?.name ?? "클래스"}</span>
                <span class="sm muted num">
                  확정 {info.taken}/{s.cap}
                  {info.waiting ? ` · 대기 ${info.waiting}` : ""}
                </span>
              </span>
              <Status tone={info.tone}>{info.label}</Status>
              {s.id === current ? <Check size={20} /> : null}
            </button>
          </Fragment>
        );
      })}
    </div>
  );
}

export function openSlotPicker(current: string | undefined, onPick: (id: string) => void) {
  openSheet("회차 고르기", (close) => (
    <SlotPicker
      current={current}
      onPick={(id) => {
        onPick(id);
        close();
      }}
    />
  ));
}

const sources = ["직접", "문의", "플랫폼"] as const satisfies readonly BookingSource[];

function BookingForm({ prefill, close }: { prefill: BookingPrefill; close: () => void }) {
  const editing = prefill.bookingId ? byId(bookings.value, prefill.bookingId) : undefined;
  const editCustomer = editing ? customerOf(editing) : undefined;
  const [slotId, setSlotId] = useState(prefill.slotId ?? editing?.slotId);
  const [name, setName] = useState(prefill.name ?? editCustomer?.name ?? "");
  const [phone, setPhone] = useState(prefill.phone ?? editCustomer?.phone ?? "");
  const [party, setParty] = useState(prefill.party ?? editing?.party ?? 1);
  const [paid, setPaid] = useState(editing?.depositPaid ?? false);
  const [memo, setMemo] = useState(editing?.memo ?? "");
  const [source, setSource] = useState<BookingSource>(prefill.inquiryId ? "문의" : editing?.source ?? "직접");
  const [reason, setReason] = useState("");
  const [askWait, setAskWait] = useState(false);
  const [tried, setTried] = useState(false);

  const slot = byId(slots.value, slotId);
  const cls = classOf(slot);
  const policy = currentPolicy.value;
  const past = slot ? slot.start < Date.now() : false;
  const closed = slot ? !slot.open : false;
  const info = slot ? seatInfo(slot) : undefined;
  const ownSeats = editing && editing.slotId === slotId && holdsSeat(editing.status) ? editing.party : 0;
  const over = slot && info ? info.taken - ownSeats + party > slot.cap : false;
  const phoneOk = validPhone(phone);
  const nameOk = name.trim().length > 0;
  const dup = !editing && slot && phoneOk ? bookings.value.find((b) => b.slotId === slot.id && b.status !== "취소" && digits(customerOf(b)?.phone ?? "") === digits(phone)) : undefined;
  const slotError = !slot ? tried && "회차를 골라 주세요" : past ? "지난 회차에는 예약을 받을 수 없어요" : closed ? "닫힌 회차예요. 회차를 먼저 열어 주세요" : false;
  const ready = Boolean(slot) && !past && !closed && nameOk && phoneOk && party >= 1;

  const saveNew = (asWait: boolean) => {
    setTried(true);
    if (!slot || !cls || !ready) return;
    if (dup) {
      close();
      toast("같은 회차에 이미 예약이 있어요. 기존 예약을 열었어요");
      go(`/booking/${dup.id}`);
      return;
    }
    if (over && !asWait) {
      setAskWait(true);
      return;
    }
    const customer = ensureCustomer(name.trim(), phone.trim());
    const status: BookingStatus = asWait ? "대기" : policy.deposit.use && !paid ? "예약금 대기" : "확정";
    const b = addBooking({ slotId: slot.id, customerId: customer.id, party, status, depositPaid: paid, source, policyVersion: policy.version, memo: memo.trim(), inquiryId: prefill.inquiryId });
    if (prefill.inquiryId) patch(inquiries, prefill.inquiryId, { bookingId: b.id });
    if (status !== "대기") queueConfirmTask(b, customer.name);
    log({ actorKind: actorKind(), actor: actorName(), action: status === "대기" ? "대기 명단에 올림" : "예약을 등록함", target: `${customer.name} · ${slotTime(slot)}`, targetType: "예약", result: "완료" });
    toast(status === "대기" ? "대기 명단에 올렸어요" : status === "예약금 대기" ? "예약을 받았어요. 예약금 안내 초안을 승인함에 두었어요" : "예약을 확정했어요. 확정 안내 초안을 승인함에 두었어요");
    close();
    go(`/booking/${b.id}`);
  };

  const saveChange = () => {
    setTried(true);
    if (!editing || !slot || !cls || !ready) return;
    const fresh = byId(bookings.value, editing.id);
    if (!fresh || fresh.status !== "확정") {
      toast("방금 다른 곳에서 바뀌었어요. 최신 내용으로 다시 볼게요");
      close();
      return;
    }
    if (over) return;
    const before = { slotId: fresh.slotId, party: fresh.party, memo: fresh.memo };
    const who = editCustomer?.name ?? "손님";
    patch(bookings, fresh.id, { slotId: slot.id, party, memo: memo.trim() });
    addTask({
      kind: "변경 안내",
      title: `${who}님 예약 변경을 알려요`,
      to: `${who} · 알림톡`,
      runAt: Date.now() + 10 * MIN,
      body: `${who}님, 예약을 ${slotTime(slot)} ${cls.name} ${party}명으로 바꿨어요.${reason.trim() ? ` 사유: ${reason.trim()}` : ""}`,
      evidence: [
        { label: "새 회차", value: slotTime(slot) },
        { label: "인원", value: `${party}명` },
        { label: "규정", value: `v${fresh.policyVersion} 유지` },
      ],
    });
    log({ actorKind: actorKind(), actor: actorName(), action: "예약을 옮김", target: `${who} · ${slotTime(slot)}`, targetType: "예약", result: "완료" });
    toast("예약을 바꿨어요. 변경 안내 초안을 승인함에 두었어요", () => {
      patch(bookings, fresh.id, before);
      log({ actorKind: actorKind(), actor: actorName(), action: "예약 변경을 되돌림", target: who, targetType: "예약", result: "되돌림" });
    });
    close();
  };

  const slotButton = (
    <button type="button" class="input bk-pick" aria-invalid={slotError ? true : undefined} onClick={() => openSlotPicker(slotId, setSlotId)}>
      {slot ? (
        <span class="grow">
          <span class="strong clamp1">{cls?.name ?? "클래스"}</span>
          <span class="sm muted num">
            {slotTime(slot)} · 확정 {info?.taken}/{slot.cap}
          </span>
        </span>
      ) : (
        <span class="grow muted">회차를 골라 주세요</span>
      )}
      <ChevronRight size={20} />
    </button>
  );

  if (editing) {
    return (
      <div class="stack bk-sheet" style={{ "--gap": "var(--s4)" }}>
        <div class="card sm stack" style={{ "--gap": "var(--s1)" }}>
          <span class="strong">{editCustomer?.name ?? "손님"} · 현재 {editing.party}명</span>
          <span class="muted num">{byId(slots.value, editing.slotId) ? slotTime(byId(slots.value, editing.slotId)!) : "회차 없음"}</span>
          <span class="muted">규정 v{editing.policyVersion}은 그대로 둬요</span>
        </div>
        <div class="field">
          <span class="field-label">새 회차</span>
          {slotButton}
          {slotError ? <span class="error-text" role="alert">{slotError}</span> : null}
          {over && slot ? <span class="error-text" role="alert">새 회차에 자리가 부족해요. 확정 {info?.taken}/{slot.cap}이에요.</span> : null}
        </div>
        <div class="field">
          <span class="field-label">인원</span>
          <Stepper label="인원" value={party} min={1} max={slot?.cap ?? 20} onChange={setParty} />
        </div>
        <Field label="변경 사유 (선택)">
          <TextInput value={reason} onValue={setReason} placeholder="손님 요청, 일정 조정 등" />
        </Field>
        <Field label="메모">
          <TextArea value={memo} onValue={setMemo} placeholder="유아 동반, 알레르기 같은 참고 사항" />
        </Field>
        <Btn variant="primary" disabled={!ready || over || (slot?.id === editing.slotId && party === editing.party && memo.trim() === editing.memo)} onClick={saveChange}>
          변경 저장
        </Btn>
      </div>
    );
  }

  return (
    <div class="stack bk-sheet" style={{ "--gap": "var(--s4)" }}>
      <div class="field">
        <span class="field-label">회차</span>
        {slotButton}
        {slotError ? <span class="error-text" role="alert">{slotError}</span> : null}
        {slot && info && !past && !closed ? <span class="help-text num">남은 자리 {info.left}명{info.waiting ? ` · 대기 ${info.waiting}명` : ""}</span> : null}
      </div>
      <Field label="손님 이름" error={tried && !nameOk && "이름을 적어 주세요"}>
        <TextInput value={name} onValue={setName} placeholder="홍길동" autoComplete="off" />
      </Field>
      <Field label="연락처" error={phone.length > 3 && !phoneOk && "휴대폰 번호 형식으로 써 주세요"}>
        <TextInput value={phone} onValue={setPhone} inputMode="tel" placeholder="010-0000-0000" invalid={phone.length > 3 && !phoneOk} autoComplete="off" />
      </Field>
      {dup ? (
        <div class="card bk-note stack" style={{ "--gap": "var(--s2)" }}>
          <span class="strong">이 번호로 같은 회차 예약이 이미 있어요</span>
          <span class="sm muted">새로 저장하는 대신 기존 예약을 열어 드려요.</span>
        </div>
      ) : null}
      <div class="field">
        <span class="field-label">인원</span>
        <Stepper label="인원" value={party} min={1} max={20} onChange={setParty} />
        {slot && over && !askWait ? <span class="help-text num">정원 {slot.cap}명 중 {info?.taken}명이 확정이라 저장할 때 대기로 받을지 물어요.</span> : null}
      </div>
      {policy.deposit.use ? <Switch label={`예약금 ${won(policy.deposit.amount)} 입금했어요`} hint={paid ? "바로 확정으로 저장해요" : "예약금 대기로 저장하고 입금 안내를 보내요"} on={paid} onChange={setPaid} /> : null}
      <div class="field">
        <span class="field-label">출처</span>
        <Segmented label="출처" options={sources} value={source} onChange={setSource} />
      </div>
      <Field label="메모">
        <TextArea value={memo} onValue={setMemo} placeholder="유아 동반, 알레르기 같은 참고 사항" />
      </Field>
      {askWait && slot ? (
        <div class="card bk-ask stack" role="alertdialog" aria-label="대기 등록 확인">
          <span class="strong">정원을 넘어요. 대기로 받을까요?</span>
          <span class="sm muted num">
            정원 {slot.cap}명 중 {info?.taken}명이 확정이에요. 이 예약은 {party}명이에요.
          </span>
          <div class="row">
            <Btn class="grow" onClick={() => setAskWait(false)}>
              다시 고르기
            </Btn>
            <Btn class="grow" variant="primary" onClick={() => saveNew(true)}>
              대기로 받기
            </Btn>
          </div>
        </div>
      ) : (
        <Btn variant="primary" disabled={tried && !ready} onClick={() => saveNew(false)}>
          {dup ? "기존 예약 열기" : "저장"}
        </Btn>
      )}
    </div>
  );
}

export function openBookingForm(prefill: BookingPrefill = {}) {
  if (role.value === "VIEWER") {
    toast("이 화면은 사장님만 쓸 수 있어요");
    return;
  }
  const editing = prefill.bookingId ? byId(bookings.value, prefill.bookingId) : undefined;
  openSheet(editing ? "예약 변경" : "예약 등록", (close) => <BookingForm prefill={prefill} close={close} />);
}
