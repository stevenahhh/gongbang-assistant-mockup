import { computed, signal } from "@preact/signals";
import { Fragment } from "preact";
import { AlertTriangle, Check, ChevronRight, Cpu, Crown, UserRound } from "lucide-preact";
import { activity, actorName, role, scenario } from "../store";
import type { Activity, ActorKind } from "../types";
import { Btn, Chips, Empty, Mascot, Page, Segmented, openSheet } from "../ui";
import { DAY, dateLabel, dayKey, hhmm, startOfToday } from "../lib/time";
import { Denied } from "./settings-shared";

const periods = ["오늘", "7일", "30일", "전체"] as const;
type Period = (typeof periods)[number];
const actorOptions: ActorKind[] = ["사장님", "직원", "비서", "시스템"];
const kinds = ["발송", "초안", "예약", "승인", "수정", "연결", "직원", "내보내기", "기타"] as const;
type Kind = (typeof kinds)[number];
const targetOptions: Activity["targetType"][] = ["예약", "문의", "연결", "규정", "기타"];

const actorSel = signal<ActorKind[]>([]);
const kindSel = signal<Kind[]>([]);
const targetSel = signal<Activity["targetType"][]>([]);
const period = signal<Period>("7일");

export function kindOf(a: Activity): Kind {
  const s = a.action;
  if (a.gap) return "기타";
  if (/초대|권한|접속을 끊/.test(s)) return "직원";
  if (/내보냄|내려받/.test(s)) return "내보내기";
  if (/연결|갱신|해제/.test(s)) return "연결";
  if (/승인|반려|거절/.test(s)) return "승인";
  if (/초안/.test(s)) return "초안";
  if (/보냄|발송|보내/.test(s)) return "발송";
  if (/예약/.test(s)) return "예약";
  if (/수정|고침|바꿈|저장|켬|끔/.test(s)) return "수정";
  return "기타";
}

const countIn = (s: string) => Number(s.match(/(\d+)건/)?.[1] ?? 1);
const resultText = (a: Activity) => (a.result === "완료" ? "끝났어요" : a.result === "실패" ? "실패했어요" : a.result === "대기" ? "승인을 기다려요" : a.result === "부분 완료" ? "일부만 끝났어요" : "되돌렸어요");

const scoped = computed(() => (role.value === "OWNER" ? activity.value : activity.value.filter((a) => a.actor === actorName())));

const summary7 = computed(() => {
  const since = Date.now() - 7 * DAY;
  let sent = 0;
  let changed = 0;
  let deleted = 0;
  for (const a of scoped.value) {
    if (a.at < since || a.gap) continue;
    const k = kindOf(a);
    if (k === "발송" && a.result === "완료") sent += countIn(a.action);
    if (k === "예약") changed += 1;
    if (/지움|삭제|취소함/.test(a.action)) deleted += 1;
  }
  return { sent, changed, deleted };
});

const filtered = computed(() => {
  const p = period.value;
  const since = p === "전체" ? 0 : p === "오늘" ? startOfToday() : Date.now() - (p === "7일" ? 7 : 30) * DAY;
  const rows = scoped.value.filter((a) => {
    if (a.at < since) return false;
    if (a.gap) return true;
    if (actorSel.value.length && !actorSel.value.includes(a.actorKind)) return false;
    if (kindSel.value.length && !kindSel.value.includes(kindOf(a))) return false;
    if (targetSel.value.length && !targetSel.value.includes(a.targetType)) return false;
    return true;
  });
  return rows.toSorted((a, b) => b.at - a.at);
});

const filtering = computed(() => Boolean(actorSel.value.length || kindSel.value.length || targetSel.value.length));

function ActorGlyph({ kind }: { kind: ActorKind }) {
  return (
    <span class="glyph adm-actor" data-kind={kind} title={kind}>
      {kind === "비서" ? <Mascot size={26} /> : kind === "사장님" ? <Crown size={20} /> : kind === "직원" ? <UserRound size={20} /> : <Cpu size={20} />}
    </span>
  );
}

const stamp = (t: number, i: number) => {
  const d = new Date(t + i * 1000);
  return `${hhmm(t)}:${String(d.getSeconds()).padStart(2, "0")}`;
};

function openDetail(a: Activity) {
  const lines: { k: string; v: string }[] = [
    { k: "누가", v: a.actor },
    { k: "대상", v: a.target ? `${a.target} (${a.targetType})` : a.targetType },
    ...(a.evidence ?? []).map((e) => ({ k: e.label, v: e.value })),
    { k: "결과", v: resultText(a) },
  ];
  openSheet(a.action, () => (
    <div class="stack" style={{ "--gap": "var(--s4)" }}>
      <p class="sm muted num">
        {dayTitle(a.at)} {hhmm(a.at)}
      </p>
      <div class="adm-trail">
        {lines.map((l, i) => (
          <div key={`${l.k}-${i}`}>
            <span class="k">{l.k}</span>
            <span class="num">{l.v}</span>
            <span class="t num">{stamp(a.at, i)}</span>
          </div>
        ))}
      </div>
      {a.actorKind === "비서" && !a.evidence?.length ? <p class="sm muted">이 행동에는 저장된 근거 데이터가 없어요.</p> : null}
      <p class="cap muted row" style={{ "--gap": "var(--s1)" }}>
        <Check size={14} /> 원본 기록을 확인했어요. 활동 기록은 고치거나 지울 수 없어요.
      </p>
    </div>
  ));
}

function LogRow({ a }: { a: Activity }) {
  if (a.gap) {
    return (
      <div class="adm-gap" role="note">
        <AlertTriangle size={18} />
        <span class="grow">이 시간대 기록을 확인하지 못했어요</span>
        <span class="num cap">{hhmm(a.at)}</span>
      </div>
    );
  }
  return (
    <button type="button" class="rowitem" onClick={() => openDetail(a)}>
      <ActorGlyph kind={a.actorKind} />
      <span class="grow">
        <span class="strong clamp1" style={{ display: "block" }}>
          {a.action}
        </span>
        <span class="sm muted clamp1">
          {a.actor}
          {a.target ? ` · ${a.target}` : ""}
          {a.result !== "완료" ? ` · ${resultText(a)}` : ""}
        </span>
      </span>
      <span class="adm-log-time num">{hhmm(a.at)}</span>
      <ChevronRight size={18} class="muted" />
    </button>
  );
}

const dayTitle = (t: number) => {
  const key = dayKey(t);
  if (key === dayKey(Date.now())) return "오늘";
  if (key === dayKey(Date.now() - DAY)) return "어제";
  return dateLabel(t);
};

function clear() {
  actorSel.value = [];
  kindSel.value = [];
  targetSel.value = [];
}

export function ActivitySettings() {
  const r = role.value;
  if (r === "VIEWER") return <Denied title="활동 기록" />;
  const rows = scenario.value === "empty" ? [] : filtered.value;
  const s = summary7.value;
  const total = scoped.value.filter((a) => !a.gap).length;
  const gaps = scoped.value.filter((a) => a.gap).length;
  const groups: { title: string; rows: Activity[] }[] = [];
  for (const a of rows) {
    const title = dayTitle(a.at);
    const last = groups[groups.length - 1];
    if (last && last.title === title) last.rows.push(a);
    else groups.push({ title, rows: [a] });
  }
  return (
    <Page title="활동 기록" backTo="/settings">
      <div class="wide stack" style={{ "--gap": "var(--s4)" }}>
        <div class="card adm-verified">
          <span class={gaps ? "mark warn" : "mark"}>{gaps ? <AlertTriangle size={16} /> : <Check size={16} />}</span>
          <div class="grow">
            <p class="strong">
              기록 {total}건을 {gaps ? "확인했어요" : "모두 확인했어요"} · 방금
            </p>
            <p class="sm muted">
              {gaps ? `${gaps}개 시간대의 기록은 확인하지 못했어요. 아래 목록에 표시해 드려요.` : "비서와 사람이 한 일은 모두 기록으로 남아요. 빠지거나 바뀐 기록이 없는지 확인했어요."}
            </p>
          </div>
        </div>

        <div class="card stack" style={{ "--gap": "var(--s3)" }}>
          <div class="row between">
            <span class="strong">최근 7일</span>
            <span class="cap muted">{r === "OWNER" ? "사장님 · 직원 · 비서" : "내 행동만"}</span>
          </div>
          <div class="adm-summary">
            <div>
              <strong class={s.sent ? "num err" : "num"}>{s.sent}</strong>
              <span class="cap muted">보낸 메시지</span>
            </div>
            <div>
              <strong class="num">{s.changed}</strong>
              <span class="cap muted">바꾼 예약</span>
            </div>
            <div>
              <strong class="num">{s.deleted}</strong>
              <span class="cap muted">지운 것</span>
            </div>
          </div>
          <p class="cap muted">보낸 메시지와 지운 것은 비서가 사장님 이름으로 한 일이에요. 숫자가 이상하면 아래 기록을 확인해 주세요.</p>
        </div>

        <Segmented label="기간" options={periods} value={period.value} onChange={(v) => (period.value = v)} />
        <div class="stack" style={{ "--gap": "0px" }}>
          {r === "OWNER" ? <Chips label="누가" options={actorOptions} value={actorSel.value} onChange={(v) => (actorSel.value = v)} /> : null}
          <Chips label="종류" options={kinds} value={kindSel.value} onChange={(v) => (kindSel.value = v)} />
          <Chips label="대상" options={targetOptions} value={targetSel.value} onChange={(v) => (targetSel.value = v)} />
        </div>
        <p class="sm muted num">{rows.filter((a) => !a.gap).length}건</p>

        {groups.length ? (
          groups.map((g) => (
            <Fragment key={g.title}>
              <p class="adm-day">{g.title}</p>
              <div class="adm-log">
                {g.rows.map((a) => (
                  <LogRow key={a.id} a={a} />
                ))}
              </div>
            </Fragment>
          ))
        ) : (
          <Empty title="조건에 맞는 기록이 없어요" action={filtering.value ? <Btn small onClick={clear}>필터 지우기</Btn> : undefined}>
            {filtering.value ? "필터를 지우면 다시 보여요." : "비서와 사람이 한 일이 여기에 쌓여요."}
          </Empty>
        )}
        <p class="cap muted">기록은 추가만 할 수 있고 고치거나 지울 수 없어요. 1년이 지난 기록은 요약만 보관해요.</p>
      </div>
    </Page>
  );
}
