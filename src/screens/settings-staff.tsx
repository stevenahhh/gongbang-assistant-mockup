import { useState } from "preact/hooks";
import { Check, ChevronRight, UserPlus, UserRound } from "lucide-preact";
import { actorKind, actorName, inquiries, log, newId, patch, role, staff, toast } from "../store";
import type { Staff } from "../types";
import { Btn, Empty, Field, IconBtn, Page, Segmented, Status, TextInput, openSheet } from "../ui";
import { DAY } from "../lib/time";
import { Denied, daysLeft, euro, isEmail, isMobile, maskContact } from "./settings-shared";

type StaffRole = Staff["role"];
const roleName: Record<StaffRole, "직원" | "열람자"> = { STAFF: "직원", VIEWER: "열람자" };
const roleOptions = ["직원", "열람자"] as const;
const toRole = (label: string): StaffRole => (label === "직원" ? "STAFF" : "VIEWER");

const staffCan = ["문의 읽기와 답장", "예약 등록·변경·노쇼 기록", "승인함에서 예약·문의 작업 승인", "기회·홍보·배송 보기", "연결 상태 보기", "본인 활동 기록 보기"];
const viewerCan = ["오늘 화면 지표 카드", "규정 읽기", "리포트 보기", "내 계정 설정"];
const inviteLeft = (s: Staff) => daysLeft((s.invitedAt ?? Date.now()) + 7 * DAY);

function CanList({ title, items }: { title: string; items: string[] }) {
  return (
    <div class="card stack" style={{ "--gap": "var(--s2)" }}>
      <span class="strong sm">{title}</span>
      <ul class="adm-checks ok">
        {items.map((x) => (
          <li key={x}>
            <Check size={16} />
            {x}
          </li>
        ))}
      </ul>
    </div>
  );
}

function InviteForm({ close }: { close: () => void }) {
  const [contact, setContact] = useState("");
  const [r, setR] = useState<(typeof roleOptions)[number]>("직원");
  const valid = isMobile(contact) || isEmail(contact);
  const send = () => {
    staff.value = [...staff.value, { id: newId("st"), name: "초대한 직원", contact: contact.trim(), role: toRole(r), status: "초대 대기", invitedAt: Date.now() }];
    log({ actorKind: actorKind(), actor: actorName(), action: `${r} 초대 링크를 보냄`, target: maskContact(contact.trim()), targetType: "기타", result: "완료" });
    toast("초대 링크를 보냈어요. 7일 안에 수락하면 연결돼요");
    close();
  };
  return (
    <div class="stack" style={{ "--gap": "var(--s4)" }}>
      <Field label="휴대폰 번호 또는 이메일" error={contact.length > 4 && !valid && "휴대폰 번호나 이메일 형식으로 써 주세요"}>
        <TextInput value={contact} onValue={setContact} inputMode="email" autoComplete="off" placeholder="010-0000-0000 또는 name@example.com" />
      </Field>
      <Field label="역할">
        <Segmented label="역할" options={roleOptions} value={r} onChange={setR} />
      </Field>
      <CanList title={`${r}이 할 수 있는 일`} items={r === "직원" ? staffCan : viewerCan} />
      <p class="help-text">초대 링크는 7일 동안 유효해요. 받은 사람은 네이버 로그인으로 수락해요. 금액이 걸린 일은 언제나 사장님이 승인해요.</p>
      <Btn variant="primary" disabled={!valid} onClick={send}>
        초대 링크 보내기
      </Btn>
    </div>
  );
}

const openInvite = () => openSheet("직원 초대", (close) => <InviteForm close={close} />);

function removeMember(s: Staff) {
  const assigned = inquiries.value.filter((q) => q.assignee === s.name).length;
  staff.value = staff.value.filter((x) => x.id !== s.id);
  inquiries.value = inquiries.value.map((q) => (q.assignee === s.name ? { ...q, assignee: undefined } : q));
  log({ actorKind: actorKind(), actor: actorName(), action: s.status === "활성" ? "직원 접속을 끊음" : "직원 초대를 취소함", target: s.name, targetType: "기타", result: "완료" });
  toast(s.status === "활성" ? `${s.name}님을 내보냈어요. 문의 ${assigned}건을 사장님 담당으로 돌렸어요` : "초대를 취소했어요");
}

function openRemove(s: Staff) {
  const assigned = inquiries.value.filter((q) => q.assignee === s.name).length;
  openSheet(
    "내보낼까요?",
    () => (
      <div class="stack">
        <p>지금 내보내면 {s.name}님의 접속이 바로 끊겨요.</p>
        <div class="card stack" style={{ "--gap": "var(--s1)" }}>
          <span class="strong sm">함께 바뀌는 것</span>
          <span class="sm num">맡고 있던 문의 {assigned}건이 사장님 담당으로 넘어와요</span>
          <span class="sm muted">다시 함께 일하려면 새로 초대해야 해요.</span>
        </div>
      </div>
    ),
    (close) => (
      <>
        <Btn onClick={close}>취소</Btn>
        <Btn
          variant="danger"
          onClick={() => {
            removeMember(s);
            close();
          }}
        >
          내보내기
        </Btn>
      </>
    ),
  );
}

function MemberSheet({ s, close }: { s: Staff; close: () => void }) {
  const [r, setR] = useState<StaffRole>(s.role);
  const changed = r !== s.role;
  const pending = s.status === "초대 대기";
  const apply = () => {
    patch(staff, s.id, { role: r });
    log({ actorKind: actorKind(), actor: actorName(), action: `직원 권한을 ${euro(roleName[r])} 바꿈`, target: s.name, targetType: "기타", result: "완료" });
    toast(`${s.name}님을 ${euro(roleName[r])} 바꿨어요`);
    close();
  };
  return (
    <div class="stack" style={{ "--gap": "var(--s4)" }}>
      <div class="row">
        <span class="glyph">
          <UserRound size={20} />
        </span>
        <div class="grow">
          <p class="strong">{s.name}</p>
          <p class="sm muted">{s.contact}</p>
        </div>
        {pending ? <Status tone="warn">초대 대기</Status> : <Status tone="ok">활성</Status>}
      </div>
      {pending ? (
        <>
          <p class="sm">아직 초대를 수락하지 않았어요. 링크는 {Math.max(inviteLeft(s), 0)}일 뒤에 만료돼요.</p>
          <div class="row">
            <Btn
              class="grow"
              onClick={() => {
                patch(staff, s.id, { invitedAt: Date.now() });
                toast("초대 링크를 다시 보냈어요. 7일 동안 유효해요");
                close();
              }}
            >
              다시 보내기
            </Btn>
            <Btn
              class="grow"
              variant="danger"
              onClick={() => {
                removeMember(s);
                close();
              }}
            >
              초대 취소
            </Btn>
          </div>
        </>
      ) : (
        <>
          <Field label="역할">
            <Segmented label="역할" options={roleOptions} value={roleName[r]} onChange={(v) => setR(toRole(v))} />
          </Field>
          {changed && r === "VIEWER" ? (
            <div class="card alert stack" style={{ "--gap": "var(--s2)" }}>
              <span class="strong sm">이 사람이 더 이상 할 수 없는 일</span>
              <ul class="adm-checks no">
                {staffCan.map((x) => (
                  <li key={x}>
                    <Check size={16} />
                    {x}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {changed && r === "STAFF" ? <CanList title="새로 할 수 있는 일" items={staffCan} /> : null}
          <div class="row">
            <Btn class="grow" variant="danger" onClick={() => { close(); openRemove(s); }}>
              내보내기
            </Btn>
            <Btn class="grow" variant="primary" disabled={!changed} onClick={apply}>
              권한 바꾸기
            </Btn>
          </div>
        </>
      )}
    </div>
  );
}

function MemberRow({ s }: { s: Staff }) {
  const left = inviteLeft(s);
  return (
    <button type="button" class="rowitem" onClick={() => openSheet(s.name, (close) => <MemberSheet s={s} close={close} />)}>
      <span class="glyph">
        <UserRound size={20} />
      </span>
      <span class="grow">
        <span class="strong" style={{ display: "block" }}>{s.name}</span>
        <span class="sm muted clamp1">{s.contact}</span>
      </span>
      {s.status === "초대 대기" ? <Status tone={left > 0 ? "warn" : "err"}>{left > 0 ? `초대 대기 · ${left}일 남음` : "초대 만료"}</Status> : <Status>{roleName[s.role]}</Status>}
      <ChevronRight size={20} class="muted" />
    </button>
  );
}

export function StaffSettings() {
  if (role.value !== "OWNER") return <Denied title="직원·권한" />;
  const rows = staff.value;
  return (
    <Page
      title="직원·권한"
      backTo="/settings"
      right={
        <IconBtn label="직원 초대" solid onClick={openInvite}>
          <UserPlus size={22} />
        </IconBtn>
      }
    >
      <div class="wide stack" style={{ "--gap": "var(--s4)" }}>
        <p class="sm muted">직원은 문의와 예약을 함께 처리하고 열람자는 숫자만 봐요. 환불처럼 금액이 걸린 일은 언제나 사장님이 승인해요.</p>
        {rows.length ? (
          <div class="list">
            {rows.map((s) => (
              <MemberRow key={s.id} s={s} />
            ))}
          </div>
        ) : (
          <Empty title="아직 함께 일하는 사람이 없어요" action={<Btn small onClick={openInvite}>직원 초대하기</Btn>} />
        )}
        <div class="grid2">
          <CanList title="직원이 할 수 있는 일" items={staffCan} />
          <CanList title="열람자가 할 수 있는 일" items={viewerCan} />
        </div>
      </div>
    </Page>
  );
}
