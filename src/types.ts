export type Role = "OWNER" | "STAFF" | "VIEWER";
export type Tone = "run" | "ok" | "warn" | "err" | "muted";

export interface Shop {
  name: string;
  crafts: string[];
  address: string;
  phone: string;
  hours: string;
  placeUrl: string;
  types: string[];
}

export interface ClassItem {
  id: string;
  name: string;
  mins: number;
  cap: number;
  price: number;
  pickup: "현장 수령" | "소성 후 픽업·택배";
  fireDays?: number;
  note: string;
  onSale: boolean;
}

export interface Slot {
  id: string;
  classId: string;
  start: number;
  cap: number;
  open: boolean;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  noShows: number;
  adOptIn: boolean;
}

export type BookingStatus = "예약금 대기" | "확정" | "대기" | "취소" | "출석" | "노쇼";
export type BookingSource = "직접" | "문의" | "네이버 엑셀" | "플랫폼";

export interface Booking {
  id: string;
  slotId: string;
  customerId: string;
  party: number;
  status: BookingStatus;
  depositPaid: boolean;
  source: BookingSource;
  policyVersion: number;
  memo: string;
  inquiryId?: string;
  naverNo?: string;
  refunded?: boolean;
  checkedAt?: number;
}

export type Channel = "톡톡" | "전화" | "카카오톡" | "인스타그램 DM" | "블로그" | "문자" | "기타";
export type InquiryStatus = "새 문의" | "답장 초안 있음" | "답함" | "끝냄";
export type InquiryTag =
  | "예약 요청"
  | "가격·시간 문의"
  | "주차·위치"
  | "변경·취소"
  | "작품 수령"
  | "단체·출강 견적"
  | "기타"
  | "확인 필요";

export interface ChatLine {
  from: "손님" | "사장님" | "비서" | "시스템";
  text: string;
  at: number;
}

export interface Inquiry {
  id: string;
  channel: Channel;
  customerName: string;
  phone: string;
  messages: ChatLine[];
  tag: InquiryTag;
  tagEvidence: string;
  status: InquiryStatus;
  assignee?: string;
  taskId?: string;
  extracted?: { date?: string; party?: number; classId?: string; slotId?: string };
  bookingId?: string;
}

export type TaskKind =
  | "답장"
  | "리마인드"
  | "확정 안내"
  | "변경 안내"
  | "취소 안내"
  | "대기 자리 안내"
  | "발송 안내"
  | "신청서 초안"
  | "게시글 초안"
  | "리뷰 답글 초안";

export type TaskStatus =
  | "승인 대기"
  | "승인됨"
  | "실행 중"
  | "완료"
  | "부분 완료"
  | "실패"
  | "중단됨"
  | "반려됨"
  | "만료됨"
  | "사람이 처리"
  | "알아서 처리됨";

export interface Evidence {
  label: string;
  value: string;
}

export interface AgentTask {
  id: string;
  kind: TaskKind;
  title: string;
  to: string;
  runAt: number;
  createdAt: number;
  body: string;
  originalBody?: string;
  evidence: Evidence[];
  reason?: string;
  status: TaskStatus;
  mismatch?: { field: string; draft: string; source: string };
  failReason?: string;
  failCount?: number;
  batch?: string;
  inquiryId?: string;
  progress?: { done: number; total: number };
  result?: string;
  moneyRelated?: boolean;
}

export type MessageStatus = "예약됨" | "보냄" | "도착" | "실패" | "대체 발송" | "취소됨";

export interface OutboundMessage {
  id: string;
  template: string;
  to: string;
  channel: "알림톡" | "SMS";
  status: MessageStatus;
  at: number;
  failReason?: string;
}

export type TemplateReview = "작성중" | "심사중" | "승인" | "반려";

export interface Template {
  id: string;
  name: string;
  body: string;
  review: TemplateReview;
  rejectReason?: string;
}

export interface RefundBand {
  label: string;
  percent: number;
}

export interface Policy {
  version: number;
  deposit: { use: boolean; amount: number; hours: number; overdue: "자동 취소" | "사장님 확인" };
  bands: RefundBand[];
  shopFault: string;
  lateMins: number;
  noShow: string;
  editor: string;
  at: number;
  changes: string;
  bookingCount: number;
}

export type Verdict = "맞음" | "확인 필요" | "안 맞음";
export type OppStatus = "알림 보냄" | "보관" | "관심" | "준비 중" | "신청함" | "선정" | "미선정" | "참가 완료" | "마감 지남";

export interface OppFact {
  label: string;
  value: string | null;
  source: string;
}

export interface Opportunity {
  id: string;
  title: string;
  org: string;
  kind: "마켓" | "체험부스" | "공모전" | "지원사업" | "교육";
  deadline: number;
  verdict: Verdict;
  verdictReason: string;
  preferred?: string;
  status: OppStatus;
  url: string;
  license?: string;
  attachments: string[];
  facts: OppFact[];
  form: { label: string; value: string }[];
  announceAt?: number;
  predicted?: { when: string; rounds: string[] };
}

export interface DeliveryItem {
  id: string;
  bookingId: string;
  customer: string;
  className: string;
  classDate: number;
  dueAt: number;
  method: "픽업" | "택배";
  address?: string;
  tracking?: string;
  noAddress?: boolean;
  storedDays?: number;
  sent?: boolean;
}

export type ConnStatus = "설정 중" | "심사 중" | "정상" | "곧 만료" | "만료" | "오류" | "해제됨";

export interface Connection {
  id: string;
  name: string;
  verbLine: string;
  status: ConnStatus;
  lastUsed?: number;
  expiresAt?: number;
  can: string[];
  cannot: string[];
  error?: string;
  pendingSends?: number;
}

export type ActorKind = "사장님" | "직원" | "비서" | "시스템";

export interface Activity {
  id: string;
  at: number;
  actorKind: ActorKind;
  actor: string;
  action: string;
  target: string;
  targetType: "예약" | "문의" | "연결" | "규정" | "기타";
  result: "완료" | "실패" | "부분 완료" | "대기" | "되돌림";
  evidence?: Evidence[];
  gap?: boolean;
}

export interface Staff {
  id: string;
  name: string;
  contact: string;
  role: "STAFF" | "VIEWER";
  status: "활성" | "초대 대기";
  invitedAt?: number;
}

export interface AutoRule {
  id: string;
  name: string;
  on: boolean;
  until: number;
}

export interface NotifyRow {
  kind: string;
  channel: "앱 푸시" | "알림톡" | "이메일" | "끄기";
  locked?: boolean;
}

export interface NoticeItem {
  id: string;
  level: "P3" | "P5";
  text: string;
  at: number;
  read: boolean;
  href?: string;
}
