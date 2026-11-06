import type {
  Activity,
  AgentTask,
  AutoRule,
  Booking,
  ClassItem,
  Connection,
  Customer,
  DeliveryItem,
  Inquiry,
  NoticeItem,
  NotifyRow,
  OutboundMessage,
  Opportunity,
  Policy,
  Shop,
  Slot,
  Staff,
  Template,
} from "./types";
import { at, DAY, HOUR, MIN } from "./lib/time";

export const seedShop = (): Shop => ({
  name: "오늘의 흙 공방",
  crafts: ["도자"],
  address: "전남 순천시 조례동 123-4 2층",
  phone: "061-000-1234",
  hours: "화~일 10:00~19:00",
  placeUrl: "https://naver.me/example",
  types: ["원데이클래스만"],
});

export const seedClasses = (): ClassItem[] => [
  { id: "c1", name: "원데이 물레 체험", mins: 120, cap: 6, price: 55000, pickup: "소성 후 픽업·택배", fireDays: 21, note: "앞치마를 드려요. 건물 뒤 공영주차장을 쓰세요.", onSale: true },
  { id: "c2", name: "핸드빌딩 머그 만들기", mins: 90, cap: 8, price: 40000, pickup: "소성 후 픽업·택배", fireDays: 21, note: "손톱을 짧게 정리하고 오시면 편해요.", onSale: true },
  { id: "c3", name: "커플 물레 2인", mins: 150, cap: 4, price: 98000, pickup: "소성 후 픽업·택배", fireDays: 21, note: "2명이 한 팀이에요.", onSale: true },
  { id: "c4", name: "아이와 흙놀이", mins: 60, cap: 6, price: 30000, pickup: "현장 수령", note: "6세 이상 함께 참여해요.", onSale: false },
];

export const seedSlots = (): Slot[] => {
  const rows: [string, string, number, number, number, boolean?][] = [
    ["s0", "c2", -1, 15, 0],
    ["s1", "c1", 0, 11, 0],
    ["s2", "c2", 0, 15, 0],
    ["s3", "c1", 1, 11, 0],
    ["s4", "c2", 1, 14, 0],
    ["s5", "c3", 2, 13, 0],
    ["s6", "c1", 3, 11, 0],
    ["s7", "c2", 4, 14, 0],
    ["s8", "c1", 5, 11, 0],
    ["s9", "c3", 6, 13, 0],
    ["s10", "c1", 7, 14, 0],
    ["s11", "c2", 8, 11, 0, false],
    ["s12", "c1", 9, 11, 0],
    ["s13", "c2", 10, 14, 0],
  ];
  const caps: Record<string, number> = { c1: 6, c2: 8, c3: 4 };
  return rows.map(([id, classId, d, h, m, open]) => ({ id, classId, start: at(d, h, m), cap: caps[classId]!, open: open ?? true }));
};

const people: [string, string][] = [
  ["김민지", "010-2345-6781"], ["이서연", "010-3456-7892"], ["박지훈", "010-4567-8903"], ["최유나", "010-5678-9014"],
  ["정수아", "010-6789-0125"], ["강도윤", "010-7890-1236"], ["윤하은", "010-8901-2347"], ["장민재", "010-9012-3458"],
  ["임소율", "010-1122-3344"], ["한지우", "010-2233-4455"], ["오태양", "010-3344-5566"], ["서다인", "010-4455-6677"],
  ["신예린", "010-5566-7788"], ["권시우", "010-6677-8899"], ["황보라", "010-7788-9900"], ["안준서", "010-8899-0011"],
];

export const seedCustomers = (): Customer[] =>
  people.map(([name, phone], i) => ({ id: `u${i}`, name, phone, noShows: i === 5 ? 2 : 0, adOptIn: i % 3 === 0 }));

export const seedBookings = (): Booking[] => {
  const b = (
    id: string,
    slotId: string,
    u: number,
    party: number,
    status: Booking["status"] = "확정",
    extra: Partial<Booking> = {},
  ): Booking => ({ id, slotId, customerId: `u${u}`, party, status, depositPaid: status !== "예약금 대기", source: "직접", policyVersion: 2, memo: "", ...extra });
  return [
    b("b0", "s0", 10, 2, "확정"), b("b00", "s0", 11, 3, "확정"),
    b("b1", "s1", 0, 2), b("b2", "s1", 1, 2, "확정", { source: "네이버 엑셀", naverNo: "N-20482" }), b("b3", "s1", 2, 1, "확정", { policyVersion: 1 }),
    b("b4", "s2", 3, 3), b("b5", "s2", 4, 2, "예약금 대기", { source: "문의", inquiryId: "i2" }), b("b6", "s2", 6, 3, "확정", { memo: "유아 동반" }),
    b("b7", "s3", 7, 2), b("b8", "s3", 8, 2), b("b9", "s3", 9, 1, "확정", { source: "네이버 엑셀", naverNo: "N-20519" }),
    b("b10", "s4", 10, 2), b("b11", "s4", 11, 2, "예약금 대기"), b("b12", "s4", 12, 1),
    b("b13", "s5", 13, 2), b("b14", "s5", 14, 2),
    b("b15", "s6", 15, 2), b("b16", "s6", 0, 2), b("b17", "s6", 3, 2), b("b18", "s6", 7, 2, "대기"),
    b("b19", "s8", 2, 2),
  ];
};

export const seedPolicies = (): Policy[] => [
  {
    version: 1,
    deposit: { use: false, amount: 0, hours: 24, overdue: "사장님 확인" },
    bands: [{ label: "수업 2일 전까지", percent: 100 }, { label: "수업 1일 전", percent: 50 }, { label: "수업 당일", percent: 0 }],
    shopFault: "전액 환불",
    lateMins: 0,
    noShow: "",
    editor: "사장님",
    at: at(-60, 21),
    changes: "처음 만든 규정",
    bookingCount: 1,
  },
  {
    version: 2,
    deposit: { use: true, amount: 20000, hours: 24, overdue: "사장님 확인" },
    bands: [{ label: "수업 3일 전까지", percent: 100 }, { label: "수업 1일 전", percent: 50 }, { label: "수업 당일", percent: 0 }],
    shopFault: "전액 환불",
    lateMins: 15,
    noShow: "예약금을 돌려드리지 않아요",
    editor: "사장님",
    at: at(-14, 22),
    changes: "예약금 20,000원 도입, 지각 기준 15분 추가",
    bookingCount: 20,
  },
];

export const seedInquiries = (): Inquiry[] => [
  {
    id: "i1", channel: "톡톡", customerName: "정수아", phone: "010-6789-0125", tag: "예약 요청", tagEvidence: "내일 물레 체험 2명", status: "답장 초안 있음", taskId: "t1",
    extracted: { date: "내일", party: 2, classId: "c1", slotId: "s3" },
    messages: [{ from: "손님", text: "안녕하세요! 내일 물레 체험 2명 가능할까요?", at: Date.now() - 95 * MIN }],
  },
  {
    id: "i3", channel: "카카오톡", customerName: "강도윤", phone: "010-7890-1236", tag: "변경·취소", tagEvidence: "다음 주로 옮길 수", status: "새 문의",
    messages: [{ from: "손님", text: "죄송한데 이번 주 수업을 다음 주로 옮길 수 있을까요?", at: Date.now() - 62 * MIN }],
  },
  {
    id: "i4", channel: "전화", customerName: "번호 8821", phone: "010-1234-8821", tag: "단체·출강 견적", tagEvidence: "회사 워크숍 12명", status: "새 문의",
    messages: [{ from: "손님", text: "전화 메모: 회사 워크숍 12명, 12월 초 출강 견적 문의. 수업 끝나고 다시 전화 드리기로 함.", at: Date.now() - 40 * MIN }],
  },
  {
    id: "i5", channel: "인스타그램 DM", customerName: "@mug_lover", phone: "", tag: "가격·시간 문의", tagEvidence: "머그 수업 가격", status: "답장 초안 있음", taskId: "t9",
    messages: [{ from: "손님", text: "머그 수업 가격이랑 소요시간 알려주세요!", at: Date.now() - 4 * HOUR }],
  },
  {
    id: "i6", channel: "블로그", customerName: "도담맘", phone: "", tag: "확인 필요", tagEvidence: "주말에 아이랑", status: "새 문의",
    messages: [{ from: "손님", text: "주말에 아이랑 가도 되나요? 몇 살부터 되는지 궁금해요.", at: Date.now() - 6 * HOUR }],
  },
  {
    id: "i2", channel: "톡톡", customerName: "정수아", phone: "010-6789-0125", tag: "주차·위치", tagEvidence: "주차", status: "답함",
    messages: [
      { from: "손님", text: "주차는 어디에 하면 되나요?", at: Date.now() - 2 * DAY },
      { from: "비서", text: "건물 뒤 공영주차장을 쓰시면 돼요. 2시간 무료예요.", at: Date.now() - 2 * DAY + 20 * MIN },
      { from: "시스템", text: "사장님 승인", at: Date.now() - 2 * DAY + 19 * MIN },
    ],
  },
  {
    id: "i7", channel: "문자", customerName: "임소율", phone: "010-1122-3344", tag: "작품 수령", tagEvidence: "작품 언제", status: "끝냄",
    messages: [{ from: "손님", text: "작품 언제 찾으러 가면 될까요?", at: Date.now() - 4 * DAY }],
  },
];

export const seedTasks = (): AgentTask[] => {
  const now = Date.now();
  const reminders: AgentTask[] = ["김민지", "이서연", "박지훈", "장민재", "임소율", "한지우", "오태양", "서다인"].map((n, i) => ({
    id: `r${i}`, kind: "리마인드", title: "내일 수업 전날 리마인드", to: n, runAt: now + 3 * HOUR, createdAt: now - 2 * HOUR,
    body: `${n}님, 내일 수업 안내드려요. 준비물 없이 편한 옷으로 오세요. 주차는 건물 뒤 공영주차장을 쓰시면 돼요.`,
    evidence: [{ label: "회차", value: "내일 수업" }, { label: "확정 인원", value: "예약 확정 상태" }],
    status: "승인 대기", batch: "내일 리마인드",
  }));
  return [
    {
      id: "t1", kind: "답장", title: "정수아님 문의에 답장해요", to: "정수아 · 톡톡", runAt: now + 40 * MIN, createdAt: now - 90 * MIN,
      body: "안녕하세요, 오늘의 흙 공방입니다. 내일 11시 물레 체험은 1자리만 남았어요. 2분이 함께 오시려면 모레 13시나 3일 뒤 11시를 추천드려요.",
      reason: "내일 11시 회차에 1자리만 남아 다른 회차를 함께 제안했어요.",
      evidence: [{ label: "내일 11시 회차", value: "정원 6, 확정 5" }, { label: "클래스 가격", value: "55,000원" }, { label: "규정", value: "v2" }],
      status: "승인 대기", inquiryId: "i1",
    },
    {
      id: "t2", kind: "확정 안내", title: "윤하은님 예약 확정을 알려요", to: "윤하은 · 알림톡", runAt: now + 2 * HOUR, createdAt: now - 30 * MIN,
      body: "윤하은님, 핸드빌딩 머그 만들기 예약이 확정됐어요. 금액은 50,000원이에요. 15분 이상 늦으면 노쇼로 처리해요.",
      evidence: [{ label: "클래스 가격", value: "40,000원" }, { label: "인원", value: "3명" }, { label: "규정", value: "v2" }],
      status: "승인 대기", mismatch: { field: "금액", draft: "50,000원", source: "40,000원" }, moneyRelated: true,
    },
    {
      id: "t3", kind: "대기 자리 안내", title: "권시우님께 빈자리를 알려요", to: "권시우 · 알림톡", runAt: now + 3 * HOUR, createdAt: now - 20 * MIN,
      body: "권시우님, 3일 뒤 11시 물레 체험에 자리가 났어요. 6시간 안에 답장 주시면 예약을 잡아 드릴게요.",
      reason: "대기 순서 1번이에요. 응답 기한은 6시간으로 잡았어요.",
      evidence: [{ label: "대기 순서", value: "1번" }, { label: "남은 자리", value: "2자리" }],
      status: "승인 대기",
    },
    {
      id: "t4", kind: "신청서 초안", title: "해방마켓 체험부스 신청서를 만들었어요", to: "순천시 소상공인 원스톱 지원센터", runAt: now + 3 * DAY, createdAt: now - 5 * HOUR,
      body: "공방명: 오늘의 흙 공방\n참가 분야: 체험부스\n소개: 순천에서 물레와 핸드빌딩 수업을 여는 도자 공방입니다.\n준비 물품: 소형 물레 1대, 테이블 2개",
      evidence: [{ label: "공고", value: "해방마켓 셀러 모집" }, { label: "공방 분야", value: "도자" }, { label: "지역", value: "순천" }],
      status: "승인 대기",
    },
    {
      id: "t5", kind: "게시글 초안", title: "이번 주 수업 후기 글을 만들었어요", to: "인스타그램 · 사장님이 직접 게시", runAt: now + 2 * DAY, createdAt: now - 8 * HOUR,
      body: "이번 주말에도 물레 앞에서 웃음소리가 가득했어요. 처음 흙을 만져 보신 분들도 멋진 그릇을 완성하셨답니다.\n\n#순천공방 #도자기체험 #원데이클래스",
      evidence: [{ label: "사진", value: "3장" }, { label: "말투", value: "지난 글 12편" }],
      status: "승인 대기",
    },
    {
      id: "t6", kind: "리뷰 답글 초안", title: "남겨 주신 리뷰에 답글을 만들었어요", to: "네이버 플레이스 · 사장님이 직접 게시", runAt: now + 26 * HOUR, createdAt: now - 12 * HOUR,
      body: "소중한 후기 감사해요. 기다리시게 해서 죄송합니다. 다음 수업부터 시작 전 준비 시간을 더 넉넉히 잡을게요.",
      evidence: [{ label: "리뷰 원문", value: "수업은 좋았는데 시작이 조금 늦었어요" }],
      status: "승인 대기",
    },
    {
      id: "t9", kind: "답장", title: "@mug_lover님 문의에 답장해요", to: "@mug_lover · 복사해서 직접 보내기", runAt: now + 5 * HOUR, createdAt: now - 3 * HOUR,
      body: "안녕하세요! 핸드빌딩 머그 만들기는 40,000원이고 90분 걸려요. 작품은 소성 뒤 3주 후에 찾아가실 수 있어요.",
      evidence: [{ label: "클래스 가격", value: "40,000원" }, { label: "소요 시간", value: "90분" }],
      status: "승인 대기", inquiryId: "i5",
    },
    ...reminders,
    {
      id: "f1", kind: "리마인드", title: "오늘 15시 수업 리마인드를 보내지 못했어요", to: "최유나 · 알림톡", runAt: now - 2 * HOUR, createdAt: now - 20 * HOUR,
      body: "최유나님, 오늘 15시 수업 안내드려요.", evidence: [{ label: "연락처", value: "번호 형식 오류" }],
      status: "중단됨", failReason: "손님 번호가 맞지 않아요", failCount: 2,
    },
    {
      id: "x1", kind: "변경 안내", title: "서다인님 변경 안내", to: "서다인 · 알림톡", runAt: now - 3 * HOUR, createdAt: now - 26 * HOUR,
      body: "서다인님, 예약을 내일 14시로 옮겼어요.", evidence: [{ label: "새 회차", value: "내일 14시" }],
      status: "만료됨",
    },
    {
      id: "a1", kind: "답장", title: "주차 문의에 답했어요", to: "한지우 · 톡톡", runAt: now - 5 * HOUR, createdAt: now - 5 * HOUR,
      body: "건물 뒤 공영주차장을 쓰시면 돼요. 2시간 무료예요.", evidence: [{ label: "사전 허용", value: "가격·시간·주차 문의 답장" }, { label: "공방 정보", value: "주차 안내" }],
      status: "알아서 처리됨", result: "손님 1명에게 답장 도착",
    },
    {
      id: "a2", kind: "리마인드", title: "오늘 11시 수업 리마인드를 보냈어요", to: "3명", runAt: now - 20 * HOUR, createdAt: now - 21 * HOUR,
      body: "내일 수업 안내드려요.", evidence: [{ label: "사전 허용", value: "정보성 리마인드" }],
      status: "알아서 처리됨", result: "오늘 수업 3명 중 3명에게 리마인드 도착",
    },
  ];
};

export const seedMessages = (): OutboundMessage[] => {
  const now = Date.now();
  return [
    { id: "m1", template: "전날 리마인드", to: "김민지", channel: "알림톡", status: "도착", at: now - 20 * HOUR },
    { id: "m2", template: "전날 리마인드", to: "이서연", channel: "알림톡", status: "도착", at: now - 20 * HOUR },
    { id: "m3", template: "전날 리마인드", to: "박지훈", channel: "SMS", status: "대체 발송", at: now - 20 * HOUR, failReason: "알림톡 실패 뒤 SMS로 보냈어요" },
    { id: "m4", template: "당일 리마인드", to: "최유나", channel: "알림톡", status: "실패", at: now - 2 * HOUR, failReason: "손님 번호가 맞지 않아요" },
    { id: "m5", template: "전날 리마인드", to: "장민재", channel: "알림톡", status: "예약됨", at: at(0, 18) },
    { id: "m6", template: "예약 확정", to: "강도윤", channel: "알림톡", status: "취소됨", at: now - 26 * HOUR },
  ];
};

export const seedTemplates = (): Template[] => [
  { id: "tp1", name: "예약 확정", review: "승인", body: "#{손님 이름}님, #{클래스} 예약이 확정됐어요. #{날짜} #{시간}에 만나요." },
  { id: "tp2", name: "예약금 안내", review: "승인", body: "#{손님 이름}님, 예약금을 입금해 주시면 자리를 확정해 드려요." },
  { id: "tp3", name: "전날 리마인드", review: "승인", body: "#{손님 이름}님, 내일 #{시간} #{클래스} 수업이에요. #{주소}로 오세요." },
  { id: "tp4", name: "당일 리마인드", review: "심사중", body: "#{손님 이름}님, 오늘 #{시간} 수업이에요. 주차는 건물 뒤 공영주차장을 쓰세요." },
  { id: "tp5", name: "변경 확정", review: "승인", body: "#{손님 이름}님, 예약을 #{날짜} #{시간}으로 옮겼어요." },
  { id: "tp6", name: "취소 확정", review: "승인", body: "#{손님 이름}님, 예약이 취소됐어요. #{규정 요약}" },
  { id: "tp7", name: "대기 자리 안내", review: "반려", body: "#{손님 이름}님, 자리가 났어요. 지금 신청하세요!", rejectReason: "'지금 신청하세요'가 광고성 문구로 보여요. 안내 문구로 바꿔 주세요." },
  { id: "tp8", name: "작품 발송 안내", review: "작성중", body: "#{손님 이름}님, 작품을 보냈어요." },
];

export const seedOpportunities = (): Opportunity[] => [
  {
    id: "o1", title: "해방마켓 체험부스 셀러 모집", org: "순천시 소상공인 원스톱 지원센터", kind: "체험부스", deadline: at(4, 18), verdict: "맞음",
    verdictReason: "대상이 전국 개인·단체 셀러이고 공방이 순천에 있어요.", preferred: "우대 대상일 수 있어요", status: "관심", url: "https://example.org/notice/1842",
    attachments: ["참가신청서.hwp", "행사 안내.pdf"], announceAt: at(9, 10),
    facts: [
      { label: "기간", value: "11월 23일~24일", source: "공고 본문 2문단" },
      { label: "장소", value: "순천 웃장 일대", source: "공고 본문 2문단" },
      { label: "모집 규모", value: "체험부스 20팀", source: "공고 본문 3문단" },
      { label: "참가비", value: "1일 3만원", source: "첨부 2쪽" },
      { label: "혜택", value: null, source: "" },
      { label: "신청 방법", value: "네이버 폼", source: "공고 본문 4문단" },
    ],
    form: [{ label: "공방명", value: "오늘의 흙 공방" }, { label: "대표자 연락처", value: "061-000-1234" }, { label: "체험 내용", value: "소형 물레로 작은 그릇을 빚는 체험" }, { label: "준비 물품", value: "소형 물레 1대, 테이블 2개" }],
  },
  {
    id: "o2", title: "대한민국공예품대전 전남 예선 공모", org: "전라남도", kind: "공모전", deadline: at(6, 18), verdict: "확인 필요",
    verdictReason: "출품 자격에 사업자 등록 기준이 있어요. 등록 정보를 확인해 주세요.", status: "알림 보냄", url: "https://example.org/notice/2210",
    attachments: ["공모요강.pdf"], facts: [
      { label: "기간", value: "접수 후 12월 심사", source: "요강 1쪽" }, { label: "장소", value: "전남도청", source: "요강 1쪽" }, { label: "모집 규모", value: null, source: "" },
      { label: "참가비", value: "없음", source: "요강 2쪽" }, { label: "혜택", value: "전국 대회 출품", source: "요강 3쪽" }, { label: "신청 방법", value: "우편 접수", source: "요강 4쪽" },
    ],
    form: [{ label: "작품명", value: "" }, { label: "재료", value: "백자토" }],
  },
  {
    id: "o3", title: "소상공인 온라인 판로 지원사업", org: "기업마당", kind: "지원사업", deadline: at(12, 18), verdict: "맞음", verdictReason: "전남 소재 소상공인이 대상이에요.", status: "알림 보냄", url: "https://example.org/notice/3301",
    license: "공공누리 3유형", attachments: [], facts: [
      { label: "기간", value: "내년 1월~6월", source: "공고 본문" }, { label: "장소", value: "온라인", source: "공고 본문" }, { label: "모집 규모", value: "100개사", source: "공고 본문" },
      { label: "참가비", value: "없음", source: "공고 본문" }, { label: "혜택", value: "상세페이지 제작 지원", source: "공고 본문" }, { label: "신청 방법", value: "누리집 접수", source: "공고 본문" },
    ],
    form: [],
  },
  {
    id: "o4", title: "순천 정원 플리마켓 푸드트럭 모집", org: "순천문화재단", kind: "마켓", deadline: at(8, 18), verdict: "안 맞음", verdictReason: "받지 않을 키워드 '푸드트럭'에 해당해요.", status: "보관", url: "https://example.org/notice/4101", attachments: [], facts: [], form: [],
  },
  {
    id: "o5", title: "남도 공예 페어", org: "KCDF", kind: "마켓", deadline: at(-5, 18), verdict: "맞음", verdictReason: "전남 공예 사업자가 대상이에요.", status: "신청함", url: "https://example.org/notice/5001", attachments: [], facts: [], form: [], announceAt: at(3, 10),
  },
  {
    id: "o6", title: "해방마켓 겨울 모집", org: "순천시 소상공인 원스톱 지원센터", kind: "체험부스", deadline: at(45, 18), verdict: "확인 필요", verdictReason: "지난 모집과 같은 조건이라고 가정했어요.", status: "알림 보냄", url: "https://example.org/notice/1842", attachments: [], facts: [], form: [],
    predicted: { when: "12월 중순", rounds: ["지난해 4월 3일", "지난해 8월 1일", "지난해 12월 11일"] },
  },
];

export const seedDeliveries = (): DeliveryItem[] => [
  { id: "d1", bookingId: "b19", customer: "임소율", className: "원데이 물레 체험", classDate: at(-21), dueAt: at(0), method: "택배", address: "순천시 연향동 12-3", sent: false },
  { id: "d2", bookingId: "b2", customer: "한지우", className: "핸드빌딩 머그 만들기", classDate: at(-14), dueAt: at(7), method: "픽업", noAddress: true },
  { id: "d3", bookingId: "b3", customer: "오태양", className: "원데이 물레 체험", classDate: at(-44), dueAt: at(-23), method: "픽업", storedDays: 23 },
  { id: "d4", bookingId: "b4", customer: "서다인", className: "커플 물레 2인", classDate: at(-52), dueAt: at(-31), method: "픽업", storedDays: 31 },
  { id: "d5", bookingId: "b5", customer: "신예린", className: "원데이 물레 체험", classDate: at(-22), dueAt: at(-1), method: "택배", address: "여수시 학동 45", tracking: "6012-3344-5566", sent: true },
];

export const seedConnections = (): Connection[] => {
  const now = Date.now();
  return [
    { id: "cn1", name: "네이버 톡톡", verbLine: "톡톡 문의를 문의함에 모아요", status: "곧 만료", lastUsed: now - 95 * MIN, expiresAt: now + 20 * DAY, can: ["받은 톡톡을 문의함에 모아요", "승인한 답장을 보내요"], cannot: ["승인 없이 답장하지 않아요", "다른 채팅방을 읽지 않아요"] },
    { id: "cn2", name: "알림톡 발송", verbLine: "예약 안내를 카카오톡으로 보내요", status: "심사 중", lastUsed: now - 2 * HOUR, expiresAt: now + 80 * DAY, can: ["승인된 템플릿으로 안내를 보내요", "실패하면 SMS로 대신 보내요"], cannot: ["광고 메시지를 보내지 않아요"], pendingSends: 8 },
    { id: "cn3", name: "기업마당 공고 알림", verbLine: "지원사업 공고를 찾아 알려요", status: "오류", lastUsed: now - 26 * HOUR, expiresAt: now + 200 * DAY, can: ["공고 제목과 마감일을 가져와요"], cannot: ["신청서를 대신 내지 않아요"], error: "인증키가 만료됐어요. 새 키를 넣어 주세요." },
    { id: "cn4", name: "순천시 게시판", verbLine: "시·군 셀러 모집 공고를 확인해요", status: "정상", lastUsed: now - 6 * HOUR, can: ["공개 게시판의 새 글을 하루 2회 확인해요"], cannot: ["로그인이 필요한 글은 읽지 않아요"] },
  ];
};

export const seedActivity = (): Activity[] => {
  const now = Date.now();
  return [
    { id: "ac1", at: now - 25 * MIN, actorKind: "비서", actor: "비서", action: "답장 초안을 만듦", target: "정수아 문의", targetType: "문의", result: "대기", evidence: [{ label: "회차", value: "내일 11시" }, { label: "정원", value: "6" }, { label: "확정 인원", value: "5" }, { label: "규정", value: "v2" }] },
    { id: "ac2", at: now - 70 * MIN, actorKind: "직원", actor: "이보조", action: "예약을 등록함", target: "윤하은 · 오늘 15시", targetType: "예약", result: "완료" },
    { id: "ac3", at: now - 2 * HOUR, actorKind: "시스템", actor: "시스템", action: "리마인드 발송 실패", target: "최유나", targetType: "연결", result: "실패" },
    { id: "ac4", at: now - 3 * HOUR, actorKind: "사장님", actor: "사장님", action: "사람이 분류 수정", target: "강도윤 문의", targetType: "문의", result: "완료" },
    { id: "ac5", at: now - 5 * HOUR, actorKind: "비서", actor: "비서", action: "사전 허용으로 답장 보냄", target: "한지우 문의", targetType: "문의", result: "완료", evidence: [{ label: "사전 허용 규칙", value: "가격·시간·주차 문의 답장" }, { label: "공방 정보", value: "주차 안내" }] },
    { id: "ac6", at: now - 9 * HOUR, actorKind: "시스템", actor: "시스템", action: "이 시간대 기록을 확인하지 못했어요", target: "", targetType: "기타", result: "실패", gap: true },
    { id: "ac7", at: now - 26 * HOUR, actorKind: "비서", actor: "비서", action: "리마인드 8건을 보냄", target: "어제 회차", targetType: "예약", result: "완료" },
    { id: "ac8", at: now - 28 * HOUR, actorKind: "사장님", actor: "사장님", action: "예약을 옮김", target: "서다인 · 내일 14시", targetType: "예약", result: "완료" },
    { id: "ac9", at: now - 3 * DAY, actorKind: "사장님", actor: "사장님", action: "연락처 마스킹을 풀고 내보냄", target: "예약 내역", targetType: "예약", result: "완료" },
  ];
};

export const seedStaff = (): Staff[] => [
  { id: "st1", name: "이보조", contact: "010-1111-2222", role: "STAFF", status: "활성" },
  { id: "st2", name: "최세무", contact: "tax@example.com", role: "VIEWER", status: "활성" },
  { id: "st3", name: "새 직원", contact: "010-3333-4444", role: "STAFF", status: "초대 대기", invitedAt: Date.now() - 2 * DAY },
];

export const seedRules = (): AutoRule[] => [
  { id: "ar1", name: "정보성 리마인드는 알아서", on: true, until: Date.now() + 5 * DAY },
  { id: "ar2", name: "가격·시간·주차 문의 답장은 알아서", on: true, until: Date.now() + 62 * DAY },
];

export const seedNotify = (): NotifyRow[] => [
  { kind: "새 문의", channel: "앱 푸시" },
  { kind: "승인 요청", channel: "앱 푸시" },
  { kind: "실패", channel: "알림톡", locked: true },
  { kind: "기회", channel: "알림톡" },
  { kind: "연결 오류", channel: "앱 푸시", locked: true },
];

export const seedNotices = (): NoticeItem[] => [
  { id: "n1", level: "P3", text: "새 기회를 찾았어요: 소상공인 온라인 판로 지원사업", at: Date.now() - 5 * HOUR, read: false, href: "/opp/o3" },
  { id: "n2", level: "P3", text: "이보조님이 예약을 등록했어요", at: Date.now() - 70 * MIN, read: false, href: "/booking" },
  { id: "n3", level: "P5", text: "지난주 요약을 만들었어요", at: Date.now() - 3 * DAY, read: true, href: "/rpt" },
];
