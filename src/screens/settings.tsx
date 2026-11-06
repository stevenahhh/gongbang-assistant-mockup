import { ChevronRight, History, Link2, MessageSquareText, ScrollText, Store, UserRound, Users } from "lucide-preact";
import { go, route, type DetailProps, type ScreenDef } from "../router";
import { role } from "../store";
import type { Role } from "../types";
import { Empty, Page } from "../ui";
import { AccountSettings } from "./settings-account";
import { ActivitySettings } from "./settings-activity";
import { ConnectionsScreen } from "./settings-connections";
import { PolicySettings } from "./settings-policy";
import { ShopSettings } from "./settings-shop";
import { StaffSettings } from "./settings-staff";
import { TemplateSettings } from "./settings-templates";

interface MenuItem {
  key: string;
  label: string;
  desc: string;
  Icon: typeof Store;
  roles: Role[];
}

const groups: { title: string; items: MenuItem[] }[] = [
  {
    title: "공방",
    items: [
      { key: "shop", label: "공방 정보", desc: "이름, 분야, 주소, 연락처", Icon: Store, roles: ["OWNER"] },
      { key: "policy", label: "규정", desc: "예약금, 취소·환불, 지각·노쇼", Icon: ScrollText, roles: ["OWNER", "STAFF", "VIEWER"] },
      { key: "templates", label: "알림 문구", desc: "템플릿, 자동 발송, 발송 결과", Icon: MessageSquareText, roles: ["OWNER", "STAFF"] },
      { key: "connections", label: "연결", desc: "톡톡, 알림톡, 공고 알림", Icon: Link2, roles: ["OWNER", "STAFF"] },
    ],
  },
  {
    title: "팀",
    items: [
      { key: "staff", label: "직원·권한", desc: "초대, 역할 바꾸기, 내보내기", Icon: Users, roles: ["OWNER"] },
      { key: "activity", label: "활동 기록", desc: "누가 언제 무엇을 했는지", Icon: History, roles: ["OWNER", "STAFF"] },
    ],
  },
  {
    title: "나",
    items: [{ key: "account", label: "내 계정", desc: "알림, 방해 금지, 사용량, 탈퇴", Icon: UserRound, roles: ["OWNER", "STAFF", "VIEWER"] }],
  },
];

const roleAs: Record<Role, string> = { OWNER: "사장님으로", STAFF: "직원으로", VIEWER: "열람자로" };

function Master() {
  const selected = route.value.key === "settings" ? route.value.path[0] : undefined;
  const r = role.value;
  return (
    <div class="adm-root">
      <Page title="설정" backTo="/more" sub={false}>
        {groups.map((g) => {
          const items = g.items.filter((i) => i.roles.includes(r));
          if (!items.length) return null;
          return (
            <section key={g.title}>
              <h2 class="adm-group">{g.title}</h2>
              <div class="list">
                {items.map(({ key, label, desc, Icon }) => (
                  <button key={key} type="button" class="rowitem" aria-current={selected === key || undefined} onClick={() => go(`/settings/${key}`)}>
                    <span class="glyph">
                      <Icon size={20} />
                    </span>
                    <span class="grow">
                      <span class="strong" style={{ display: "block" }}>{label}</span>
                      <span class="sm muted clamp1">{desc}</span>
                    </span>
                    <ChevronRight size={20} class="muted" />
                  </button>
                ))}
              </div>
            </section>
          );
        })}
        <p class="cap muted" style={{ marginTop: "var(--s5)" }}>
          지금은 {roleAs[r]} 보고 있어요. 권한은 서버에서 다시 확인해요.
        </p>
      </Page>
    </div>
  );
}

function Detail({ path }: DetailProps) {
  switch (path[0]) {
    case "shop":
      return <ShopSettings />;
    case "policy":
      return <PolicySettings />;
    case "templates":
      return <TemplateSettings />;
    case "connections":
      return <ConnectionsScreen id={path[1]} />;
    case "staff":
      return <StaffSettings />;
    case "activity":
      return <ActivitySettings />;
    case "account":
      return <AccountSettings />;
    default:
      return (
        <Page title="설정" backTo="/settings">
          <Empty title="이 화면을 찾지 못했어요" />
        </Page>
      );
  }
}

export const screen: ScreenDef = { split: true, Master, Detail };
