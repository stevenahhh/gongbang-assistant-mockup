import { Ban, ChevronRight, CircleAlert, Info } from "lucide-preact";
import type { Block, Reply, Tone } from "./catalog";
import { runAction } from "../chat";
import { approveTask, byId, classes, role, seatsTaken, slots, tasks, toast } from "../store";
import { BarRow, Btn, Status } from "../ui";
import { dateLabel, hhmm, relative, won } from "../lib/time";

const toneClass = (t?: Tone) => (t ? `tone-${t}` : "");

function Summary({ b }: { b: Extract<Block, { ui: "summary" }> }) {
  return (
    <div class="card stack blk-summary">
      <p class="blk-headline">{b.headline}</p>
      {b.stats.length ? (
        <div class="blk-stats">
          {b.stats.map((s) => (
            <div key={s.label} class={`blk-stat ${toneClass(s.tone)}`}>
              <span class="num strong">{s.value}</span>
              <span class="cap muted">{s.label}</span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function TodoList({ b }: { b: Extract<Block, { ui: "todo_list" }> }) {
  return (
    <div class="card blk-list">
      {b.title ? <p class="blk-title">{b.title}</p> : null}
      {b.items.map((it, i) => (
        <button key={i} type="button" class="rowitem" onClick={() => runAction(it.action)}>
          {it.tone ? <span class={`blk-dot ${toneClass(it.tone)}`} aria-hidden="true" /> : null}
          <span class="grow">
            <span class="strong clamp1 num">{it.title}</span>
            {it.sub ? <span class="sm muted clamp1">{it.sub}</span> : null}
          </span>
          <ChevronRight size={18} class="muted" />
        </button>
      ))}
    </div>
  );
}

function Schedule({ b }: { b: Extract<Block, { ui: "schedule" }> }) {
  return (
    <div class="card blk-list">
      <p class="blk-title">{b.title}</p>
      {b.rows.length ? (
        b.rows.map((r, i) => {
          const body = (
            <>
              <span class="num strong blk-time">{r.time}</span>
              <span class="grow">
                <span class="strong clamp1">{r.title}</span>
                {r.meta ? <span class="sm muted num clamp1">{r.meta}</span> : null}
              </span>
            </>
          );
          return r.action ? (
            <button key={i} type="button" class="rowitem" style={{ opacity: r.dim ? "0.55" : "1" }} onClick={() => runAction(r.action!)}>
              {body}
              <ChevronRight size={18} class="muted" />
            </button>
          ) : (
            <div key={i} class="rowitem" style={{ opacity: r.dim ? "0.55" : "1" }}>
              {body}
            </div>
          );
        })
      ) : (
        <p class="sm muted">{b.empty ?? "없어요"}</p>
      )}
    </div>
  );
}

function Approval({ taskId }: { taskId: string }) {
  const task = byId(tasks.value, taskId);
  if (!task) return <p class="sm muted">이 작업을 찾지 못했어요.</p>;
  const pending = task.status === "승인 대기";
  const blocked = Boolean(task.mismatch);
  const canAct = role.value !== "VIEWER";
  return (
    <article class="card stack">
      <div class="row between">
        <span class="cap muted">{task.kind}</span>
        <Status tone={pending ? "run" : task.status === "완료" || task.status === "알아서 처리됨" ? "ok" : "muted"}>{task.status}</Status>
      </div>
      <p class="strong">{task.title}</p>
      <p class="sm clamp2">{task.body}</p>
      <dl class="kv">
        <dt>누구에게</dt>
        <dd>{task.to}</dd>
        <dt>언제</dt>
        <dd class="num">{task.runAt < Date.now() ? "시간이 지났어요" : `${relative(task.runAt)} · ${hhmm(task.runAt)}`}</dd>
        {task.mismatch ? (
          <>
            <dt class="total">{task.mismatch.field}</dt>
            <dd>
              <span class="diff num">초안 {task.mismatch.draft}</span> · 원본 <span class="num">{task.mismatch.source}</span>
            </dd>
          </>
        ) : null}
      </dl>
      {task.reason ? <p class="sm muted">{task.reason}</p> : null}
      {pending && canAct ? (
        <div class="row">
          <Btn class="grow" onClick={() => void import("../screens/approvals").then((m) => m.openReject(task))}>
            거절
          </Btn>
          <Btn class="grow" variant="primary" disabled={blocked} onClick={() => approveTask(task.id) && toast("승인했어요")}>
            승인
          </Btn>
        </div>
      ) : task.result ? (
        <p class="sm strong">{task.result}</p>
      ) : null}
      {blocked && pending ? <p class="sm" style={{ color: "var(--err)" }}>원본과 금액이 달라서 승인할 수 없어요. 승인함에서 본문을 고쳐 주세요.</p> : null}
    </article>
  );
}

function Progress({ taskId }: { taskId: string }) {
  const task = byId(tasks.value, taskId);
  if (!task) return null;
  const p = task.progress;
  if (!p) return <div class="card sm strong">{task.result ?? `${task.kind} ${task.status}`}</div>;
  return (
    <div class="card stack">
      <span class="strong num">
        {task.kind} {p.total}건 보내는 중 · {p.done}/{p.total}
      </span>
      <div class="bar">
        <i style={{ transform: `scaleX(${p.done / p.total})` }} />
      </div>
    </div>
  );
}

function Kv({ b }: { b: Extract<Block, { ui: "kv" }> }) {
  return (
    <div class="card stack">
      <p class="blk-title">{b.title}</p>
      <dl class="kv">
        {b.rows.map((r) => (
          <>
            <dt>{r.label}</dt>
            <dd class="num">{r.value}</dd>
          </>
        ))}
        {b.total ? (
          <>
            <dt class="total">{b.total.label}</dt>
            <dd class="num strong">{b.total.value}</dd>
          </>
        ) : null}
      </dl>
    </div>
  );
}

function Bars({ b }: { b: Extract<Block, { ui: "bars" }> }) {
  return (
    <div class="card stack">
      <p class="blk-title">{b.title}</p>
      {b.rows.map((r) => (
        <BarRow key={r.label} label={r.label} value={r.value} max={r.max} tail={r.tail} />
      ))}
    </div>
  );
}

function BookingDraft({ b }: { b: Extract<Block, { ui: "booking_draft" }> }) {
  const slot = byId(slots.value, b.slotId);
  const cls = classes.value.find((c) => c.id === slot?.classId);
  const left = slot ? slot.cap - seatsTaken(slot.id) : undefined;
  const over = left !== undefined && b.party !== undefined && b.party > left;
  return (
    <div class="card stack">
      <div class="row between">
        <p class="blk-title" style={{ margin: "0" }}>예약 초안</p>
        <Status tone={over ? "warn" : "run"}>{over ? "정원 초과" : "저장 전"}</Status>
      </div>
      <dl class="kv">
        <dt>클래스</dt>
        <dd>{cls?.name ?? "회차를 골라 주세요"}</dd>
        <dt>날짜</dt>
        <dd class="num">{slot ? `${dateLabel(slot.start)} ${hhmm(slot.start)}` : "없음"}</dd>
        <dt>손님</dt>
        <dd>{b.name ?? "없음"}</dd>
        <dt>인원</dt>
        <dd class="num">{b.party ? `${b.party}명` : "없음"}</dd>
        <dt>남은 자리</dt>
        <dd class="num">{left !== undefined ? `${left}자리` : "없음"}</dd>
        {cls && b.party ? (
          <>
            <dt class="total">금액</dt>
            <dd class="num strong">{won(cls.price * b.party)}</dd>
          </>
        ) : null}
      </dl>
      {b.note ? <p class="sm muted">{b.note}</p> : null}
      <Btn variant="primary" block onClick={() => runAction({ type: "open_booking", slotId: b.slotId, name: b.name, phone: b.phone, party: b.party })}>
        예약 화면에서 확인하기
      </Btn>
    </div>
  );
}

function Notice({ b }: { b: Extract<Block, { ui: "notice" }> }) {
  const Icon = b.tone === "refuse" ? Ban : b.tone === "warn" ? CircleAlert : Info;
  return (
    <div class={`card stack blk-notice notice-${b.tone}`}>
      <div class="row" style={{ alignItems: "flex-start" }}>
        <Icon size={20} />
        <div class="grow stack" style={{ "--gap": "4px" }}>
          <p class="strong">{b.title}</p>
          {b.body ? <p class="sm">{b.body}</p> : null}
        </div>
      </div>
      {b.action ? (
        <Btn small onClick={() => runAction(b.action!.action)}>
          {b.action.label}
        </Btn>
      ) : null}
    </div>
  );
}

function Choices({ b }: { b: Extract<Block, { ui: "choices" }> }) {
  return (
    <div class="stack" style={{ "--gap": "var(--s2)" }}>
      {b.question ? <p class="sm">{b.question}</p> : null}
      <div class="row wrap" style={{ "--gap": "var(--s2)" }}>
        {b.options.map((o) => (
          <Btn key={o.label} small variant="outline" onClick={() => runAction(o.action)}>
            {o.label}
          </Btn>
        ))}
      </div>
    </div>
  );
}

export function RenderBlock({ b }: { b: Block }) {
  switch (b.ui) {
    case "text":
      return <p class="pre">{b.body}</p>;
    case "summary":
      return <Summary b={b} />;
    case "todo_list":
      return <TodoList b={b} />;
    case "schedule":
      return <Schedule b={b} />;
    case "approval":
      return <Approval taskId={b.taskId} />;
    case "progress":
      return <Progress taskId={b.taskId} />;
    case "kv":
      return <Kv b={b} />;
    case "bars":
      return <Bars b={b} />;
    case "booking_draft":
      return <BookingDraft b={b} />;
    case "notice":
      return <Notice b={b} />;
    case "choices":
      return <Choices b={b} />;
  }
}

export function RenderReply({ reply }: { reply: Reply }) {
  return (
    <div class="stack blk-reply">
      {reply.say ? <p class="blk-say">{reply.say}</p> : null}
      {reply.blocks.map((b, i) => (
        <RenderBlock key={i} b={b} />
      ))}
    </div>
  );
}
