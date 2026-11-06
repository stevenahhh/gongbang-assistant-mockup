import type { ComponentChildren } from "preact";
import { ChevronRight, Lock } from "lucide-preact";
import { back } from "../router";
import { role } from "../store";
import type { Role } from "../types";
import { Btn, Empty, Page } from "../ui";
import { DAY } from "../lib/time";

export function Rows({ children }: { children: ComponentChildren }) {
  return <div class="adm-rows">{children}</div>;
}

export function Row({
  label,
  value,
  tone,
  hint,
  danger,
  disabled,
  onClick,
}: {
  label: ComponentChildren;
  value?: ComponentChildren;
  tone?: "ok" | "warn";
  hint?: string;
  danger?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}) {
  const inner = (
    <>
      <span class="grow">
        <span class={danger ? "adm-row-label danger" : "adm-row-label"}>{label}</span>
        {hint ? (
          <span class="help-text" style={{ display: "block" }}>
            {hint}
          </span>
        ) : null}
      </span>
      {value !== undefined && value !== null ? <span class={tone ? `adm-row-value num ${tone}` : "adm-row-value num"}>{value}</span> : null}
      {onClick && !disabled ? <ChevronRight size={20} class="muted" /> : null}
    </>
  );
  if (!onClick) return <div class="adm-row">{inner}</div>;
  return (
    <button type="button" class="adm-row" disabled={disabled} onClick={onClick}>
      {inner}
    </button>
  );
}

export function SecretField({
  label,
  value,
  onValue,
  placeholder,
  secret = true,
  inputMode,
}: {
  label: string;
  value: string;
  onValue: (v: string) => void;
  placeholder?: string;
  secret?: boolean;
  inputMode?: "text" | "tel" | "numeric" | "email" | "url";
}) {
  const attrs = { type: secret ? "password" : "text", autoComplete: "off", autoCorrect: "off", spellcheck: false, inputMode, placeholder };
  return (
    <label class="adm-field">
      <span class="adm-field-label">{label}</span>
      <input {...(attrs as object)} class="adm-field-input" value={value} onInput={(e) => onValue(e.currentTarget.value)} />
    </label>
  );
}

export function SecureSave({ disabled, onClick, label = "저장" }: { disabled?: boolean; onClick: () => void; label?: string }) {
  return (
    <div class="stack" style={{ "--gap": "var(--s2)" }}>
      <Btn variant="primary" disabled={disabled} onClick={onClick}>
        <Lock size={18} /> {label}
      </Btn>
      <p class="cap muted adm-lock-note">
        <Lock size={14} /> 내 암호화 키로 보호돼요
      </p>
    </div>
  );
}

export function Denied({ title, backTo = "/settings" }: { title: string; backTo?: string }) {
  return (
    <Page title={title} backTo={backTo}>
      <Empty title="이 화면은 사장님만 볼 수 있어요" action={<Btn onClick={() => back(backTo)}>돌아가기</Btn>}>
        필요하면 사장님께 권한을 요청해 주세요.
      </Empty>
    </Page>
  );
}

export function Guard({ allow, title, children }: { allow: Role[]; title: string; children: ComponentChildren }) {
  return allow.includes(role.value) ? <>{children}</> : <Denied title={title} />;
}

export const roleLabel = (r: Role) => (r === "OWNER" ? "사장님" : r === "STAFF" ? "직원" : "열람자");
export const digits = (s: string) => s.replace(/\D/g, "");
export const isMobile = (s: string) => /^01\d{8,9}$/.test(digits(s));
export const isTel = (s: string) => /^0\d{8,10}$/.test(digits(s));
export const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
export const daysLeft = (t: number) => Math.ceil((t - Date.now()) / DAY);
export const toNumber = (s: string) => Number(digits(s) || 0);

const jong = (w: string) => {
  const c = w.charCodeAt(w.length - 1);
  return c >= 0xac00 && c <= 0xd7a3 ? (c - 0xac00) % 28 : -1;
};
export const euro = (w: string) => `${w}${jong(w) <= 0 || jong(w) === 8 ? "로" : "으로"}`;
export const eul = (w: string) => `${w}${jong(w) <= 0 ? "를" : "을"}`;
export const maskContact = (c: string) => (c.includes("@") ? `${c.slice(0, 2)}***@${c.split("@")[1] ?? ""}` : `***-****-${digits(c).slice(-4)}`);
