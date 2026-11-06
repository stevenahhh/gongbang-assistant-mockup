import { Check, CheckCheck, ChevronRight, Inbox, Link2, ScrollText, ShieldCheck, Sun, X } from "lucide-preact";
import { go, route, type DetailProps, type ScreenDef } from "../router";
import { aiNotice } from "../store";
import { Btn, Empty, Mascot, Page, Status } from "../ui";

interface Guide {
  id: string;
  title: string;
  desc: string;
  Icon: typeof Sun;
  body: string[];
  link?: { to: string; label: string };
}

const guides: Guide[] = [
  {
    id: "start",
    title: "처음 시작하기",
    desc: "오늘 화면, 비서에게 말하기, 승인함",
    Icon: Sun,
    body: [
      "오늘 화면 맨 위에는 지금 처리할 일이 카드로 모여요. 긴급한 일은 빨간 카드로 올라와요.",
      "화면 아래 입력창으로 비서에게 말할 수 있어요. '내일 11시 자리 있어?'라고 물으면 회차와 남은 자리를 알려 줘요.",
      "비서가 만든 초안은 승인함에 모여요. 사장님이 승인하기 전에는 손님에게 아무것도 나가지 않아요.",
    ],
    link: { to: "/today", label: "오늘 화면 열기" },
  },
  {
    id: "inbox",
    title: "문의함 쓰는 법",
    desc: "톡톡, 전화 메모, 대화 붙여 넣기",
    Icon: Inbox,
    body: [
      "톡톡 문의는 연결해 두면 자동으로 들어와요. 전화는 전화 메모로, 카카오톡이나 DM은 대화 붙여 넣기로 넣어요.",
      "비서가 문의를 분류하고 답장 초안을 만들어요. 톡톡은 승인하면 바로 보내요. 다른 채널은 복사해서 직접 보내요.",
      "분류가 틀리면 분류 칩을 눌러 고칠 수 있어요. 고친 내용은 활동 기록에 남아요.",
    ],
    link: { to: "/inbox", label: "문의함 열기" },
  },
  {
    id: "approvals",
    title: "승인함과 비서 작업",
    desc: "승인, 거절, 고쳐서 승인, 사전 허용",
    Icon: CheckCheck,
    body: [
      "비서가 만든 초안과 제안은 모두 승인함을 거쳐요. 승인, 거절, 고쳐서 승인 중에 고를 수 있어요.",
      "금액, 날짜, 인원이 원본과 다르면 승인 버튼이 막히고 차이를 빨갛게 표시해요.",
      "정보성 리마인드처럼 반복되는 일은 사전 허용 규칙으로 맡길 수 있어요. 규칙은 최대 90일 동안 유효해요.",
    ],
    link: { to: "/approvals", label: "승인함 열기" },
  },
  {
    id: "policy",
    title: "규정과 환불",
    desc: "버전, 예약에 붙는 규정, 학원 등록 공방",
    Icon: ScrollText,
    body: [
      "규정은 저장할 때마다 새 버전이 생겨요. 예약을 확정할 때 그 시점의 규정이 예약에 붙어요. 나중에 규정을 바꿔도 이전 예약은 이전 규정을 따라요.",
      "학원으로 등록한 공방은 수업 시작 전 취소에 전액 환불해야 해요. 그래서 0% 환불이나 예약금 몰수를 고를 수 없어요.",
      "손님에게 보내는 한 줄 요약은 규정에서 자동으로 만들어요. 지각·노쇼 기준은 미리 알린 예약에만 적용해요.",
    ],
    link: { to: "/settings/policy", label: "규정 열기" },
  },
  {
    id: "connections",
    title: "연결 관리",
    desc: "만료, 갱신, 해제하면 멈추는 발송",
    Icon: Link2,
    body: [
      "연결은 계정 단위로 비서에게 맡긴 권한이에요. 각 연결에서 할 수 있는 일과 할 수 없는 일을 볼 수 있어요.",
      "만료 30일 전부터 목록 맨 위에 '곧 만료'로 올라와요. 갱신 버튼으로 바로 연장할 수 있어요.",
      "연결을 해제하면 그 연결로 예약해 둔 발송도 함께 멈춰요. 멈춘 건수를 화면에 보여 드려요.",
    ],
    link: { to: "/settings/connections", label: "연결 열기" },
  },
];

function Master() {
  const selected = route.value.key === "help" ? route.value.path[0] : undefined;
  return (
    <div class="adm-root">
      <Page title="도움말" backTo="/more" sub={false}>
        <div class="card adm-note">
          <Mascot size={40} />
          <p class="sm">
            헷갈리는 칸 옆의 물음표를 누르면 짧은 설명이 떠요. 여기서는 조금 더 긴 안내를 모아 두었어요.
          </p>
        </div>
        <h2 class="adm-group">보안</h2>
        <div class="list">
          <button type="button" class="rowitem" aria-current={selected === "security" || undefined} onClick={() => go("/help/security")}>
            <span class="glyph">
              <ShieldCheck size={20} />
            </span>
            <span class="grow">
              <span class="strong" style={{ display: "block" }}>
                보안·개인정보 안내
              </span>
              <span class="sm muted clamp1">누가 무엇을 볼 수 있는지, 보관 기간, AI 고지</span>
            </span>
            <ChevronRight size={20} class="muted" />
          </button>
        </div>
        <h2 class="adm-group">사용법</h2>
        <div class="list">
          {guides.map(({ id, title, desc, Icon }) => (
            <button key={id} type="button" class="rowitem" aria-current={selected === id || undefined} onClick={() => go(`/help/${id}`)}>
              <span class="glyph">
                <Icon size={20} />
              </span>
              <span class="grow">
                <span class="strong" style={{ display: "block" }}>
                  {title}
                </span>
                <span class="sm muted clamp1">{desc}</span>
              </span>
              <ChevronRight size={20} class="muted" />
            </button>
          ))}
        </div>
        <p class="cap muted" style={{ marginTop: "var(--s5)" }}>
          비서가 틀릴 수 있어요. 금액과 날짜는 승인 전에 한 번 더 확인해 주세요.
        </p>
      </Page>
    </div>
  );
}

function GuidePage({ g }: { g: Guide }) {
  return (
    <Page title={g.title} backTo="/help">
      <div class="wide stack" style={{ "--gap": "var(--s4)" }}>
        <div class="row" style={{ "--gap": "var(--s2)" }}>
          <span class="glyph">
            <g.Icon size={20} />
          </span>
          <span class="sm muted">{g.desc}</span>
        </div>
        {g.body.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
        {g.link ? (
          <Btn variant="outline" onClick={() => go(g.link!.to)}>
            {g.link.label}
          </Btn>
        ) : null}
      </div>
    </Page>
  );
}

const access = [
  { who: "비서", can: "공방 정보, 클래스와 회차, 예약과 문의 내용, 규정, 사장님이 올린 파일", cannot: "네이버 비밀번호, 결제 수단, 연결하지 않은 다른 채팅방" },
  { who: "AI 모델 제공사", can: "초안을 만들 때 보내는 문의 본문과 공방 정보. 손님 연락처는 가리고 보내요", cannot: "손님 연락처 원본, 활동 기록, 다른 공방의 데이터. 학습에 쓰지 않아요" },
  { who: "우리 팀", can: "장애를 고칠 때 필요한 시스템 기록, 사장님이 요청한 범위의 데이터", cannot: "평소의 손님 대화 본문, 연락처 원본" },
  { who: "손님·직원", can: "손님은 자기에게 온 안내만, 직원은 권한 표에서 허용한 화면만", cannot: "다른 손님 정보, 매출, 설정과 연결" },
];

const does = ["문의를 분류하고 답장 초안을 만들어요", "예약 안내와 리마인드 초안을 만들어요", "공고에서 마감일과 자격 같은 사실을 추려요", "승인한 일만 실행하고 결과를 활동 기록에 남겨요"];
const doesNot = ["승인 없이 손님에게 메시지를 보내지 않아요", "네이버·인스타그램 페이지를 몰래 수집하지 않아요", "환불, 취소, 금액 변경을 알아서 처리하지 않아요", "공공 공고 원문을 고쳐 쓰지 않아요"];
const keeps = ["손님 개인정보를 예약 이행 목적으로만 써요", "모든 행동을 활동 기록에 남기고 고치거나 지울 수 없어요", "권한은 화면과 서버에서 두 번 확인해요", "연결 토큰은 암호화해 저장하고 화면에 다시 보여 주지 않아요"];
const keepsNot = ["복사해서 다른 앱에 붙여 넣은 내용은 그 앱의 정책을 따라요", "사장님이 직접 올린 파일 속 개인정보까지 가려 주지는 못해요", "비서가 틀릴 수 있어요. 금액과 날짜는 승인 전에 확인해 주세요", "네이버, 카카오 같은 외부 서비스의 장애는 막지 못해요"];
const retention = [
  ["손님 개인정보", "마지막 수업 후 1년. 이후에는 이름 첫 글자와 연락처 끝 4자리만 남겨요 (제안, 법률 검토 필요)"],
  ["문의 대화", "손님 개인정보와 같은 기간이에요"],
  ["활동 기록", "1년이 지나면 요약만 보관해요 (제안)"],
  ["연결 토큰", "해제하면 바로 지워요"],
  ["탈퇴한 계정", "30일 뒤 완전히 지워요. 그 전에는 다시 로그인해 되돌릴 수 있어요"],
];

function CheckList({ items, ok }: { items: string[]; ok: boolean }) {
  return (
    <ul class={ok ? "adm-checks ok" : "adm-checks no"}>
      {items.map((t) => (
        <li key={t}>
          {ok ? <Check size={16} /> : <X size={16} />}
          <span>{t}</span>
        </li>
      ))}
    </ul>
  );
}

function SecurityPage() {
  return (
    <Page title="보안·개인정보 안내" backTo="/help">
      <div class="wide stack" style={{ "--gap": "var(--s6)" }}>
        <section>
          <h2 class="section-head">누가 내 데이터를 볼 수 있나요</h2>
          <table class="adm-table">
            <thead>
              <tr>
                <th scope="col">누가</th>
                <th scope="col">볼 수 있는 것</th>
                <th scope="col">볼 수 없는 것</th>
              </tr>
            </thead>
            <tbody>
              {access.map((r) => (
                <tr key={r.who}>
                  <td>{r.who}</td>
                  <td data-h="볼 수 있는 것">{r.can}</td>
                  <td data-h="볼 수 없는 것">{r.cannot}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        <section>
          <h2 class="section-head">비서가 하는 일과 하지 않는 일</h2>
          <div class="grid2">
            <div class="card stack">
              <p class="strong sm">하는 일</p>
              <CheckList items={does} ok />
            </div>
            <div class="card stack">
              <p class="strong sm">하지 않는 일</p>
              <CheckList items={doesNot} ok={false} />
            </div>
          </div>
        </section>
        <section>
          <h2 class="section-head">대시보드가 지키는 것과 지키지 못하는 것</h2>
          <div class="grid2">
            <div class="card stack">
              <p class="strong sm">지키는 것</p>
              <CheckList items={keeps} ok />
            </div>
            <div class="card stack">
              <p class="strong sm">지키지 못하는 것</p>
              <CheckList items={keepsNot} ok={false} />
            </div>
          </div>
        </section>
        <section>
          <h2 class="section-head">데이터 보관 기간</h2>
          <dl class="kv" style={{ "--gap": "var(--s2)" }}>
            {retention.map(([k, v]) => (
              <div key={k} style={{ display: "contents" }}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
        </section>
        <section>
          <h2 class="section-head">AI 사용 고지</h2>
          <div class="card stack">
            <p class="sm">비서의 문구는 HyperCLOVA X 기반 생성형 AI가 만들어요. 손님에게 처음 연락할 때 "AI 비서가 작성을 도왔습니다" 문구를 붙일 수 있어요. 기본값은 켜짐이에요.</p>
            <div class="row between wrap">
              <Status tone={aiNotice.value ? "ok" : "muted"}>{aiNotice.value ? "지금 켜져 있어요" : "지금 꺼져 있어요"}</Status>
              <Btn small onClick={() => go("/settings/templates")}>
                알림 문구 설정에서 바꾸기
              </Btn>
            </div>
          </div>
        </section>
      </div>
    </Page>
  );
}

function Detail({ path }: DetailProps) {
  if (path[0] === "security") return <SecurityPage />;
  const g = guides.find((x) => x.id === path[0]);
  if (!g) {
    return (
      <Page title="도움말" backTo="/help">
        <Empty title="이 안내를 찾지 못했어요" />
      </Page>
    );
  }
  return <GuidePage key={g.id} g={g} />;
}

export const screen: ScreenDef = { split: true, Master, Detail };
