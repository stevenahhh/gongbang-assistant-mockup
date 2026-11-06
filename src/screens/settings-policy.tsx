import { computed } from "@preact/signals";
import { useState } from "preact/hooks";
import { Plus, X } from "lucide-preact";
import { actorKind, actorName, bookings, classes, currentPolicy, log, policies, role, shop, toast } from "../store";
import type { Policy, RefundBand } from "../types";
import { Btn, Chips, Field, Help, IconBtn, Page, RelTime, Segmented, Status, Switch, TextInput } from "../ui";
import { won } from "../lib/time";
import { toNumber } from "./settings-shared";

export type PolicyDraft = Pick<Policy, "deposit" | "bands" | "shopFault" | "lateMins" | "noShow">;

export const ACADEMY_REASON = "학원으로 등록한 공방은 수업 시작 전 취소에 전액 환불해야 해요. 그래서 0%는 고를 수 없어요.";
export const isAcademy = (types: string[]) => types.includes("학원으로 등록");

export function cheapestPrice() {
  const prices = classes.value.filter((c) => c.onSale).map((c) => c.price);
  return prices.length ? Math.min(...prices) : Infinity;
}

export function summarize(d: PolicyDraft) {
  const parts = [
    d.deposit.use ? `예약금은 ${won(d.deposit.amount)}이고 예약 후 ${d.deposit.hours}시간 안에 입금해 주세요.` : "예약금은 받지 않아요.",
    `취소하면 ${d.bands.map((b) => `${b.label || "구간"} ${b.percent}%`).join(", ")}를 돌려드려요.`,
  ];
  if (d.lateMins > 0) parts.push(`${d.lateMins}분 이상 늦으면 노쇼로 처리해요.`);
  const ns = d.noShow.trim();
  if (ns) parts.push(/[.!?]$/.test(ns) ? ns : `${ns}.`);
  return parts.join(" ");
}

export function policyErrors(d: PolicyDraft, academy: boolean) {
  const errs: string[] = [];
  const cheapest = cheapestPrice();
  if (d.deposit.use && d.deposit.amount <= 0) errs.push("예약금 금액을 써 주세요.");
  if (d.deposit.use && d.deposit.amount > cheapest) errs.push(`예약금은 가장 저렴한 클래스 가격(${won(cheapest)})보다 클 수 없어요.`);
  if (d.bands.some((b) => !b.label.trim())) errs.push("환불 구간 이름을 써 주세요.");
  if (academy && d.bands.some((b) => b.percent === 0)) errs.push(ACADEMY_REASON);
  return errs;
}

export function describeChanges(prev: PolicyDraft, d: PolicyDraft) {
  const out: string[] = [];
  if (prev.deposit.use !== d.deposit.use) out.push(d.deposit.use ? `예약금 ${won(d.deposit.amount)} 도입` : "예약금 없음");
  else if (d.deposit.use && prev.deposit.amount !== d.deposit.amount) out.push(`예약금 ${won(prev.deposit.amount)}에서 ${won(d.deposit.amount)}으로`);
  if (d.deposit.use && prev.deposit.hours !== d.deposit.hours) out.push(`입금 기한 ${d.deposit.hours}시간`);
  if (d.deposit.use && prev.deposit.overdue !== d.deposit.overdue) out.push(`기한 넘기면 ${d.deposit.overdue}`);
  if (JSON.stringify(prev.bands) !== JSON.stringify(d.bands)) out.push(`환불 구간 ${d.bands.map((b) => `${b.label} ${b.percent}%`).join(", ")}`);
  if (prev.shopFault !== d.shopFault) out.push(`공방 사유 취소는 ${d.shopFault}`);
  if (prev.lateMins !== d.lateMins) out.push(d.lateMins ? `지각 기준 ${d.lateMins}분` : "지각 기준 없음");
  if (prev.noShow.trim() !== d.noShow.trim()) out.push("노쇼 처리 문구 변경");
  return out.join(", ");
}

export function savePolicy(d: PolicyDraft, changes: string) {
  const prev = currentPolicy.value;
  const next: Policy = { ...d, bands: d.bands.map((b) => ({ ...b, label: b.label.trim() })), noShow: d.noShow.trim(), version: prev.version + 1, editor: actorName(), at: Date.now(), changes, bookingCount: 0 };
  policies.value = [...policies.value, next];
  log({ actorKind: actorKind(), actor: actorName(), action: `규정 v${next.version}을 저장함`, target: changes, targetType: "규정", result: "완료" });
  return next;
}

const countByVersion = computed(() => {
  const m = new Map<number, number>();
  for (const b of bookings.value) m.set(b.policyVersion, (m.get(b.policyVersion) ?? 0) + 1);
  return m;
});

const hourOptions = ["6시간", "12시간", "24시간", "48시간"];
const lateOptions = ["없음", "10분", "15분", "20분", "30분"];
const faultOptions = ["전액 환불", "전액 환불과 다음 수업 할인권", "다른 날짜를 먼저 안내"];
const overdueOptions = ["자동 취소", "사장님 확인"] as const;

const clone = (p: Policy): PolicyDraft => ({ deposit: { ...p.deposit }, bands: p.bands.map((b) => ({ ...b })), shopFault: p.shopFault, lateMins: p.lateMins, noShow: p.noShow });
const withOption = (list: string[], v: string) => (list.includes(v) ? list : [...list, v]);

export function PctStepper({ value, min = 0, onChange, label }: { value: number; min?: number; onChange: (v: number) => void; label: string }) {
  return (
    <div class="stepper" role="group" aria-label={label}>
      <IconBtn label={`${label} 줄이기`} disabled={value <= min} onClick={() => onChange(Math.max(min, value - 10))}>
        −
      </IconBtn>
      <output class="num adm-pct">{value}%</output>
      <IconBtn label={`${label} 늘리기`} disabled={value >= 100} onClick={() => onChange(Math.min(100, value + 10))}>
        +
      </IconBtn>
    </div>
  );
}

function History({ current }: { current: number }) {
  const rows = policies.value.toSorted((a, b) => b.version - a.version);
  return (
    <section class="section">
      <h2 class="section-head">변경 이력</h2>
      <div class="stack">
        {rows.map((p) => (
          <article key={p.version} class="card stack" style={{ "--gap": "var(--s2)" }}>
            <div class="row between">
              <span class="strong num">v{p.version}</span>
              {p.version === current ? <Status tone="ok">지금 쓰는 규정</Status> : <Status>이전 규정</Status>}
            </div>
            <p class="sm">{p.changes}</p>
            <p class="cap muted">
              {p.editor} · <RelTime t={p.at} class="cap muted" /> · 이 버전을 쓰는 예약 <span class="num">{countByVersion.value.get(p.version) ?? 0}</span>건
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}

function SummaryCard({ draft }: { draft: PolicyDraft }) {
  return (
    <div class="card stack" style={{ "--gap": "var(--s2)" }}>
      <div class="row between">
        <span class="strong sm">손님에게 보내는 한 줄 요약</span>
        <Status>자동 생성</Status>
      </div>
      <p class="sm">{summarize(draft)}</p>
    </div>
  );
}

function ReadOnly() {
  const p = currentPolicy.value;
  return (
    <Page title="규정" backTo="/settings">
      <div class="wide stack" style={{ "--gap": "var(--s4)" }}>
        <div class="row between">
          <Status tone="ok">v{p.version} 적용 중</Status>
          <span class="cap muted">규정은 사장님만 바꿀 수 있어요</span>
        </div>
        <SummaryCard draft={p} />
        <dl class="kv">
          <dt>예약금</dt>
          <dd class="num">{p.deposit.use ? `${won(p.deposit.amount)} · ${p.deposit.hours}시간 안에 입금 · 기한 넘기면 ${p.deposit.overdue}` : "받지 않아요"}</dd>
          <dt>환불 구간</dt>
          <dd class="num">{p.bands.map((b) => `${b.label} ${b.percent}%`).join(", ")}</dd>
          <dt>공방 사유 취소</dt>
          <dd>{p.shopFault}</dd>
          <dt>지각 기준</dt>
          <dd class="num">{p.lateMins ? `${p.lateMins}분` : "없음"}</dd>
          <dt>노쇼 처리</dt>
          <dd>{p.noShow || "따로 정하지 않았어요"}</dd>
        </dl>
        <History current={p.version} />
      </div>
    </Page>
  );
}

function Editor() {
  const current = currentPolicy.value;
  const [draft, setDraft] = useState<PolicyDraft>(() => clone(current));
  const academy = isAcademy(shop.value.types);
  const errors = policyErrors(draft, academy);
  const changes = describeChanges(current, draft);
  const dirty = changes.length > 0;
  const set = (p: Partial<PolicyDraft>) => setDraft({ ...draft, ...p });
  const setDeposit = (p: Partial<PolicyDraft["deposit"]>) => set({ deposit: { ...draft.deposit, ...p } });
  const setBand = (i: number, p: Partial<RefundBand>) => set({ bands: draft.bands.map((b, j) => (j === i ? { ...b, ...p } : b)) });
  const hourLabel = `${draft.deposit.hours}시간`;
  const lateLabel = draft.lateMins ? `${draft.lateMins}분` : "없음";
  const save = () => {
    const next = savePolicy(draft, changes);
    toast(`규정 v${next.version}을 저장했어요. 새 예약부터 적용해요`);
  };
  return (
    <Page
      title="규정"
      backTo="/settings"
      foot={
        <Btn variant="primary" disabled={!dirty || errors.length > 0} onClick={save}>
          {dirty ? `v${current.version + 1}으로 저장` : "저장"}
        </Btn>
      }
    >
      <div class="wide stack" style={{ "--gap": "var(--s5)" }}>
        <div class="stack" style={{ "--gap": "var(--s3)" }}>
          <div class="row between">
            <Status tone="ok">v{current.version} 적용 중</Status>
            <span class="cap muted">
              {current.editor} · <RelTime t={current.at} class="cap muted" />
            </span>
          </div>
          <SummaryCard draft={draft} />
        </div>

        <section class="stack" style={{ "--gap": "var(--s3)" }}>
          <h2 class="section-head">예약금</h2>
          <Switch label="예약금 받기" on={draft.deposit.use} hint="확정 전에 예약금을 받아 노쇼를 줄여요" onChange={(use) => setDeposit({ use })} />
          {draft.deposit.use ? (
            <>
              <Field label="금액" error={draft.deposit.amount > cheapestPrice() && `가장 저렴한 클래스 가격(${won(cheapestPrice())})보다 클 수 없어요`} hint={won(draft.deposit.amount)}>
                <TextInput value={draft.deposit.amount ? String(draft.deposit.amount) : ""} onValue={(v) => setDeposit({ amount: toNumber(v) })} inputMode="numeric" placeholder="20000" invalid={draft.deposit.amount > cheapestPrice()} />
              </Field>
              <Field label="입금 기한" help="예약한 뒤 이 시간 안에 입금하지 않으면 아래에서 고른 방식으로 처리해요. 자동 취소를 고르면 기한 1시간 전에 손님 안내 초안을 만들어요.">
                <Segmented<string> label="입금 기한" options={withOption(hourOptions, hourLabel)} value={hourLabel} onChange={(v) => setDeposit({ hours: toNumber(v) })} />
              </Field>
              <Field label="기한을 넘기면" hint={draft.deposit.overdue === "자동 취소" ? "기한 1시간 전에 손님 안내 초안을 승인함에 올려요" : "취소하는 대신 오늘 화면에 할 일 카드를 만들어요"}>
                <Segmented label="기한을 넘기면" options={overdueOptions} value={draft.deposit.overdue} onChange={(v) => setDeposit({ overdue: v })} />
              </Field>
            </>
          ) : null}
        </section>

        <section class="stack" style={{ "--gap": "var(--s3)" }}>
          <h2 class="section-head row" style={{ "--gap": "var(--s2)" }}>
            취소·환불
            <Help text="수업까지 남은 기간에 따라 돌려드리는 비율이에요. 저장할 때마다 새 버전이 생겨요. 이미 확정된 예약은 그때의 규정을 그대로 따라요." example="수업 3일 전까지 100%, 1일 전 50%, 당일 0%" />
          </h2>
          {academy ? <p class="sm" style={{ color: "var(--warn)" }}>{ACADEMY_REASON}</p> : null}
          <div class="stack">
            {draft.bands.map((b, i) => (
              <div key={i} class="adm-band">
                <TextInput value={b.label} onValue={(v) => setBand(i, { label: v })} aria-label={`${i + 1}번째 구간 이름`} placeholder="예: 수업 3일 전까지" invalid={!b.label.trim()} />
                <div class="row" style={{ "--gap": "var(--s2)" }}>
                  <PctStepper value={b.percent} min={academy ? 10 : 0} onChange={(v) => setBand(i, { percent: v })} label={b.label || `${i + 1}번째 구간`} />
                  {draft.bands.length > 1 ? (
                    <IconBtn label="구간 지우기" plain onClick={() => set({ bands: draft.bands.filter((_, j) => j !== i) })}>
                      <X size={18} />
                    </IconBtn>
                  ) : null}
                </div>
                {academy && b.percent === 0 ? <span class="error-text" role="alert">0%는 고를 수 없어요. 늘리기를 눌러 10% 이상으로 바꿔 주세요.</span> : null}
              </div>
            ))}
            {draft.bands.length < 5 ? (
              <Btn small variant="outline" onClick={() => set({ bands: [...draft.bands, { label: "", percent: 50 }] })}>
                <Plus size={16} /> 구간 추가
              </Btn>
            ) : null}
          </div>
          <div class="field">
            <span class="field-label">공방 사유로 취소하면</span>
            <Chips<string> label="공방 사유 취소" options={withOption(faultOptions, draft.shopFault)} value={[draft.shopFault]} onChange={(v) => v.length && set({ shopFault: v[v.length - 1]! })} />
          </div>
        </section>

        <section class="stack" style={{ "--gap": "var(--s3)" }}>
          <h2 class="section-head">지각·노쇼</h2>
          <Field label="몇 분 늦으면 노쇼로 볼까요" help="이 기준은 예약 확정 안내에 함께 들어가요. 미리 알리지 않은 기준은 노쇼 처리에 쓰지 않아요.">
            <Segmented<string> label="지각 기준" options={withOption(lateOptions, lateLabel)} value={lateLabel} onChange={(v) => set({ lateMins: toNumber(v) })} />
          </Field>
          <Field label="노쇼 처리" hint="손님 안내에 그대로 들어가요">
            <TextInput value={draft.noShow} onValue={(v) => set({ noShow: v })} placeholder="예: 예약금을 돌려드리지 않아요" />
          </Field>
        </section>

        {errors.length ? (
          <div class="card alert stack" style={{ "--gap": "var(--s1)" }} role="alert">
            {errors.map((e) => (
              <p key={e} class="sm">
                {e}
              </p>
            ))}
          </div>
        ) : dirty ? (
          <p class="sm muted">저장하면 v{current.version + 1}이 생겨요. 이미 확정된 예약 {countByVersion.value.get(current.version) ?? 0}건은 v{current.version}을 그대로 따라요.</p>
        ) : null}

        <History current={current.version} />
      </div>
    </Page>
  );
}

export function PolicySettings() {
  if (role.value !== "OWNER") return <ReadOnly />;
  return <Editor key={currentPolicy.value.version} />;
}
