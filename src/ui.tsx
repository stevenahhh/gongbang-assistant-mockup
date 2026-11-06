import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ComponentChildren, TextareaHTMLAttributes } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";
import { signal } from "@preact/signals";
import { ChevronLeft, CircleHelp, Mic, X } from "lucide-preact";
import { back, go, preload, type ScreenKey } from "./router";
import type { Tone } from "./types";
import { fullLabel, relative } from "./lib/time";

export function Mascot({ size = 40 }: { size?: number }) {
  return (
    <svg class="mascot" width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <path fill="var(--clay)" d="M24 5c5 0 7 3 11 4s9 6 8 12c-1 4 1 7-1 12s-8 9-14 9c-4 0-7 2-12 0S6 36 5 31s2-8 1-12S10 10 15 8s5-3 9-3Z" />
      <ellipse cx="18" cy="23" rx="3.2" ry="5" fill="#1b1512" />
      <ellipse cx="31" cy="23" rx="3.2" ry="5" fill="#1b1512" />
      <circle cx="19" cy="21" r="1.1" fill="#fff" />
      <circle cx="32" cy="21" r="1.1" fill="#fff" />
    </svg>
  );
}

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "plain" | "danger" | "outline";
  small?: boolean;
  block?: boolean;
};

export function Btn({ variant = "plain", small, block, class: cls, ...rest }: BtnProps) {
  const c = ["btn", variant !== "plain" && variant, small && "sm", block && "block", cls].filter(Boolean).join(" ");
  return <button type="button" class={c} {...rest} />;
}

export function IconBtn({ label, plain, solid, class: cls, children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; plain?: boolean; solid?: boolean }) {
  const c = ["icon-btn", plain && "plain", solid && "solid", cls].filter(Boolean).join(" ");
  return (
    <button type="button" class={c} aria-label={label} title={label} {...rest}>
      {children}
    </button>
  );
}

export function NavLink({ to, class: cls, children, ...rest }: Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & { to: string }) {
  return (
    <a
      {...(rest as object)}
      href={`#${to}`}
      class={cls}
      onPointerDown={() => void preload((to.split("/")[1] ?? "today") as ScreenKey)}
      onClick={(e) => {
        e.preventDefault();
        go(to);
      }}
    >
      {children}
    </a>
  );
}

export function Page({
  title,
  backTo,
  right,
  children,
  foot,
  scrollRef,
  sub,
}: {
  title: ComponentChildren;
  backTo?: string;
  right?: ComponentChildren;
  children: ComponentChildren;
  foot?: ComponentChildren;
  scrollRef?: { current: HTMLDivElement | null };
  sub?: boolean;
}) {
  const isSub = sub ?? Boolean(backTo);
  return (
    <div class="page">
      <header class={isSub ? "topbar sub" : "topbar"}>
        {backTo ? (
          <IconBtn label="뒤로" class="back" data-root={backTo.split("/").length === 2 ? "" : undefined} onClick={() => back(backTo)}>
            <ChevronLeft size={22} />
          </IconBtn>
        ) : null}
        <h1>{title}</h1>
        {right ?? (isSub ? <span class="sub-spacer" /> : null)}
      </header>
      <div class="scroll" ref={scrollRef}>
        {children}
      </div>
      {foot ? <footer class="footbar">{foot}</footer> : <span />}
    </div>
  );
}

export function Status({ tone = "muted", children }: { tone?: Tone; children: ComponentChildren }) {
  return <span class={tone === "muted" ? "status" : `status ${tone}`}>{children}</span>;
}

export function Empty({ title, children, action }: { title: string; children?: ComponentChildren; action?: ComponentChildren }) {
  return (
    <div class="empty">
      <Mascot size={56} />
      <p class="strong">{title}</p>
      {children ? <p class="muted sm">{children}</p> : null}
      {action}
    </div>
  );
}

export function LoadError({ what, onRetry }: { what: string; onRetry: () => void }) {
  return (
    <div class="card alert row between wrap">
      <span class="sm strong">{what}을 불러오지 못했어요.</span>
      <Btn small onClick={onRetry}>
        다시 시도
      </Btn>
    </div>
  );
}

export function Skeleton({ height = 72, count = 3 }: { height?: number; count?: number }) {
  return (
    <div class="stack" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} class="skel" style={{ height: `${height}px` }} />
      ))}
    </div>
  );
}

export function RelTime({ t, class: cls }: { t: number; class?: string }) {
  const [abs, setAbs] = useState(false);
  return (
    <button
      type="button"
      class={`reltime num ${cls ?? "cap muted"}`}
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
        setAbs(!abs);
      }}
      aria-label={fullLabel(t)}
    >
      {abs ? fullLabel(t) : relative(t)}
    </button>
  );
}

export function Field({ label, error, help, hint, children }: { label: string; error?: string | false; help?: string; hint?: ComponentChildren; children: ComponentChildren }) {
  return (
    <label class="field">
      <span class="field-label">
        {label}
        {help ? <Help text={help} /> : null}
      </span>
      {children}
      {error ? <span class="error-text" role="alert">{error}</span> : null}
      {hint ? <span class="help-text">{hint}</span> : null}
    </label>
  );
}

interface TextInputProps {
  value: string;
  onValue: (v: string) => void;
  invalid?: boolean;
  type?: string;
  inputMode?: "text" | "tel" | "numeric" | "email" | "search" | "url";
  placeholder?: string;
  autoComplete?: string;
  disabled?: boolean;
  "aria-label"?: string;
}

export function TextInput({ value, onValue, invalid, ...rest }: TextInputProps) {
  return <input {...(rest as object)} class="input" value={value} aria-invalid={invalid || undefined} onInput={(e) => onValue(e.currentTarget.value)} />;
}

export function TextArea({ value, onValue, ...rest }: Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "value"> & { value: string; onValue: (v: string) => void }) {
  return <textarea class="input" value={value} onInput={(e) => onValue(e.currentTarget.value)} {...rest} />;
}

export function Switch({ label, on, onChange, disabled, hint }: { label: string; on: boolean; onChange: (v: boolean) => void; disabled?: boolean; hint?: string }) {
  return (
    <button type="button" role="switch" class="switch-row" aria-checked={on} disabled={disabled} onClick={() => onChange(!on)}>
      <span class="grow">
        <span class="strong">{label}</span>
        {hint ? <span class="help-text" style={{ display: "block" }}>{hint}</span> : null}
      </span>
      <span class="switch" />
    </button>
  );
}

export function Segmented<T extends string>({ options, value, onChange, label }: { options: readonly T[]; value: T; onChange: (v: T) => void; label: string }) {
  return (
    <div class="seg" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={o} type="button" role="radio" aria-checked={o === value} onClick={() => onChange(o)}>
          {o}
        </button>
      ))}
    </div>
  );
}

export function Chips<T extends string>({ options, value, onChange, label, disabled }: { options: readonly T[]; value: T[]; onChange: (v: T[]) => void; label: string; disabled?: (o: T) => boolean }) {
  return (
    <div class="chips" role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o}
          type="button"
          class="chip"
          disabled={disabled?.(o)}
          aria-pressed={value.includes(o)}
          onClick={() => onChange(value.includes(o) ? value.filter((v) => v !== o) : [...value, o])}
        >
          {o}
        </button>
      ))}
    </div>
  );
}

export function Stepper({ value, min = 1, max = 99, onChange, label }: { value: number; min?: number; max?: number; onChange: (v: number) => void; label: string }) {
  return (
    <div class="stepper" role="group" aria-label={label}>
      <IconBtn label={`${label} 줄이기`} disabled={value <= min} onClick={() => onChange(value - 1)}>
        −
      </IconBtn>
      <output class="num">{value}</output>
      <IconBtn label={`${label} 늘리기`} disabled={value >= max} onClick={() => onChange(value + 1)}>
        +
      </IconBtn>
    </div>
  );
}

export function BarRow({ label, value, max, tail, tone = "run" }: { label: string; value: number; max: number; tail?: string; tone?: "run" | "ok" | "warn" }) {
  return (
    <div class="stack" style={{ "--gap": "4px" }}>
      <div class="row between sm">
        <span>{label}</span>
        <span class="num strong">{tail ?? value}</span>
      </div>
      <div class="bar">
        <i style={{ transform: `scaleX(${max ? value / max : 0})`, background: `var(--${tone})` }} />
      </div>
    </div>
  );
}

export function MicIcon() {
  return <Mic size={20} />;
}

interface SheetEntry {
  id: number;
  title: string;
  render: (close: () => void) => ComponentChildren;
  foot?: (close: () => void) => ComponentChildren;
}

export const sheets = signal<SheetEntry[]>([]);
let sheetId = 0;

export function openSheet(title: string, render: SheetEntry["render"], foot?: SheetEntry["foot"]) {
  sheets.value = [...sheets.value, { id: ++sheetId, title, render, foot }];
}

const closeSheet = (id: number) => {
  sheets.value = sheets.value.filter((s) => s.id !== id);
};

function Sheet({ entry }: { entry: SheetEntry }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [shown, setShown] = useState(false);
  const drag = useRef({ y: 0, dy: 0, active: false });

  useEffect(() => {
    const dlg = ref.current!;
    dlg.showModal();
    dlg.focus();
    const id = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const close = () => {
    setShown(false);
    setTimeout(() => closeSheet(entry.id), 220);
  };

  const down = (e: PointerEvent) => {
    if (e.target instanceof Element && e.target.closest("button")) return;
    drag.current = { y: e.clientY, dy: 0, active: true };
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    ref.current!.dataset.drag = "";
  };
  const move = (e: PointerEvent) => {
    if (!drag.current.active) return;
    const dy = Math.max(0, e.clientY - drag.current.y);
    drag.current.dy = dy;
    ref.current!.style.transform = `translate3d(0, ${dy}px, 0)`;
  };
  const up = () => {
    if (!drag.current.active) return;
    drag.current.active = false;
    const dlg = ref.current!;
    delete dlg.dataset.drag;
    dlg.style.transform = "";
    if (drag.current.dy > 90) close();
  };

  const handle = { onPointerDown: down, onPointerMove: move, onPointerUp: up, onPointerCancel: up };

  return (
    <dialog
      ref={ref}
      class="sheet"
      tabIndex={-1}
      data-in={shown ? "" : undefined}
      aria-label={entry.title}
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      onClick={(e) => {
        if (e.target === ref.current) close();
      }}
    >
      <div class="sheet-inner">
        <div {...handle}>
          <div class="grabber" />
          <div class="sheet-head">
            <h2>{entry.title}</h2>
            <IconBtn label="닫기" plain onClick={close}>
              <X size={22} />
            </IconBtn>
          </div>
        </div>
        <div class="sheet-body">{entry.render(close)}</div>
        {entry.foot ? <div class="sheet-foot">{entry.foot(close)}</div> : <span />}
      </div>
    </dialog>
  );
}

export function SheetHost() {
  return (
    <>
      {sheets.value.map((s) => (
        <Sheet key={s.id} entry={s} />
      ))}
    </>
  );
}

export function Help({ text, example }: { text: string; example?: string }) {
  return (
    <button
      type="button"
      class="icon-btn plain"
      style={{ width: "32px", height: "32px", margin: "-6px", padding: "6px", boxSizing: "content-box" }}
      aria-label="도움말"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        openSheet("도움말", () => (
          <div class="stack">
            <p>{text}</p>
            {example ? <p class="muted sm">예: {example}</p> : null}
          </div>
        ));
      }}
    >
      <CircleHelp size={18} />
    </button>
  );
}
