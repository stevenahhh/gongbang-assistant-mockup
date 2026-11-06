import { computed, signal } from "@preact/signals";
import { useRef, useState } from "preact/hooks";
import { ChevronRight, RefreshCw } from "lucide-preact";
import { actorKind, actorName, aiNotice, autoSend, currentPolicy, log, messages, patch, role, shop, templates, toast } from "../store";
import type { MessageStatus, OutboundMessage, Template, TemplateReview, Tone } from "../types";
import { Btn, Field, Page, RelTime, Segmented, Status, Switch, openSheet } from "../ui";
import { DAY, dateLabel, hhmm } from "../lib/time";
import { Denied, daysLeft } from "./settings-shared";
import { summarize } from "./settings-policy";

export const autoSendUntil = signal<number | null>(null);
export const remindEve = signal("18:00");
export const remindDay = signal("3시간 전");

const AD_WORDS = ["할인", "이벤트", "쿠폰", "특가", "세일", "프로모션", "신규 클래스", "오픈 기념", "지금 신청", "선착순", "무료 체험", "증정"];
export const findAdWords = (body: string) => AD_WORDS.filter((w) => body.includes(w));

const VARS = ["손님 이름", "클래스", "날짜", "시간", "주소", "규정 요약"];
const sample: Record<string, () => string> = {
  "손님 이름": () => "김민지",
  클래스: () => "원데이 물레 체험",
  날짜: () => "11월 15일(토)",
  시간: () => "14:00",
  주소: () => shop.value.address,
  "규정 요약": () => summarize(currentPolicy.value),
};

const reviewTone = (r: TemplateReview): Tone => (r === "승인" ? "ok" : r === "심사중" ? "run" : r === "반려" ? "err" : "muted");
const reviewHint = (t: Template) =>
  t.review === "승인" ? "알림톡으로 보낼 수 있어요" : t.review === "심사중" ? "카카오 심사 중이에요. 보통 1~3일 걸려요" : t.review === "반려" ? t.rejectReason ?? "반려됐어요" : "아직 심사를 보내지 않았어요";
const msgTone = (s: MessageStatus): Tone => (s === "도착" ? "ok" : s === "실패" ? "err" : s === "대체 발송" ? "warn" : s === "취소됨" ? "muted" : "run");
const msgText = (m: OutboundMessage) =>
  m.status === "예약됨" ? `${hhmm(m.at)}에 보낼 예정이에요` : m.status === "보냄" ? "보냈어요. 도착을 확인하고 있어요" : m.status === "도착" ? "손님에게 도착했어요" : m.status === "취소됨" ? "예약이 취소돼서 보내지 않았어요" : m.failReason ?? m.status;
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function Highlight({ text, words }: { text: string; words: string[] }) {
  const re = new RegExp(`(#\\{[^}]+\\}${words.length ? `|${words.map(esc).join("|")}` : ""})`, "g");
  return (
    <>
      {text.split(re).map((part, i) => {
        if (!part) return null;
        if (part.startsWith("#{")) return <span key={i} class="adm-var">{part}</span>;
        if (words.includes(part)) return <mark key={i} class="adm-mark">{part}</mark>;
        return part;
      })}
    </>
  );
}

const fill = (body: string) => body.replace(/#\{([^}]+)\}/g, (_, k: string) => sample[k]?.() ?? `#{${k}}`);
const sentRows = computed(() => messages.value.toSorted((a, b) => b.at - a.at));

function TemplateEditor({ t, close, editable }: { t: Template; close: () => void; editable: boolean }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [body, setBody] = useState(t.body);
  const ads = findAdWords(body);
  const dirty = body.trim() !== t.body;
  const insert = (v: string) => {
    const token = `#{${v}}`;
    const el = ref.current;
    const s = el?.selectionStart ?? body.length;
    const e = el?.selectionEnd ?? s;
    const next = body.slice(0, s) + token + body.slice(e);
    setBody(next);
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(s + token.length, s + token.length);
    });
  };
  const save = () => {
    patch(templates, t.id, { body: body.trim(), review: "심사중", rejectReason: undefined });
    log({ actorKind: actorKind(), actor: actorName(), action: "알림 문구를 고침", target: t.name, targetType: "기타", result: "완료" });
    toast("저장했어요. 카카오 심사를 다시 받아요");
    close();
  };
  return (
    <div class="stack" style={{ "--gap": "var(--s4)" }}>
      <div class="row between">
        <Status tone={reviewTone(t.review)}>{t.review}</Status>
        <span class="cap muted">{t.review === "반려" ? "카카오 심사에서 반려됐어요" : reviewHint(t)}</span>
      </div>
      {t.review === "반려" && t.rejectReason ? (
        <div class="card alert sm">
          <span class="strong">반려 사유</span> {t.rejectReason}
        </div>
      ) : null}
      {editable ? (
        <>
          <label class="field">
            <span class="field-label">문구</span>
            <textarea ref={ref} class="input" value={body} aria-invalid={ads.length > 0 || undefined} onInput={(e) => setBody(e.currentTarget.value)} />
            {ads.length ? (
              <span class="error-text" role="alert">
                “{ads.join("”, “")}”은 광고 문구예요. 정보성 안내에는 넣을 수 없어요.
              </span>
            ) : (
              <span class="help-text">변수를 누르면 커서 자리에 들어가요. {body.length}자</span>
            )}
          </label>
          <div class="chips" role="group" aria-label="변수">
            {VARS.map((v) => (
              <button key={v} type="button" class="chip" onClick={() => insert(v)}>
                {`#{${v}}`}
              </button>
            ))}
          </div>
        </>
      ) : (
        <p class="adm-preview">
          <Highlight text={t.body} words={[]} />
        </p>
      )}
      <div class="card stack" style={{ "--gap": "var(--s2)" }}>
        <span class="strong sm">김민지님에게 보내면 이렇게 보여요</span>
        <p class="sm adm-preview">
          <Highlight text={fill(body)} words={ads} />
        </p>
      </div>
      {editable ? (
        <Btn variant="primary" disabled={!dirty || ads.length > 0 || !body.trim()} onClick={save}>
          저장하고 심사 받기
        </Btn>
      ) : (
        <p class="cap muted">문구는 사장님만 고칠 수 있어요.</p>
      )}
    </div>
  );
}

function openTemplate(t: Template, editable: boolean) {
  openSheet(editable ? `${t.name} 고치기` : t.name, (close) => <TemplateEditor t={t} close={close} editable={editable} />);
}

function resend(m: OutboundMessage) {
  patch(messages, m.id, { status: "대체 발송", channel: "SMS", at: Date.now(), failReason: "알림톡 실패 뒤 SMS로 보냈어요" });
  log({ actorKind: actorKind(), actor: actorName(), action: "실패한 안내를 SMS로 다시 보냄", target: m.to, targetType: "예약", result: "완료" });
  toast(`${m.to}님께 SMS로 다시 보냈어요`);
}

function ResultRow({ m, owner }: { m: OutboundMessage; owner: boolean }) {
  return (
    <div class="rowitem" style={{ alignItems: "flex-start" }}>
      <span class="grow">
        <span class="row between" style={{ "--gap": "var(--s2)" }}>
          <span class="strong clamp1">
            {m.to} · {m.template}
          </span>
          <RelTime t={m.at} />
        </span>
        <span class="sm muted" style={{ display: "block" }}>
          {m.channel} · {msgText(m)}
        </span>
        <span class="row" style={{ "--gap": "var(--s2)", marginTop: "var(--s1)" }}>
          <Status tone={msgTone(m.status)}>{m.status}</Status>
          {m.status === "실패" && owner ? (
            <Btn small onClick={() => resend(m)}>
              <RefreshCw size={16} /> 다시 보내기
            </Btn>
          ) : null}
        </span>
      </span>
    </div>
  );
}

function AutoSendCard({ editable }: { editable: boolean }) {
  const on = autoSend.value;
  const until = autoSendUntil.value ?? Date.now() + 90 * DAY;
  const left = daysLeft(until);
  const turn = (v: boolean) => {
    autoSend.value = v;
    autoSendUntil.value = v ? Date.now() + 90 * DAY : null;
    log({ actorKind: actorKind(), actor: actorName(), action: v ? "리마인드 자동 발송을 켬" : "리마인드 자동 발송을 끔", target: v ? "90일 동안 유효" : "", targetType: "기타", result: "완료" });
    toast(v ? "90일 동안 리마인드를 알아서 보내요" : "리마인드는 다시 승인함을 거쳐요");
  };
  const extend = () => {
    autoSendUntil.value = Date.now() + 90 * DAY;
    toast("90일 더 맡겼어요");
  };
  return (
    <section class="card stack" style={{ "--gap": "var(--s2)" }}>
      <Switch
        label="정보성 리마인드 자동 발송"
        on={on}
        disabled={!editable}
        hint={on ? `${left}일 남음 · ${dateLabel(until)} 만료 · 만료 7일 전에 다시 물어볼게요` : "켜면 리마인드를 승인 없이 보내요. 최대 90일 동안 유효해요"}
        onChange={turn}
      />
      {on && left <= 7 && editable ? (
        <Btn small onClick={extend}>
          90일 연장
        </Btn>
      ) : null}
      <Switch
        label="AI 작성 안내 문구 붙이기"
        on={aiNotice.value}
        disabled={!editable}
        hint="손님에게 처음 연락할 때 “AI 비서가 작성을 도왔습니다”를 붙여요. AI 기본법 고지에 따라 기본으로 켜져 있어요"
        onChange={(v) => {
          aiNotice.value = v;
          toast(v ? "AI 작성 안내를 붙여요" : "AI 작성 안내를 붙이지 않아요");
        }}
      />
      {!editable ? <p class="cap muted">사장님만 바꿀 수 있어요.</p> : null}
    </section>
  );
}

export function TemplateSettings() {
  const r = role.value;
  if (r === "VIEWER") return <Denied title="알림 문구" />;
  const editable = r === "OWNER";
  return (
    <Page title="알림 문구" backTo="/settings">
      <div class="wide stack" style={{ "--gap": "var(--s5)" }}>
        <section>
          <h2 class="section-head">템플릿</h2>
          <p class="sm muted" style={{ marginBottom: "var(--s2)" }}>
            리마인드와 확정 안내는 정보성 메시지예요. 할인이나 이벤트 문구는 넣을 수 없어요.
          </p>
          <div class="list">
            {templates.value.map((t) => (
              <button key={t.id} type="button" class="rowitem" onClick={() => openTemplate(t, editable)}>
                <span class="grow">
                  <span class="row between" style={{ "--gap": "var(--s2)" }}>
                    <span class="strong">{t.name}</span>
                    <Status tone={reviewTone(t.review)}>{t.review}</Status>
                  </span>
                  <span class="sm muted clamp1">{t.review === "반려" ? t.rejectReason : t.body}</span>
                </span>
                <ChevronRight size={20} class="muted" />
              </button>
            ))}
          </div>
        </section>

        <AutoSendCard editable={editable} />

        <section class="stack" style={{ "--gap": "var(--s3)" }}>
          <h2 class="section-head">리마인드 보내는 시각</h2>
          {editable ? (
            <>
              <Field label="전날 리마인드">
                <Segmented<string> label="전날 리마인드 시각" options={["17:00", "18:00", "19:00", "20:00"]} value={remindEve.value} onChange={(v) => (remindEve.value = v)} />
              </Field>
              <Field label="당일 리마인드" hint="오후 9시부터 오전 8시 사이에는 보내지 않고 아침 8시로 미뤄요">
                <Segmented<string> label="당일 리마인드" options={["2시간 전", "3시간 전", "4시간 전"]} value={remindDay.value} onChange={(v) => (remindDay.value = v)} />
              </Field>
            </>
          ) : (
            <dl class="kv">
              <dt>전날</dt>
              <dd class="num">{remindEve.value}</dd>
              <dt>당일</dt>
              <dd class="num">수업 {remindDay.value}</dd>
            </dl>
          )}
        </section>

        <section>
          <h2 class="section-head">발송 결과</h2>
          <div class="list">
            {sentRows.value.map((m) => (
              <ResultRow key={m.id} m={m} owner={editable} />
            ))}
          </div>
          <p class="cap muted" style={{ marginTop: "var(--s3)" }}>
            알림톡이 실패하면 SMS로 대신 보내요. 두 시도 모두 기록에 남아요.
          </p>
        </section>
      </div>
    </Page>
  );
}
