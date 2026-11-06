// 가상 데이터와 계산 로직 (D5-1·3 팀 기획 워크시트 기준)
// 모든 데이터는 가상이며 실제 회사 설비 데이터는 쓰지 않습니다.

const EQUIPMENTS = [
  { id: "P1", name: "프레스 #1" },
  { id: "P2", name: "프레스 #2" },
  { id: "P3", name: "프레스 #3" },
  { id: "P4", name: "프레스 #4", sinceDays: 45 }, // 최근 설치된 설비 → 일부 유형은 데이터 부족
];

// 고장 유형 표준 코드 F01~F09 (워크시트 1쪽)
// mtbfDays · repair(분) 는 가상 데이터 생성용 가정값
const FAILURE_TYPES = [
  { id: "F01", name: "클러치·브레이크 마모",     symptom: "정지 위치 밀림, 오버런",                    mtbfDays: 40, repair: [150, 300],
    causes: ["마찰재 마모", "잔류 공압으로 제동 지연", "스프링 피로"], parts: ["브레이크 라이닝", "클러치 디스크", "솔레노이드 밸브"] },
  { id: "F02", name: "유압·공압 계통 누설",       symptom: "압력 저하, 밸런서 실린더 이상",             mtbfDays: 20, repair: [90, 180],
    causes: ["오일실 패킹 마모", "배관 진동으로 이음부 풀림", "호스 노화"], parts: ["오일실·패킹", "유압 호스", "피팅"] },
  { id: "F03", name: "과부하 장치 작동",          symptom: "오버로드로 라인 정지",                      mtbfDays: 18, repair: [40, 120],
    causes: ["소재 이중 투입", "허용 톤수 초과", "오버로드 밸브 이상"], parts: ["오버로드 밸브", "압력 스위치", "-"] },
  { id: "F04", name: "슬라이드·가이드(지브) 마모", symptom: "하사점 편차, 치수 불량",                    mtbfDays: 50, repair: [150, 300],
    causes: ["윤활유 부족", "편심 부하 반복", "지브 간극 증가"], parts: ["지브 라이너", "가이드 플레이트", "-"] },
  { id: "F05", name: "윤활 불량",                 symptom: "윤활 압력 알람, 마찰부 발열",               mtbfDays: 14, repair: [40, 100],
    causes: ["분배 밸브 막힘", "윤활유 오염", "윤활 펌프 이상"], parts: ["분배 밸브", "윤활유 필터", "윤활 펌프"] },
  { id: "F06", name: "모터·플라이휠·베어링 이상",  symptom: "진동, 소음, 과열",                          mtbfDays: 35, repair: [120, 240],
    causes: ["베어링 윤활 불량", "벨트 장력 이상", "모터 과부하"], parts: ["베어링", "V벨트", "냉각팬"] },
  { id: "F07", name: "금형 체결·다이쿠션 이상",   symptom: "금형 들뜸, 성형 불량",                      mtbfDays: 22, repair: [90, 180],
    causes: ["클램퍼 고장", "다이쿠션 압력 불균형", "금형 안착 불량"], parts: ["다이 클램퍼", "쿠션 실린더 실", "-"] },
  { id: "F08", name: "이송장치(피더) 오급송",     symptom: "소재 걸림, 미스피드 정지",                  mtbfDays: 7,  repair: [20, 60],
    causes: ["핑거 변형", "서보 위치 에러", "소재 휨"], parts: ["피더 핑거", "엔코더 케이블", "-"] },
  { id: "F09", name: "전기·센서 이상",            symptom: "광전 안전장치, 리미트스위치, 인코더 오류",  mtbfDays: 10, repair: [30, 80],
    causes: ["광전 센서 이물 오인식", "리미트스위치 파손", "센서 단선"], parts: ["리미트스위치", "센서 케이블", "-"] },
];

const ACTIONS = ["부품 교체", "조정", "청소·이물 제거", "재설정(리셋)", "임시 조치"];
const INSPECT_ACTIONS = ["점검 이상 없음", "윤활·청소", "조정", "부품 예방 교체"];
const WORKERS = ["보전원 A", "보전원 B", "보전원 C", "보전원 D"]; // 가명

const HOUR = 3600 * 1000;
const DAY = 24 * HOUR;
const PERIOD_DAYS = 180;
const SAFETY = 0.8; // 점검 권장일 안전계수 (팀 가정값)
const TARGET = { mttr: 70, inspectRate: 80 }; // KPI 목표값 (가정)

// 항상 같은 가상 데이터가 나오도록 고정 시드 난수
function seeded(seed) {
  return function () {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

function generateVirtualData() {
  const rand = seeded(20261106);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = today.getTime() - PERIOD_DAYS * DAY;
  const end = Date.now() - 2 * HOUR;
  const pick = (arr) => arr[Math.floor(rand() * arr.length)];
  const records = [];
  let n = 1;
  EQUIPMENTS.forEach((eq, ei) => {
    FAILURE_TYPES.forEach((ft) => {
      const mtbf = ft.mtbfDays * DAY * (0.85 + ei * 0.1); // 설비마다 조금씩 다르게
      const eqStart = eq.sinceDays ? end - eq.sinceDays * DAY : start;
      let t = eqStart + rand() * mtbf;
      while (t < end) {
        // 현재 MTTR이 워크시트 현재값(95분, 가정) 근처가 되도록 1.05배 보정
        const min = Math.round((ft.repair[0] + rand() * (ft.repair[1] - ft.repair[0])) * 1.05);
        const e = t + min * 60 * 1000;
        if (e > end) break;
        const action = pick(ACTIONS);
        records.push({
          id: "v" + n++,
          kind: "repair",
          eq: eq.id,
          type: ft.id,
          start: t,
          end: e,
          cause: pick(ft.causes),
          action,
          parts: action === "부품 교체" ? pick(ft.parts.filter((p) => p !== "-")) || "" : "",
          worker: pick(WORKERS),
          virtual: true,
        });
        t = e + mtbf * (0.6 + rand() * 0.8);
      }
    });
  });
  addVirtualInspections(records, rand, end, () => n++);
  return records;
}

// 가상 예방 점검 기록: 일부 설비·유형은 권장일 전에 점검(이행), 일부는 권장일이 지난 뒤 점검(늦은 이행)
function addVirtualInspections(records, rand, end, nextId) {
  EQUIPMENTS.forEach((eq) =>
    FAILURE_TYPES.forEach((ft) => {
      const st = comboStats(records.filter((r) => r.eq === eq.id && r.type === ft.id), end);
      if (st.insufficient || !st.count) return;
      const roll = rand();
      let at;
      if (roll < 0.12) at = st.last.start + (0.45 + rand() * 0.3) * st.mtbfDays * DAY; // 권장일 전
      else if (roll < 0.4 && st.dueAt < end - 2 * DAY) at = st.dueAt + (1 + rand() * Math.min(3, (end - st.dueAt) / DAY - 1)) * DAY; // 권장일 후
      else return;
      if (at > end - 3 * HOUR) return;
      const min = Math.round(20 + rand() * 40);
      records.push({
        id: "v" + nextId(),
        kind: "inspect",
        eq: eq.id,
        type: ft.id,
        start: at,
        end: at + min * 60 * 1000,
        cause: "",
        action: INSPECT_ACTIONS[Math.floor(rand() * INSPECT_ACTIONS.length)],
        parts: "",
        worker: WORKERS[Math.floor(rand() * WORKERS.length)],
        virtual: true,
      });
    })
  );
}

// ---------- 저장소 (가상 데이터 + 직접 입력한 기록) ----------
const STORE_KEY = "press-tracker-records-v2";

function loadUserRecords() {
  try {
    return JSON.parse(localStorage.getItem(STORE_KEY)) || [];
  } catch {
    return [];
  }
}
function saveUserRecords(list) {
  localStorage.setItem(STORE_KEY, JSON.stringify(list));
}
let _virtual;
function allRecords() {
  _virtual = _virtual || generateVirtualData();
  return _virtual.concat(loadUserRecords()).sort((a, b) => b.start - a.start);
}

// ---------- 계산 (워크시트 5쪽 수식) ----------
const durationMin = (r) => (r.end - r.start) / 60000;

/**
 * 설비 × 고장유형 한 조합의 통계
 *  수리시간 = 완료 − 발생
 *  MTTR = Σ수리시간 ÷ 고장 건수
 *  MTBF = (마지막 고장일 − 첫 고장일) ÷ (고장 건수 − 1)
 *  다음 고장 예상일 = 마지막 고장일 + MTBF
 *  점검 권장일 = 마지막 고장일 + 0.8 × MTBF
 *  고장 2건 미만이면 데이터 부족
 */
function comboStats(records, now = Date.now()) {
  const repairs = records.filter((r) => r.kind === "repair").sort((a, b) => a.start - b.start);
  const n = repairs.length;
  const out = { count: n };
  if (!n) return out;
  out.mttr = repairs.reduce((s, r) => s + durationMin(r), 0) / n;
  out.first = repairs[0];
  out.last = repairs[n - 1];
  if (n < 2) return { ...out, insufficient: true };
  out.mtbfDays = (out.last.start - out.first.start) / DAY / (n - 1);
  out.nextAt = out.last.start + out.mtbfDays * DAY;
  out.dueAt = out.last.start + SAFETY * out.mtbfDays * DAY;
  // 마지막 고장 이후 실시한 예방 점검
  out.inspection = records
    .filter((r) => r.kind === "inspect" && r.start > out.last.start)
    .sort((a, b) => b.end - a.end)[0];
  out.daysToDue = (out.dueAt - now) / DAY;
  out.status = out.inspection ? "done" : out.daysToDue < 0 ? "over" : out.daysToDue <= 7 ? "soon" : "ok";
  return out;
}

/** 결과 KPI: 평균 수리시간 MTTR (고장 수리 기록의 수리시간 평균) */
function overallMttr(records) {
  const reps = records.filter((r) => r.kind === "repair");
  return reps.length ? reps.reduce((s, r) => s + durationMin(r), 0) / reps.length : null;
}

/**
 * 과정 KPI: 점검 권장일 내 점검 이행률
 *  권장 건 = 점검 권장일이 도래한(오늘 이전) 설비×유형 조합 + 점검을 이미 실시한 조합
 *  이행 건 = 그중 권장일 이전에 예방 점검을 완료한 조합
 */
function inspectRate(combos) {
  const due = combos.filter((c) => !c.insufficient && c.count >= 2 && (c.daysToDue < 0 || c.inspection));
  const done = due.filter((c) => c.inspection && c.inspection.end <= c.dueAt);
  return { due: due.length, done: done.length, rate: due.length ? (done.length / due.length) * 100 : null };
}

// ---------- 담당자 (기본 가명 + 직접 추가한 가명) ----------
const WORKER_KEY = "press-tracker-workers-v1";
function loadExtraWorkers() {
  try {
    return JSON.parse(localStorage.getItem(WORKER_KEY)) || [];
  } catch {
    return [];
  }
}
function saveExtraWorkers(list) {
  localStorage.setItem(WORKER_KEY, JSON.stringify(list));
}
const allWorkers = () => WORKERS.concat(loadExtraWorkers());
