// 화면 렌더링과 이벤트 (화면 2개: 입력 / 목록·요약)

const $ = (s) => document.querySelector(s);
const eqName = (id) => EQUIPMENTS.find((e) => e.id === id)?.name ?? id;
const typeOf = (id) => FAILURE_TYPES.find((t) => t.id === id);
const typeLabel = (id) => `${id} ${typeOf(id)?.name ?? ""}`;

const state = { tab: "input", eq: "all", type: "all", kind: "all", shown: 30, combosShown: 10 };

// ---------- 포맷 ----------
const pad = (n) => String(n).padStart(2, "0");
function fmtDate(ms, withTime = true) {
  const d = new Date(ms);
  const base = `${d.getMonth() + 1}/${d.getDate()}`;
  return withTime ? `${base} ${pad(d.getHours())}:${pad(d.getMinutes())}` : base;
}
function toLocalInput(ms) {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
const days = (d) => (Math.abs(d) < 1 ? "1일 미만" : `${Math.round(Math.abs(d))}일`);
function escapeHtml(s = "") {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}
function toast(msg) {
  const t = $("#toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => t.classList.remove("show"), 2000);
}

// ---------- 입력 폼 ----------
function setupControls() {
  const eqOpts = EQUIPMENTS.map((e) => `<option value="${e.id}">${e.name}</option>`).join("");
  const typeOpts = FAILURE_TYPES.map((t) => `<option value="${t.id}">${t.id} ${t.name}</option>`).join("");
  $("#eqFilter").innerHTML = `<option value="all">전체 설비</option>${eqOpts}`;
  $("#typeFilter").innerHTML = `<option value="all">전체 유형</option>${typeOpts}`;
  const f = $("#recForm");
  f.eq.innerHTML = eqOpts;
  f.type.innerHTML = typeOpts;
  f.worker.innerHTML = WORKERS.map((w) => `<option>${w}</option>`).join("");

  // QR로 접속: ?eq=P2 이면 해당 설비가 선택된 상태로 열림
  const qEq = new URLSearchParams(location.search).get("eq");
  if (EQUIPMENTS.some((e) => e.id === qEq)) {
    state.eq = qEq;
    $("#eqFilter").value = qEq;
  }
  resetForm();
}

function resetForm() {
  const f = $("#recForm");
  const kind = f.kind.value;
  f.reset();
  f.kind.value = kind;
  if (state.eq !== "all") f.eq.value = state.eq;
  const now = Date.now();
  f.start.value = toLocalInput(now - 60 * 60 * 1000);
  f.end.value = toLocalInput(now);
  onKindChange();
}

function onKindChange() {
  const f = $("#recForm");
  const repair = f.kind.value === "repair";
  document.querySelectorAll("[data-only=repair]").forEach((el) => (el.hidden = !repair));
  $("[data-k=typeLabel]").textContent = repair ? "고장 유형" : "점검 대상 유형";
  $("[data-k=startLabel]").textContent = repair ? "발생 일시" : "점검 시작 일시";
  f.action.innerHTML = (repair ? ACTIONS : INSPECT_ACTIONS).map((a) => `<option>${a}</option>`).join("");
  onTypeChange();
}

function onTypeChange() {
  const f = $("#recForm");
  const t = typeOf(f.type.value);
  $("#causeList").innerHTML = t.causes.map((c) => `<option value="${c}">`).join("");
  $("#partList").innerHTML = t.parts.filter((p) => p !== "-").map((p) => `<option value="${p}">`).join("");
  let hint = `대표 증상: ${t.symptom}`;
  if (f.kind.value === "inspect") {
    const st = comboStats(allRecords().filter((r) => r.eq === f.eq.value && r.type === t.id));
    hint += st.insufficient || !st.count ? " · 점검 권장일: 데이터 부족" : ` · 점검 권장일 ${fmtDate(st.dueAt, false)} (${dueText(st)})`;
  }
  $("#typeHint").textContent = hint;
  updateDuration();
}

function updateDuration() {
  const f = $("#recForm");
  const hint = $("#durationHint");
  const s = new Date(f.start.value).getTime();
  const e = new Date(f.end.value).getTime();
  const word = f.kind.value === "repair" ? "수리시간" : "점검 시간";
  if (!s || !e) {
    hint.className = "hint";
    hint.textContent = `${word}이 자동으로 계산됩니다.`;
    return false;
  }
  if (e <= s) {
    hint.className = "hint err";
    hint.textContent = "완료 일시는 시작 일시보다 늦어야 합니다.";
    return false;
  }
  hint.className = "hint ok";
  hint.textContent = `${word}: ${Math.round((e - s) / 60000)}분`;
  return true;
}

// ---------- 목록 · 요약 ----------
const scoped = () => allRecords().filter((r) => state.eq === "all" || r.eq === state.eq);

function dueText(st) {
  if (st.status === "done") return `점검 완료 ${fmtDate(st.inspection.end, false)}`;
  return st.daysToDue < 0 ? `${days(st.daysToDue)} 초과` : `${days(st.daysToDue)} 남음`;
}

const ORDER = { over: 0, soon: 1, ok: 2, done: 3, none: 4 };

function buildCombos(records) {
  const eqs = state.eq === "all" ? EQUIPMENTS : EQUIPMENTS.filter((e) => e.id === state.eq);
  const list = [];
  eqs.forEach((eq) =>
    FAILURE_TYPES.forEach((t) => {
      const st = comboStats(records.filter((r) => r.eq === eq.id && r.type === t.id));
      list.push({ eq, t, st, key: st.insufficient || !st.count ? "none" : st.status });
    })
  );
  return list;
}

function renderKpis(records, combos) {
  const mttr = overallMttr(records);
  const ir = inspectRate(combos.map((c) => c.st));
  const mttrPct = mttr ? Math.min(100, (TARGET.mttr / mttr) * 100) : 0;
  $("#kpis").innerHTML = `
    <div class="kpi">
      <div class="label">결과 KPI · 평균 수리시간 MTTR</div>
      <div class="value">${mttr ? Math.round(mttr) : "-"}<small>분</small></div>
      <div class="target">목표 ${TARGET.mttr}분 이하</div>
      <div class="meter"><i style="width:${mttrPct}%"></i></div>
    </div>
    <div class="kpi">
      <div class="label">과정 KPI · 점검 권장일 내 이행률</div>
      <div class="value">${ir.rate == null ? "-" : Math.round(ir.rate)}<small>%</small></div>
      <div class="target">목표 ${TARGET.inspectRate}% · 권장 ${ir.due}건 중 ${ir.done}건 이행</div>
      <div class="meter"><i style="width:${ir.rate ? Math.min(100, (ir.rate / TARGET.inspectRate) * 100) : 0}%"></i></div>
    </div>`;
}

function renderCombos(combos) {
  const list = combos
    .filter((c) => state.type === "all" || c.t.id === state.type)
    .sort((a, b) => ORDER[a.key] - ORDER[b.key] || (a.st.daysToDue ?? 0) - (b.st.daysToDue ?? 0));
  const rows = list.slice(0, state.combosShown).map(({ eq, t, st, key }) => {
    const metrics = !st.count
      ? "고장 기록 없음"
      : st.insufficient
      ? `${st.count}건 · MTTR ${Math.round(st.mttr)}분 · MTBF 계산에 2건 이상 필요`
      : `${st.count}건 · MTTR ${Math.round(st.mttr)}분 · MTBF ${st.mtbfDays.toFixed(1)}일`;
    const right =
      key === "none"
        ? `<div class="due">데이터 부족</div>`
        : `<div class="due">점검 권장 ${fmtDate(st.dueAt, false)}</div>
           <div class="state">${dueText(st)}</div>
           <div class="next">고장 예상 ${fmtDate(st.nextAt, false)}</div>`;
    return `<div class="combo ${key}">
      <i class="dot ${key}"></i>
      <div class="c-main">
        <div class="c-title">${eq.name} · <b>${t.id}</b> ${t.name}</div>
        <div class="c-meta">${metrics}</div>
      </div>
      <div class="c-right">${right}</div>
    </div>`;
  });
  if (list.length > state.combosShown)
    rows.push(`<button class="more" id="moreCombos">더 보기 (${list.length - state.combosShown}개)</button>`);
  $("#comboList").innerHTML = rows.join("") || `<p class="muted">표시할 항목이 없습니다.</p>`;
}

function renderRecords(records) {
  const list = records.filter(
    (r) => (state.type === "all" || r.type === state.type) && (state.kind === "all" || r.kind === state.kind)
  );
  $("#listCount").textContent = `${list.length}건`;
  const items = list.slice(0, state.shown).map((r) => {
    const isRepair = r.kind === "repair";
    const detail = [r.cause, r.action, r.parts && `교체: ${r.parts}`].filter(Boolean).map(escapeHtml).join(" · ");
    return `<li>
      <div class="rec-main">
        <div class="rec-title"><span class="kind ${r.kind}">${isRepair ? "고장 수리" : "예방 점검"}</span>${typeLabel(r.type)}${
      r.virtual ? "" : '<span class="tag">직접 입력</span>'
    }</div>
        <div class="rec-sub">${eqName(r.eq)} · ${fmtDate(r.start)} · ${escapeHtml(r.worker)}</div>
        <div class="rec-sub">${detail}</div>
      </div>
      <div class="rec-side">
        <div class="rec-dur">${Math.round(durationMin(r))}분</div>
        ${r.virtual ? "" : `<button class="del" data-id="${r.id}">삭제</button>`}
      </div>
    </li>`;
  });
  if (list.length > state.shown) items.push(`<li class="more-row"><button class="more" id="moreBtn">더 보기 (${list.length - state.shown}건)</button></li>`);
  if (!list.length) items.push(`<li class="rec-sub">기록이 없습니다.</li>`);
  $("#recordList").innerHTML = items.join("");
}

function renderBoard() {
  const records = scoped();
  const combos = buildCombos(records);
  renderKpis(records, combos);
  renderCombos(combos);
  renderRecords(records);
}

// ---------- 공통 ----------
function render() {
  document.querySelectorAll(".tabs button").forEach((b) => b.classList.toggle("active", b.dataset.tab === state.tab));
  document.querySelectorAll(".tab-panel").forEach((p) => p.classList.toggle("active", p.id === "tab-" + state.tab));
  if (state.tab === "board") renderBoard();
}

function bindEvents() {
  document.querySelectorAll(".tabs button").forEach((b) =>
    b.addEventListener("click", () => {
      state.tab = b.dataset.tab;
      render();
    })
  );
  $("#eqFilter").addEventListener("change", (e) => {
    state.eq = e.target.value;
    state.shown = 30;
    state.combosShown = 10;
    if (state.eq !== "all") $("#recForm").eq.value = state.eq;
    onTypeChange();
    render();
  });
  $("#typeFilter").addEventListener("change", (e) => {
    state.type = e.target.value;
    state.shown = 30;
    renderBoard();
  });
  $("#kindFilter").addEventListener("change", (e) => {
    state.kind = e.target.value;
    state.shown = 30;
    renderBoard();
  });

  const f = $("#recForm");
  f.querySelectorAll("[name=kind]").forEach((r) => r.addEventListener("change", onKindChange));
  f.type.addEventListener("change", onTypeChange);
  f.eq.addEventListener("change", onTypeChange);
  f.start.addEventListener("input", updateDuration);
  f.end.addEventListener("input", updateDuration);
  f.addEventListener("submit", (e) => {
    e.preventDefault();
    if (!updateDuration()) return;
    const repair = f.kind.value === "repair";
    const rec = {
      id: "u" + Date.now(),
      kind: f.kind.value,
      eq: f.eq.value,
      type: f.type.value,
      start: new Date(f.start.value).getTime(),
      end: new Date(f.end.value).getTime(),
      cause: repair ? f.cause.value.trim() : "",
      action: f.action.value,
      parts: f.parts.value.trim(),
      worker: f.worker.value,
    };
    saveUserRecords(loadUserRecords().concat(rec));
    toast(`${eqName(rec.eq)} · ${rec.type} ${repair ? "고장 수리" : "예방 점검"} 저장 완료`);
    resetForm();
    state.tab = "board";
    render();
  });

  $("#comboList").addEventListener("click", (e) => {
    if (e.target.id === "moreCombos") {
      state.combosShown += 10;
      renderBoard();
    }
  });
  $("#recordList").addEventListener("click", (e) => {
    if (e.target.id === "moreBtn") {
      state.shown += 30;
      renderBoard();
    }
    const id = e.target.dataset?.id;
    if (id && confirm("이 기록을 삭제할까요?")) {
      saveUserRecords(loadUserRecords().filter((r) => r.id !== id));
      renderBoard();
    }
  });
  $("#resetBtn").addEventListener("click", () => {
    if (confirm("직접 입력한 기록을 모두 지울까요? (가상 데이터는 유지됩니다)")) {
      saveUserRecords([]);
      render();
      toast("입력 기록을 초기화했습니다");
    }
  });
}

setupControls();
bindEvents();
render();
