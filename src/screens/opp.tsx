import { computed, signal } from "@preact/signals";
import { useState } from "preact/hooks";
import { Archive, Check, ChevronDown, ChevronUp, Copy, Download, ExternalLink, Paperclip, SlidersHorizontal, Sparkles, X } from "lucide-preact";
import { go, route, type DetailProps, type ScreenDef } from "../router";
import { actorKind, actorName, byId, log, opportunities, patch, refresh, role, scenario, toast } from "../store";
import type { OppStatus, Opportunity, Tone, Verdict } from "../types";
import { Btn, Chips, Empty, IconBtn, LoadError, Page, Segmented, Status, TextInput, openSheet } from "../ui";
import { DAY, dateLabel, hhmm, startOfToday } from "../lib/time";

type Kind = Opportunity["kind"];
const kinds: Kind[] = ["마켓", "체험부스", "공모전", "지원사업", "교육"];
const radii = ["10km", "30km", "50km", "전국"] as const;
type Radius = (typeof radii)[number];
interface Interest {
  radius: Radius;
  kinds: Kind[];
  excluded: string[];
}

const kindSel = signal<Kind[]>([]);
const archiveOpen = signal(false);
const interest = signal<Interest>({ radius: "30km", kinds: [...kinds], excluded: ["푸드트럭"] });

const daysLeft = (t: number) => Math.ceil((t - startOfToday()) / DAY) - 1;
const dLabel = (t: number) => {
  const d = daysLeft(t);
  return d < 0 ? "마감 지남" : d === 0 ? "오늘 마감" : `D-${d}`;
};
const dTone = (t: number): Tone => {
  const d = daysLeft(t);
  return d < 0 ? "muted" : d <= 3 ? "err" : d <= 7 ? "warn" : "muted";
};
const verdictTone = (v: Verdict): Tone => (v === "맞음" ? "ok" : v === "확인 필요" ? "warn" : "muted");
const statusTone = (s: OppStatus): Tone => (s === "선정" || s === "참가 완료" ? "ok" : s === "신청함" || s === "준비 중" ? "run" : "muted");
const ro = (w: string) => {
  const c = w.charCodeAt(w.length - 1) - 0xac00;
  const jong = c % 28;
  return c < 0 || jong === 0 || jong === 8 ? "로" : "으로";
};
const finished = (s: OppStatus) => s === "신청함" || s === "선정" || s === "미선정" || s === "참가 완료";
const closed = (o: Opportunity) => daysLeft(o.deadline) < 0 && !finished(o.status);
const isArchived = (o: Opportunity) => o.verdict === "안 맞음" || o.status === "보관";
const matchesKind = (o: Opportunity) => !kindSel.value.length || kindSel.value.includes(o.kind);

const active = computed(() =>
  opportunities.value
    .filter((o) => !isArchived(o) && !o.predicted && matchesKind(o))
    .toSorted((a, b) => Number(daysLeft(a.deadline) < 0) - Number(daysLeft(b.deadline) < 0) || a.deadline - b.deadline),
);
const predictions = computed(() => opportunities.value.filter((o) => Boolean(o.predicted) && !isArchived(o) && matchesKind(o)));
const archived = computed(() => opportunities.value.filter(isArchived));

function setStatus(o: Opportunity, next: OppStatus) {
  const prev = o.status;
  patch(opportunities, o.id, { status: next });
  log({ actorKind: actorKind(), actor: actorName(), action: `기회 상태를 ${next}${ro(next)} 바꿈`, target: o.title, targetType: "기타", result: "완료" });
  toast(`${next}${ro(next)} 바꿨어요`, () => patch(opportunities, o.id, { status: prev }));
}

function Row({ o, current, archive }: { o: Opportunity; current: boolean; archive?: boolean }) {
  return (
    <button type="button" class="rowitem" aria-current={current || undefined} onClick={() => go(`/opp/${o.id}`)}>
      <span class="grow">
        <span class="row between" style={{ "--gap": "var(--s2)" }}>
          <span class="strong clamp1">{o.title}</span>
          <Status tone={dTone(o.deadline)}>{dLabel(o.deadline)}</Status>
        </span>
        <span class="sm muted clamp1">{archive ? o.verdictReason : `${o.org} · ${o.kind}`}</span>
        <span class="row wrap" style={{ "--gap": "6px", marginTop: "4px" }}>
          <Status tone={verdictTone(o.verdict)}>{o.verdict}</Status>
          {o.preferred ? <Status tone="run">{o.preferred}</Status> : null}
          {closed(o) ? <Status>마감 지남</Status> : o.status !== "알림 보냄" && o.status !== "보관" ? <Status tone={statusTone(o.status)}>{o.status}</Status> : null}
        </span>
      </span>
    </button>
  );
}

function PredictionCard({ o }: { o: Opportunity }) {
  const p = o.predicted!;
  return (
    <button type="button" class="card tap g-card" onClick={() => go(`/opp/${o.id}`)}>
      <span class="row between">
        <span class="row" style={{ "--gap": "var(--s2)" }}>
          <Sparkles size={18} />
          <span class="strong">곧 모집할 수 있어요</span>
        </span>
        <Status tone="warn">추정</Status>
      </span>
      <span class="strong clamp2">{o.title}</span>
      <span class="sm">{p.when}에 모집할 것 같아요. 지난 모집 간격으로 추정했어요.</span>
      <span class="cap muted num">근거 회차: {p.rounds.join(" · ")}</span>
    </button>
  );
}

function InterestForm({ close }: { close: () => void }) {
  const [v, setV] = useState<Interest>(interest.value);
  const [kw, setKw] = useState("");
  const add = () => {
    const w = kw.trim();
    if (!w || v.excluded.includes(w)) return;
    setV({ ...v, excluded: [...v.excluded, w] });
    setKw("");
  };
  return (
    <div class="stack" style={{ "--gap": "var(--s4)" }}>
      <div class="field">
        <span class="field-label">관심 지역 반경</span>
        <Segmented<Radius> label="관심 지역 반경" options={radii} value={v.radius} onChange={(radius) => setV({ ...v, radius })} />
        <span class="help-text">{v.radius === "전국" ? "전국 공고를 모두 찾아요." : `공방 주소에서 ${v.radius} 안의 공고를 찾아요.`}</span>
      </div>
      <div class="field">
        <span class="field-label">관심 유형</span>
        <Chips<Kind> label="관심 유형" options={kinds} value={v.kinds} onChange={(ks) => setV({ ...v, kinds: ks })} />
      </div>
      <div class="field">
        <span class="field-label">받지 않을 키워드</span>
        {v.excluded.length ? (
          <div class="row wrap" style={{ "--gap": "6px" }}>
            {v.excluded.map((w) => (
              <button key={w} type="button" class="chip" aria-pressed="true" aria-label={`${w} 빼기`} onClick={() => setV({ ...v, excluded: v.excluded.filter((x) => x !== w) })}>
                {w} <X size={14} />
              </button>
            ))}
          </div>
        ) : (
          <span class="help-text">아직 없어요.</span>
        )}
        <div class="row">
          <span class="grow">
            <TextInput value={kw} onValue={setKw} placeholder="예: 푸드트럭" aria-label="받지 않을 키워드" />
          </span>
          <Btn small disabled={!kw.trim()} onClick={add}>
            추가
          </Btn>
        </div>
        <span class="help-text">제목에 이 말만 있는 공고는 알리지 않고 보관함에 둬요.</span>
      </div>
      <Btn
        variant="primary"
        disabled={!v.kinds.length}
        onClick={() => {
          interest.value = v;
          log({ actorKind: actorKind(), actor: actorName(), action: "기회 관심 조건 수정", target: `${v.radius} · ${v.kinds.join(", ")}`, targetType: "기타", result: "완료" });
          toast("관심 조건을 저장했어요");
          close();
        }}
      >
        저장
      </Btn>
    </div>
  );
}

const openInterest = () => openSheet("관심 조건", (close) => <InterestForm close={close} />);

function Forbidden() {
  return (
    <Page title="기회">
      <Empty
        title="이 화면은 사장님만 볼 수 있어요"
        action={
          <Btn small onClick={() => go("/more")}>
            돌아가기
          </Btn>
        }
      />
    </Page>
  );
}

function Master() {
  if (role.value === "VIEWER") return <Forbidden />;
  const selected = route.value.key === "opp" ? route.value.path[0] : undefined;
  const sc = scenario.value;
  const rows = sc === "empty" ? [] : active.value;
  const preds = sc === "empty" ? [] : predictions.value;
  const arch = sc === "empty" ? [] : archived.value;
  const it = interest.value;
  const filtering = kindSel.value.length > 0;
  return (
    <Page
      title="기회"
      right={
        role.value === "OWNER" ? (
          <IconBtn label="관심 조건" onClick={openInterest}>
            <SlidersHorizontal size={20} />
          </IconBtn>
        ) : undefined
      }
    >
      <Chips<Kind> label="유형" options={kinds} value={kindSel.value} onChange={(v) => (kindSel.value = v)} />
      <p class="cap muted" style={{ marginBottom: "var(--s3)" }}>
        반경 {it.radius} · 받지 않는 말 {it.excluded.length ? it.excluded.join(", ") : "없음"}
      </p>
      {sc === "error" ? <LoadError what="기회 목록" onRetry={refresh} /> : null}
      {preds.length ? (
        <div class="stack" style={{ marginBottom: "var(--s3)" }}>
          {preds.map((o) => (
            <PredictionCard key={o.id} o={o} />
          ))}
        </div>
      ) : null}
      {rows.length ? (
        <div class="list">
          {rows.map((o) => (
            <Row key={o.id} o={o} current={o.id === selected} />
          ))}
        </div>
      ) : sc === "error" ? null : filtering ? (
        <Empty
          title="조건에 맞는 기회가 없어요"
          action={
            <Btn small onClick={() => (kindSel.value = [])}>
              필터 지우기
            </Btn>
          }
        />
      ) : (
        <Empty title="아직 찾은 기회가 없어요">새 공고를 찾으면 여기에 모아 둘게요.</Empty>
      )}
      {arch.length ? (
        <section class="section">
          <button type="button" class="rowitem" aria-expanded={archiveOpen.value} onClick={() => (archiveOpen.value = !archiveOpen.value)}>
            <span class="glyph">
              <Archive size={20} />
            </span>
            <span class="grow">
              <span class="strong num" style={{ display: "block" }}>
                보관함 {arch.length}건
              </span>
              <span class="sm muted">안 맞는 공고를 모아 뒀어요</span>
            </span>
            {archiveOpen.value ? <ChevronUp size={20} class="muted" /> : <ChevronDown size={20} class="muted" />}
          </button>
          {archiveOpen.value ? (
            <div class="list">
              {arch.map((o) => (
                <Row key={o.id} o={o} current={o.id === selected} archive />
              ))}
            </div>
          ) : null}
        </section>
      ) : null}
      <p class="cap muted" style={{ marginTop: "var(--s4)" }}>
        비서가 틀릴 수 있어요. 자격은 원문에서 다시 확인해 주세요.
      </p>
    </Page>
  );
}

function Facts({ o }: { o: Opportunity }) {
  if (!o.facts.length) {
    return <p class="sm muted">{o.predicted ? "아직 공고가 나지 않았어요. 지난 모집을 근거로 추정했어요." : "요약할 사실이 아직 없어요. 원문을 확인해 주세요."}</p>;
  }
  return (
    <div>
      {o.facts.map((f) => (
        <div key={f.label} class="g-fact">
          <span class="g-fact-k">{f.label}</span>
          <span class="g-fact-v">
            {f.value === null ? <span class="muted">공고에 없음</span> : <span>{f.value}</span>}
            {f.value !== null && f.source ? (
              <a class="g-src" href={o.url} target="_blank" rel="noreferrer">
                <ExternalLink size={14} /> 원문 · {f.source}
              </a>
            ) : null}
          </span>
        </div>
      ))}
    </div>
  );
}

function Draft({ o }: { o: Opportunity }) {
  const [open, setOpen] = useState(o.status === "준비 중" || finished(o.status));
  const copy = (text: string) => {
    void navigator.clipboard?.writeText(text);
    toast("복사했어요");
  };
  const openDraft = () => {
    setOpen(true);
    if (role.value === "OWNER" && o.status === "관심") setStatus(o, "준비 중");
  };
  return (
    <section class="stack">
      <div class="row between">
        <h3 class="section-head" style={{ margin: 0 }}>
          신청서 초안
        </h3>
        <Status tone="run">비서가 채웠어요</Status>
      </div>
      {open ? (
        <div class="card g-card">
          {o.form.map((f) => (
            <div key={f.label} class="row">
              <span class="grow">
                <span class="cap muted" style={{ display: "block" }}>
                  {f.label}
                </span>
                {f.value ? <span>{f.value}</span> : <span class="muted">비어 있어요. 직접 적어 주세요.</span>}
              </span>
              <IconBtn label={`${f.label} 복사`} disabled={!f.value} onClick={() => copy(f.value)}>
                <Copy size={18} />
              </IconBtn>
            </div>
          ))}
          <Btn onClick={() => copy(o.form.map((f) => `${f.label}: ${f.value}`).join("\n"))}>
            <Copy size={18} /> 전체 복사
          </Btn>
          <p class="cap muted">제출은 사장님이 직접 해요. 비서는 폼을 제출하지 않아요.</p>
        </div>
      ) : (
        <Btn variant="outline" onClick={openDraft}>
          신청서 초안 열기
        </Btn>
      )}
    </section>
  );
}

const steps = ["관심", "준비 중", "신청함", "선정/미선정", "참가 완료"] as const;
const stepIndex = (s: OppStatus) => (s === "관심" ? 0 : s === "준비 중" ? 1 : s === "신청함" ? 2 : s === "선정" || s === "미선정" ? 3 : s === "참가 완료" ? 4 : -1);

function askResult(o: Opportunity) {
  openSheet("결과를 적어요", (close) => (
    <div class="stack">
      <Btn
        variant="primary"
        onClick={() => {
          setStatus(o, "선정");
          close();
        }}
      >
        선정됐어요
      </Btn>
      <Btn
        onClick={() => {
          setStatus(o, "미선정");
          close();
        }}
      >
        미선정이에요
      </Btn>
      <p class="cap muted">선정 결과는 사장님이 직접 적어요. 비서가 알아서 바꾸지 않아요.</p>
    </div>
  ));
}

function Progress({ o }: { o: Opportunity }) {
  const idx = stepIndex(o.status);
  const over = closed(o);
  if (role.value !== "OWNER") {
    return (
      <section class="stack">
        <h3 class="section-head" style={{ margin: 0 }}>
          진행 상태
        </h3>
        <p class="sm">
          지금은 <span class="strong">{over ? "마감 지남" : o.status}</span>이에요. 상태는 사장님이 바꿔요.
        </p>
      </section>
    );
  }
  const choose = (i: number) => {
    if (i === 3) {
      askResult(o);
      return;
    }
    setStatus(o, steps[i] as OppStatus);
  };
  return (
    <section class="stack">
      <h3 class="section-head" style={{ margin: 0 }}>
        진행 상태
      </h3>
      {over ? <p class="sm muted">마감이 지나서 더 진행할 수 없어요.</p> : null}
      <div class="stack" style={{ "--gap": "var(--s2)" }}>
        {steps.map((s, i) => {
          const state = i < idx ? "done" : i === idx ? "now" : i === idx + 1 ? "next" : "later";
          const label = i === 3 && idx >= 3 ? (o.status === "미선정" ? "미선정" : "선정") : s;
          const enabled = !over && state === "next" && !(i === 4 && o.status !== "선정");
          return (
            <button key={s} type="button" class="g-step" data-state={state} aria-current={state === "now" ? "step" : undefined} disabled={!enabled} onClick={() => choose(i)}>
              <span class="g-step-no">{state === "done" ? <Check size={16} /> : i + 1}</span>
              <span class="grow">{label}</span>
              {enabled ? <span class="cap">누르면 바꿔요</span> : null}
            </button>
          );
        })}
      </div>
      {o.announceAt ? (
        <p class="sm">
          <span class="strong">선정 통보 예정일</span> {dateLabel(o.announceAt)}. 그날 아침에 확인 알림을 보내 드려요.
        </p>
      ) : null}
    </section>
  );
}

function OppDetail({ o }: { o: Opportunity }) {
  const d = daysLeft(o.deadline);
  const restricted = o.license === "공공누리 3유형";
  return (
    <Page title={o.kind} backTo="/opp" sub>
      <div class="wide stack" style={{ "--gap": "var(--s5)" }}>
        <header class="stack" style={{ "--gap": "var(--s2)" }}>
          <h2 style={{ fontSize: "var(--fs-h3)" }}>{o.title}</h2>
          <p class="sm muted">{o.org}</p>
          <div class="row" style={{ alignItems: "baseline" }}>
            <span class={`g-dday num${d >= 0 && d <= 3 ? " soon" : ""}`}>{o.predicted ? "추정" : dLabel(o.deadline)}</span>
            <span class="sm muted num">{o.predicted ? `${o.predicted.when} 모집 예상` : `${dateLabel(o.deadline)} ${hhmm(o.deadline)} 마감`}</span>
          </div>
          <div class="row wrap" style={{ "--gap": "6px" }}>
            <Status tone={verdictTone(o.verdict)}>{o.verdict}</Status>
            {o.preferred ? <Status tone="run">{o.preferred}</Status> : null}
            {closed(o) ? <Status>마감 지남</Status> : <Status tone={statusTone(o.status)}>{o.status}</Status>}
          </div>
          <p class="sm">{o.verdictReason}</p>
        </header>
        {restricted ? (
          <div class="card g-card sm" style={{ "--gap": "var(--s1)" }}>
            <span class="strong">변경 금지 공고예요</span>
            <span>공공누리 3유형이라 원문을 고쳐 쓰지 않아요. 마감일과 자격 같은 사실만 추리고 원문 링크를 붙였어요.</span>
          </div>
        ) : null}
        {o.predicted ? (
          <div class="card g-card sm" style={{ "--gap": "var(--s1)" }}>
            <span class="row between">
              <span class="strong">추정 근거</span>
              <Status tone="warn">추정</Status>
            </span>
            <span>지난해 같은 행사가 {o.predicted.rounds.length}번 모집했어요. 그 간격으로 {o.predicted.when} 모집을 예상했어요.</span>
            <span class="num muted">{o.predicted.rounds.join(" · ")}</span>
          </div>
        ) : null}
        <section class="stack">
          <h3 class="section-head" style={{ margin: 0 }}>
            핵심 사실
          </h3>
          <Facts o={o} />
          {o.facts.length ? <p class="cap muted">원문에 없는 내용은 쓰지 않아요. 칸마다 원문 위치를 붙였어요.</p> : null}
        </section>
        <section class="stack">
          <h3 class="section-head" style={{ margin: 0 }}>
            원문과 첨부
          </h3>
          <a class="btn outline" href={o.url} target="_blank" rel="noreferrer">
            <ExternalLink size={18} /> 원문 보기
          </a>
          {o.attachments.length ? (
            <div class="list">
              {o.attachments.map((a) => (
                <button key={a} type="button" class="rowitem" onClick={() => toast("첨부 파일을 내려받았어요")}>
                  <span class="glyph">
                    <Paperclip size={20} />
                  </span>
                  <span class="grow clamp1">{a}</span>
                  <Download size={20} class="muted" />
                </button>
              ))}
            </div>
          ) : (
            <p class="sm muted">첨부 파일이 없어요.</p>
          )}
        </section>
        {!restricted && o.form.length ? <Draft o={o} /> : null}
        <Progress o={o} />
      </div>
    </Page>
  );
}

function Detail({ path }: DetailProps) {
  if (role.value === "VIEWER") return <Forbidden />;
  const o = byId(opportunities.value, path[0]);
  if (!o) {
    return (
      <Page title="기회" backTo="/opp">
        <Empty title="이 기회를 찾지 못했어요" />
      </Page>
    );
  }
  return <OppDetail key={o.id} o={o} />;
}

export const screen: ScreenDef = { split: true, Master, Detail };
