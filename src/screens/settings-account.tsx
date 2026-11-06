import { useState } from "preact/hooks";
import { Check, Download } from "lucide-preact";
import { actorKind, actorName, connections, learnTone, log, messages, notify, quietHours, role, toast } from "../store";
import type { NotifyRow } from "../types";
import { BarRow, Btn, Page, Switch, openSheet } from "../ui";
import { Row, Rows, roleLabel } from "./settings-shared";

const channels: NotifyRow["channel"][] = ["앱 푸시", "알림톡", "이메일", "끄기"];
const usage = { assistant: { used: 1240, max: 3000 }, alim: { used: 318, max: 1000 } };
const tone = (u: { used: number; max: number }) => (u.used / u.max > 0.8 ? "warn" : "run");

function openChannelPicker(n: NotifyRow) {
  openSheet(`${n.kind} 알림`, (close) => (
    <div class="stack">
      <p class="sm muted">이 종류의 알림을 어디로 받을지 골라요.</p>
      <div class="list">
        {channels.map((c) => (
          <button
            key={c}
            type="button"
            class="rowitem"
            onClick={() => {
              notify.value = notify.value.map((x) => (x.kind === n.kind ? { ...x, channel: c } : x));
              close();
            }}
          >
            <span class="grow">{c}</span>
            {n.channel === c ? <Check size={20} /> : null}
          </button>
        ))}
      </div>
    </div>
  ));
}

function QuietSheet({ close }: { close: () => void }) {
  const q = quietHours.value;
  return (
    <div class="stack" style={{ "--gap": "var(--s4)" }}>
      <div class="adm-time">
        <input class="input num" type="time" aria-label="방해 금지 시작" value={q.from} onInput={(e) => (quietHours.value = { ...q, from: e.currentTarget.value })} />
        <span class="sm muted">부터</span>
        <input class="input num" type="time" aria-label="방해 금지 끝" value={q.to} onInput={(e) => (quietHours.value = { ...q, to: e.currentTarget.value })} />
      </div>
      <p class="help-text">
        {q.from}부터 {q.to}까지 생긴 알림은 {q.to}에 한 번에 보내요. 실패와 연결 오류 알림은 이 시간에도 바로 보내요.
      </p>
      <Btn variant="primary" onClick={close}>
        확인
      </Btn>
    </div>
  );
}

function download() {
  log({ actorKind: actorKind(), actor: actorName(), action: "전체 데이터 내려받기를 요청함", target: "예약·문의·규정·활동 기록", targetType: "기타", result: "완료" });
  toast("내려받기 파일을 준비해요. 준비되면 알려 드릴게요");
}

function DeleteFlow({ close }: { close: () => void }) {
  const [downloaded, setDownloaded] = useState(false);
  const [step, setStep] = useState(1);
  const [agree, setAgree] = useState(false);
  const scheduled = messages.value.filter((m) => m.status === "예약됨").length;
  const live = connections.value.filter((c) => c.status !== "해제됨").length;
  const run = () => {
    messages.value = messages.value.map((m) => (m.status === "예약됨" ? { ...m, status: "취소됨" } : m));
    connections.value = connections.value.map((c) => (c.status === "해제됨" ? c : { ...c, status: "해제됨", pendingSends: 0 }));
    log({ actorKind: actorKind(), actor: actorName(), action: "계정 탈퇴를 신청함", target: `발송 ${scheduled}건 중단, 연결 ${live}개 해제`, targetType: "기타", result: "완료" });
    toast("탈퇴를 신청했어요. 30일 뒤에 완전히 지워요");
    close();
  };
  return (
    <div class="stack" style={{ "--gap": "var(--s4)" }}>
      {step === 1 ? (
        <>
          <p>탈퇴하기 전에 전체 데이터를 내려받아 두세요. 예약, 문의, 규정, 활동 기록이 들어가요.</p>
          <Btn
            variant="outline"
            onClick={() => {
              download();
              setDownloaded(true);
            }}
          >
            <Download size={18} /> {downloaded ? "내려받기를 요청했어요" : "전체 데이터 내려받기"}
          </Btn>
          {!downloaded ? <p class="help-text">내려받기를 요청한 뒤에 다음으로 넘어갈 수 있어요.</p> : null}
          <Btn variant="primary" disabled={!downloaded} onClick={() => setStep(2)}>
            다음
          </Btn>
        </>
      ) : (
        <>
          <Rows>
            <Row label="예약된 발송" value={`${scheduled}건 멈춤`} />
            <Row label="연결" value={`${live}개 해제`} />
            <Row label="완전 삭제" value="30일 뒤" />
          </Rows>
          <p class="help-text">30일 안에 다시 로그인하면 탈퇴를 취소할 수 있어요.</p>
          <Switch label="내용을 확인했어요" on={agree} onChange={setAgree} />
          <Btn variant="danger" disabled={!agree} onClick={run}>
            탈퇴하기
          </Btn>
        </>
      )}
    </div>
  );
}

function LeaveFlow({ close }: { close: () => void }) {
  return (
    <div class="stack" style={{ "--gap": "var(--s4)" }}>
      <p>이 공방에서 나가면 바로 접속이 끊겨요. 맡고 있던 문의는 사장님 담당으로 넘어가요.</p>
      <Btn
        variant="danger"
        onClick={() => {
          log({ actorKind: actorKind(), actor: actorName(), action: "공방에서 나감", target: actorName(), targetType: "기타", result: "완료" });
          toast("공방에서 나갔어요");
          close();
        }}
      >
        나가기
      </Btn>
    </div>
  );
}

export function AccountSettings() {
  const r = role.value;
  const owner = r === "OWNER";
  const q = quietHours.value;
  return (
    <Page title="내 계정" backTo="/settings">
      <div class="wide stack" style={{ "--gap": "var(--s4)" }}>
        <Rows>
          <Row label="이름" value={actorName()} />
          <Row label="역할" value={roleLabel(r)} />
          <Row label="로그인" value="네이버 계정" />
        </Rows>

        <h2 class="adm-group">알림 받을 방법</h2>
        <Rows>
          {notify.value.map((n) => (
            <Row key={n.kind} label={n.kind} value={n.channel} hint={n.locked ? "끌 수 없어요" : undefined} disabled={n.locked} onClick={() => openChannelPicker(n)} />
          ))}
          <Row label="방해 금지 시간" value={`${q.from}~${q.to}`} onClick={() => openSheet("방해 금지 시간", (close) => <QuietSheet close={close} />)} />
        </Rows>
        <p class="cap muted">실패와 연결 오류 알림은 끌 수 없어요. 방해 금지 시간에 생긴 알림은 아침에 모아서 보내요.</p>

        <h2 class="adm-group">이번 달 사용량</h2>
        <section class="card adm-meter">
          <BarRow label="비서 사용량" value={usage.assistant.used} max={usage.assistant.max} tail={`${usage.assistant.used.toLocaleString()} / ${usage.assistant.max.toLocaleString()}회`} tone={tone(usage.assistant)} />
          <BarRow label="알림톡 발송 건수" value={usage.alim.used} max={usage.alim.max} tail={`${usage.alim.used.toLocaleString()} / ${usage.alim.max.toLocaleString()}건`} tone={tone(usage.alim)} />
          <p class="cap muted">다음 달 1일에 다시 세요.</p>
        </section>

        <h2 class="adm-group">비서</h2>
        <Rows>
          <Switch label="내 말투 배우기" on={learnTone.value} hint="승인한 답장을 보고 비서가 말투를 다듬어요. 손님 정보는 배우지 않아요" onChange={(v) => (learnTone.value = v)} />
        </Rows>

        <h2 class="adm-group">데이터</h2>
        <Rows>
          <Row label="전체 데이터 내려받기" hint="예약, 문의, 규정, 활동 기록" onClick={download} />
        </Rows>
        <div>
          <button type="button" class="adm-danger" onClick={() => openSheet(owner ? "계정 탈퇴" : "공방에서 나가기", (close) => (owner ? <DeleteFlow close={close} /> : <LeaveFlow close={close} />))}>
            {owner ? "계정 탈퇴" : "이 공방에서 나가기"}
          </button>
          {owner ? (
            <p class="cap muted" style={{ paddingInline: "var(--s4)" }}>
              탈퇴하면 예약된 발송을 모두 멈추고 연결을 해제해요. 30일 뒤 완전히 지워요.
            </p>
          ) : null}
        </div>
      </div>
    </Page>
  );
}
