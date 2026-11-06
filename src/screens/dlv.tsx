import { computed, signal } from "@preact/signals";
import { useState } from "preact/hooks";
import { CalendarClock, ChevronDown, ChevronUp, ClipboardPaste, Package, PackageCheck, Phone, Truck } from "lucide-preact";
import { go, type ScreenDef } from "../router";
import { actorKind, actorName, addTask, bookings, byId, classes, customers, deliveries, log, newId, patch, role, scenario, shop, slots, toast } from "../store";
import type { DeliveryItem } from "../types";
import { Btn, Empty, Field, IconBtn, Page, Status, TextArea, openSheet } from "../ui";
import { DAY, MIN, dateLabel, dayKey, startOfToday } from "../lib/time";

interface Row extends Omit<DeliveryItem, "bookingId" | "method"> {
  bookingId: string;
  method?: DeliveryItem["method"];
  auto?: boolean;
  fireDays?: number;
}

const KEEP = 30;
const handled = signal<string[]>([]);
const noticed = signal<string[]>([]);
const doneOpen = signal(false);

const rows = computed<Row[]>(() => {
  const own: Row[] = deliveries.value.map((d) => ({ ...d }));
  const have = new Set(own.map((d) => d.bookingId));
  const now = Date.now();
  const derived: Row[] = [];
  for (const b of bookings.value) {
    if (have.has(b.id) || (b.status !== "확정" && b.status !== "출석")) continue;
    const slot = byId(slots.value, b.slotId);
    if (!slot || slot.start > now) continue;
    const cls = byId(classes.value, slot.classId);
    if (!cls?.fireDays) continue;
    derived.push({
      id: `bk-${b.id}`,
      bookingId: b.id,
      customer: byId(customers.value, b.customerId)?.name ?? "손님",
      className: cls.name,
      classDate: slot.start,
      dueAt: midnight(slot.start) + cls.fireDays * DAY,
      auto: true,
      fireDays: cls.fireDays,
    });
  }
  return [...own, ...derived];
});

const groups = computed(() => {
  const all = rows.value;
  const open = all.filter((r) => !r.sent);
  return {
    due: open.filter((r) => !r.noAddress && !r.storedDays && !(r.method === "택배" && r.address)).toSorted((a, b) => a.dueAt - b.dueAt),
    noAddr: open.filter((r) => r.noAddress),
    ship: open.filter((r) => r.method === "택배" && Boolean(r.address) && !r.noAddress),
    stored: open.filter((r) => Boolean(r.storedDays)).toSorted((a, b) => (b.storedDays ?? 0) - (a.storedDays ?? 0)),
    done: all.filter((r) => r.sent),
  };
});

const dayDiff = (t: number) => Math.round((t - startOfToday()) / DAY);
const midnight = (t: number) => new Date(`${dayKey(t)}T00:00:00+09:00`).getTime();

function materialize(r: Row): DeliveryItem {
  if (!r.auto) return byId(deliveries.value, r.id)!;
  const item: DeliveryItem = { id: newId("d"), bookingId: r.bookingId, customer: r.customer, className: r.className, classDate: r.classDate, dueAt: r.dueAt, method: "픽업" };
  deliveries.value = [...deliveries.value, item];
  return item;
}

function DueForm({ r, close }: { r: Row; close: () => void }) {
  const [date, setDate] = useState(dayKey(r.dueAt));
  const save = () => {
    const t = new Date(`${date}T00:00:00+09:00`).getTime();
    if (!Number.isFinite(t)) return;
    const item = materialize(r);
    const prev = item.dueAt;
    patch(deliveries, item.id, { dueAt: t });
    log({ actorKind: actorKind(), actor: actorName(), action: "완성 예정일 변경", target: `${r.customer} · ${r.className}`, targetType: "예약", result: "완료", evidence: [{ label: "새 예정일", value: dateLabel(t) }] });
    toast("완성 예정일을 바꿨어요", () => patch(deliveries, item.id, { dueAt: prev }));
    close();
  };
  return (
    <div class="stack" style={{ "--gap": "var(--s4)" }}>
      <p class="sm muted">
        지금은 {dateLabel(r.dueAt)}이에요.{r.auto ? ` 수업일에 소성 ${r.fireDays}일을 더해 정했어요.` : ""}
      </p>
      <div class="row">
        {[-7, -3, 3, 7].map((n) => (
          <Btn key={n} small class="grow num" onClick={() => setDate(dayKey(r.dueAt + n * DAY))}>
            {n > 0 ? `+${n}일` : `${n}일`}
          </Btn>
        ))}
      </div>
      <Field label="완성 예정일">
        <input class="input" type="date" value={date} onInput={(e) => setDate(e.currentTarget.value)} />
      </Field>
      <Btn variant="primary" disabled={!date} onClick={save}>
        저장
      </Btn>
    </div>
  );
}

const openDue = (r: Row) => openSheet("완성 예정일 바꾸기", (close) => <DueForm r={r} close={close} />);

function TrackingForm({ close, preset }: { close: () => void; preset?: Row }) {
  const [text, setText] = useState(preset ? `${preset.customer} ` : "");
  const candidates = rows.value.filter((r) => !r.sent && !r.tracking);
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const parsed = lines.map((line) => {
    const num = line.match(/\d[\d-]{8,16}\d/)?.[0] ?? "";
    const digits = num.replace(/\D/g, "");
    const name = line.replace(num, "").replace(/[,\t·]/g, " ").trim();
    const target = candidates.find((r) => Boolean(name) && (r.customer === name || name.includes(r.customer)));
    const error = !num || digits.length < 10 || digits.length > 14 ? "송장번호가 맞지 않아요" : !target ? "손님을 찾지 못했어요" : target.method === "픽업" && !target.noAddress ? "픽업 손님이에요" : undefined;
    return { line, num, name, target, error };
  });
  const ok = parsed.filter((p) => !p.error);
  const create = () => {
    const seen = new Set<string>();
    let n = 0;
    for (const p of ok) {
      const target = p.target!;
      if (seen.has(target.id)) continue;
      seen.add(target.id);
      const item = materialize(target);
      patch(deliveries, item.id, { tracking: p.num, method: "택배", sent: true, noAddress: false });
      addTask({
        kind: "발송 안내",
        title: `${item.customer}님 발송 안내`,
        to: `${item.customer} · 알림톡`,
        runAt: Date.now() + 10 * MIN,
        body: `${item.customer}님, ${item.className}에서 만드신 작품을 택배로 보냈어요. 송장번호는 ${p.num}이에요. 보통 1~2일이면 도착해요.`,
        evidence: [
          { label: "송장번호", value: p.num },
          { label: "클래스", value: item.className },
          { label: "주소", value: item.address ?? "손님이 남긴 주소" },
        ],
      });
      n += 1;
    }
    const skipped = parsed.length - ok.length;
    log({ actorKind: actorKind(), actor: actorName(), action: `발송 안내 초안 ${n}건 요청`, target: "송장번호 붙여 넣기", targetType: "예약", result: "완료" });
    toast(`발송 안내 초안 ${n}건을 승인함에 넣었어요${skipped ? `. ${skipped}줄은 건너뛰었어요` : ""}`);
    close();
  };
  return (
    <div class="stack" style={{ "--gap": "var(--s4)" }}>
      <Field label="송장번호 붙여 넣기" hint="한 줄에 한 건씩 손님 이름과 송장번호를 적어요. 여러 건을 한 번에 넣을 수 있어요.">
        <TextArea value={text} onValue={setText} placeholder={"임소율 6012-3344-5566\n한지우 6012-7788-9900"} />
      </Field>
      {parsed.length ? (
        <div class="list">
          {parsed.map((p, i) => (
            <div key={i} class="rowitem" style={{ minHeight: "52px" }}>
              <span class="grow">
                <span class="strong clamp1">{p.target?.customer ?? (p.name || "이름 없음")}</span>
                <span class="sm muted clamp1 num">{p.line}</span>
              </span>
              {p.error ? <Status tone="err">{p.error}</Status> : <Status tone="ok">초안 만들어요</Status>}
            </div>
          ))}
        </div>
      ) : null}
      <Btn variant="primary" disabled={!ok.length} onClick={create}>
        초안 {ok.length}건 만들기
      </Btn>
      <p class="cap muted">초안은 승인함에서 확인한 뒤에 나가요. 틀린 줄은 고쳐서 다시 넣어 주세요.</p>
    </div>
  );
}

const openTracking = (preset?: Row) => openSheet("송장번호 붙여 넣기", (close) => <TrackingForm close={close} preset={preset} />);

function askPickupLink(r: Row) {
  addTask({
    kind: "리마인드",
    title: `${r.customer}님 수령 방법 확인`,
    to: `${r.customer} · 알림톡`,
    runAt: Date.now() + 30 * MIN,
    body: `${r.customer}님, ${r.className}에서 만드신 작품이 완성됐어요. 택배로 받으시려면 주소를 남겨 주세요. 남기지 않으시면 공방에서 찾아가실 수 있어요. ${shop.value.hours}`,
    evidence: [
      { label: "완성 예정", value: dateLabel(r.dueAt) },
      { label: "응답", value: "아직 없음" },
    ],
  });
  toast("수령 방법 확인 초안을 승인함에 넣었어요");
}

function ItemSheet({ r, close }: { r: Row; close: () => void }) {
  const d = dayDiff(r.dueAt);
  const finish = (how: "픽업" | "택배") => {
    const item = materialize(r);
    patch(deliveries, item.id, { sent: true, method: how, noAddress: false });
    log({ actorKind: actorKind(), actor: actorName(), action: how === "픽업" ? "작품 수령 확인" : "발송 확인", target: `${r.customer} · ${r.className}`, targetType: "예약", result: "완료" });
    toast(how === "픽업" ? "손님이 찾아간 작품으로 표시했어요" : "보낸 작품으로 표시했어요", () => patch(deliveries, item.id, { sent: false }));
    close();
  };
  return (
    <div class="stack" style={{ "--gap": "var(--s4)" }}>
      <dl class="kv">
        <dt>클래스</dt>
        <dd>{r.className}</dd>
        <dt>수업일</dt>
        <dd class="num">{dateLabel(r.classDate)}</dd>
        <dt>완성 예정</dt>
        <dd class="num">
          {dateLabel(r.dueAt)} · {d === 0 ? "오늘" : d > 0 ? `${d}일 뒤` : `${-d}일 전`}
        </dd>
        <dt>수령 방법</dt>
        <dd>{r.method ?? "아직 몰라요"}{r.noAddress ? " · 주소 미입력" : ""}</dd>
        {r.address ? (
          <>
            <dt>주소</dt>
            <dd>{r.address}</dd>
          </>
        ) : null}
        {r.tracking ? (
          <>
            <dt>송장번호</dt>
            <dd class="num">{r.tracking}</dd>
          </>
        ) : null}
      </dl>
      {r.auto ? <p class="cap muted">수업일에 소성 {r.fireDays}일을 더해 완성 예정일을 자동으로 넣었어요.</p> : null}
      {r.sent ? (
        <Status tone="ok">{r.method === "택배" ? "보냈어요" : "찾아갔어요"}</Status>
      ) : (
        <div class="stack">
          <Btn
            onClick={() => {
              close();
              openDue(r);
            }}
          >
            <CalendarClock size={18} /> 완성 예정일 바꾸기
          </Btn>
          {r.noAddress ? (
            <Btn
              variant="outline"
              onClick={() => {
                askPickupLink(r);
                close();
              }}
            >
              수령 방법 다시 묻기
            </Btn>
          ) : null}
          {r.method !== "픽업" || r.noAddress ? (
            <Btn
              variant="primary"
              onClick={() => {
                close();
                openTracking(r);
              }}
            >
              <Truck size={18} /> 송장번호 넣기
            </Btn>
          ) : null}
          <Btn variant={r.method === "픽업" && !r.noAddress ? "primary" : "plain"} onClick={() => finish("픽업")}>
            <PackageCheck size={18} /> 손님이 찾아갔어요
          </Btn>
        </div>
      )}
    </div>
  );
}

const openItem = (r: Row) => openSheet(`${r.customer}님 작품`, (close) => <ItemSheet r={r} close={close} />);

function DlvRow({ r }: { r: Row }) {
  const d = dayDiff(r.dueAt);
  const Icon = r.sent ? PackageCheck : r.method === "택배" ? Truck : r.method === "픽업" ? Package : CalendarClock;
  const chip = r.sent ? (r.method === "택배" ? "보냈어요" : "찾아갔어요") : d === 0 ? "오늘" : d > 0 ? `D-${d}` : `${-d}일 지남`;
  const tone = r.sent ? "ok" : d < 0 ? "warn" : d === 0 ? "run" : "muted";
  const detail = [`완성 ${dateLabel(r.dueAt)}`, r.method ?? "수령 방법 미정", r.address, r.tracking ? `송장 ${r.tracking}` : undefined].filter(Boolean).join(" · ");
  return (
    <button type="button" class="rowitem" onClick={() => openItem(r)}>
      <span class="glyph">
        <Icon size={20} />
      </span>
      <span class="grow">
        <span class="row between" style={{ "--gap": "var(--s2)" }}>
          <span class="strong clamp1">
            {r.customer} · {r.className}
          </span>
          <Status tone={tone}>{chip}</Status>
        </span>
        <span class="sm muted clamp1 num">{detail}</span>
        {r.auto ? <span class="cap muted">수업일 + 소성 {r.fireDays}일로 자동 계산했어요</span> : null}
      </span>
    </button>
  );
}

function Group({ title, items, empty, note }: { title: string; items: Row[]; empty: string; note?: string }) {
  return (
    <section class="stack" style={{ "--gap": "var(--s2)" }}>
      <div class="row between">
        <h2 class="section-head" style={{ margin: 0 }}>
          {title}
        </h2>
        <Status tone={items.length ? "run" : "muted"}>{items.length}건</Status>
      </div>
      {note ? <p class="cap muted">{note}</p> : null}
      {items.length ? (
        <div class="list">
          {items.map((r) => (
            <DlvRow key={r.id} r={r} />
          ))}
        </div>
      ) : (
        <p class="sm muted">{empty}</p>
      )}
    </section>
  );
}

function StoredCard({ r }: { r: Row }) {
  const days = r.storedDays ?? 0;
  const over = days > KEEP;
  const done = handled.value.includes(r.id);
  const sentNotice = noticed.value.includes(r.id);
  const phone = customers.value.find((c) => c.name === r.customer)?.phone;
  const makeNotice = () => {
    addTask({
      kind: "리마인드",
      title: `${r.customer}님 작품 수령 안내`,
      to: `${r.customer} · 알림톡`,
      runAt: Date.now() + 30 * MIN,
      body: `${r.customer}님, ${r.className}에서 만드신 작품을 공방에서 보관하고 있어요. 보관 기한이 ${KEEP - days}일 남았어요. ${shop.value.hours}에 찾아가실 수 있어요.`,
      evidence: [
        { label: "보관 일수", value: `${days}일` },
        { label: "보관 기한", value: `${KEEP}일` },
      ],
    });
    noticed.value = [...noticed.value, r.id];
    toast("수령 안내 초안을 승인함에 넣었어요");
  };
  const markHandled = () => {
    handled.value = [...handled.value, r.id];
    log({ actorKind: actorKind(), actor: actorName(), action: "보관 기한 지난 작품 처리", target: `${r.customer} · ${r.className}`, targetType: "예약", result: "완료" });
    toast("처리한 일로 표시했어요", () => (handled.value = handled.value.filter((id) => id !== r.id)));
  };
  return (
    <article class={over ? "card g-card alert" : "card g-card g-warn"}>
      <div class="row between">
        <span class="strong clamp1">
          {r.customer} · {r.className}
        </span>
        <Status tone={over ? "err" : "warn"}>보관 {days}일째</Status>
      </div>
      <p class="sm">{over ? `보관 기한 ${KEEP}일이 ${days - KEEP}일 지났어요. 사장님이 직접 연락해 주세요.` : `보관 기한까지 ${KEEP - days}일 남았어요. 손님에게 안내 초안을 만들어 둘게요.`}</p>
      {over ? (
        done ? (
          <Status tone="ok">연락했어요</Status>
        ) : (
          <div class="row wrap">
            {phone ? (
              <a class="btn grow" href={`tel:${phone}`}>
                <Phone size={18} /> 전화하기
              </a>
            ) : null}
            <Btn class="grow" variant="primary" onClick={markHandled}>
              처리했어요
            </Btn>
          </div>
        )
      ) : sentNotice ? (
        <Status tone="run">안내 초안이 승인함에 있어요</Status>
      ) : (
        <Btn variant="outline" onClick={makeNotice}>
          손님 안내 초안 만들기
        </Btn>
      )}
      <button type="button" class="cap muted" style={{ textAlign: "start", minHeight: "44px" }} onClick={() => openItem(r)}>
        작품 자세히 보기
      </button>
    </article>
  );
}

function Master() {
  if (role.value === "VIEWER") {
    return (
      <Page title="배송">
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
  const g = groups.value;
  const empty = scenario.value === "empty";
  return (
    <div class="growth-root">
      <Page
        title="배송"
        backTo="/more"
        sub={false}
        right={
          <IconBtn label="송장번호 붙여 넣기" solid onClick={() => openTracking()}>
            <ClipboardPaste size={22} />
          </IconBtn>
        }
      >
        <div class="wide stack" style={{ "--gap": "var(--s5)" }}>
          {empty ? (
            <Empty title="챙길 작품이 없어요">수업이 끝나면 완성 예정일을 자동으로 넣어 둘게요.</Empty>
          ) : (
            <>
              <Group title="완성 예정" items={g.due} empty="완성을 기다리는 작품이 없어요." />
              <Group title="주소 미입력" items={g.noAddr} empty="주소를 기다리는 손님이 없어요." note="수령 링크에 답이 없으면 픽업으로 두고 여기에 모아요." />
              <Group title="발송 대기" items={g.ship} empty="보낼 택배가 없어요." note="송장번호를 붙여 넣으면 손님별 발송 안내 초안을 만들어요." />
              <section class="stack" style={{ "--gap": "var(--s2)" }}>
                <div class="row between">
                  <h2 class="section-head" style={{ margin: 0 }}>
                    보관 기한
                  </h2>
                  <Status tone={g.stored.length ? "warn" : "muted"}>{g.stored.length}건</Status>
                </div>
                <p class="cap muted">픽업 작품은 {KEEP}일까지 보관해요. 7일 전에 손님 안내 초안을 만들어요. 기한이 지나면 사장님 할 일로 올려요.</p>
                {g.stored.length ? (
                  <div class="stack">
                    {g.stored.map((r) => (
                      <StoredCard key={r.id} r={r} />
                    ))}
                  </div>
                ) : (
                  <p class="sm muted">보관 중인 작품이 없어요.</p>
                )}
              </section>
              {g.done.length ? (
                <section>
                  <button type="button" class="rowitem" aria-expanded={doneOpen.value} onClick={() => (doneOpen.value = !doneOpen.value)}>
                    <span class="glyph">
                      <PackageCheck size={20} />
                    </span>
                    <span class="grow">
                      <span class="strong num" style={{ display: "block" }}>
                        끝난 작품 {g.done.length}건
                      </span>
                      <span class="sm muted">보냈거나 손님이 찾아간 작품이에요</span>
                    </span>
                    {doneOpen.value ? <ChevronUp size={20} class="muted" /> : <ChevronDown size={20} class="muted" />}
                  </button>
                  {doneOpen.value ? (
                    <div class="list">
                      {g.done.map((r) => (
                        <DlvRow key={r.id} r={r} />
                      ))}
                    </div>
                  ) : null}
                </section>
              ) : null}
            </>
          )}
        </div>
      </Page>
    </div>
  );
}

export const screen: ScreenDef = { Master };
