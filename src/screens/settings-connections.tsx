import { computed } from "@preact/signals";
import { useState } from "preact/hooks";
import { Check, ChevronRight, Copy, Landmark, Link2, MessageCircle, Newspaper, Plus, Send, X } from "lucide-preact";
import { go, route } from "../router";
import { actorKind, actorName, byId, connections, log, messages, newId, patch, role, toast } from "../store";
import type { ConnStatus, Connection, Tone } from "../types";
import { Btn, Empty, Field, IconBtn, Mascot, Page, RelTime, Status, Switch, TextInput, openSheet } from "../ui";
import { DAY, dateLabel, relative } from "../lib/time";
import { Denied, Row, Rows, SecretField, SecureSave, daysLeft, isTel } from "./settings-shared";

export const connTone = (s: ConnStatus): Tone => (s === "정상" ? "ok" : s === "곧 만료" ? "warn" : s === "만료" || s === "오류" ? "err" : s === "해제됨" ? "muted" : "run");

export function ConnIcon({ name, size = 20 }: { name: string; size?: number }) {
  const Icon = name.includes("톡톡") ? MessageCircle : name.includes("알림톡") ? Send : name.includes("기업마당") ? Landmark : name.includes("게시판") ? Newspaper : Link2;
  return <Icon size={size} />;
}

const expiringSoon = (c: Connection) => c.status !== "해제됨" && c.expiresAt !== undefined && daysLeft(c.expiresAt) <= 30;
const rank = (c: Connection) => (expiringSoon(c) || c.status === "만료" ? 0 : c.status === "오류" ? 1 : c.status === "해제됨" ? 3 : 2);
export const sortedConnections = computed(() => connections.value.toSorted((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name, "ko")));

export const statusLine = (c: Connection) =>
  c.status === "해제됨"
    ? "해제했어요. 다시 쓰려면 처음부터 설정해요"
    : c.status === "오류"
      ? c.error ?? "오류가 났어요"
      : c.status === "심사 중"
        ? "카카오 심사 중이에요. 그동안 SMS로만 보내요"
        : c.status === "설정 중"
          ? "설정을 아직 마치지 않았어요"
          : c.status === "만료"
            ? "만료됐어요. 갱신해 주세요"
            : c.expiresAt && daysLeft(c.expiresAt) <= 30
              ? `${daysLeft(c.expiresAt)}일 뒤 만료 · 갱신이 필요해요`
              : c.lastUsed
                ? `마지막 사용 ${relative(c.lastUsed)}`
                : "아직 쓰지 않았어요";

function upsert(name: string, data: Omit<Connection, "id" | "name">) {
  const found = connections.value.find((c) => c.name === name);
  if (found) patch(connections, found.id, data);
  else connections.value = [...connections.value, { ...data, id: newId("cn"), name }];
  log({ actorKind: actorKind(), actor: actorName(), action: `${name}을 연결함`, target: name, targetType: "연결", result: data.status === "심사 중" ? "대기" : "완료" });
}

function Steps({ n, at }: { n: number; at: number }) {
  return (
    <div class="row between">
      <div class="adm-steps grow" aria-hidden="true">
        {Array.from({ length: n }, (_, i) => (
          <i key={i} data-on={i < at ? "" : undefined} />
        ))}
      </div>
      <span class="cap muted num">
        {at} / {n}
      </span>
    </div>
  );
}

function TalkFlow({ close, onDone }: { close: () => void; onDone?: () => void }) {
  const [step, setStep] = useState(1);
  const [token, setToken] = useState("");
  const [ack, setAck] = useState(true);
  const [test, setTest] = useState<"idle" | "sending" | "ok">("idle");
  const hook = "https://assistant.example.com/hooks/talktalk/shop-1";
  const finish = () => {
    const now = Date.now();
    upsert("네이버 톡톡", {
      verbLine: "톡톡 문의를 문의함에 모아요",
      status: "정상",
      lastUsed: now,
      expiresAt: now + 365 * DAY,
      can: ["받은 톡톡을 문의함에 모아요", "승인한 답장을 보내요", ...(ack ? ["받은 즉시 “확인 후 답드릴게요”를 보내요"] : [])],
      cannot: ["승인 없이 답장하지 않아요", "다른 채팅방을 읽지 않아요"],
    });
    toast("네이버 톡톡을 연결했어요");
    close();
    onDone?.();
  };
  return (
    <div class="stack" style={{ "--gap": "var(--s4)" }}>
      <Steps n={3} at={step} />
      {step === 1 ? (
        <>
          <p>톡톡 파트너센터에서 챗봇 API를 켜 주세요.</p>
          <ol class="stack sm" style={{ "--gap": "var(--s2)" }}>
            <li>1. 파트너센터에 로그인해서 우리 공방 계정을 골라요.</li>
            <li>2. 챗봇 API 설정에서 API 사용을 켜요.</li>
            <li>3. 다음 단계의 웹훅 주소를 넣고 파트너센터가 준 인증 토큰을 복사해 두세요.</li>
          </ol>
          <Btn variant="primary" onClick={() => setStep(2)}>
            켰어요, 다음
          </Btn>
        </>
      ) : null}
      {step === 2 ? (
        <>
          <div class="field">
            <span class="field-label">웹훅 주소</span>
            <div class="card adm-hook">
              <code>{hook}</code>
              <IconBtn
                label="웹훅 주소 복사"
                onClick={() => {
                  void navigator.clipboard?.writeText(hook);
                  toast("웹훅 주소를 복사했어요");
                }}
              >
                <Copy size={18} />
              </IconBtn>
            </div>
          </div>
          <SecretField label="인증 토큰" value={token} onValue={setToken} placeholder="파트너센터에서 복사한 토큰" />
          <p class="help-text">토큰은 화면에 다시 보여 주지 않고 기록에도 남기지 않아요.</p>
          <Switch label="자동 수신 확인 보내기" on={ack} onChange={setAck} hint="손님이 보내면 바로 “확인 후 답드릴게요”를 보내요. 실제 답장은 승인 뒤에 나가요" />
          <SecureSave disabled={token.trim().length < 8} onClick={() => setStep(3)} />
        </>
      ) : null}
      {step === 3 ? (
        <>
          <p>테스트 메시지 1건으로 연결을 확인해요. 웹훅 응답은 5초 안에 돌아와야 해요.</p>
          {test === "ok" ? (
            <div class="card stack" style={{ "--gap": "var(--s1)" }}>
              <span class="row sm strong" style={{ "--gap": "var(--s1)", color: "var(--ok)" }}>
                <Check size={16} /> 문의함에 테스트 문의 1건이 생겼어요
              </span>
              <span class="cap muted">응답 시간 0.8초</span>
            </div>
          ) : (
            <Btn
              variant="outline"
              disabled={test === "sending"}
              onClick={() => {
                setTest("sending");
                setTimeout(() => setTest("ok"), 800);
              }}
            >
              {test === "sending" ? "보내는 중" : "테스트 메시지 보내기"}
            </Btn>
          )}
          <Btn variant="primary" disabled={test !== "ok"} onClick={finish}>
            연결 끝내기
          </Btn>
        </>
      ) : null}
    </div>
  );
}

function AlimFlow({ close, onDone }: { close: () => void; onDone?: () => void }) {
  const [step, setStep] = useState(1);
  const [channel, setChannel] = useState("");
  const [service, setService] = useState("");
  const [access, setAccess] = useState("");
  const [secret, setSecret] = useState("");
  const [sender, setSender] = useState("");
  const finish = () => {
    const now = Date.now();
    upsert("알림톡 발송", {
      verbLine: "예약 안내를 카카오톡으로 보내요",
      status: "심사 중",
      lastUsed: undefined,
      expiresAt: now + 365 * DAY,
      can: ["승인된 템플릿으로 안내를 보내요", "실패하면 SMS로 대신 보내요"],
      cannot: ["광고 메시지를 보내지 않아요"],
      pendingSends: 0,
    });
    toast("알림톡 발송을 연결했어요. 심사가 끝나면 알림톡으로 보내요");
    close();
    onDone?.();
  };
  return (
    <div class="stack" style={{ "--gap": "var(--s4)" }}>
      <Steps n={3} at={step} />
      {step === 1 ? (
        <>
          <p>카카오톡 채널 관리자센터에서 비즈니스 채널 인증을 받은 뒤 채널 ID를 넣어 주세요.</p>
          <Field label="카카오톡 채널 ID">
            <TextInput value={channel} onValue={setChannel} placeholder="@오늘의흙공방" autoComplete="off" />
          </Field>
          <Btn variant="primary" disabled={channel.trim().length < 2} onClick={() => setStep(2)}>
            다음
          </Btn>
        </>
      ) : null}
      {step === 2 ? (
        <div class="adm-secret">
          <p>네이버클라우드 SENS 알림톡 서비스의 키를 넣어 주세요. 키는 화면에 다시 보여 주지 않아요.</p>
          <div class="stack" style={{ "--gap": "var(--s2)" }}>
            <SecretField label="서비스 ID" value={service} onValue={setService} secret={false} placeholder="ncp:sms:kr:..." />
            <SecretField label="액세스 키" value={access} onValue={setAccess} />
            <SecretField label="시크릿 키" value={secret} onValue={setSecret} />
          </div>
          <SecureSave disabled={!service.trim() || access.trim().length < 8 || secret.trim().length < 8} onClick={() => setStep(3)} />
        </div>
      ) : null}
      {step === 3 ? (
        <>
          <Field label="발신 번호" hint="발신 번호는 통신사 인증을 거쳐요" error={sender.length > 3 && !isTel(sender) && "번호를 다시 확인해 주세요"}>
            <TextInput value={sender} onValue={setSender} inputMode="tel" placeholder="061-000-1234" autoComplete="off" />
          </Field>
          <div class="card sm stack" style={{ "--gap": "var(--s1)" }}>
            <span class="strong">연결을 마치면</span>
            <span>템플릿 심사가 끝나기 전에는 SMS로만 보내요. 심사 상태는 알림 문구 화면에서 볼 수 있어요.</span>
          </div>
          <Btn variant="primary" disabled={!isTel(sender)} onClick={finish}>
            연결 끝내기
          </Btn>
        </>
      ) : null}
    </div>
  );
}

function BizFlow({ close, onDone }: { close: () => void; onDone?: () => void }) {
  const [key, setKey] = useState("");
  const finish = () => {
    const now = Date.now();
    upsert("기업마당 공고 알림", {
      verbLine: "지원사업 공고를 찾아 알려요",
      status: "정상",
      lastUsed: now,
      expiresAt: now + 365 * DAY,
      can: ["공고 제목과 마감일을 가져와요"],
      cannot: ["신청서를 대신 내지 않아요"],
      error: undefined,
    });
    toast("기업마당 공고 알림을 연결했어요");
    close();
    onDone?.();
  };
  return (
    <div class="adm-secret">
      <p>기업마당 OpenAPI 인증키를 넣어 주세요. 비서는 공고 제목과 마감일만 가져와요.</p>
      <SecretField label="인증키" value={key} onValue={setKey} placeholder="기업마당 OpenAPI 인증키" />
      <p class="help-text">키는 화면에 다시 보여 주지 않아요.</p>
      <SecureSave disabled={key.trim().length < 8} onClick={finish} />
    </div>
  );
}

export const openTalkFlow = (onDone?: () => void) => openSheet("네이버 톡톡 연결", (close) => <TalkFlow close={close} onDone={onDone} />);
export const openAlimFlow = (onDone?: () => void) => openSheet("알림톡 발송 연결", (close) => <AlimFlow close={close} onDone={onDone} />);
export const openBizFlow = (onDone?: () => void) => openSheet("기업마당 공고 알림 연결", (close) => <BizFlow close={close} onDone={onDone} />);

const flows = [
  { name: "네이버 톡톡", desc: "톡톡 문의를 문의함에 모아요", open: openTalkFlow },
  { name: "알림톡 발송", desc: "예약 안내를 카카오톡으로 보내요", open: openAlimFlow },
  { name: "기업마당 공고 알림", desc: "지원사업 공고를 찾아 알려요", open: openBizFlow },
];

function openAddPicker() {
  openSheet("연결 추가", (close) => (
    <div class="list">
      {flows.map((f) => (
        <button
          key={f.name}
          type="button"
          class="rowitem"
          onClick={() => {
            close();
            f.open();
          }}
        >
          <span class="glyph">
            <ConnIcon name={f.name} />
          </span>
          <span class="grow">
            <span class="strong" style={{ display: "block" }}>{f.name}</span>
            <span class="sm muted">{f.desc}</span>
          </span>
          <ChevronRight size={20} class="muted" />
        </button>
      ))}
    </div>
  ));
}

const reconnect = (c: Connection) => flows.find((f) => c.name.includes(f.name.split(" ")[0]!))?.open() ?? openAddPicker();

const periodOptions = [
  { label: "30일", days: 30 },
  { label: "90일", days: 90 },
  { label: "1년", days: 365 },
];

function renew(c: Connection, days: number, label: string) {
  const fixed = c.status === "곧 만료" || c.status === "만료" ? "정상" : c.status;
  patch(connections, c.id, { status: fixed, expiresAt: Date.now() + days * DAY });
  log({ actorKind: actorKind(), actor: actorName(), action: "연결을 갱신함", target: `${c.name} · ${label}`, targetType: "연결", result: "완료" });
  toast(`${label} 더 맡겼어요`);
}

const periodLabel = (c: Connection) => (c.expiresAt ? `${daysLeft(c.expiresAt)}일 남음` : "제한 없음");

function openPeriod(c: Connection) {
  openSheet("맡긴 기간", (close) => (
    <div class="stack">
      <p class="sm muted">오늘부터 얼마나 맡길지 고르면 만료일을 그만큼 미뤄요. 만료 30일 전부터 다시 알려 드려요.</p>
      <div class="list">
        {periodOptions.map((p) => (
          <button
            key={p.label}
            type="button"
            class="rowitem"
            onClick={() => {
              renew(c, p.days, p.label);
              close();
            }}
          >
            <span class="grow">{p.label}</span>
            <span class="sm muted num">{dateLabel(Date.now() + p.days * DAY)}까지</span>
          </button>
        ))}
      </div>
    </div>
  ));
}

type DisconnectResult = "완료" | "부분 완료" | "실패";

function disconnect(c: Connection, retry = false) {
  const n = c.pendingSends ?? 0;
  const scheduled = messages.value.filter((m) => m.status === "예약됨");
  let result: DisconnectResult = "완료";
  let remaining: { id?: string; label: string }[] = [];
  if (c.status === "오류" && !retry) result = "실패";
  else if (n > 2) {
    result = "부분 완료";
    remaining = scheduled.slice(0, 2).map((m) => ({ id: m.id, label: `${m.to} · ${m.template}` }));
    if (remaining.length < 2) remaining.push({ label: "권시우 · 대기 자리 안내" });
  }
  if (result !== "실패") {
    const keep = new Set(remaining.map((r) => r.id));
    patch(connections, c.id, { status: "해제됨", pendingSends: remaining.length, error: undefined });
    if (c.name.includes("알림톡")) messages.value = messages.value.map((m) => (m.status === "예약됨" && !keep.has(m.id) ? { ...m, status: "취소됨" } : m));
  }
  log({ actorKind: actorKind(), actor: actorName(), action: result === "실패" ? "연결 해제를 시도함" : "연결을 해제함", target: c.name, targetType: "연결", result });
  openSheet(
    "해제 결과",
    () => (
      <div class="stack">
        <div class="adm-result">
          <Status tone={result === "완료" ? "ok" : result === "부분 완료" ? "warn" : "err"}>{result}</Status>
          <p class="strong">{result === "완료" ? `${c.name} 연결을 해제했어요` : result === "부분 완료" ? `연결은 해제했지만 발송 ${remaining.length}건은 멈추지 못했어요` : "해제하지 못했어요"}</p>
          <p class="sm muted">
            {result === "완료" ? `예약해 둔 발송 ${n}건을 멈췄어요.` : result === "부분 완료" ? `발송 ${n - remaining.length}건은 멈췄어요. 남은 건은 발송 결과에서 직접 취소할 수 있어요.` : "연결 서버가 응답하지 않았어요. 잠시 뒤 다시 시도해 주세요."}
          </p>
        </div>
        {remaining.length ? (
          <div class="list">
            {remaining.map((r) => (
              <div key={r.label} class="rowitem" style={{ minHeight: "52px" }}>
                <span class="grow sm">{r.label}</span>
                <Status tone="warn">예약됨</Status>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    ),
    (close) => (
      <>
        <Btn onClick={close}>닫기</Btn>
        {result === "부분 완료" ? (
          <Btn
            variant="primary"
            onClick={() => {
              close();
              go("/settings/templates");
            }}
          >
            발송 결과 보기
          </Btn>
        ) : null}
        {result === "실패" ? (
          <Btn
            variant="primary"
            onClick={() => {
              close();
              disconnect(c, true);
            }}
          >
            다시 시도
          </Btn>
        ) : null}
      </>
    ),
  );
}

function openDisconnect(c: Connection) {
  const n = c.pendingSends ?? 0;
  openSheet(
    "연결을 해제할까요?",
    () => (
      <div class="stack">
        <p>{c.name} 연결을 해제하면 비서가 이 연결로 하는 일을 모두 멈춰요.</p>
        <div class="card stack" style={{ "--gap": "var(--s1)" }}>
          <span class="strong sm">함께 멈추는 것</span>
          <span class="sm num">예약해 둔 발송 {n}건</span>
          <span class="sm muted">해제한 연결은 처음부터 다시 설정해야 해요.</span>
        </div>
      </div>
    ),
    (close) => (
      <>
        <Btn onClick={close}>취소</Btn>
        <Btn
          variant="danger"
          onClick={() => {
            close();
            disconnect(c);
          }}
        >
          해제
        </Btn>
      </>
    ),
  );
}

function ConnRow({ c }: { c: Connection }) {
  const current = route.value.path[1] === c.id;
  return (
    <button type="button" class="rowitem" aria-current={current || undefined} onClick={() => go(`/settings/connections/${c.id}`)}>
      <span class="glyph">
        <ConnIcon name={c.name} />
      </span>
      <span class="grow">
        <span class="row between" style={{ "--gap": "var(--s2)" }}>
          <span class="strong clamp1">{c.name}</span>
          <Status tone={connTone(c.status)}>{c.status}</Status>
        </span>
        <span class="sm muted clamp1">{c.verbLine}</span>
        <span class="cap muted clamp1">{statusLine(c)}</span>
      </span>
      <ChevronRight size={20} class="muted" />
    </button>
  );
}

function ConnectionList() {
  const owner = role.value === "OWNER";
  return (
    <Page
      title="연결"
      backTo="/settings"
      right={
        owner ? (
          <IconBtn label="연결 추가" solid onClick={openAddPicker}>
            <Plus size={22} />
          </IconBtn>
        ) : undefined
      }
    >
      <div class="wide stack" style={{ "--gap": "var(--s4)" }}>
        <div class="card adm-note">
          <Mascot size={36} />
          <div class="grow">
            <p class="strong sm">이 연결로 비서가 할 수 있는 일</p>
            <p class="sm muted">연결은 계정 단위로 맡긴 권한이에요. 각 연결을 누르면 할 수 있는 일과 할 수 없는 일을 볼 수 있어요. 만료가 30일 안으로 다가온 연결은 위에 올려요.</p>
          </div>
        </div>
        <div class="list">
          {sortedConnections.value.map((c) => (
            <ConnRow key={c.id} c={c} />
          ))}
        </div>
        {!owner ? <p class="cap muted">직원은 연결 상태만 볼 수 있어요. 추가, 갱신, 해제는 사장님이 해요.</p> : null}
      </div>
    </Page>
  );
}

function ConnectionDetail({ c }: { c: Connection }) {
  const owner = role.value === "OWNER";
  const live = c.status !== "해제됨";
  return (
    <Page
      title={c.name}
      backTo="/settings/connections"
      foot={
        owner && !live ? (
          <Btn variant="primary" onClick={() => reconnect(c)}>
            다시 연결
          </Btn>
        ) : undefined
      }
    >
      <div class="wide stack" style={{ "--gap": "var(--s4)" }}>
        <div class="row" style={{ alignItems: "flex-start" }}>
          <span class="glyph">
            <ConnIcon name={c.name} />
          </span>
          <div class="grow">
            <p class="strong">{c.verbLine}</p>
            <p class="sm muted">{statusLine(c)}</p>
          </div>
          <Status tone={connTone(c.status)}>{c.status}</Status>
        </div>
        {c.error && live ? (
          <div class="card alert stack" style={{ "--gap": "var(--s2)" }}>
            <p class="sm strong">{c.error}</p>
            {owner ? (
              <Btn small onClick={() => reconnect(c)}>
                새 키 넣기
              </Btn>
            ) : null}
          </div>
        ) : null}
        <Rows>
          <Row label="마지막 사용" value={c.lastUsed ? <RelTime t={c.lastUsed} class="sm muted" /> : "아직 없어요"} />
          <Row label="예약된 발송" value={`${c.pendingSends ?? 0}건`} />
        </Rows>
        {owner && live ? (
          <div class="stack" style={{ "--gap": "var(--s2)" }}>
            <Rows>
              <Row label="맡긴 기간" value={periodLabel(c)} tone={c.expiresAt && daysLeft(c.expiresAt) <= 30 ? "warn" : undefined} hint={c.expiresAt ? `${dateLabel(c.expiresAt)}까지` : undefined} onClick={() => openPeriod(c)} />
              <Row label="연결 해제" danger onClick={() => openDisconnect(c)} />
            </Rows>
            <p class="cap muted" style={{ paddingInline: "var(--s4)" }}>
              맡긴 기간이 끝나면 연결이 저절로 꺼져요. 꺼지면 비서는 이 연결로 아무 일도 하지 않아요. 예약해 둔 발송도 멈춰요.
            </p>
          </div>
        ) : (
          <Rows>
            <Row label="맡긴 기간" value={live ? periodLabel(c) : "해제됨"} hint={live && c.expiresAt ? `${dateLabel(c.expiresAt)}까지` : undefined} />
          </Rows>
        )}
        <div class="grid2">
          <div class="card stack" style={{ "--gap": "var(--s2)" }}>
            <span class="strong sm">이 연결로 비서가 할 수 있는 일</span>
            <ul class="adm-checks ok">
              {c.can.map((x) => (
                <li key={x}>
                  <Check size={16} />
                  {x}
                </li>
              ))}
            </ul>
          </div>
          <div class="card stack" style={{ "--gap": "var(--s2)" }}>
            <span class="strong sm">할 수 없는 일</span>
            <ul class="adm-checks no">
              {c.cannot.map((x) => (
                <li key={x}>
                  <X size={16} />
                  {x}
                </li>
              ))}
            </ul>
          </div>
        </div>
        <p class="cap muted">연결은 계정 단위로 맡긴 권한이에요. 해제하면 이 연결로 예약한 발송도 함께 멈춰요.</p>
      </div>
    </Page>
  );
}

export function ConnectionsScreen({ id }: { id?: string }) {
  if (role.value === "VIEWER") return <Denied title="연결" />;
  if (id) {
    const c = byId(connections.value, id);
    return c ? (
      <ConnectionDetail key={c.id} c={c} />
    ) : (
      <Page title="연결" backTo="/settings/connections">
        <Empty title="이 연결을 찾지 못했어요" />
      </Page>
    );
  }
  return <ConnectionList />;
}
