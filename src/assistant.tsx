import { useRef, useState } from "preact/hooks";
import { ArrowUp, Mic } from "lucide-preact";
import { go, route } from "./router";
import { slots } from "./store";
import { Btn, IconBtn, Mascot, openSheet } from "./ui";
import { dayKey, at } from "./lib/time";

interface Line {
  from: "me" | "bot";
  text: string;
  warn?: boolean;
  action?: { label: string; run: () => void };
}

const examples = ["내일 2시 머그 2명 김민지 예약 잡아 줘", "네이버 리뷰를 다 긁어 와", "인스타 DM에 자동으로 답해 줘", "오늘 할 일 알려 줘"];
const secretPattern = /(sk-|ntn_|ghp_|token|토큰|비밀번호|api[ _-]?key)\S*/i;

function reply(text: string, close: () => void): Line {
  if (secretPattern.test(text)) {
    return { from: "bot", warn: true, text: "비밀번호나 키는 여기에 적지 마세요. 입력한 내용을 가렸어요. 연결 화면의 전용 칸에 넣어 주세요.", action: { label: "연결 화면 열기", run: () => { close(); go("/settings/connections"); } } };
  }
  if (/긁어|크롤|수집/.test(text)) return { from: "bot", text: "네이버 정책이 자동 수집을 금지해서 할 수 없어요. 리뷰를 붙여 넣으면 답글 초안을 만들 수 있어요.", action: { label: "리뷰 답글 만들기", run: () => { close(); go("/mkt"); } } };
  if (/인스타|DM/i.test(text)) return { from: "bot", text: "인스타그램 DM 자동 응답은 아직 할 수 없어요. 대화를 붙여 넣으면 문의로 정리하고 답장 초안을 만들어요.", action: { label: "문의함 열기", run: () => { close(); go("/inbox"); } } };
  const booking = text.match(/(\d+)\s*시.*?(\d+)\s*명\s*([가-힣]{2,4})?/);
  if (booking && /예약/.test(text)) {
    const [, hour, party, name] = booking;
    const wantClass = /머그/.test(text) ? "c2" : /커플/.test(text) ? "c3" : "c1";
    const tomorrow = dayKey(at(1));
    const slot = slots.value.find((s) => s.classId === wantClass && dayKey(s.start) === tomorrow) ?? slots.value.find((s) => s.classId === wantClass && s.start > Date.now());
    return {
      from: "bot",
      text: `${hour}시 ${party}명 ${name ?? "손님"} 예약을 화면에 채워 둘게요. 저장은 사장님이 눌러 주세요.`,
      action: { label: "예약 화면 열기", run: () => { close(); void import("./screens/booking-form").then((m) => m.openBookingForm({ slotId: slot?.id, party: Number(party), name })); } },
    };
  }
  if (/옮겨|변경/.test(text) && route.value.key === "booking" && route.value.path[0]) {
    return { from: "bot", text: "열어 둔 예약을 대상으로 변경 화면을 열게요.", action: { label: "변경 화면 열기", run: () => { close(); go(`/booking/${route.value.path[0]}?edit=1`); } } };
  }
  if (/할 일|오늘/.test(text)) return { from: "bot", text: "오늘 화면에 할 일을 모아 두었어요.", action: { label: "오늘 화면 열기", run: () => { close(); go("/today"); } } };
  return { from: "bot", text: "이 목업에서는 예시 문장으로 동작을 보여 드려요. 아래 예시를 눌러 보세요." };
}

function Assistant({ close }: { close: () => void }) {
  const [lines, setLines] = useState<Line[]>([{ from: "bot", text: "무엇을 맡길까요? 말로 맡기면 화면을 채워 드려요. 저장은 사장님이 눌러요." }]);
  const [text, setText] = useState("");
  const [listening, setListening] = useState(false);
  const end = useRef<HTMLDivElement>(null);

  const send = (raw: string) => {
    const value = raw.trim();
    if (!value) return;
    const shown = secretPattern.test(value) ? value.replace(secretPattern, "••••••") : value;
    setLines((prev) => [...prev, { from: "me", text: shown }, reply(value, close)]);
    setText("");
    requestAnimationFrame(() => end.current?.scrollIntoView({ block: "end" }));
  };

  return (
    <div class="stack" style={{ "--gap": "var(--s4)" }}>
      <div class="chat">
        {lines.map((l, i) => (
          <div key={i} class="stack" style={{ "--gap": "var(--s2)", alignItems: l.from === "me" ? "flex-end" : "flex-start" }}>
            <div class={l.from === "me" ? "bubble mine" : "bubble"} style={l.warn ? { background: "var(--warn-soft)" } : undefined}>{l.text}</div>
            {l.action ? <Btn small variant="primary" onClick={l.action.run}>{l.action.label}</Btn> : null}
          </div>
        ))}
      </div>
      <div class="chips" aria-label="예시 문장">
        {examples.map((e) => (
          <button key={e} type="button" class="chip" onClick={() => send(e)}>{e}</button>
        ))}
      </div>
      <form class="ask-bar" style={{ boxShadow: "none", width: "100%" }} onSubmit={(e) => { e.preventDefault(); send(text); }}>
        <Mascot size={30} />
        <input class="grow" style={{ border: 0, background: "none", minHeight: "48px", outline: "none" }} aria-label="비서에게 말하기" placeholder="비서에게 말하기" value={text} onInput={(e) => setText(e.currentTarget.value)} />
        {text ? (
          <IconBtn label="보내기" solid type="submit"><ArrowUp size={20} /></IconBtn>
        ) : (
          <IconBtn
            label={listening ? "듣는 중" : "말로 하기"}
            solid
            onClick={() => {
              setListening(true);
              setTimeout(() => { setListening(false); send(examples[0]!); }, 700);
            }}
          >
            <Mic size={20} class={listening ? "spin" : undefined} />
          </IconBtn>
        )}
      </form>
      <div ref={end} />
    </div>
  );
}

export function openAssistant() {
  openSheet("비서에게 말하기", (close) => <Assistant close={close} />);
}
