import { CircleHelp, FileBarChart, Megaphone, Package, RotateCcw, Settings, Sparkles, ChevronRight } from "lucide-preact";
import { go, type ScreenDef } from "../router";
import { role, scenario } from "../store";
import type { Role } from "../types";
import { Mascot, NavLink, Page, Segmented } from "../ui";

const items = [
  { to: "/opp", label: "기회", desc: "셀러 모집과 지원사업을 놓치지 않아요", Icon: Sparkles, roles: ["OWNER", "STAFF"] },
  { to: "/mkt", label: "홍보", desc: "사진으로 게시글 초안을 만들어요", Icon: Megaphone, roles: ["OWNER", "STAFF"] },
  { to: "/dlv", label: "배송", desc: "작품 수령과 택배를 챙겨요", Icon: Package, roles: ["OWNER", "STAFF"] },
  { to: "/rpt", label: "리포트", desc: "주간·월간 숫자를 봐요", Icon: FileBarChart, roles: ["OWNER", "STAFF", "VIEWER"] },
  { to: "/settings", label: "설정", desc: "공방 정보, 규정, 연결, 직원을 관리해요", Icon: Settings, roles: ["OWNER", "STAFF", "VIEWER"] },
  { to: "/help", label: "도움말", desc: "사용법과 보안 안내를 봐요", Icon: CircleHelp, roles: ["OWNER", "STAFF", "VIEWER"] },
];

const roleLabels = { 사장님: "OWNER", 직원: "STAFF", 열람자: "VIEWER" } as const;
const scenarioLabels = { "평소": "normal", "빈 상태": "empty", "불러오기 오류": "error" } as const;
type RoleLabel = keyof typeof roleLabels;
type ScenarioLabel = keyof typeof scenarioLabels;

function Master() {
  const roleLabel = (Object.keys(roleLabels) as RoleLabel[]).find((k) => roleLabels[k] === role.value)!;
  const scenarioLabel = (Object.keys(scenarioLabels) as ScenarioLabel[]).find((k) => scenarioLabels[k] === scenario.value)!;
  return (
    <Page title="더보기">
      <div class="list">
        {items
          .filter((i) => i.roles.includes(role.value))
          .map(({ to, label, desc, Icon }) => (
            <NavLink key={to} to={to} class="rowitem">
              <span class="glyph"><Icon size={20} /></span>
              <span class="grow">
                <span class="strong" style={{ display: "block" }}>{label}</span>
                <span class="sm muted clamp1">{desc}</span>
              </span>
              <ChevronRight size={20} class="muted" />
            </NavLink>
          ))}
      </div>
      <section class="section stack">
        <h2 class="section-head row" style={{ "--gap": "var(--s2)" }}><Mascot size={26} /> 목업 보기 설정</h2>
        <p class="sm muted">실제 서비스에는 없는 메뉴예요. 권한과 상태별 화면을 확인할 때 쓰세요.</p>
        <div class="field">
          <span class="field-label">이 역할로 보기</span>
          <Segmented<RoleLabel> label="역할" options={["사장님", "직원", "열람자"]} value={roleLabel} onChange={(v) => { role.value = roleLabels[v] as Role; if (v === "열람자") go("/rpt"); }} />
        </div>
        <div class="field">
          <span class="field-label">화면 상태</span>
          <Segmented<ScenarioLabel> label="화면 상태" options={["평소", "빈 상태", "불러오기 오류"]} value={scenarioLabel} onChange={(v) => (scenario.value = scenarioLabels[v])} />
        </div>
        <button type="button" class="rowitem" onClick={() => go("/onboarding")}>
          <span class="glyph"><RotateCcw size={20} /></span>
          <span class="grow strong">시작하기 화면 다시 보기</span>
          <ChevronRight size={20} class="muted" />
        </button>
      </section>
    </Page>
  );
}

export const screen: ScreenDef = { Master };
