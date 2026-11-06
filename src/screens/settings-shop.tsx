import { useState } from "preact/hooks";
import { actorKind, actorName, log, role, shop, toast } from "../store";
import type { Shop } from "../types";
import { Btn, Chips, Field, Page, TextInput, openSheet } from "../ui";
import { Denied, Row, Rows, isTel } from "./settings-shared";

export const craftOptions = ["도자", "가죽", "캔들", "플라워", "금속", "섬유", "목공", "기타"];
export type ShopDraft = Pick<Shop, "name" | "crafts" | "address" | "phone" | "hours" | "placeUrl">;

export const emptyShop = (): ShopDraft => ({ name: "", crafts: [], address: "", phone: "", hours: "", placeUrl: "" });
export const pickShop = (s: Shop): ShopDraft => ({ name: s.name, crafts: [...s.crafts], address: s.address, phone: s.phone, hours: s.hours, placeUrl: s.placeUrl });

export function shopErrors(d: ShopDraft) {
  const name = d.name.trim();
  const url = d.placeUrl.trim();
  return {
    name: !name ? "공방 이름을 써 주세요" : name.length < 2 ? "2자 이상 써 주세요" : name.length > 30 ? "30자까지 쓸 수 있어요" : "",
    crafts: d.crafts.length ? "" : "공예 분야를 하나 이상 골라 주세요",
    address: d.address.trim() ? "" : "주소를 써 주세요",
    phone: !d.phone.trim() ? "연락처를 써 주세요" : isTel(d.phone) ? "" : "번호를 다시 확인해 주세요",
    placeUrl: !url || /^https?:\/\/\S+$/.test(url) ? "" : "https://로 시작하는 주소를 써 주세요",
  };
}

export const shopValid = (d: ShopDraft) => Object.values(shopErrors(d)).every((e) => !e);

export const shopLabels: Record<keyof ShopDraft, string> = { name: "공방 이름", crafts: "공예 분야", address: "주소", phone: "연락처", hours: "운영 요일·시간", placeUrl: "네이버 플레이스 주소" };
const fieldOrder: (keyof ShopDraft)[] = ["name", "crafts", "address", "phone", "hours", "placeUrl"];

export function ShopFields({ draft, onChange, strict, only }: { draft: ShopDraft; onChange: (d: ShopDraft) => void; strict?: boolean; only?: keyof ShopDraft }) {
  const [touched, setTouched] = useState<Partial<Record<keyof ShopDraft, boolean>>>({});
  const errors = shopErrors(draft);
  const set = <K extends keyof ShopDraft>(k: K, v: ShopDraft[K]) => {
    setTouched((t) => ({ ...t, [k]: true }));
    onChange({ ...draft, [k]: v });
  };
  const err = (k: keyof typeof errors) => ((strict || touched[k]) && errors[k]) || undefined;
  const show = (k: keyof ShopDraft) => !only || only === k;
  return (
    <div class="stack" style={{ "--gap": "var(--s4)" }}>
      {show("name") ? (
        <Field label={shopLabels.name} error={err("name")} hint={`${draft.name.trim().length} / 30자`}>
          <TextInput value={draft.name} onValue={(v) => set("name", v)} invalid={Boolean(err("name"))} placeholder="예: 오늘의 흙 공방" autoComplete="organization" />
        </Field>
      ) : null}
      {show("crafts") ? (
        <div class="field">
          <span class="field-label">{shopLabels.crafts}</span>
          <Chips<string> label="공예 분야" options={craftOptions} value={draft.crafts} onChange={(v) => set("crafts", v)} />
          {err("crafts") ? <span class="error-text" role="alert">{errors.crafts}</span> : <span class="help-text">여러 개 고를 수 있어요. 기회 알림의 자격 대조에 써요.</span>}
        </div>
      ) : null}
      {show("address") ? (
        <Field label={shopLabels.address} error={err("address")} hint="검색 결과가 없으면 직접 써도 돼요">
          <TextInput value={draft.address} onValue={(v) => set("address", v)} invalid={Boolean(err("address"))} placeholder="도로명 주소" autoComplete="street-address" />
        </Field>
      ) : null}
      {show("phone") ? (
        <Field label={shopLabels.phone} error={err("phone")}>
          <TextInput value={draft.phone} onValue={(v) => set("phone", v)} invalid={Boolean(err("phone"))} inputMode="tel" placeholder="061-000-0000" autoComplete="tel" />
        </Field>
      ) : null}
      {show("hours") ? (
        <Field label={shopLabels.hours} hint="선택이에요. 비서가 답장할 때 알려 드려요">
          <TextInput value={draft.hours} onValue={(v) => set("hours", v)} placeholder="화~일 10:00~19:00" />
        </Field>
      ) : null}
      {show("placeUrl") ? (
        <Field label={shopLabels.placeUrl} error={err("placeUrl")} hint="선택이에요">
          <TextInput value={draft.placeUrl} onValue={(v) => set("placeUrl", v)} invalid={Boolean(err("placeUrl"))} inputMode="url" placeholder="https://naver.me/..." />
        </Field>
      ) : null}
    </div>
  );
}

function FieldSheet({ field, close }: { field: keyof ShopDraft; close: () => void }) {
  const [draft, setDraft] = useState<ShopDraft>(() => pickShop(shop.value));
  const dirty = JSON.stringify(draft[field]) !== JSON.stringify(shop.value[field]);
  const valid = shopValid(draft);
  const save = () => {
    shop.value = { ...shop.value, ...draft, name: draft.name.trim(), address: draft.address.trim() };
    log({ actorKind: actorKind(), actor: actorName(), action: `공방 ${shopLabels[field]}을 고침`, target: draft.name.trim(), targetType: "기타", result: "완료" });
    toast(field === "address" ? "주소를 저장했어요. 좌표를 새로 계산해요" : "공방 정보를 저장했어요");
    close();
  };
  return (
    <div class="stack" style={{ "--gap": "var(--s4)" }}>
      <ShopFields draft={draft} onChange={setDraft} strict only={field} />
      {field === "address" ? <p class="help-text">주소를 바꾸면 좌표를 새로 계산해서 기회 판정에 새 지역을 써요.</p> : null}
      <Btn variant="primary" disabled={!dirty || !valid} onClick={save}>
        저장
      </Btn>
    </div>
  );
}

const openField = (field: keyof ShopDraft) => openSheet(shopLabels[field], (close) => <FieldSheet field={field} close={close} />);

function display(s: Shop, k: keyof ShopDraft) {
  const v = s[k];
  if (Array.isArray(v)) return v.length ? v.join(", ") : "없음";
  return v || "없음";
}

export function ShopSettings() {
  if (role.value !== "OWNER") return <Denied title="공방 정보" />;
  const s = shop.value;
  return (
    <Page title="공방 정보" backTo="/settings">
      <div class="wide stack" style={{ "--gap": "var(--s4)" }}>
        <Rows>
          {fieldOrder.slice(0, 4).map((k) => (
            <Row key={k} label={shopLabels[k]} value={display(s, k)} onClick={() => openField(k)} />
          ))}
        </Rows>
        <Rows>
          {fieldOrder.slice(4).map((k) => (
            <Row key={k} label={shopLabels[k]} value={display(s, k)} onClick={() => openField(k)} />
          ))}
        </Rows>
        <p class="cap muted">공예 분야와 주소는 기회 알림의 자격 대조와 비서 문구에 써요. 공방 유형은 규정 화면에서 바꿔요.</p>
      </div>
    </Page>
  );
}
