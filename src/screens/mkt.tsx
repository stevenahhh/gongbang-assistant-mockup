import { signal } from "@preact/signals";
import { Camera, Copy, Download, Image, Megaphone, X } from "lucide-preact";
import { go, type ScreenDef } from "../router";
import { actorKind, actorName, addTask, byId, classes, log, patch, role, shop, tasks, toast } from "../store";
import type { TaskStatus, Tone } from "../types";
import { Btn, Empty, Field, Mascot, Page, Segmented, Status, TextArea, TextInput, openSheet } from "../ui";
import { HOUR } from "../lib/time";

const tabs = ["게시글 초안", "리뷰 답글"] as const;
const channels = ["블로그", "인스타그램"] as const;
type Tab = (typeof tabs)[number];
type Ch = (typeof channels)[number];

interface Photo {
  id: number;
  name: string;
  style: number;
  url?: string;
  face?: boolean;
  consent?: boolean;
}
interface PostDraft {
  taskId: string;
  channel: Ch;
  body: string;
  tags: string[];
  photos: number;
  posted?: boolean;
}
interface ReplyDraft {
  taskId: string;
  review: string;
  body: string;
}

const MAX = 10;
const risky = ["무독성", "효능", "최저가"];
const riskRe = /(무독성|효능|최저가)/g;
const foundRisks = (text: string) => risky.filter((w) => text.includes(w));
const samples: Omit<Photo, "id">[] = [
  { name: "물레 위에 올린 그릇", style: 1 },
  { name: "완성된 머그 네 개", style: 2 },
  { name: "수업 중인 손님", style: 3, face: true },
  { name: "유약 바른 접시", style: 4 },
  { name: "작업대 전경", style: 5 },
];

const tab = signal<Tab>("게시글 초안");
const photos = signal<Photo[]>([]);
const channel = signal<Ch>("블로그");
const emphasis = signal("무독성 유약을 써요. 첫 수업 손님도 쉬워요");
const progress = signal<{ step: string; pct: number } | null>(null);
const post = signal<PostDraft | null>(null);
const review = signal("물레 체험은 재밌었는데 예약 시간보다 20분 늦게 시작해서 아쉬웠어요. 선생님은 친절하셨어요.");
const reply = signal<ReplyDraft | null>(null);
const replyBusy = signal(false);
let photoId = 0;

const taskTone = (s: TaskStatus | undefined): Tone => (s === "승인 대기" ? "run" : s === "완료" || s === "사람이 처리" ? "ok" : s === "반려됨" ? "err" : "muted");

function askConsent(faces: Photo[]) {
  const ids = new Set(faces.map((p) => p.id));
  openSheet("얼굴이 나온 사진이 있어요", (close) => (
    <div class="stack" style={{ "--gap": "var(--s4)" }}>
      <p>{faces.length}장에 손님 얼굴이 보여요. 게시하려면 손님 동의가 필요해요. 동의를 받으셨나요?</p>
      <div class="g-photos">
        {faces.map((p) => (
          <PhotoTile key={p.id} p={p} />
        ))}
      </div>
      <Btn
        variant="primary"
        onClick={() => {
          photos.value = photos.value.map((p) => (ids.has(p.id) ? { ...p, consent: true } : p));
          log({ actorKind: actorKind(), actor: actorName(), action: "사진 초상권 동의 확인", target: `사진 ${faces.length}장`, targetType: "기타", result: "완료" });
          toast("동의 받은 사진으로 표시했어요");
          close();
        }}
      >
        동의 받았어요
      </Btn>
      <Btn
        onClick={() => {
          photos.value = photos.value.filter((p) => !ids.has(p.id));
          toast("얼굴이 나온 사진을 뺐어요");
          close();
        }}
      >
        이 사진 빼기
      </Btn>
    </div>
  ));
}

function addPhotos(list: Photo[]) {
  const room = MAX - photos.value.length;
  if (room <= 0) {
    toast("사진은 10장까지 넣을 수 있어요");
    return;
  }
  if (list.length > room) toast(`10장까지만 넣을 수 있어서 ${list.length - room}장은 뺐어요`);
  const next = list.slice(0, room);
  photos.value = [...photos.value, ...next];
  const faces = next.filter((p) => p.face && !p.consent);
  if (faces.length) askConsent(faces);
}

function PhotoTile({ p, onRemove }: { p: Photo; onRemove?: () => void }) {
  return (
    <div class="g-photo" data-style={p.url ? undefined : p.style} style={p.url ? { backgroundImage: `url("${p.url}")` } : undefined} role="img" aria-label={p.name}>
      {p.face ? (
        <span class="g-face">
          <Status tone={p.consent ? "ok" : "warn"}>{p.consent ? "동의 받음" : "얼굴"}</Status>
        </span>
      ) : null}
      {onRemove ? (
        <button type="button" class="g-x" aria-label={`${p.name} 빼기`} onClick={onRemove}>
          <X size={18} />
        </button>
      ) : null}
    </div>
  );
}

function Highlight({ text }: { text: string }) {
  return (
    <>
      {text.split(riskRe).map((part, i) =>
        risky.includes(part) ? (
          <mark key={i} class="g-risk">
            {part}
          </mark>
        ) : (
          part
        ),
      )}
    </>
  );
}

function finishPost() {
  const ch = channel.value;
  const em = emphasis.value.trim().replace(/[.。]\s*$/, "");
  const n = photos.value.length;
  const first = classes.value.find((c) => c.onSale)?.name ?? "원데이 클래스";
  const body =
    ch === "블로그"
      ? `${shop.value.name}에서 ${first} 수업이 있었어요. 사진 ${n}장으로 그날 분위기를 담았어요.\n\n처음 흙을 만지는 손님도 두 시간이면 그릇 하나를 빚어요. ${em ? `${em}. ` : ""}소성이 끝나면 3주 뒤에 작품을 찾아가거나 택배로 받을 수 있어요.\n\n수업 문의는 네이버 톡톡으로 주세요.`
      : `${shop.value.name}, ${first}.\n${em ? `${em}.\n` : ""}두 시간 뒤면 내 손으로 만든 그릇이 생겨요.\n예약은 프로필 링크에서 받아요.`;
  const tags = ch === "블로그" ? ["순천공방", "원데이클래스", "물레체험", "순천데이트"] : ["순천공방", "원데이클래스", "물레체험", "순천데이트", "도자기공방", "주말데이트"];
  const evidence = [
    { label: "사진", value: `${n}장` },
    { label: "채널", value: ch },
    ...(em ? [{ label: "강조할 점", value: em }] : []),
  ];
  const t = addTask({
    kind: "게시글 초안",
    title: `${ch} 게시글 초안`,
    to: ch,
    runAt: Date.now() + HOUR,
    body: `${body}\n\n${tags.map((x) => `#${x}`).join(" ")}`,
    evidence,
    reason: role.value === "OWNER" ? "사장님이 사진으로 요청했어요" : "직원이 요청했어요. 사장님 승인이 필요해요",
  });
  post.value = { taskId: t.id, channel: ch, body, tags, photos: n };
  log({ actorKind: actorKind(), actor: actorName(), action: "게시글 초안 요청", target: `${ch} 게시글`, targetType: "기타", result: "완료" });
  toast("초안을 승인함에 넣었어요");
}

function makePost() {
  const faces = photos.value.filter((p) => p.face && !p.consent);
  if (faces.length) {
    askConsent(faces);
    return;
  }
  const steps = ["사진을 보고 있어요", "공방 말투로 쓰고 있어요", "해시태그를 고르고 있어요"];
  let i = 0;
  progress.value = { step: steps[0]!, pct: 0.2 };
  const tick = () => {
    i += 1;
    if (i < steps.length) {
      progress.value = { step: steps[i]!, pct: (i + 1) / (steps.length + 1) };
      setTimeout(tick, 420);
      return;
    }
    progress.value = null;
    finishPost();
  };
  setTimeout(tick, 420);
}

function PostCard({ d }: { d: PostDraft }) {
  const task = byId(tasks.value, d.taskId);
  const status = task?.status;
  const risks = foundRisks(d.body);
  const owner = role.value === "OWNER";
  const copyAll = () => {
    void navigator.clipboard?.writeText(`${d.body}\n\n${d.tags.map((t) => `#${t}`).join(" ")}`);
    toast("본문과 해시태그를 복사했어요");
  };
  const download = () => {
    for (const p of photos.value) {
      if (!p.url) continue;
      const a = document.createElement("a");
      a.href = p.url;
      a.download = p.name;
      a.click();
    }
    toast(`사진 ${d.photos}장을 내려받았어요`);
  };
  const markPosted = () => {
    patch(tasks, d.taskId, { status: "사람이 처리", result: "사장님이 직접 게시했어요" });
    log({ actorKind: actorKind(), actor: actorName(), action: "게시 완료 표시", target: `${d.channel} 게시글`, targetType: "기타", result: "완료" });
    post.value = { ...d, posted: true };
    toast("게시한 것으로 표시했어요");
  };
  return (
    <article class="card g-card">
      <div class="row between">
        <span class="row" style={{ "--gap": "var(--s2)" }}>
          <Mascot size={26} />
          <span class="strong">{d.channel} 게시글 초안</span>
        </span>
        <Status tone={d.posted ? "ok" : taskTone(status)}>{d.posted ? "게시했어요" : (status ?? "승인 대기")}</Status>
      </div>
      <p class="pre">
        <Highlight text={d.body} />
      </p>
      <div class="g-tags">
        {d.tags.map((t) => (
          <Status key={t}>#{t}</Status>
        ))}
      </div>
      {risks.length ? (
        <div class="card g-warn sm">
          <span class="strong">표시광고 위험</span> ‘{risks.join("’, ‘")}’ 같은 말은 근거 자료가 없으면 과장 광고로 볼 수 있어요. 빼거나 근거를 붙여 주세요.
        </div>
      ) : null}
      <div class="row">
        <Btn small class="grow" onClick={copyAll}>
          <Copy size={18} /> 복사하기
        </Btn>
        <Btn small class="grow" onClick={download}>
          <Download size={18} /> 사진 내려받기
        </Btn>
      </div>
      <Btn variant="primary" disabled={d.posted || !owner} onClick={markPosted}>
        {d.posted ? "게시했어요" : "게시했어요로 표시"}
      </Btn>
      <p class="cap muted">{owner ? "비서는 게시하지 않아요. 복사해서 직접 올린 뒤 표시해 주세요." : "사장님이 승인한 뒤 직접 올려요. 비서는 게시하지 않아요."}</p>
      <p class="cap muted">손님에게 직접 보내는 홍보는 수신 동의한 분께만, 오전 8시부터 오후 9시 사이에 (광고) 표시를 붙여 보내요.</p>
    </article>
  );
}

function onFiles(e: { currentTarget: HTMLInputElement }) {
  const files = Array.from(e.currentTarget.files ?? []);
  addPhotos(files.map((f) => ({ id: ++photoId, name: f.name, style: 0, url: URL.createObjectURL(f) })));
  e.currentTarget.value = "";
}

function PostTab() {
  const ph = photos.value;
  const p = progress.value;
  const d = post.value;
  const staff = role.value === "STAFF";
  const em = emphasis.value;
  const emRisks = foundRisks(em);
  return (
    <>
      <section class="stack">
        <div class="row between">
          <h2 class="section-head" style={{ margin: 0 }}>
            사진 고르기
          </h2>
          <span class="sm muted num">
            {ph.length} / {MAX}
          </span>
        </div>
        <div class="g-photos">
          {ph.map((x) => (
            <PhotoTile key={x.id} p={x} onRemove={() => (photos.value = photos.value.filter((y) => y.id !== x.id))} />
          ))}
          {ph.length < MAX ? (
            <>
              <label class="g-add">
                <input class="vh" type="file" accept="image/*" capture="environment" onChange={onFiles} />
                <Camera size={22} />
                <span>찍어서 넣기</span>
              </label>
              <label class="g-add">
                <input class="vh" type="file" accept="image/*" multiple onChange={onFiles} />
                <Image size={22} />
                <span>앨범에서 고르기</span>
              </label>
            </>
          ) : null}
        </div>
        <div class="row wrap">
          <Btn small variant="outline" onClick={() => addPhotos(samples.map((s) => ({ ...s, id: ++photoId })))}>
            예시 사진 쓰기
          </Btn>
          {ph.length ? (
            <Btn small onClick={() => (photos.value = [])}>
              모두 빼기
            </Btn>
          ) : null}
        </div>
        <p class="cap muted">손님 얼굴이 보이면 동의를 받았는지 먼저 물어봐요. 비서가 네이버나 인스타그램에서 사진을 가져오지는 않아요.</p>
      </section>
      <div class="field">
        <span class="field-label">어디에 올릴까요</span>
        <Segmented<Ch> label="채널" options={channels} value={channel.value} onChange={(v) => (channel.value = v)} />
      </div>
      <Field label="강조할 점 (선택)" hint={emRisks.length ? `‘${emRisks.join("’, ‘")}’은 표시광고 위험이 있어요. 초안에서 강조해 보여 드려요.` : undefined}>
        <TextInput value={em} onValue={(v) => (emphasis.value = v)} placeholder="예: 첫 수업 손님도 쉬워요" />
      </Field>
      {p ? (
        <div class="card g-card">
          <span class="row" style={{ "--gap": "var(--s2)" }}>
            <Mascot size={26} />
            <span class="strong">{p.step}</span>
          </span>
          <div class="bar">
            <i style={{ transform: `scaleX(${p.pct})` }} />
          </div>
        </div>
      ) : null}
      <Btn variant={d ? "outline" : "primary"} disabled={!ph.length || Boolean(p)} onClick={makePost}>
        <Megaphone size={18} /> {d ? "초안 다시 만들기" : staff ? "초안 요청하기" : "초안 만들기"}
      </Btn>
      {!ph.length ? <p class="cap muted">사진을 한 장 이상 넣으면 초안을 만들 수 있어요.</p> : null}
      {d ? <PostCard d={d} /> : null}
    </>
  );
}

function makeReply() {
  const text = review.value.trim();
  const negative = /늦|아쉬|실망|별로|불친절|비싸|기다|불편|더러|추워|더워/.test(text);
  replyBusy.value = true;
  setTimeout(() => {
    const late = /늦|기다/.test(text);
    const body = negative
      ? `소중한 후기를 남겨 주셔서 고마워요. 불편을 드려 정말 죄송해요. ${late ? "앞 수업 정리 시간을 넉넉히 두고 시작 시간을 꼭 지키도록 바꿀게요. " : "말씀해 주신 부분을 바로 살펴서 고칠게요. "}다음에 오시면 더 편하게 모실게요.`
      : `따뜻한 후기 고마워요. 즐겁게 만드신 모습이 저희에게도 큰 힘이 돼요. 작품은 소성이 끝나면 연락드릴게요. 다음에도 편하게 들러 주세요.`;
    const t = addTask({
      kind: "리뷰 답글 초안",
      title: negative ? "아쉬운 리뷰에 답글" : "고마운 리뷰에 답글",
      to: "네이버 리뷰",
      runAt: Date.now() + HOUR,
      body,
      evidence: [{ label: "리뷰 원문", value: text.length > 30 ? `${text.slice(0, 30)}…` : text }],
      reason: negative ? "사과와 개선 약속을 담았어요" : "감사 인사를 담았어요",
    });
    reply.value = { taskId: t.id, review: text, body };
    replyBusy.value = false;
    log({ actorKind: actorKind(), actor: actorName(), action: "리뷰 답글 초안 요청", target: "네이버 리뷰", targetType: "기타", result: "완료" });
    toast("답글 초안을 승인함에 넣었어요");
  }, 700);
}

function ReplyCard({ r }: { r: ReplyDraft }) {
  const status = byId(tasks.value, r.taskId)?.status;
  return (
    <article class="card g-card">
      <div class="row between">
        <span class="row" style={{ "--gap": "var(--s2)" }}>
          <Mascot size={26} />
          <span class="strong">답글 초안</span>
        </span>
        <Status tone={taskTone(status)}>{status ?? "승인 대기"}</Status>
      </div>
      <div class="inner stack" style={{ "--gap": "var(--s1)" }}>
        <span class="cap muted">리뷰 원문</span>
        <p class="sm pre">{r.review}</p>
      </div>
      <p class="pre">{r.body}</p>
      <Btn
        onClick={() => {
          void navigator.clipboard?.writeText(r.body);
          toast("답글을 복사했어요");
        }}
      >
        <Copy size={18} /> 복사하기
      </Btn>
      <p class="cap muted">답글도 직접 올려요. 비서는 게시하지 않아요.</p>
    </article>
  );
}

function ReviewTab() {
  const r = reply.value;
  const text = review.value;
  const busy = replyBusy.value;
  return (
    <>
      <Field label="리뷰 붙여 넣기" hint="네이버, 인스타그램 어디서 온 리뷰든 괜찮아요.">
        <TextArea value={text} onValue={(v) => (review.value = v)} placeholder="리뷰 내용을 붙여 넣어 주세요" />
      </Field>
      <Btn variant={r ? "outline" : "primary"} disabled={!text.trim() || busy} onClick={makeReply}>
        {busy ? "쓰고 있어요" : r ? "답글 다시 만들기" : "답글 초안 만들기"}
      </Btn>
      {r ? <ReplyCard r={r} /> : null}
      <p class="cap muted">네이버 스마트플레이스의 AI 답글이 공방 업종에 열리면 그 기능으로 안내해 드려요.</p>
    </>
  );
}

function Master() {
  if (role.value === "VIEWER") {
    return (
      <Page title="홍보">
        <Empty
          title="이 화면은 사장님만 볼 수 있어요"
          action={
            <Btn small onClick={() => go("/more")}>
              돌아가기
            </Btn>
          }
        />
      </Page>
    );
  }
  return (
    <div class="growth-root">
      <Page title="홍보" backTo="/more" sub={false}>
        <div class="wide stack" style={{ "--gap": "var(--s4)" }}>
          <Segmented<Tab> label="홍보 종류" options={tabs} value={tab.value} onChange={(v) => (tab.value = v)} />
          {tab.value === "게시글 초안" ? <PostTab /> : <ReviewTab />}
        </div>
      </Page>
    </div>
  );
}

export const screen: ScreenDef = { Master };
