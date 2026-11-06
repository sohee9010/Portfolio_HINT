// 가상 데이터와 계산 로직 (화면과 분리)

const EQUIPMENTS = [
  { id: "P1", name: "프레스 1호기" },
  { id: "P2", name: "프레스 2호기" },
  { id: "P3", name: "프레스 3호기" },
];

// mtbfDays: 가상 데이터 생성용 평균 고장 간격, repair: 수리 시간 범위(분)
const FAILURE_TYPES = [
  { id: "feed",   name: "소재 이송 걸림",      desc: "철판을 넣어 주는 장치에 소재가 걸림", mtbfDays: 8,  repair: [15, 40] },
  { id: "sensor", name: "센서 오류",           desc: "위치·안전 센서 오감지",               mtbfDays: 13, repair: [20, 60] },
  { id: "die",    name: "금형 이상",           desc: "금형 파손·정렬 불량",                 mtbfDays: 18, repair: [90, 180] },
  { id: "hyd",    name: "유압 압력 저하",      desc: "가압용 유압 압력 부족",               mtbfDays: 21, repair: [60, 120] },
  { id: "motor",  name: "모터 과열",           desc: "메인 모터 온도 상승으로 정지",        mtbfDays: 26, repair: [40, 90] },
  { id: "clutch", name: "클러치·브레이크 이상", desc: "작동·정지 장치 이상",                 mtbfDays: 38, repair: [120, 240] },
];

const ACTIONS = ["부품 교체", "조정", "청소·이물 제거", "재설정(리셋)", "임시 조치"];
const WORKERS = ["김반장", "이주임", "박기사", "최기사"];

const HOUR = 3600 * 1000;
const DAY = 24 * HOUR;
const PERIOD_DAYS = 90;

// 항상 같은 가상 데이터가 나오도록 고정 시드 난수
function seeded(seed) {
  return function () {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

function periodStart() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today.getTime() - PERIOD_DAYS * DAY;
}

function generateVirtualData() {
  const rand = seeded(20261106);
  const start = periodStart();
  const end = Date.now() - 2 * HOUR;
  const records = [];
  let n = 1;
  EQUIPMENTS.forEach((eq, ei) => {
    FAILURE_TYPES.forEach((ft) => {
      const mtbf = ft.mtbfDays * DAY * (0.85 + ei * 0.12); // 설비마다 조금씩 다르게
      let t = start + rand() * mtbf * 0.8;
      while (t < end) {
        const repairMin = Math.round(ft.repair[0] + rand() * (ft.repair[1] - ft.repair[0]));
        const s = t;
        const e = s + repairMin * 60 * 1000;
        if (e > end) break;
        records.push({
          id: "v" + n++,
          eq: eq.id,
          type: ft.id,
          start: s,
          end: e,
          action: ACTIONS[Math.floor(rand() * ACTIONS.length)],
          worker: WORKERS[Math.floor(rand() * WORKERS.length)],
          memo: "",
          virtual: true,
        });
        t = e + mtbf * (0.6 + rand() * 0.8);
      }
    });
  });
  return records;
}

// ---------- 저장소 (가상 데이터 + 사용자가 입력한 기록) ----------
const STORE_KEY = "press-tracker-records-v1";

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
function allRecords() {
  return generateVirtualData().concat(loadUserRecords()).sort((a, b) => b.start - a.start);
}

// ---------- 계산 ----------
const repairMin = (r) => (r.end - r.start) / 60000;

/**
 * 공식
 *  MTTR = 총 수리 시간 ÷ 고장 횟수
 *  MTBF = 총 가동 시간 ÷ 고장 횟수   (풀가동 가정: 가동 시간 = 관측 기간 − 고장 정지 시간)
 *  가동률 = MTBF ÷ (MTBF + MTTR)
 *  다음 고장 예상 = 마지막 고장 수리 완료 시각 + MTBF
 */
function stats(records, now = Date.now()) {
  const count = records.length;
  if (!count) return { count: 0 };
  const start = Math.min(periodStart(), ...records.map((r) => r.start));
  const totalRepair = records.reduce((s, r) => s + repairMin(r), 0);
  const uptimeH = (now - start) / HOUR - totalRepair / 60;
  const mttr = totalRepair / count;
  const mtbfH = uptimeH / count;
  const last = records.reduce((a, b) => (a.start > b.start ? a : b));
  const nextAt = last.end + mtbfH * HOUR;
  return {
    count,
    mttr,
    mtbfH,
    availability: mtbfH / (mtbfH + mttr / 60),
    last,
    sinceLastH: (now - last.end) / HOUR,
    nextAt,
    remainH: (nextAt - now) / HOUR,
  };
}

function riskLevel(remainH) {
  if (remainH <= 48) return "high";
  if (remainH <= 24 * 7) return "mid";
  return "low";
}
