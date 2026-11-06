// 화면 렌더링과 이벤트 (화면 2개: 입력 / 목록·요약)

const $ = (s) => document.querySelector(s);
const eqName = (id) => EQUIPMENTS.find((e) => e.id === id)?.name ?? id;
const typeOf = (id) => FAILURE_TYPES.find((t) => t.id === id);
const typeLabel = (id) => `${id} ${typeOf(id)?.name ?? ""}`;

const state = { tab: "input", eq: "all", type: "all", kind: "all", shown: 50, sel: null, status: new Set() }; // sel: { eq, type }
const STATUS = [
  ["over", "권장일 초과"],
  ["soon", "7일 이내"],
  ["ok", "정상"],
  ["done", "점검 완료"],
  ["none", "데이터 부족"],
];
const shortEq = (id) => eqName(id).replace("프레스 ", "");

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
// 고장 유형 이름의 핵심 상태어(이상·마모·불량 등) 강조
const KEYWORDS = /(이상|마모|불량|누설|작동|오급송)/g;
const hl = (name) => escapeHtml(name).replace(KEYWORDS, '<em class="kw">$1</em>');
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

// ---------- 담당자 관리 ----------
function renderWorkers(selected) {
  const sel = $("#workerSel");
  const keep = selected ?? sel.value;
  sel.innerHTML = allWorkers().map((w) => `<option>${escapeHtml(w)}</option>`).join("");
  if (allWorkers().includes(keep)) sel.value = keep;
  $("#workerChips").innerHTML = allWorkers()
    .map((w) =>
      WORKERS.includes(w)
        ? `<li class="fixed">${escapeHtml(w)}</li>`
        : `<li>${escapeHtml(w)}<button type="button" data-worker="${escapeHtml(w)}" aria-label="${escapeHtml(w)} 삭제">✕</button></li>`
    )
    .join("");
}
function addWorker() {
  const input = $("#workerInput");
  const name = input.value.trim().replace(/\s+/g, " ");
  if (!name) return input.focus();
  if (allWorkers().includes(name)) {
    toast("이미 있는 담당자입니다");
    return input.select();
  }
  saveExtraWorkers(loadExtraWorkers().concat(name));
  input.value = "";
  renderWorkers(name);
  toast(`${name} 추가됨`);
}

// ---------- 설비 QR ----------
const QR_ITEMS = EQUIPMENTS.map((e) => ({ id: e.id, name: e.name })).concat({ id: "all", name: "전체 설비" });
function openQr() {
  $("#qrGrid").innerHTML = QR_ITEMS.map(
    (q) => `<figure class="qr-item">
      <img src="qr/${q.id}.png" alt="${q.name} QR 코드" loading="lazy" />
      <figcaption>${q.name}</figcaption>
      <a class="ghost strong" href="qr/${q.id}.png" download="${q.name.replace(" #", "_").replace(/ /g, "_")}_QR.png">다운로드</a>
    </figure>`
  ).join("");
  $("#qrDialog").showModal();
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
  renderWorkers();

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
  renderDiagram();
}

// ---------- 프레스 고장 부위도 ----------
const STATUS_LABEL = { over: "권장일 초과", soon: "7일 이내", ok: "정상", done: "점검 완료", none: "데이터 부족" };
function renderDiagram() {
  const box = $("#pressSvg");
  if (!box.firstElementChild) box.innerHTML = PRESS_SVG;
  const f = $("#recForm");
  const eq = f.eq.value;
  const selType = f.type.value;
  const recs = allRecords().filter((r) => r.eq === eq);
  $("#diagramEq").textContent = `${eqName(eq)} 기준`;
  const info = {};
  FAILURE_TYPES.forEach((t) => {
    const st = comboStats(recs.filter((r) => r.type === t.id));
    const key = st.insufficient || !st.count ? "none" : st.status;
    info[t.id] = { st, key };
    const g = box.querySelector(`.part[data-type="${t.id}"]`);
    g.setAttribute("class", `part st-${key}${t.id === selType ? " sel" : ""}`);
    g.setAttribute("aria-pressed", String(t.id === selType));
  });
  // 번호 마커
  box.querySelector("#markers").innerHTML = Object.entries(PRESS_MARKERS)
    .map(([code, [x, y, tx, ty]]) => {
      const k = info[code].key;
      return `<g class="marker m-${k}${code === selType ? " sel" : ""}" data-type="${code}" tabindex="0" role="button" aria-label="${code} 선택">
        <line x1="${x}" y1="${y}" x2="${tx}" y2="${ty}" class="leader"/>
        <circle cx="${tx}" cy="${ty}" r="3" class="tip"/>
        <circle cx="${x}" cy="${y}" r="${code === selType ? 19 : 16}" class="badge"/>
        <text x="${x}" y="${y + 4}" text-anchor="middle">${code}</text>
      </g>`;
    })
    .join("");
  // 선택 부위 상세
  const t = typeOf(selType);
  const { st, key } = info[selType];
  const metrics =
    key === "none"
      ? st.count ? `고장 ${st.count}건 · MTTR ${Math.round(st.mttr)}분 · MTBF 계산엔 2건 이상 필요` : "고장 기록 없음"
      : `고장 ${st.count}건 · MTTR ${Math.round(st.mttr)}분 · MTBF ${st.mtbfDays.toFixed(1)}일`;
  const due = key === "none" ? "" : `<div class="pi-due">점검 권장 <b>${fmtDate(st.dueAt, false)}</b> · 고장 예상 <b>${fmtDate(st.nextAt, false)}</b> · ${dueText(st)}</div>`;
  $("#partInfo").innerHTML = `
    <div class="pi-head"><span class="pi-badge ${key}">${STATUS_LABEL[key]}</span><span><b>${t.id}</b> ${hl(t.name)}</span></div>
    <div class="pi-sub">대표 증상: ${escapeHtml(t.symptom)}</div>
    <div class="pi-sub">${metrics}</div>${due}`;
}
function pickPart(code) {
  const f = $("#recForm");
  if (!code || f.type.value === code) return;
  f.type.value = code;
  onTypeChange();
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
  if (st.status === "done")
    return `점검 완료 ${fmtDate(st.inspection.end, false)}${st.inspection.end > st.dueAt ? " (권장일 지남)" : ""}`;
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
  const byType = combos.filter((c) => state.type === "all" || c.t.id === state.type);
  const counts = Object.fromEntries(STATUS.map(([k]) => [k, byType.filter((c) => c.key === k).length]));
  $("#statusFilter").innerHTML =
    `<button type="button" class="sf${state.status.size ? "" : " on"}" data-status="all">전체 <b>${byType.length}</b></button>` +
    STATUS.map(
      ([k, label]) =>
        `<button type="button" class="sf ${k}${state.status.has(k) ? " on" : ""}" data-status="${k}" aria-pressed="${state.status.has(k)}"><i class="dot ${k}"></i>${label} <b>${counts[k]}</b></button>`
    ).join("");
  const list = byType
    .filter((c) => !state.status.size || state.status.has(c.key))
    .sort((a, b) => ORDER[a.key] - ORDER[b.key] || (a.st.daysToDue ?? 0) - (b.st.daysToDue ?? 0));
  $("#comboCount").textContent = `${list.length}개`;
  const rows = list.map(({ eq, t, st, key }) => {
    const metrics = !st.count
      ? "고장 기록 없음"
      : st.insufficient
      ? `${st.count}건 · MTTR ${Math.round(st.mttr)}분 · MTBF 계산엔 2건 이상 필요`
      : `${st.count}건 · MTTR ${Math.round(st.mttr)}분 · MTBF ${st.mtbfDays.toFixed(1)}일`;
    const right =
      key === "none"
        ? `<div class="state">데이터 부족</div>`
        : `<div class="state">${dueText(st)}</div>
           <div class="due">권장 ${fmtDate(st.dueAt, false)} · 예상 ${fmtDate(st.nextAt, false)}</div>`;
    const selected = state.sel && state.sel.eq === eq.id && state.sel.type === t.id;
    return `<button type="button" class="combo ${key}${selected ? " selected" : ""}" data-eq="${eq.id}" data-type="${t.id}" aria-pressed="${selected}">
      <i class="dot ${key}"></i>
      <div class="c-main">
        <div class="c-title"><span class="eqno">${shortEq(eq.id)}</span><b>${t.id}</b> ${hl(t.name)}</div>
        <div class="c-meta">${metrics}</div>
      </div>
      <div class="c-right">${right}</div>
    </button>`;
  });
  $("#comboList").innerHTML = rows.join("") || `<p class="muted">표시할 항목이 없습니다.</p>`;
}

function renderRecords(records) {
  const sel = state.sel;
  const list = records.filter(
    (r) =>
      (sel ? r.eq === sel.eq && r.type === sel.type : state.type === "all" || r.type === state.type) &&
      (state.kind === "all" || r.kind === state.kind)
  );
  $("#listCount").textContent = `${list.length}건`;
  const chip = $("#selChip");
  chip.hidden = !sel;
  if (sel) chip.innerHTML = `<span>${eqName(sel.eq)} · <b>${sel.type}</b> ${hl(typeOf(sel.type).name)}</span><button type="button" id="clearSel" aria-label="선택 해제">전체 보기 ✕</button>`;

  const items = list.slice(0, state.shown).map((r) => {
    const isRepair = r.kind === "repair";
    const d = new Date(r.start);
    const detail = [r.cause, r.action, r.parts && `교체: ${r.parts}`].filter(Boolean).map(escapeHtml).join(" · ");
    return `<li class="rec">
      <div class="r-date">${d.getMonth() + 1}/${d.getDate()}<small>${pad(d.getHours())}:${pad(d.getMinutes())}</small></div>
      <div class="rec-main">
        <div class="rec-title"><span class="kind ${r.kind}">${isRepair ? "수리" : "점검"}</span>${
      sel ? "" : `<span class="eqno">${shortEq(r.eq)}</span>`
    }<b>${r.type}</b> ${hl(typeOf(r.type).name)}${r.virtual ? "" : '<span class="tag">직접 입력</span>'}</div>
        <div class="rec-sub">${detail} · ${escapeHtml(r.worker)}</div>
      </div>
      <div class="rec-side">
        <div class="rec-dur">${Math.round(durationMin(r))}<small>분</small></div>
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
  // 상태 필터가 켜져 있으면 이력도 그 상태의 설비·유형만
  const visible = state.status.size ? new Set(combos.filter((c) => state.status.has(c.key)).map((c) => c.eq.id + c.t.id)) : null;
  renderRecords(visible ? records.filter((r) => visible.has(r.eq + r.type)) : records);
}

// ---------- 공통 ----------
function render() {
  document.querySelectorAll(".tabs button").forEach((b) => b.classList.toggle("active", b.dataset.tab === state.tab));
  document.querySelectorAll(".tab-panel").forEach((p) => p.classList.toggle("active", p.id === "tab-" + state.tab));
  if (state.tab === "board") renderBoard();
}

// ---------- 시작 알림 팝업 ----------
const ALERT_KEY = "press-tracker-alert-skip";
const todayKey = () => toLocalInput(Date.now()).slice(0, 10); // 한국 시간 기준 날짜

function showStartupAlert() {
  if (localStorage.getItem(ALERT_KEY) === todayKey()) return;
  const urgent = buildCombos(scoped())
    .filter((c) => c.key === "over" || c.key === "soon")
    .sort((a, b) => a.st.daysToDue - b.st.daysToDue);
  if (!urgent.length) return;
  const over = urgent.filter((c) => c.key === "over").length;
  const soon = urgent.length - over;
  const where = state.eq === "all" ? "전체 설비" : eqName(state.eq);
  $("#alertSummary").innerHTML =
    `${where} 기준 <b class="t-over">권장일 초과 ${over}건</b> · <b class="t-soon">7일 이내 ${soon}건</b>`;
  const TOP = 5;
  $("#alertList").innerHTML = urgent
    .slice(0, TOP)
    .map(
      ({ eq, t, st, key }) => `<li class="${key}">
        <i class="dot ${key}"></i>
        <div class="a-main"><span class="eqno">${shortEq(eq.id)}</span><b>${t.id}</b> ${hl(t.name)}
          <div class="a-sub">점검 권장 ${fmtDate(st.dueAt, false)} · 고장 예상 ${fmtDate(st.nextAt, false)} · MTTR ${Math.round(st.mttr)}분</div></div>
        <div class="a-state">${dueText(st)}</div>
      </li>`
    )
    .join("");
  $("#alertMore").textContent = urgent.length > TOP ? `외 ${urgent.length - TOP}건은 목록·요약에서 확인하세요.` : "";
  $("#alertSkip").checked = false;
  $("#alertDialog").showModal();
}

function closeAlert(goToBoard) {
  if ($("#alertSkip").checked) localStorage.setItem(ALERT_KEY, todayKey());
  $("#alertDialog").close();
  if (goToBoard) {
    state.tab = "board";
    state.status = new Set(["over", "soon"]);
    state.sel = null;
    render();
  }
}

function bindEvents() {
  $("#workerToggle").addEventListener("click", (e) => {
    const panel = $("#workerPanel");
    panel.hidden = !panel.hidden;
    e.currentTarget.setAttribute("aria-expanded", String(!panel.hidden));
    if (!panel.hidden) $("#workerInput").focus();
  });
  $("#workerAdd").addEventListener("click", addWorker);
  $("#workerInput").addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addWorker();
    }
  });
  $("#workerChips").addEventListener("click", (e) => {
    const name = e.target.dataset?.worker;
    if (!name || !confirm(`담당자 '${name}'을(를) 목록에서 지울까요? 이미 저장된 기록은 그대로 남습니다.`)) return;
    saveExtraWorkers(loadExtraWorkers().filter((w) => w !== name));
    renderWorkers();
  });
  $("#alertClose").addEventListener("click", () => closeAlert(false));
  $("#alertGo").addEventListener("click", () => closeAlert(true));
  $("#alertDialog").addEventListener("cancel", () => closeAlert(false)); // Esc
  const pressBox = $("#pressSvg");
  pressBox.addEventListener("click", (e) => pickPart(e.target.closest("[data-type]")?.dataset.type));
  pressBox.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      const code = e.target.closest?.("[data-type]")?.dataset.type;
      if (code) {
        e.preventDefault();
        pickPart(code);
      }
    }
  });
  $("#qrBtn").addEventListener("click", openQr);
  $("#qrClose").addEventListener("click", () => $("#qrDialog").close());
  $("#qrDialog").addEventListener("click", (e) => {
    if (e.target.id === "qrDialog") e.target.close(); // 바깥 영역 클릭 시 닫기
  });
  document.querySelectorAll(".tabs button").forEach((b) =>
    b.addEventListener("click", () => {
      state.tab = b.dataset.tab;
      render();
    })
  );
  $("#eqFilter").addEventListener("change", (e) => {
    state.eq = e.target.value;
    state.shown = 50;
    state.sel = null;
    if (state.eq !== "all") $("#recForm").eq.value = state.eq;
    onTypeChange();
    render();
  });
  $("#typeFilter").addEventListener("change", (e) => {
    state.type = e.target.value;
    state.shown = 50;
    state.sel = null;
    renderBoard();
  });
  $("#kindFilter").addEventListener("change", (e) => {
    state.kind = e.target.value;
    state.shown = 50;
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
    const row = e.target.closest(".combo");
    if (!row) return;
    const { eq, type } = row.dataset;
    const same = state.sel && state.sel.eq === eq && state.sel.type === type;
    state.sel = same ? null : { eq, type };
    state.shown = 50;
    renderBoard();
    $("#recordList").scrollTop = 0;
    // 화면이 좁아 위아래로 쌓일 때는 이력 목록으로 이동
    if (!same && window.matchMedia("(max-width: 900px)").matches)
      $("#selChip").scrollIntoView({ behavior: "smooth", block: "start" });
  });
  $("#statusFilter").addEventListener("click", (e) => {
    const btn = e.target.closest(".sf");
    if (!btn) return;
    const k = btn.dataset.status;
    if (k === "all") state.status.clear();
    else state.status.has(k) ? state.status.delete(k) : state.status.add(k);
    state.sel = null;
    state.shown = 50;
    renderBoard();
  });
  $("#selChip").addEventListener("click", (e) => {
    if (e.target.id === "clearSel") {
      state.sel = null;
      renderBoard();
    }
  });
  $("#recordList").addEventListener("click", (e) => {
    if (e.target.id === "moreBtn") {
      state.shown += 50;
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
showStartupAlert();
