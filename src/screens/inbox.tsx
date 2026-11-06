import { computed, signal } from "@preact/signals";
import { useState } from "preact/hooks";
import { Camera, Check, ClipboardPaste, Copy, MessageCircle, Mic, NotebookPen, Phone, Plus, Search, UserPlus } from "lucide-preact";
import { back, go, route, type DetailProps, type ScreenDef } from "../router";
import { addInquiry, addTask, bookings, byId, customers, inquiries, log, patch, role, scenario, staff, tasks, toast, actorKind, actorName, approveTask, rejectTask } from "../store";
import type { Channel, Inquiry, InquiryStatus, InquiryTag } from "../types";
import { Btn, Chips, Empty, Field, IconBtn, Mascot, Page, Status, TextArea, TextInput, openSheet } from "../ui";
import { hhmm, lastFour, relative } from "../lib/time";

const statusFilters: InquiryStatus[] = ["새 문의", "답장 초안 있음", "답함", "끝냄"];
const channelFilters: Channel[] = ["톡톡", "전화", "카카오톡", "인스타그램 DM", "블로그", "문자"];

const q = signal("");
const statusSel = signal<InquiryStatus[]>([]);
const channelSel = signal<Channel[]>([]);

const filtered = computed(() => {
  const term = q.value.trim().toLowerCase();
  const rows = inquiries.value.filter((i) => {
    if (statusSel.value.length ? !statusSel.value.includes(i.status) : i.status === "끝냄") return false;
    if (channelSel.value.length && !channelSel.value.includes(i.channel)) return false;
    if (!term) return true;
    return `${i.customerName} ${i.phone} ${i.messages.map((m) => m.text).join(" ")}`.toLowerCase().includes(term);
  });
  const rank = (s: InquiryStatus) => (s === "새 문의" ? 0 : s === "답장 초안 있음" ? 1 : 2);
  return rows.toSorted((a, b) => rank(a.status) - rank(b.status) || a.messages[0]!.at - b.messages[0]!.at);
});

const filtering = computed(() => Boolean(q.value || statusSel.value.length || channelSel.value.length));

export const statusTone = (s: InquiryStatus) => (s === "새 문의" ? "err" : s === "답장 초안 있음" ? "run" : s === "답함" ? "ok" : "muted");

function ChannelIcon({ channel }: { channel: Channel }) {
  const Icon = channel === "전화" ? Phone : channel === "톡톡" ? MessageCircle : channel === "카카오톡" ? MessageCircle : ClipboardPaste;
  return (
    <span class="glyph" title={channel}>
      <Icon size={20} />
      <span class="vh">{channel}</span>
    </span>
  );
}

function Row({ item, current }: { item: Inquiry; current: boolean }) {
  const last = item.messages[item.messages.length - 1]!;
  return (
    <button type="button" class="rowitem" aria-current={current || undefined} onClick={() => go(`/inbox/${item.id}`)}>
      <ChannelIcon channel={item.channel} />
      <span class="grow">
        <span class="row between" style={{ "--gap": "var(--s2)" }}>
          <span class="strong clamp1">{item.customerName}</span>
          <span class="cap muted num">{relative(item.messages[0]!.at)}</span>
        </span>
        <span class="sm muted clamp1">{last.text.slice(0, 40)}</span>
        <span class="row" style={{ "--gap": "6px", marginTop: "4px" }}>
          <Status tone={statusTone(item.status)}>{item.status}</Status>
          <Status>{item.tag}</Status>
          {item.assignee ? <Status>{item.assignee}</Status> : null}
        </span>
      </span>
    </button>
  );
}

function PhoneMemoForm({ close }: { close: () => void }) {
  const [phone, setPhone] = useState("");
  const [memo, setMemo] = useState("");
  const [recording, setRecording] = useState(false);
  const valid = /^01\d[- ]?\d{3,4}[- ]?\d{4}$/.test(phone) && memo.trim().length > 0;
  return (
    <div class="stack" style={{ "--gap": "var(--s4)" }}>
      <Field label="전화번호" error={phone.length > 3 && !/^01\d/.test(phone) && "휴대폰 번호로 써 주세요"}>
        <TextInput value={phone} onValue={setPhone} inputMode="tel" autoComplete="off" placeholder="010-0000-0000" />
      </Field>
      <Field label="내용">
        <TextArea value={memo} onValue={setMemo} placeholder="통화 내용을 적어 주세요" />
      </Field>
      <Btn
        variant="outline"
        onClick={() => {
          setRecording(!recording);
          if (recording) setMemo("음성 메모: 토요일 오전 수업 2명 문의, 주차 가능 여부 확인 요청");
        }}
      >
        <Mic size={18} /> {recording ? "녹음 끝내기" : "음성 메모 남기기"}
      </Btn>
      {recording ? <p class="help-text">듣고 있어요. 끝내면 글자로 바꿔 드려요.</p> : null}
      <Btn
        variant="primary"
        disabled={!valid}
        onClick={() => {
          const known = customers.value.find((c) => c.phone.replace(/\D/g, "") === phone.replace(/\D/g, ""));
          addInquiry({ channel: "전화", customerName: known?.name ?? `번호 ${lastFour(phone)}`, phone, tag: "확인 필요", tagEvidence: memo.slice(0, 12), status: "새 문의", messages: [{ from: "손님", text: `전화 메모: ${memo}`, at: Date.now() }] });
          toast("전화 메모를 문의로 등록했어요");
          close();
        }}
      >
        저장
      </Btn>
    </div>
  );
}

function PasteForm({ close }: { close: () => void }) {
  const [text, setText] = useState("11월 15일 토요일 2명 물레 가능할까요?");
  const [channel, setChannel] = useState<Channel>("카카오톡");
  const [phone, setPhone] = useState("");
  const party = text.match(/(\d+)\s*명/)?.[1];
  const date = text.match(/\d+월\s*\d+일/)?.[0];
  return (
    <div class="stack" style={{ "--gap": "var(--s4)" }}>
      <Field label="붙여 넣을 대화" error={text.length > 5000 && "5,000자까지 붙여 넣을 수 있어요"} hint={`${text.length.toLocaleString()} / 5,000자`}>
        <TextArea value={text} onValue={setText} />
      </Field>
      <Btn variant="outline" onClick={() => toast("스크린숏에서 글자를 읽었어요")}>
        <Camera size={18} /> 스크린숏으로 넣기
      </Btn>
      <div class="field">
        <span class="field-label">어디서 온 대화인가요</span>
        <Chips label="채널" options={["카카오톡", "인스타그램 DM", "블로그", "문자", "기타"] as Channel[]} value={[channel]} onChange={(v) => v.length && setChannel(v[v.length - 1]!)} />
      </div>
      <Field label="손님 연락처(선택)">
        <TextInput value={phone} onValue={setPhone} inputMode="tel" placeholder="010-0000-0000" />
      </Field>
      {date || party ? (
        <div class="card sm">
          <p class="strong">비서가 찾은 내용</p>
          <p class="num">날짜 {date ?? "없음"} · 인원 {party ? `${party}명` : "없음"} · 클래스 원데이 물레 체험</p>
        </div>
      ) : null}
      <Btn
        variant="primary"
        disabled={!text.trim() || text.length > 5000}
        onClick={() => {
          addInquiry({ channel, customerName: phone ? `번호 ${lastFour(phone)}` : `${channel} 손님`, phone, tag: "예약 요청", tagEvidence: text.slice(0, 14), status: "새 문의", messages: [{ from: "손님", text, at: Date.now() }], extracted: { date, party: party ? Number(party) : undefined, classId: "c1" } });
          toast("붙여 넣은 대화를 문의로 등록했어요");
          close();
        }}
      >
        문의로 등록
      </Btn>
    </div>
  );
}

function openAdd() {
  openSheet("문의 넣기", (close) => (
    <div class="stack">
      <button type="button" class="card tap row" onClick={() => { close(); openSheet("전화 메모", (c) => <PhoneMemoForm close={c} />); }}>
        <span class="glyph"><NotebookPen size={20} /></span>
        <span class="grow"><span class="strong">전화 메모</span><span class="sm muted" style={{ display: "block" }}>수업 중 받지 못한 전화를 적어요</span></span>
      </button>
      <button type="button" class="card tap row" onClick={() => { close(); openSheet("대화 붙여 넣기", (c) => <PasteForm close={c} />); }}>
        <span class="glyph"><ClipboardPaste size={20} /></span>
        <span class="grow"><span class="strong">대화 붙여 넣기</span><span class="sm muted" style={{ display: "block" }}>카카오톡, DM, 블로그, 문자 대화를 넣어요</span></span>
      </button>
    </div>
  ));
}

function Master() {
  const selected = route.value.key === "inbox" ? route.value.path[0] : undefined;
  const rows = scenario.value === "empty" ? [] : filtered.value;
  return (
    <Page
      title="문의함"
      right={
        <IconBtn label="문의 넣기" solid onClick={openAdd}>
          <Plus size={22} />
        </IconBtn>
      }
    >
      <div class="field" style={{ position: "relative", marginBottom: "var(--s2)" }}>
        <Search size={18} style={{ position: "absolute", left: "16px", top: "17px", color: "var(--ink-2)" }} />
        <input class="input" style={{ paddingLeft: "44px" }} type="search" aria-label="이름, 번호, 내용으로 찾기" placeholder="이름, 번호, 내용으로 찾기" value={q.value} onInput={(e) => (q.value = e.currentTarget.value)} />
      </div>
      <Chips label="상태" options={statusFilters} value={statusSel.value} onChange={(v) => (statusSel.value = v)} />
      <Chips label="채널" options={channelFilters} value={channelSel.value} onChange={(v) => (channelSel.value = v)} />
      <p class="sm muted num" style={{ marginBottom: "var(--s1)" }}>{rows.length}건</p>
      {rows.length ? (
        <div class="list">
          {rows.map((i) => (
            <Row key={i.id} item={i} current={i.id === selected} />
          ))}
        </div>
      ) : filtering.value ? (
        <Empty title="조건에 맞는 문의가 없어요" action={<Btn small onClick={() => { q.value = ""; statusSel.value = []; channelSel.value = []; }}>필터 지우기</Btn>} />
      ) : (
        <Empty title="아직 문의가 없어요" action={<Btn small onClick={() => openSheet("전화 메모", (c) => <PhoneMemoForm close={c} />)}>전화 메모를 남겨 보세요</Btn>} />
      )}
    </Page>
  );
}

function DraftCard({ item }: { item: Inquiry }) {
  const task = byId(tasks.value, item.taskId);
  const [editing, setEditing] = useState(false);
  const [body, setBody] = useState(task?.body ?? "");
  if (!task || task.status !== "승인 대기") return null;
  const direct = item.channel === "톡톡";
  const canApprove = role.value !== "VIEWER";
  return (
    <div class="card stack">
      <div class="row between">
        <span class="row" style={{ "--gap": "var(--s2)" }}><Mascot size={26} /><span class="strong">답장 초안</span></span>
        <Status tone="run">승인 대기</Status>
      </div>
      {editing ? <TextArea aria-label="답장 고치기" value={body} onValue={setBody} /> : <button type="button" style={{ textAlign: "start" }} class="pre" onClick={() => setEditing(true)}>{task.body}</button>}
      {task.reason ? <p class="sm muted">{task.reason}</p> : null}
      <dl class="kv">
        {task.evidence.map((e) => (
          <>
            <dt>{e.label}</dt>
            <dd class="num">{e.value}</dd>
          </>
        ))}
      </dl>
      <div class="row">
        <Btn class="grow" onClick={() => { rejectTask(task.id, "기타"); patch(inquiries, item.id, { status: "새 문의", taskId: undefined }); toast("초안을 버렸어요"); }}>버리기</Btn>
        {direct ? (
          <Btn class="grow" variant="primary" disabled={!canApprove} onClick={() => { approveTask(task.id, editing ? body : undefined); toast("승인했어요. 톡톡으로 보내요"); }}>
            {editing ? "고쳐서 보내기" : "보내기"}
          </Btn>
        ) : (
          <Btn class="grow" variant="primary" onClick={() => { void navigator.clipboard?.writeText(editing ? body : task.body); approveTask(task.id, editing ? body : undefined); toast("복사했어요. 손님께 직접 보내 주세요"); }}>
            <Copy size={18} /> 복사하기
          </Btn>
        )}
      </div>
      <p class="cap muted">비서가 틀릴 수 있어요. 카드 내용을 확인해 주세요.</p>
    </div>
  );
}

const tagOptions: InquiryTag[] = ["예약 요청", "가격·시간 문의", "주차·위치", "변경·취소", "작품 수령", "단체·출강 견적", "기타", "확인 필요"];

function openTagPicker(item: Inquiry) {
  openSheet("분류 바꾸기", (close) => (
    <div class="list">
      {tagOptions.map((t) => (
        <button
          key={t}
          type="button"
          class="rowitem"
          onClick={() => {
            patch(inquiries, item.id, { tag: t });
            log({ actorKind: actorKind(), actor: actorName(), action: "사람이 분류 수정", target: `${item.customerName} 문의`, targetType: "문의", result: "완료" });
            toast("분류를 바꿨어요");
            close();
          }}
        >
          <span class="grow">{t}</span>
          {t === item.tag ? <Check size={20} /> : null}
        </button>
      ))}
    </div>
  ));
}

function openAssign(item: Inquiry) {
  const people = staff.value.filter((s) => s.role === "STAFF" && s.status === "활성");
  openSheet("직원에게 맡기기", (close) => (
    <div class="list">
      {people.map((s) => (
        <button key={s.id} type="button" class="rowitem" onClick={() => { patch(inquiries, item.id, { assignee: s.name }); toast(`${s.name}님에게 맡겼어요`); close(); }}>
          <span class="grow">{s.name}</span>
        </button>
      ))}
    </div>
  ));
}

function Detail({ path }: DetailProps) {
  const item = byId(inquiries.value, path[0]);
  if (!item) return <Page title="문의" backTo="/inbox"><Empty title="이 문의를 찾지 못했어요" /></Page>;
  const customer = customers.value.find((c) => c.phone === item.phone);
  const booked = bookings.value.find((b) => b.inquiryId === item.id);
  const hasStaff = staff.value.some((s) => s.role === "STAFF" && s.status === "활성");
  const makeBooking = () =>
    void import("./booking-form").then((m) => m.openBookingForm({ name: item.customerName, phone: item.phone, party: item.extracted?.party, slotId: item.extracted?.slotId, inquiryId: item.id }));
  return (
    <Page
      title={item.customerName}
      backTo="/inbox"
      sub
      foot={
        <>
          {item.status !== "끝냄" ? (
            <Btn onClick={() => { patch(inquiries, item.id, { status: "끝냄" }); toast("문의를 끝냈어요", () => patch(inquiries, item.id, { status: item.status })); back("/inbox"); }}>
              끝냄
            </Btn>
          ) : null}
          {booked ? (
            <Btn variant="outline" onClick={() => go(`/booking/${booked.id}`)}>예약 보기</Btn>
          ) : (
            <Btn variant={item.taskId ? "outline" : "primary"} onClick={makeBooking}>예약 만들기</Btn>
          )}
        </>
      }
    >
      <div class="wide stack" style={{ "--gap": "var(--s4)" }}>
        <div class="row wrap" style={{ "--gap": "6px" }}>
          <Status>{item.channel}</Status>
          <button type="button" class="tap44" onClick={() => openTagPicker(item)} aria-label="분류 바꾸기"><Status tone="run">{item.tag}</Status></button>
          {customer && customer.noShows > 0 ? <Status tone="warn">노쇼 {customer.noShows}회</Status> : null}
          {hasStaff && role.value === "OWNER" ? (
            <button type="button" class="status" style={{ minHeight: "44px" }} onClick={() => openAssign(item)}>
              <UserPlus size={14} /> {item.assignee ?? "맡기기"}
            </button>
          ) : null}
        </div>
        <p class="sm muted">근거: “{item.tagEvidence}”</p>
        <div class="chat">
          {item.messages.map((m, i) =>
            m.from === "시스템" ? (
              <div key={i} class="sysline num"><Check size={14} /> {m.text} · {hhmm(m.at)}</div>
            ) : (
              <div key={i} class={m.from === "손님" ? "bubble" : "bubble mine"}>{m.text}</div>
            ),
          )}
        </div>
        <DraftCard item={item} />
        {!item.taskId && item.status === "새 문의" ? (
          <Btn
            variant="outline"
            onClick={() => {
              const t = addTask({ kind: "답장", title: `${item.customerName}님 문의에 답장해요`, to: `${item.customerName} · ${item.channel}`, runAt: Date.now() + 3_600_000, body: "문의 주셔서 감사해요. 수업 끝나고 자세히 안내해 드릴게요.", evidence: [{ label: "공방 정보", value: "운영 시간" }], inquiryId: item.id });
              patch(inquiries, item.id, { status: "답장 초안 있음", taskId: t.id });
            }}
          >
            답장 초안 받기
          </Btn>
        ) : null}
      </div>
    </Page>
  );
}

export const screen: ScreenDef = { split: true, Master, Detail };
