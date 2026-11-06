import { signal } from "@preact/signals";
import { useState } from "preact/hooks";
import { Download } from "lucide-preact";
import type { ScreenDef } from "../router";
import { actorKind, actorName, bookings, byId, classOf, customers, log, role, slots, toast } from "../store";
import type { Tone } from "../types";
import { Btn, IconBtn, Page, Segmented, Status, Switch, openSheet } from "../ui";
import { DAY, HOUR, dateLabel, dayKey, hhmm, maskPhone, startOfToday, won } from "../lib/time";

const periods = ["주간", "월간"] as const;
const dims = ["클래스", "요일", "시간대"] as const;
const ranges = ["이번 주", "이번 달", "전체"] as const;
const formats = ["CSV", "엑셀"] as const;
type Period = (typeof periods)[number];
type Dim = (typeof dims)[number];
type Range = (typeof ranges)[number];
type Format = (typeof formats)[number];

interface Kpi {
  key: string;
  label: string;
  now: number;
  prev: number;
  unit: "건" | "명" | "원" | "분";
  lowerBetter?: boolean;
}
interface Rate {
  label: string;
  noShow: number;
  cancel: number;
}
interface Stats {
  now: string;
  prev: string;
  compare: string;
  kpis: Kpi[];
  channels: { ch: string; inq: number; conv: number }[];
  trend: { labels: string[]; now: number[]; prev: number[] };
  rates: Record<Dim, Rate[]>;
  reminder: { label: string; before: number; after: number }[];
}

const stats: Record<Period, Stats> = {
  주간: {
    now: "이번 주",
    prev: "지난주",
    compare: "지난주와 비교",
    kpis: [
      { key: "classes", label: "수업 수", now: 9, prev: 8, unit: "건" },
      { key: "students", label: "수강생 수", now: 31, prev: 26, unit: "명" },
      { key: "sales", label: "매출", now: 1485000, prev: 1230000, unit: "원" },
      { key: "inq", label: "문의 수", now: 18, prev: 14, unit: "건" },
      { key: "reply", label: "첫 응답 시간 중앙값", now: 12, prev: 25, unit: "분", lowerBetter: true },
      { key: "approve", label: "승인 처리 시간", now: 38, prev: 55, unit: "분", lowerBetter: true },
    ],
    channels: [
      { ch: "톡톡", inq: 10, conv: 4 },
      { ch: "전화", inq: 3, conv: 2 },
      { ch: "카카오톡", inq: 2, conv: 1 },
      { ch: "인스타그램 DM", inq: 2, conv: 0 },
      { ch: "블로그", inq: 1, conv: 0 },
      { ch: "문자", inq: 0, conv: 0 },
    ],
    trend: { labels: ["월", "화", "수", "목", "금", "토", "일"], now: [2, 3, 2, 4, 3, 3, 1], prev: [1, 2, 2, 3, 2, 3, 1] },
    rates: {
      클래스: [
        { label: "원데이 물레 체험", noShow: 6, cancel: 9 },
        { label: "핸드빌딩 머그 만들기", noShow: 4, cancel: 7 },
        { label: "커플 물레 2인", noShow: 2, cancel: 5 },
      ],
      요일: [
        { label: "화", noShow: 5, cancel: 8 },
        { label: "수", noShow: 3, cancel: 6 },
        { label: "목", noShow: 4, cancel: 7 },
        { label: "금", noShow: 6, cancel: 9 },
        { label: "토", noShow: 8, cancel: 11 },
        { label: "일", noShow: 7, cancel: 10 },
      ],
      시간대: [
        { label: "오전", noShow: 4, cancel: 6 },
        { label: "오후", noShow: 6, cancel: 9 },
        { label: "저녁", noShow: 9, cancel: 12 },
      ],
    },
    reminder: [
      { label: "원데이 물레 체험", before: 14, after: 6 },
      { label: "핸드빌딩 머그", before: 11, after: 4 },
      { label: "커플 물레 2인", before: 8, after: 2 },
    ],
  },
  월간: {
    now: "이번 달",
    prev: "지난달",
    compare: "지난달과 비교",
    kpis: [
      { key: "classes", label: "수업 수", now: 34, prev: 31, unit: "건" },
      { key: "students", label: "수강생 수", now: 118, prev: 97, unit: "명" },
      { key: "sales", label: "매출", now: 5620000, prev: 4480000, unit: "원" },
      { key: "inq", label: "문의 수", now: 71, prev: 58, unit: "건" },
      { key: "reply", label: "첫 응답 시간 중앙값", now: 14, prev: 27, unit: "분", lowerBetter: true },
      { key: "approve", label: "승인 처리 시간", now: 41, prev: 62, unit: "분", lowerBetter: true },
    ],
    channels: [
      { ch: "톡톡", inq: 38, conv: 15 },
      { ch: "전화", inq: 11, conv: 6 },
      { ch: "카카오톡", inq: 9, conv: 4 },
      { ch: "인스타그램 DM", inq: 8, conv: 2 },
      { ch: "블로그", inq: 4, conv: 1 },
      { ch: "문자", inq: 1, conv: 0 },
    ],
    trend: { labels: ["1주", "2주", "3주", "4주", "5주"], now: [12, 16, 15, 19, 9], prev: [10, 13, 14, 15, 6] },
    rates: {
      클래스: [
        { label: "원데이 물레 체험", noShow: 7, cancel: 10 },
        { label: "핸드빌딩 머그 만들기", noShow: 5, cancel: 8 },
        { label: "커플 물레 2인", noShow: 3, cancel: 6 },
      ],
      요일: [
        { label: "화", noShow: 5, cancel: 9 },
        { label: "수", noShow: 4, cancel: 7 },
        { label: "목", noShow: 4, cancel: 8 },
        { label: "금", noShow: 7, cancel: 10 },
        { label: "토", noShow: 9, cancel: 12 },
        { label: "일", noShow: 8, cancel: 11 },
      ],
      시간대: [
        { label: "오전", noShow: 4, cancel: 7 },
        { label: "오후", noShow: 7, cancel: 10 },
        { label: "저녁", noShow: 10, cancel: 13 },
      ],
    },
    reminder: [
      { label: "원데이 물레 체험", before: 15, after: 5 },
      { label: "핸드빌딩 머그", before: 12, after: 4 },
      { label: "커플 물레 2인", before: 9, after: 3 },
    ],
  },
};

const period = signal<Period>("주간");
const dim = signal<Dim>("클래스");

const fmt = (n: number, unit: Kpi["unit"]) => (unit === "원" ? won(n) : `${n.toLocaleString("ko-KR")}${unit}`);

function KpiCard({ k, prevLabel }: { k: Kpi; prevLabel: string }) {
  const diff = k.now - k.prev;
  const good = k.lowerBetter ? diff < 0 : diff > 0;
  const tone: Tone = diff === 0 ? "muted" : good ? "ok" : "warn";
  const pct = k.prev ? Math.round((Math.abs(diff) / k.prev) * 100) : 0;
  const delta = diff === 0 ? "같아요" : `${diff > 0 ? "+" : "-"}${fmt(Math.abs(diff), k.unit)} (${pct}%)`;
  const max = Math.max(k.now, k.prev, 1);
  const big = fmt(k.now, k.unit);
  return (
    <div class="g-kpi">
      <span class="cap muted">{k.label}</span>
      <span class="g-big num" data-long={big.length > 7 ? "" : undefined}>
        {big}
      </span>
      <span class="row" style={{ "--gap": "var(--s2)" }}>
        <Status tone={tone}>{delta}</Status>
      </span>
      <span class="cap muted num">
        {prevLabel} {fmt(k.prev, k.unit)}
      </span>
      <div class="g-mini" aria-hidden="true">
        <div class="bar">
          <i style={{ transform: `scaleX(${k.now / max})` }} />
        </div>
        <div class="bar prev">
          <i style={{ transform: `scaleX(${k.prev / max})` }} />
        </div>
      </div>
    </div>
  );
}

function LineChart({ s }: { s: Stats }) {
  const W = 320;
  const H = 120;
  const px = 10;
  const py = 12;
  const { labels, now, prev } = s.trend;
  const max = Math.max(...now, ...prev, 1);
  const x = (i: number, len: number) => px + (i * (W - 2 * px)) / Math.max(len - 1, 1);
  const y = (v: number) => H - py - (v / max) * (H - 2 * py);
  const points = (arr: number[]) => arr.map((v, i) => `${x(i, arr.length).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  return (
    <div class="g-line stack" style={{ "--gap": "var(--s2)" }}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`문의 수 추이, ${s.now} ${now.join(", ")}건`}>
        {[0, 0.5, 1].map((f) => (
          <line key={f} x1={px} x2={W - px} y1={y(f * max)} y2={y(f * max)} stroke="var(--line)" stroke-width="1" />
        ))}
        <polyline points={points(prev)} fill="none" stroke="var(--ink-2)" stroke-width="2" stroke-dasharray="4 4" stroke-linejoin="round" opacity="0.6" />
        <polyline points={points(now)} fill="none" stroke="var(--run)" stroke-width="3" stroke-linejoin="round" stroke-linecap="round" />
        {now.map((v, i) => (
          <circle key={i} cx={x(i, now.length)} cy={y(v)} r="3.5" fill="var(--run)" />
        ))}
      </svg>
      <div class="g-axis num">
        {labels.map((l) => (
          <span key={l}>{l}</span>
        ))}
      </div>
      <div class="g-legend">
        <span>
          <i /> {s.now}
        </span>
        <span>
          <i class="prev" /> {s.prev}
        </span>
      </div>
    </div>
  );
}

function ChannelTable({ s }: { s: Stats }) {
  const max = Math.max(...s.channels.map((c) => c.inq), 1);
  return (
    <table class="g-tbl">
      <thead>
        <tr>
          <th scope="col">채널</th>
          <th scope="col" class="num">
            문의
          </th>
          <th scope="col" class="num">
            전환
          </th>
          <th scope="col">전환율</th>
        </tr>
      </thead>
      <tbody>
        {s.channels.map((c) => {
          const rate = c.inq ? Math.round((c.conv / c.inq) * 100) : 0;
          return (
            <tr key={c.ch}>
              <td class="strong">{c.ch}</td>
              <td class="num">{c.inq}</td>
              <td class="num">{c.conv}</td>
              <td>
                <span class="row" style={{ "--gap": "var(--s2)" }}>
                  <span class="bar grow" aria-hidden="true">
                    <i style={{ transform: `scaleX(${c.inq / max})` }} />
                  </span>
                  <span class="g-v num">{rate}%</span>
                </span>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function RateRows({ items }: { items: Rate[] }) {
  const max = Math.max(...items.flatMap((r) => [r.noShow, r.cancel]), 1);
  return (
    <div>
      {items.map((r) => (
        <div key={r.label} class="g-rate">
          <span class="strong clamp1">{r.label}</span>
          <span class="stack" style={{ "--gap": "var(--s1)" }}>
            <span class="row" style={{ "--gap": "var(--s2)" }}>
              <span class="g-k">노쇼</span>
              <span class="bar grow" aria-hidden="true">
                <i style={{ transform: `scaleX(${r.noShow / max})`, background: "var(--warn)" }} />
              </span>
              <span class="g-v num">{r.noShow}%</span>
            </span>
            <span class="row" style={{ "--gap": "var(--s2)" }}>
              <span class="g-k">취소</span>
              <span class="bar grow" aria-hidden="true">
                <i style={{ transform: `scaleX(${r.cancel / max})` }} />
              </span>
              <span class="g-v num">{r.cancel}%</span>
            </span>
          </span>
        </div>
      ))}
    </div>
  );
}

function PairedBars({ s }: { s: Stats }) {
  const max = Math.max(...s.reminder.flatMap((r) => [r.before, r.after]), 1);
  const h = (v: number) => `${Math.round((v / max) * 78)}%`;
  return (
    <>
      <div class="g-cols" role="img" aria-label={s.reminder.map((r) => `${r.label} 리마인드 전 ${r.before}%, 후 ${r.after}%`).join(". ")}>
        {s.reminder.map((r) => (
          <div key={r.label} class="g-col">
            <div class="g-col-bars">
              <span class="g-col-bar" style={{ "--h": h(r.before) }}>
                <b class="num">{r.before}%</b>
                <i />
              </span>
              <span class="g-col-bar" data-after="" style={{ "--h": h(r.after) }}>
                <b class="num">{r.after}%</b>
                <i />
              </span>
            </div>
            <span class="g-col-label clamp1">{r.label}</span>
          </div>
        ))}
      </div>
      <div class="g-legend">
        <span>
          <i class="before" /> 리마인드 전 4주
        </span>
        <span>
          <i class="after" /> 리마인드 후 4주
        </span>
      </div>
    </>
  );
}

const cell = (v: string | number) => {
  let s = String(v);
  if (/^[=+\-@]/.test(s)) s = `'${s}`;
  if (/[",\n\r]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
};

function exportRows(range: Range) {
  const todayStart = startOfToday();
  const weekday = new Date(todayStart + 9 * HOUR).getUTCDay();
  const weekStart = todayStart - ((weekday + 6) % 7) * DAY;
  const month = dayKey(Date.now()).slice(0, 7);
  return bookings.value
    .map((b) => {
      const slot = byId(slots.value, b.slotId);
      const cls = classOf(slot);
      const customer = byId(customers.value, b.customerId);
      return slot && cls && customer ? { b, slot, cls, customer } : null;
    })
    .filter((r): r is NonNullable<typeof r> => r !== null)
    .filter(({ slot }) => (range === "이번 주" ? slot.start >= weekStart && slot.start < weekStart + 7 * DAY : range === "이번 달" ? dayKey(slot.start).slice(0, 7) === month : true))
    .toSorted((a, b) => a.slot.start - b.slot.start);
}

function buildCsv(rows: ReturnType<typeof exportRows>, unmask: boolean) {
  const head = ["예약번호", "수업일", "시간", "클래스", "손님", "연락처", "인원", "상태", "예약금", "금액", "경로", "메모"];
  const lines = rows.map(({ b, slot, cls, customer }) =>
    [b.id, dateLabel(slot.start), hhmm(slot.start), cls.name, customer.name, unmask ? customer.phone : maskPhone(customer.phone), b.party, b.status, b.depositPaid ? "입금" : "미입금", cls.price * b.party, b.source, b.memo]
      .map(cell)
      .join(","),
  );
  return [head.join(","), ...lines].join("\n");
}

function ExportForm({ close }: { close: () => void }) {
  const owner = role.value === "OWNER";
  const [range, setRange] = useState<Range>("이번 달");
  const [format, setFormat] = useState<Format>("CSV");
  const [unmask, setUnmask] = useState(false);
  const rows = exportRows(range);
  const run = () => {
    const csv = buildCsv(rows, unmask && owner);
    const text = format === "엑셀" ? `\uFEFF${csv.replace(/\n/g, "\r\n")}` : csv;
    const blob = new Blob([text], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `예약내역_${range}_${dayKey(Date.now())}.csv`;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    log({
      actorKind: actorKind(),
      actor: actorName(),
      action: unmask && owner ? "연락처 마스킹 해제 내보내기" : "예약 내역 내보내기",
      target: `예약 ${rows.length}건 · ${range} · ${format}`,
      targetType: "예약",
      result: "완료",
    });
    toast(unmask && owner ? "연락처를 그대로 내보냈어요. 활동 기록에 적었어요" : "예약 내역을 내려받았어요");
    close();
  };
  return (
    <div class="stack" style={{ "--gap": "var(--s4)" }}>
      <div class="field">
        <span class="field-label">기간</span>
        <Segmented<Range> label="기간" options={ranges} value={range} onChange={setRange} />
      </div>
      <div class="field">
        <span class="field-label">형식</span>
        <Segmented<Format> label="형식" options={formats} value={format} onChange={setFormat} />
        <span class="help-text">{format === "엑셀" ? "엑셀에서 바로 열리는 CSV로 저장해요. 한글이 깨지지 않아요." : "쉼표로 나눈 UTF-8 파일이에요."}</span>
      </div>
      <Switch
        label="연락처 그대로 내보내기"
        on={unmask && owner}
        disabled={!owner}
        onChange={setUnmask}
        hint={owner ? "끄면 ***-****-1234처럼 가려요. 켜서 내보낼 때마다 활동 기록에 남아요." : "사장님만 풀 수 있어요. 지금은 가린 채로 나가요."}
      />
      <p class="sm muted num">{rows.length}건을 내보내요. 셀 첫 글자가 = + - @ 이면 따옴표를 붙여서 수식이 실행되지 않게 해요.</p>
      <Btn variant="primary" disabled={!rows.length} onClick={run}>
        <Download size={18} /> 내려받기
      </Btn>
    </div>
  );
}

const openExport = () => openSheet("예약 내역 내보내기", (close) => <ExportForm close={close} />);

function Master() {
  const p = period.value;
  const s = stats[p];
  const r = role.value;
  const kpis = s.kpis.filter((k) => !(k.key === "sales" && r === "STAFF"));
  return (
    <div class="growth-root">
      <Page
        title="리포트"
        backTo="/more"
        sub={false}
        right={
          <IconBtn label="예약 내역 내보내기" onClick={openExport}>
            <Download size={20} />
          </IconBtn>
        }
      >
        <div class="wide stack" style={{ "--gap": "var(--s5)" }}>
          <Segmented<Period> label="기간" options={periods} value={p} onChange={(v) => (period.value = v)} />
          <section class="stack">
            <div class="row between">
              <h2 class="section-head" style={{ margin: 0 }}>
                {s.now} 요약
              </h2>
              <span class="cap muted">{s.compare}</span>
            </div>
            {r === "STAFF" ? <p class="cap muted">매출은 사장님만 볼 수 있어요.</p> : null}
            <div class="g-kpis">
              {kpis.map((k) => (
                <KpiCard key={k.key} k={k} prevLabel={s.prev} />
              ))}
            </div>
          </section>
          <section class="stack">
            <h2 class="section-head" style={{ margin: 0 }}>
              문의 수 추이
            </h2>
            <div class="card">
              <LineChart s={s} />
            </div>
          </section>
          <section class="stack">
            <h2 class="section-head" style={{ margin: 0 }}>
              문의 유입 채널
            </h2>
            <div class="card">
              <ChannelTable s={s} />
            </div>
            <p class="cap muted">붙여 넣은 문의는 사장님이 고른 채널로 셌어요.</p>
          </section>
          <section class="stack">
            <h2 class="section-head" style={{ margin: 0 }}>
              노쇼·취소율
            </h2>
            <Segmented<Dim> label="기준" options={dims} value={dim.value} onChange={(v) => (dim.value = v)} />
            <div class="card">
              <RateRows items={s.rates[dim.value]} />
            </div>
          </section>
          <section class="stack">
            <h2 class="section-head" style={{ margin: 0 }}>
              리마인드 전후 노쇼율
            </h2>
            <div class="card g-card">
              <PairedBars s={s} />
            </div>
          </section>
          <section class="stack">
            <Btn variant="outline" onClick={openExport}>
              <Download size={18} /> 예약 내역 내보내기
            </Btn>
            <p class="cap muted">숫자는 한국 표준시 기준이에요. 매출은 예약금과 잔금을 합한 금액이에요.</p>
          </section>
        </div>
      </Page>
    </div>
  );
}

export const screen: ScreenDef = { Master };
