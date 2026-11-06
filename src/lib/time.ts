const KST = "Asia/Seoul";
const fTime = new Intl.DateTimeFormat("ko-KR", { timeZone: KST, hour: "2-digit", minute: "2-digit", hour12: false });
const fDate = new Intl.DateTimeFormat("ko-KR", { timeZone: KST, month: "long", day: "numeric", weekday: "short" });
const fFull = new Intl.DateTimeFormat("ko-KR", {
  timeZone: KST,
  year: "numeric",
  month: "long",
  day: "numeric",
  weekday: "short",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});
const fKey = new Intl.DateTimeFormat("en-CA", { timeZone: KST, year: "numeric", month: "2-digit", day: "2-digit" });

export const MIN = 60_000;
export const HOUR = 60 * MIN;
export const DAY = 24 * HOUR;

export const hhmm = (t: number) => fTime.format(t);
export const dateLabel = (t: number) => fDate.format(t);
export const fullLabel = (t: number) => fFull.format(t);
export const dayKey = (t: number) => fKey.format(t);

export const startOfToday = () => new Date(`${dayKey(Date.now())}T00:00:00+09:00`).getTime();
export const at = (dayOffset: number, h = 0, m = 0) => startOfToday() + dayOffset * DAY + h * HOUR + m * MIN;

export function relative(t: number, now = Date.now()): string {
  const diff = t - now;
  const abs = Math.abs(diff);
  const past = diff < 0;
  if (abs < MIN) return past ? "방금" : "곧";
  if (abs < HOUR) return `${Math.round(abs / MIN)}분 ${past ? "전" : "뒤"}`;
  if (abs < DAY) return `${Math.round(abs / HOUR)}시간 ${past ? "전" : "뒤"}`;
  return `${Math.round(abs / DAY)}일 ${past ? "전" : "뒤"}`;
}

export const won = (n: number) => `${n.toLocaleString("ko-KR")}원`;
export const dDay = (t: number) => {
  const d = Math.ceil((t - startOfToday()) / DAY) - 1;
  return d <= 0 ? "오늘 마감" : `${d}일 남음`;
};
export const lastFour = (phone: string) => phone.replace(/\D/g, "").slice(-4);
export const maskPhone = (phone: string) => `***-****-${lastFour(phone)}`;
