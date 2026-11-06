import { computed, signal } from "@preact/signals";
import { useState } from "preact/hooks";
import { Clock, FileText, Hand, MessageSquareReply, Megaphone, Send, Settings2, Star } from "lucide-preact";
import { go, route, type DetailProps, type ScreenDef } from "../router";
import { approveBatch, approveTask, byId, failedTasks, handOver, patch, rejectTask, retryTask, role, rules, scenario, tasks, toast, visibleTasks } from "../store";
import type { AgentTask, TaskKind } from "../types";
import { Btn, Empty, IconBtn, Page, RelTime, Segmented, Status, Switch, TextArea, openSheet } from "../ui";
import { dateLabel, hhmm, relative } from "../lib/time";

const tabs = ["승인 대기", "알아서 처리됨", "실패", "지난 일"] as const;
type TabName = (typeof tabs)[number];
const tab = signal<TabName>("승인 대기");

const kindIcon: Partial<Record<TaskKind, typeof Send>> = { 답장: MessageSquareReply, 리마인드: Clock, "신청서 초안": FileText, "게시글 초안": Megaphone, "리뷰 답글 초안": Star };
const KindIcon = ({ kind }: { kind: TaskKind }) => {
  const Icon = kindIcon[kind] ?? Send;
  return <span class="glyph"><Icon size={20} /></span>;
};

const rejectReasons = ["사실이 틀림", "말투가 안 맞음", "지금 필요 없음", "기타"];

export function openReject(task: AgentTask, after?: () => void) {
  openSheet("왜 거절하나요?", (close) => (
    <div class="list">
      {rejectReasons.map((r) => (
        <button key={r} type="button" class="rowitem" onClick={() => { rejectTask(task.id, r); toast(r === "지금 필요 없음" ? "24시간 동안 같은 일을 만들지 않을게요" : "거절했어요. 아무것도 보내지 않아요"); close(); after?.(); }}>
          <span class="grow">{r}</span>
        </button>
      ))}
    </div>
  ));
}

function TaskFacts({ task }: { task: AgentTask }) {
  return (
    <dl class="kv">
      <dt>누구에게</dt>
      <dd>{task.to}</dd>
      <dt>언제</dt>
      <dd class="num">{task.runAt < Date.now() ? "시간이 지났어요" : `${relative(task.runAt)} · ${dateLabel(task.runAt)} ${hhmm(task.runAt)}`}</dd>
      {task.mismatch ? (
        <>
          <dt class="total">{task.mismatch.field}</dt>
          <dd><span class="diff num">초안 {task.mismatch.draft}</span> · 원본 <span class="num">{task.mismatch.source}</span></dd>
        </>
      ) : null}
    </dl>
  );
}

function TaskCard({ task, current }: { task: AgentTask; current?: boolean }) {
  const blocked = Boolean(task.mismatch);
  return (
    <article class="card lazy stack" aria-current={current || undefined}>
      <button type="button" class="row" style={{ alignItems: "flex-start", textAlign: "start" }} onClick={() => go(`/approvals/${task.id}`)}>
        <KindIcon kind={task.kind} />
        <span class="grow">
          <span class="cap muted">{task.kind}</span>
          <span class="strong" style={{ display: "block" }}>{task.title}</span>
          <span class="sm clamp2" style={{ marginTop: "2px" }}>{task.body}</span>
        </span>
      </button>
      <TaskFacts task={task} />
      {task.reason ? <p class="sm muted">{task.reason}</p> : null}
      {blocked ? <p class="sm" style={{ color: "var(--err)" }}>원본과 금액이 달라서 승인할 수 없어요. 본문을 고쳐 주세요.</p> : null}
      <div class="row">
        <Btn class="grow" onClick={() => openReject(task)}>거절</Btn>
        <Btn class="grow" variant="primary" disabled={blocked} onClick={() => { if (approveTask(task.id)) toast("승인했어요", undefined); }}>승인</Btn>
      </div>
    </article>
  );
}

function openBatch(ids: string[]) {
  const rows = ids.map((id) => byId(tasks.value, id)!).filter(Boolean);
  openSheet(
    `${rows.length}명에게 보내요`,
    () => (
      <div class="list">
        {rows.map((t) => (
          <div key={t.id} class="rowitem" style={{ minHeight: "52px" }}>
            <span class="grow">{t.to}</span>
            {t.mismatch ? <Status tone="err">제외</Status> : <Status tone="ok">보낼 수 있어요</Status>}
          </div>
        ))}
      </div>
    ),
    (close) => (
      <>
        <Btn onClick={close}>취소</Btn>
        <Btn variant="primary" onClick={() => { const n = approveBatch(ids); toast(`${n}건을 승인했어요`); close(); }}>모두 승인</Btn>
      </>
    ),
  );
}

function BatchCard({ name, ids }: { name: string; ids: string[] }) {
  const first = byId(tasks.value, ids[0])!;
  return (
    <article class="card lazy stack">
      <div class="row" style={{ alignItems: "flex-start" }}>
        <KindIcon kind={first.kind} />
        <div class="grow">
          <p class="cap muted">{first.kind} 묶음</p>
          <p class="strong num">{name} {ids.length}건</p>
          <p class="sm clamp2">{first.body}</p>
        </div>
      </div>
      <dl class="kv">
        <dt>누구에게</dt><dd class="num">손님 {ids.length}명</dd>
        <dt>언제</dt><dd class="num">{relative(first.runAt)} · {hhmm(first.runAt)}</dd>
      </dl>
      <div class="row">
        <Btn class="grow" onClick={() => go(`/approvals/${ids[0]}`)}>하나씩 보기</Btn>
        <Btn class="grow" variant="primary" onClick={() => openBatch(ids)}>{ids.length}건 승인</Btn>
      </div>
    </article>
  );
}

function PendingList() {
  const rows = scenario.value === "empty" ? [] : visibleTasks.value;
  const groups = new Map<string, string[]>();
  for (const t of rows) if (t.batch) groups.set(t.batch, [...(groups.get(t.batch) ?? []), t.id]);
  if (!rows.length) return <Empty title="승인할 일이 없어요">비서가 일을 만들면 여기에 모여요.</Empty>;
  const seen = new Set<string>();
  const selected = route.value.path[0];
  return (
    <div class="stack">
      {rows.map((t) => {
        if (t.batch && (groups.get(t.batch)?.length ?? 0) > 1) {
          if (seen.has(t.batch)) return null;
          seen.add(t.batch);
          return <BatchCard key={t.batch} name={t.batch} ids={groups.get(t.batch)!} />;
        }
        return <TaskCard key={t.id} task={t} current={t.id === selected} />;
      })}
      <p class="cap muted">비서가 틀릴 수 있어요. 카드 내용을 확인해 주세요.</p>
    </div>
  );
}

function FailedCard({ task }: { task: AgentTask }) {
  return (
    <article class="card stack">
      <div class="row between">
        <span class="strong">{task.title}</span>
        <Status tone="err">{task.status}</Status>
      </div>
      <p class="sm">{task.failReason}</p>
      <div class="row wrap">
        <Btn small class="grow" onClick={() => { rejectTask(task.id, "버리기"); toast("버렸어요"); }}>버리기</Btn>
        <Btn small class="grow" onClick={() => go(`/approvals/${task.id}`)}>고치기</Btn>
        <Btn small class="grow" variant="outline" onClick={() => { handOver(task.id); toast("사장님이 처리한 일로 끝냈어요"); void import("./booking-form"); go("/inbox"); }}>
          <Hand size={16} /> 직접 하기
        </Btn>
        {task.status === "실패" ? <Btn small class="grow" variant="primary" onClick={() => retryTask(task.id)}>다시 시도</Btn> : null}
      </div>
      {task.status === "중단됨" ? <p class="cap muted">같은 오류가 두 번 나서 자동으로 다시 보내지 않아요.</p> : null}
    </article>
  );
}

const doneRows = computed(() => tasks.value.filter((t) => t.status === "완료" || t.status === "부분 완료" || t.status === "반려됨" || t.status === "만료됨" || t.status === "사람이 처리"));
const autoRows = computed(() => tasks.value.filter((t) => t.status === "알아서 처리됨"));

function ResultRow({ task }: { task: AgentTask }) {
  const tone = task.status === "완료" || task.status === "알아서 처리됨" ? "ok" : task.status === "만료됨" ? "warn" : "muted";
  return (
    <button type="button" class="rowitem" onClick={() => go(`/approvals/${task.id}`)}>
      <span class="grow">
        <span class="strong clamp1">{task.title}</span>
        <span class="sm muted clamp1">{task.status === "만료됨" ? "시간이 지났어요. 보내지 않았어요" : task.result}</span>
      </span>
      <Status tone={tone}>{task.status}</Status>
    </button>
  );
}

function Master() {
  const raw = route.value.raw;
  if (raw.includes("tab=fail") && tab.peek() !== "실패") tab.value = "실패";
  const failed = failedTasks.value;
  return (
    <Page
      title="승인함"
      right={role.value === "OWNER" ? <IconBtn label="사전 허용 규칙" onClick={() => go("/approvals/rules")}><Settings2 size={20} /></IconBtn> : undefined}
    >
      <div class="chips" role="tablist" aria-label="승인함 구분">
        {tabs.map((t) => (
          <button key={t} type="button" role="tab" class="chip" aria-selected={tab.value === t} aria-pressed={tab.value === t} onClick={() => (tab.value = t)}>
            {t}{t === "승인 대기" ? ` ${visibleTasks.value.length}` : t === "실패" && failed.length ? ` ${failed.length}` : ""}
          </button>
        ))}
      </div>
      {tab.value === "승인 대기" ? <PendingList /> : null}
      {tab.value === "알아서 처리됨" ? <div class="list">{autoRows.value.map((t) => <ResultRow key={t.id} task={t} />)}</div> : null}
      {tab.value === "실패" ? (failed.length ? <div class="stack">{failed.map((t) => <FailedCard key={t.id} task={t} />)}</div> : <Empty title="실패한 일이 없어요" />) : null}
      {tab.value === "지난 일" ? (doneRows.value.length ? <div class="list">{doneRows.value.map((t) => <ResultRow key={t.id} task={t} />)}</div> : <Empty title="지난 일이 아직 없어요" />) : null}
    </Page>
  );
}

function Rules() {
  const blockedKinds = ["환불 처리", "취소 처리", "금액 변경", "신청서 제출", "게시물 올리기"];
  return (
    <Page title="사전 허용 규칙" backTo="/approvals">
      <div class="wide stack" style={{ "--gap": "var(--s4)" }}>
        <p class="sm muted">켜 둔 규칙에 맞는 일은 승인함을 건너뛰고 알아서 처리해요. 최대 90일까지 맡길 수 있어요.</p>
        <div class="list">
          {rules.value.map((r) => {
            const left = Math.ceil((r.until - Date.now()) / 86_400_000);
            return (
              <div key={r.id} class="rowitem" style={{ display: "block" }}>
                <Switch label={r.name} on={r.on} hint={`${left}일 남음${left <= 7 ? " · 갱신할 때가 됐어요" : ""}`} onChange={(on) => patch(rules, r.id, { on })} />
                {left <= 7 ? <Btn small onClick={() => { patch(rules, r.id, { until: Date.now() + 90 * 86_400_000 }); toast("90일 더 맡겼어요"); }}>90일 연장</Btn> : null}
              </div>
            );
          })}
        </div>
        <section>
          <h2 class="section-head">맡길 수 없는 일</h2>
          <p class="sm muted">금액이 걸리거나 외부에 공개되는 일은 언제나 사장님이 승인해요.</p>
          <div class="row wrap" style={{ "--gap": "6px", marginTop: "var(--s2)" }}>
            {blockedKinds.map((k) => <Status key={k}>{k}</Status>)}
          </div>
        </section>
      </div>
    </Page>
  );
}

function TaskDetail({ task }: { task: AgentTask }) {
  const [body, setBody] = useState(task.body);
  const editable = task.status === "승인 대기" || task.status === "중단됨" || task.status === "실패";
  const fixed = task.mismatch ? body.includes(task.mismatch.source) && !body.includes(task.mismatch.draft) : false;
  const blocked = Boolean(task.mismatch) && !fixed;
  const pending = task.status === "승인 대기";
  return (
    <Page
      title={task.kind}
      backTo="/approvals"
      foot={
        pending ? (
          <>
            <Btn onClick={() => openReject(task)}>거절</Btn>
            <Btn
              variant="primary"
              disabled={blocked}
              onClick={() => {
                if (fixed) patch(tasks, task.id, { mismatch: undefined });
                if (approveTask(task.id, body)) toast(body !== task.body ? "고쳐서 승인했어요" : "승인했어요");
                go("/approvals");
              }}
            >
              {body !== task.body ? "고쳐서 승인" : "승인"}
            </Btn>
          </>
        ) : task.status === "중단됨" || task.status === "실패" ? (
          <Btn variant="primary" onClick={() => { patch(tasks, task.id, { body, status: "승인 대기", failReason: undefined }); toast("고쳐서 승인 대기로 돌렸어요"); go("/approvals"); }}>고쳐서 다시 시도</Btn>
        ) : undefined
      }
    >
      <div class="wide stack" style={{ "--gap": "var(--s4)" }}>
        <div>
          <Status tone={pending ? "run" : task.status === "완료" ? "ok" : "muted"}>{task.status}</Status>
          <h2 style={{ marginTop: "var(--s2)", fontSize: "var(--fs-h3)" }}>{task.title}</h2>
        </div>
        <TaskFacts task={task} />
        {task.failReason ? <div class="card alert sm">{task.failReason}</div> : null}
        {editable ? (
          <label class="field">
            <span class="field-label">본문</span>
            <TextArea style={{ minHeight: "180px" }} value={body} onValue={setBody} />
          </label>
        ) : (
          <div class="card pre">{task.body}</div>
        )}
        {task.originalBody ? (
          <section>
            <h2 class="section-head">비서가 쓴 원본</h2>
            <div class="card pre muted sm">{task.originalBody}</div>
          </section>
        ) : null}
        {task.reason ? <p class="sm muted">{task.reason}</p> : null}
        <section>
          <h2 class="section-head">비서가 쓴 근거</h2>
          <dl class="kv">
            {task.evidence.map((e) => (
              <>
                <dt>{e.label}</dt>
                <dd class="num">{e.value}</dd>
              </>
            ))}
          </dl>
        </section>
        {task.result ? <p class="strong">{task.result}</p> : null}
        <p class="cap muted">만든 시각 <RelTime t={task.createdAt} /></p>
      </div>
    </Page>
  );
}

function Detail({ path }: DetailProps) {
  if (path[0] === "rules") return <Rules />;
  const task = byId(tasks.value, path[0]);
  if (!task) return <Page title="비서 작업" backTo="/approvals"><Empty title="이 작업을 찾지 못했어요" /></Page>;
  return <TaskDetail key={task.id} task={task} />;
}

export const screen: ScreenDef = { split: true, Master, Detail };
