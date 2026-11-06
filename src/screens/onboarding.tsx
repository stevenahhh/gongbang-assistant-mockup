import { signal } from "@preact/signals";
import { useEffect, useState } from "preact/hooks";
import { Check, ChevronLeft, Clock, Sparkles } from "lucide-preact";
import { go, route } from "../router";
import { classes, connections, currentPolicy, log, newId, shop, toast } from "../store";
import type { ClassItem } from "../types";
import { Btn, Chips, Field, IconBtn, Mascot, Segmented, Status, Stepper, Switch, TextArea, TextInput } from "../ui";
import { won } from "../lib/time";
import { ACADEMY_REASON, isAcademy, policyErrors, savePolicy, summarize, type PolicyDraft } from "./settings-policy";
import { ShopFields, emptyShop, shopValid, type ShopDraft } from "./settings-shop";
import { connTone, openAlimFlow, openBizFlow, openTalkFlow } from "./settings-connections";
import { toNumber } from "./settings-shared";

const STEPS = ["welcome", "shop", "class", "policy", "channel", "ready"] as const;
type Step = (typeof STEPS)[number];
const titles: Record<Step, [string, string]> = {
  welcome: ["시작하기", ""],
  shop: ["공방 정보", "공예 분야와 주소는 기회 알림의 자격 판정과 비서 문구에 써요."],
  class: ["첫 클래스 등록", "회차는 나중에 예약 화면에서 만들어요. 클래스는 더 추가할 수 있어요."],
  policy: ["규정 정하기", "고른 유형에 맞춰 기본 규정을 채워 드려요. 나중에 설정에서 바꿀 수 있어요."],
  channel: ["채널 연결", "지금 건너뛰어도 돼요. 오늘 화면에서 언제든 연결할 수 있어요."],
  ready: ["준비 완료", "남은 일은 오늘 화면의 할 일 카드로 알려 드려요."],
};

interface ClassDraft {
  name: string;
  mins: string;
  cap: number;
  price: string;
  note: string;
  pickup: ClassItem["pickup"];
  fireDays: string;
}

interface OnbPolicy {
  types: string[];
  useDeposit: boolean;
  amount: string;
  deadline: string;
  after: string;
  regular: boolean;
}

const minsOptions = ["60분", "90분", "120분", "150분", "180분"];
const fireOptions = ["14일", "21일", "28일"];
const pickupOptions: ClassItem["pickup"][] = ["현장 수령", "소성 후 픽업·택배"];
const typeOptions = ["원데이클래스만", "학원으로 등록", "플랫폼으로도 판매"];
const deadlineOptions = ["1일 전", "2일 전", "3일 전", "7일 전"];
const afterOptions = ["예약금 몰수", "절반 환불", "전액 환불"];

const emptyClass = (): ClassDraft => ({ name: "", mins: "120분", cap: 6, price: "", note: "", pickup: "현장 수령", fireDays: "" });
const defaultPolicy = (): OnbPolicy => ({ types: [], useDeposit: true, amount: "20000", deadline: "2일 전", after: "절반 환불", regular: false });

const samples: Record<string, ClassDraft> = {
  도자: { name: "원데이 물레 체험", mins: "120분", cap: 6, price: "55000", note: "앞치마를 드려요. 건물 뒤 공영주차장을 쓰세요.", pickup: "소성 후 픽업·택배", fireDays: "21일" },
  가죽: { name: "가죽 카드지갑 만들기", mins: "90분", cap: 6, price: "45000", note: "완성품은 바로 가져가요.", pickup: "현장 수령", fireDays: "" },
  캔들: { name: "소이 캔들 2종 만들기", mins: "90분", cap: 8, price: "38000", note: "향은 수업 때 골라요.", pickup: "현장 수령", fireDays: "" },
  플라워: { name: "계절 꽃다발 만들기", mins: "90분", cap: 6, price: "48000", note: "꽃은 그날 아침에 들여와요.", pickup: "현장 수령", fireDays: "" },
  금속: { name: "실버 링 만들기", mins: "120분", cap: 4, price: "65000", note: "반지 호수를 미리 재 와 주세요.", pickup: "현장 수령", fireDays: "" },
  섬유: { name: "손뜨개 티코스터", mins: "120분", cap: 6, price: "35000", note: "실과 바늘을 드려요.", pickup: "현장 수령", fireDays: "" },
  목공: { name: "원목 도마 만들기", mins: "150분", cap: 6, price: "60000", note: "편한 옷을 입고 오세요.", pickup: "현장 수령", fireDays: "" },
  기타: { name: "원데이 클래스", mins: "90분", cap: 6, price: "40000", note: "", pickup: "현장 수령", fireDays: "" },
};

export const step = signal<Step>("welcome");
const shopDraft = signal<ShopDraft>(emptyShop());
const classDraft = signal<ClassDraft>(emptyClass());
const policyDraft = signal<OnbPolicy>(defaultPolicy());
const channelSkipped = signal(false);

const isStep = (s: string | undefined): s is Step => (STEPS as readonly string[]).includes(s ?? "");

function setStep(s: Step) {
  step.value = s;
  go(`/onboarding/${s}`, { replace: true });
}

function Title({ s }: { s: Step }) {
  const [h, p] = titles[s];
  return (
    <div class="onb-title">
      <h2>{h}</h2>
      {p ? <p>{p}</p> : null}
    </div>
  );
}

function Welcome() {
  const [state, setState] = useState<"idle" | "loading" | "failed">("idle");
  const login = (fail: boolean) => {
    setState("loading");
    setTimeout(() => {
      if (fail) return setState("failed");
      setState("idle");
      setStep("shop");
    }, 700);
  };
  return (
    <>
      <div class="onb-body">
        <div class="onb-hero">
          <Mascot size={112} />
          <h1>공방 AI 비서</h1>
          <p class="muted">문의 답장, 예약 안내, 공고 확인을 비서가 미리 준비해요. 사장님은 확인하고 승인만 하면 돼요.</p>
          <ul class="adm-checks ok" style={{ textAlign: "start" }}>
            <li>
              <Check size={16} /> 손님 문의가 오면 답장 초안을 만들어요
            </li>
            <li>
              <Check size={16} /> 예약 확정과 리마인드를 대신 보내요
            </li>
            <li>
              <Check size={16} /> 셀러 모집과 지원사업 공고를 찾아 알려요
            </li>
          </ul>
          {state === "failed" ? (
            <div class="card alert stack" role="alert">
              <p class="strong sm">네이버 로그인이 잠시 안 돼요.</p>
              <p class="sm">계정은 만들지 않았어요. 잠시 뒤 다시 시도해 주세요.</p>
              <Btn small onClick={() => login(false)}>
                다시 시도
              </Btn>
            </div>
          ) : null}
          <div class="row wrap" style={{ justifyContent: "center" }}>
            <Btn small onClick={() => login(true)}>
              로그인 실패 화면 보기
            </Btn>
            <Btn small onClick={() => go("/today")}>
              나중에 하기
            </Btn>
          </div>
          <p class="cap muted">로그인을 취소하면 다음에 다시 시작할 수 있어요.</p>
        </div>
      </div>
      <footer class="onb-foot col">
        <button type="button" class="adm-naver" disabled={state === "loading"} aria-busy={state === "loading"} onClick={() => login(false)}>
          <img src="/naver-login.png" alt="네이버 로그인" width="1472" height="224" />
        </button>
        <p class="cap muted" style={{ textAlign: "center" }} aria-live="polite">
          {state === "loading" ? "네이버에 연결하고 있어요" : "네이버 계정으로 시작해요. 비밀번호는 네이버에만 넣어요."}
        </p>
      </footer>
    </>
  );
}

function ShopStep() {
  const draft = shopDraft.value;
  const valid = shopValid(draft);
  const next = () => {
    shop.value = { ...shop.value, ...draft, name: draft.name.trim() };
    log({ actorKind: "사장님", actor: "사장님", action: "공방 정보를 등록함", target: draft.name.trim(), targetType: "기타", result: "완료" });
    setStep("class");
  };
  return (
    <>
      <div class="onb-body">
        <Title s="shop" />
        <ShopFields draft={draft} onChange={(d) => (shopDraft.value = d)} />
      </div>
      <footer class="onb-foot">
        <Btn variant="primary" disabled={!valid} onClick={next}>
          다음
        </Btn>
      </footer>
    </>
  );
}

function ClassStep() {
  const d = classDraft.value;
  const set = (p: Partial<ClassDraft>) => (classDraft.value = { ...d, ...p });
  const firing = d.pickup === "소성 후 픽업·택배";
  const errors = {
    name: d.name.trim() ? "" : "클래스 이름을 써 주세요",
    price: toNumber(d.price) > 0 ? "" : "가격을 써 주세요",
    fire: firing && !d.fireDays ? "소성 기간을 골라 주세요" : "",
  };
  const valid = !errors.name && !errors.price && !errors.fire;
  const craft = shopDraft.value.crafts[0] ?? shop.value.crafts[0] ?? "기타";
  const fill = () => {
    classDraft.value = { ...(samples[craft] ?? samples["기타"]) };
    toast(`${craft} 분야 예시로 채웠어요. 고쳐서 써도 돼요`);
  };
  const next = () => {
    const item: ClassItem = {
      id: newId("c"),
      name: d.name.trim(),
      mins: toNumber(d.mins),
      cap: d.cap,
      price: toNumber(d.price),
      pickup: d.pickup,
      fireDays: firing ? toNumber(d.fireDays) : undefined,
      note: d.note.trim(),
      onSale: true,
    };
    const same = classes.value.find((c) => c.name === item.name);
    classes.value = same ? classes.value.map((c) => (c.id === same.id ? { ...item, id: c.id } : c)) : [...classes.value, item];
    log({ actorKind: "사장님", actor: "사장님", action: "클래스를 등록함", target: item.name, targetType: "기타", result: "완료" });
    setStep("policy");
  };
  return (
    <>
      <div class="onb-body">
        <Title s="class" />
        <div class="stack" style={{ "--gap": "var(--s4)" }}>
          <Btn variant="outline" onClick={fill}>
            <Sparkles size={18} /> 예시 클래스로 채우기
          </Btn>
          <Field label="클래스 이름" error={d.name.length > 0 && errors.name}>
            <TextInput value={d.name} onValue={(v) => set({ name: v })} placeholder="원데이 물레 체험" />
          </Field>
          <div class="field">
            <span class="field-label">소요 시간</span>
            <Segmented label="소요 시간" options={minsOptions} value={d.mins} onChange={(v) => set({ mins: v })} />
          </div>
          <div class="field">
            <span class="field-label">정원</span>
            <div class="row between">
              <span class="help-text">한 회차에 1~50명까지 받을 수 있어요</span>
              <Stepper label="정원" value={d.cap} min={1} max={50} onChange={(v) => set({ cap: v })} />
            </div>
          </div>
          <Field label="가격" error={d.price.length > 0 && errors.price} hint={toNumber(d.price) > 0 ? `1명 ${won(toNumber(d.price))}` : "1명 기준 금액이에요"}>
            <TextInput value={d.price} onValue={(v) => set({ price: v.replace(/\D/g, "") })} inputMode="numeric" placeholder="55000" />
          </Field>
          <div class="field">
            <span class="field-label">완성품 수령 방식</span>
            <Segmented label="완성품 수령 방식" options={pickupOptions} value={d.pickup} onChange={(v) => set({ pickup: v })} />
          </div>
          {firing ? (
            <div class="field">
              <span class="field-label">소성 기간</span>
              <Segmented label="소성 기간" options={fireOptions} value={d.fireDays} onChange={(v) => set({ fireDays: v })} />
              {errors.fire ? (
                <span class="error-text" role="alert">
                  {errors.fire}
                </span>
              ) : (
                <span class="help-text">작품 수령 안내를 이 기간에 맞춰 보내요</span>
              )}
            </div>
          ) : null}
          <Field label="준비물·주차 안내" hint="선택이에요. 리마인드에 함께 넣어요">
            <TextArea value={d.note} onValue={(v) => set({ note: v })} placeholder="앞치마를 드려요. 건물 뒤 공영주차장을 쓰세요." />
          </Field>
        </div>
      </div>
      <footer class="onb-foot">
        <Btn variant="primary" disabled={!valid} onClick={next}>
          다음
        </Btn>
      </footer>
    </>
  );
}

const afterPct = (a: string) => (a === "예약금 몰수" ? 0 : a === "절반 환불" ? 50 : 100);
const toPolicy = (o: OnbPolicy): PolicyDraft => ({
  deposit: { use: o.useDeposit, amount: o.useDeposit ? toNumber(o.amount) : 0, hours: 24, overdue: "사장님 확인" },
  bands: [
    { label: `수업 ${o.deadline}까지`, percent: 100 },
    { label: `수업 ${o.deadline} 이후`, percent: afterPct(o.after) },
  ],
  shopFault: "전액 환불",
  lateMins: 15,
  noShow: o.after === "예약금 몰수" ? "예약금을 돌려드리지 않아요" : "",
});

function PolicyStep() {
  const o = policyDraft.value;
  const academy = isAcademy(o.types);
  const set = (p: Partial<OnbPolicy>) => (policyDraft.value = { ...o, ...p });
  const setTypes = (types: string[]) => {
    const nowAcademy = isAcademy(types);
    set({ types, after: nowAcademy && o.after === "예약금 몰수" ? "전액 환불" : o.after });
    if (nowAcademy && o.after === "예약금 몰수") toast("학원 등록 공방은 예약금 몰수를 고를 수 없어서 전액 환불로 바꿨어요");
  };
  const draft = toPolicy(o);
  const errors = policyErrors(draft, academy);
  const valid = o.types.length > 0 && errors.length === 0;
  const next = () => {
    shop.value = { ...shop.value, types: o.types };
    const saved = savePolicy(draft, "시작하기에서 만든 규정");
    toast(`규정 v${saved.version}을 저장했어요`);
    setStep("channel");
  };
  return (
    <>
      <div class="onb-body">
        <Title s="policy" />
        <div class="stack" style={{ "--gap": "var(--s4)" }}>
          <div class="field">
            <span class="field-label">공방 유형</span>
            <Chips label="공방 유형" options={typeOptions} value={o.types} onChange={setTypes} />
            {o.types.length ? null : <span class="help-text">하나 이상 골라 주세요. 여러 개를 고를 수 있어요.</span>}
          </div>
          <Switch label="30일 이상 이어지는 정규반도 운영해요" on={o.regular} onChange={(v) => set({ regular: v })} hint={o.regular ? "학원 등록 대상인지 확인해 보세요. 학원이면 환불 규정이 달라요." : undefined} />
          <div class="card stack">
            <Switch label="예약금 받기" on={o.useDeposit} onChange={(v) => set({ useDeposit: v })} hint="예약 후 24시간 안에 입금하지 않으면 사장님께 확인을 요청해요" />
            {o.useDeposit ? (
              <Field label="예약금" hint={toNumber(o.amount) > 0 ? won(toNumber(o.amount)) : "클래스 가격보다 클 수 없어요"}>
                <TextInput value={o.amount} onValue={(v) => set({ amount: v.replace(/\D/g, "") })} inputMode="numeric" placeholder="20000" />
              </Field>
            ) : null}
          </div>
          <div class="field">
            <span class="field-label">취소 기한</span>
            <Segmented label="취소 기한" options={deadlineOptions} value={o.deadline} onChange={(v) => set({ deadline: v })} />
            <span class="help-text">이때까지 취소하면 전액 돌려드려요</span>
          </div>
          <div class="field">
            <span class="field-label">기한 이후 취소 처리</span>
            <Chips label="기한 이후 취소 처리" options={afterOptions} value={[o.after]} onChange={(v) => v.length && set({ after: v[v.length - 1] })} disabled={(opt) => academy && opt === "예약금 몰수"} />
            {academy ? <span class="help-text">{ACADEMY_REASON}</span> : null}
          </div>
          {errors.map((e) => (
            <p key={e} class="error-text" role="alert">
              {e}
            </p>
          ))}
          <div class="card">
            <p class="cap muted">손님에게 보내는 한 줄 요약</p>
            <p class="sm" style={{ marginTop: "var(--s1)" }}>
              {summarize(draft)}
            </p>
          </div>
        </div>
      </div>
      <footer class="onb-foot">
        <Btn variant="primary" disabled={!valid} onClick={next}>
          규정 저장하고 다음
        </Btn>
      </footer>
    </>
  );
}

const channelList = [
  { name: "알림톡 발송", desc: "예약 확정과 리마인드를 카카오톡으로 보내요", open: openAlimFlow },
  { name: "네이버 톡톡", desc: "톡톡 문의를 문의함에 모아요", open: openTalkFlow },
  { name: "기업마당 공고 알림", desc: "지원사업 공고를 찾아 알려요", open: openBizFlow },
];
const live = new Set(["정상", "심사 중", "곧 만료"]);

function ChannelStep() {
  const rows = channelList.map((ch) => ({ ...ch, conn: connections.value.find((c) => c.name === ch.name) }));
  const connected = rows.filter((r) => r.conn && live.has(r.conn.status)).length;
  const finish = (skipped: boolean) => {
    channelSkipped.value = skipped;
    setStep("ready");
  };
  return (
    <>
      <div class="onb-body">
        <Title s="channel" />
        <div class="stack">
          {rows.map(({ name, desc, open, conn }) => (
            <div key={name} class="card onb-channel">
              <span class="grow">
                <span class="strong" style={{ display: "block" }}>
                  {name}
                </span>
                <span class="sm muted">{desc}</span>
                {conn ? (
                  <span style={{ display: "block", marginTop: "var(--s1)" }}>
                    <Status tone={connTone(conn.status)}>{conn.status}</Status>
                  </span>
                ) : null}
              </span>
              {conn && live.has(conn.status) ? (
                <Check size={22} style={{ color: "var(--ok)" }} />
              ) : (
                <Btn small onClick={() => open()}>
                  {conn ? "다시 연결" : "연결하기"}
                </Btn>
              )}
            </div>
          ))}
          <p class="cap muted">알림톡은 카카오 채널과 템플릿 심사를 거쳐요. 심사가 끝나기 전에는 SMS로만 보내요.</p>
        </div>
      </div>
      <footer class="onb-foot">
        <Btn onClick={() => finish(true)}>건너뛰기</Btn>
        <Btn variant="primary" onClick={() => finish(connected === 0)}>
          다음
        </Btn>
      </footer>
    </>
  );
}

function ReadyStep() {
  const cls = classDraft.value.name.trim() || classes.value.findLast((c) => c.onSale)?.name || "";
  const linked = connections.value.filter((c) => live.has(c.status)).length;
  const later = channelSkipped.value;
  const items = [
    { label: "공방 정보", sub: shop.value.name, done: true },
    { label: "첫 클래스", sub: cls, done: true },
    { label: "규정", sub: `v${currentPolicy.value.version} 저장됨`, done: true },
    { label: "채널 연결", sub: later ? "나중에 · 오늘 화면에서 연결할 수 있어요" : `${linked}개 연결됨`, done: !later },
  ];
  const finish = () => {
    log({ actorKind: "사장님", actor: "사장님", action: "시작하기를 마침", target: shop.value.name, targetType: "기타", result: "완료" });
    toast("준비가 끝났어요. 오늘 화면에서 시작해요");
    step.value = "welcome";
    go("/today");
  };
  return (
    <>
      <div class="onb-body">
        <Title s="ready" />
        <div class="list">
          {items.map((it) => (
            <div key={it.label} class="rowitem onb-check">
              <span class="glyph" data-done={it.done ? "" : undefined} data-later={it.done ? undefined : ""}>
                {it.done ? <Check size={20} /> : <Clock size={20} />}
              </span>
              <span class="grow">
                <span class="strong" style={{ display: "block" }}>
                  {it.label}
                </span>
                <span class="sm muted">{it.sub}</span>
              </span>
              {it.done ? <Status tone="ok">완료</Status> : <Status tone="warn">나중에</Status>}
            </div>
          ))}
        </div>
        {later ? (
          <Btn variant="outline" block style={{ marginTop: "var(--s4)" }} onClick={() => setStep("channel")}>
            지금 연결하기
          </Btn>
        ) : null}
        <p class="cap muted" style={{ marginTop: "var(--s4)" }}>
          비서가 틀릴 수 있어요. 손님에게 나가는 메시지는 승인함에서 확인한 뒤 보내요.
        </p>
      </div>
      <footer class="onb-foot">
        <Btn variant="primary" onClick={finish}>
          오늘 화면으로
        </Btn>
      </footer>
    </>
  );
}

export default function Onboarding() {
  const path = route.value.path[0];
  const current: Step = isStep(path) ? path : step.value;
  useEffect(() => {
    step.value = current;
  }, [current]);
  const index = STEPS.indexOf(current);
  return (
    <div class="onb">
      <header class="onb-head">
        {index > 0 ? (
          <IconBtn label="이전 단계" onClick={() => setStep(STEPS[index - 1])}>
            <ChevronLeft size={22} />
          </IconBtn>
        ) : (
          <Mascot size={36} />
        )}
        <div class="bar" role="progressbar" aria-label="시작하기 진행" aria-valuemin={0} aria-valuemax={STEPS.length - 1} aria-valuenow={index}>
          <i style={{ transform: `scaleX(${index / (STEPS.length - 1)})` }} />
        </div>
        <span class="tag num">
          {index + 1} / {STEPS.length}
        </span>
      </header>
      {current === "welcome" ? <Welcome /> : null}
      {current === "shop" ? <ShopStep /> : null}
      {current === "class" ? <ClassStep /> : null}
      {current === "policy" ? <PolicyStep /> : null}
      {current === "channel" ? <ChannelStep /> : null}
      {current === "ready" ? <ReadyStep /> : null}
    </div>
  );
}
