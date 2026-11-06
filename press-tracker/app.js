// 화면 렌더링과 이벤트

const $ = (s) => document.querySelector(s);
const eqName = (id) => EQUIPMENTS.find((e) => e.id === id)?.name ?? id;
const typeName = (id) => FAILURE_TYPES.find((t) => t.id === id)?.name ?? id;

const state = { tab: "input", eq: "all", type: "all", shown: 30 };

// ---------- 포맷 ----------
const pad = (n) => String(n).padStart(2, "0");
function fmtDate(ms, withTime = true) {
  const d = new Date(ms);
  const base = `${d.getMonth() + 1}/${d.getDate()}`;
  return withTime ? `${base} ${pad(d.getHours())}:${pad(d.getMinutes())}` : base;
}
function fmtSpan(hours) {
  const h = Math.abs(hours);
  if (h < 1) return `${Math.round(h * 60)}분`;
  if (h < 24) return `${Math.round(h)}시간`;
  const d = Math.floor(h / 24);
  const rh = Math.round(h % 24);
  return rh ? `${d}일 ${rh}시간` : `${d}일`;
}
function toLocalInput(ms) {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function toast(msg) {
  const t = $("#toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => t.classList.remove("show"), 2000);
}

// ---------- 데이터 필터 ----------
function filtered({ ignoreType = false } = {}) {
  return allRecords().filter(
    (r) => (state.eq === "all" || r.eq === state.eq) && (ignoreType || state.type === "all" || r.type === state.type)
  );
}

// ---------- 초기 설정 ----------
function setupControls() {
  const eqOpts = EQUIPMENTS.map((e) => `<option value="${e.id}">${e.name}</option>`).join("");
  $("#eqFilter").innerHTML = `<option value="all">전체 설비</option>${eqOpts}`;
  $("#failForm [name=eq]").innerHTML = eqOpts;
  $("#typeFilter").innerHTML =
    `<option value="all">전체 유형</option>` + FAILURE_TYPES.map((t) => `<option value="${t.id}">${t.name}</option>`).join("");
  $("#typeChips").innerHTML = FAILURE_TYPES.map(
    (t, i) =>
      `<label title="${t.desc}"><input type="radio" name="type" value="${t.id}" ${i === 0 ? "checked" : ""}/><span>${t.name}</span></label>`
  ).join("");
  $("#failForm [name=action]").innerHTML = ACTIONS.map((a) => `<option>${a}</option>`).join("");

  // QR로 접속: ?eq=P2 이면 해당 설비가 선택된 상태로 열림
  const qEq = new URLSearchParams(location.search).get("eq");
  if (EQUIPMENTS.some((e) => e.id === qEq)) {
    state.eq = qEq;
    $("#eqFilter").value = qEq;
  }
  resetForm();
}

function resetForm() {
  const f = $("#failForm");
  f.reset();
  if (state.eq !== "all") f.eq.value = state.eq;
  const now = Date.now();
  f.start.value = toLocalInput(now - 60 * 60 * 1000);
  f.end.value = toLocalInput(now);
  updateDuration();
}

function updateDuration() {
  const f = $("#failForm");
  const hint = $("#durationHint");
  const s = new Date(f.start.value).getTime();
  const e = new Date(f.end.value).getTime();
  if (!s || !e) {
    hint.className = "hint";
    hint.textContent = "수리 시간이 자동으로 계산됩니다.";
  } else if (e <= s) {
    hint.className = "hint err";
    hint.textContent = "수리 완료 시각은 고장 발생 시각보다 늦어야 합니다.";
  } else {
    hint.className = "hint ok";
    hint.textContent = `수리 시간: ${Math.round((e - s) / 60000)}분`;
  }
}

// ---------- 고장 목록 ----------
function renderList() {
  const base = filtered({ ignoreType: true });
  $("#summaryBody").innerHTML = FAILURE_TYPES.map((t) => {
    const st = stats(base.filter((r) => r.type === t.id));
    if (!st.count) return `<tr><td>${t.name}</td><td class="num">0</td><td class="num">-</td><td class="num">-</td></tr>`;
    return `<tr><td>${t.name}</td><td class="num">${st.count}회</td><td class="num">${Math.round(st.mttr)}분</td><td class="num">${fmtSpan(st.sinceLastH)} 전</td></tr>`;
  }).join("");

  const list = filtered();
  $("#listCount").textContent = `${list.length}건`;
  const items = list.slice(0, state.shown).map(
    (r) => `<li>
      <div class="rec-main">
        <div class="rec-title">${typeName(r.type)}${r.virtual ? "" : '<span class="tag">직접 입력</span>'}</div>
        <div class="rec-sub">${eqName(r.eq)} · ${fmtDate(r.start)} · ${r.action} · ${r.worker}</div>
        ${r.memo ? `<div class="rec-sub">${escapeHtml(r.memo)}</div>` : ""}
      </div>
      <div style="text-align:right">
        <div class="rec-dur">${Math.round(repairMin(r))}분</div>
        ${r.virtual ? "" : `<button class="del" data-id="${r.id}">삭제</button>`}
      </div>
    </li>`
  );
  if (list.length > state.shown) items.push(`<li style="border:0"><button class="more" id="moreBtn">더 보기 (${list.length - state.shown}건)</button></li>`);
  if (!list.length) items.push(`<li class="rec-sub">기록이 없습니다.</li>`);
  $("#recordList").innerHTML = items.join("");
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

// ---------- 고장 예측 ----------
function renderPredict() {
  const base = filtered({ ignoreType: true });
  const all = stats(base);
  const kpis = [
    ["총 고장", all.count || 0, "건"],
    ["MTTR", all.count ? Math.round(all.mttr) : "-", "분"],
    ["MTBF", all.count ? fmtSpan(all.mtbfH) : "-", ""],
    ["가동률", all.count ? (all.availability * 100).toFixed(1) : "-", "%"],
  ];
  $("#kpis").innerHTML = kpis
    .map(([l, v, u]) => `<div class="kpi"><div class="label">${l}</div><div class="value">${v}<small>${u}</small></div></div>`)
    .join("");

  // 설비 × 유형 조합별 예측
  const eqs = state.eq === "all" ? EQUIPMENTS : EQUIPMENTS.filter((e) => e.id === state.eq);
  const preds = [];
  eqs.forEach((eq) =>
    FAILURE_TYPES.forEach((t) => {
      const st = stats(base.filter((r) => r.eq === eq.id && r.type === t.id));
      if (st.count >= 2) preds.push({ eq, t, st });
    })
  );
  preds.sort((a, b) => a.st.remainH - b.st.remainH);
  $("#predictList").innerHTML =
    preds
      .map(({ eq, t, st }) => {
        const lv = riskLevel(st.remainH);
        const pct = Math.max(4, Math.min(100, (st.sinceLastH / st.mtbfH) * 100));
        const badge =
          st.remainH < 0 ? `${fmtSpan(st.remainH)} 지남` : `${fmtSpan(st.remainH)} 남음`;
        return `<div class="pred ${lv}">
          <div class="name">${eq.name} · ${t.name}</div>
          <div class="badge">${badge}<small>예상 ${fmtDate(st.nextAt, false)}</small></div>
          <div class="meta">MTBF ${fmtSpan(st.mtbfH)} · MTTR ${Math.round(st.mttr)}분 · 마지막 고장 ${fmtDate(st.last.start)} (${st.count}회 기록)</div>
          <div class="bar"><i style="width:${pct}%"></i></div>
        </div>`;
      })
      .join("") || `<p class="muted">예측하려면 같은 유형의 기록이 2건 이상 필요합니다.</p>`;

  // 막대 차트
  const byType = FAILURE_TYPES.map((t) => ({ t, st: stats(base.filter((r) => r.type === t.id)) }));
  $("#chartCount").innerHTML = hbars(byType.map(({ t, st }) => [t.name, st.count || 0]));
  $("#chartMttr").innerHTML = hbars(byType.map(({ t, st }) => [t.name, st.count ? Math.round(st.mttr) : 0]));
}

function hbars(rows) {
  const max = Math.max(1, ...rows.map((r) => r[1]));
  return rows
    .map(
      ([label, v]) =>
        `<div class="hbar"><span>${label}</span><div class="track"><div class="fill" style="width:${(v / max) * 100}%"></div></div><span class="v">${v}</span></div>`
    )
    .join("");
}

// ---------- 공통 ----------
function render() {
  document.querySelectorAll(".tabs button").forEach((b) => b.classList.toggle("active", b.dataset.tab === state.tab));
  document.querySelectorAll(".tab-panel").forEach((p) => p.classList.toggle("active", p.id === "tab-" + state.tab));
  if (state.tab === "list") renderList();
  if (state.tab === "predict") renderPredict();
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
    if (state.eq !== "all") $("#failForm").eq.value = state.eq;
    render();
  });
  $("#typeFilter").addEventListener("change", (e) => {
    state.type = e.target.value;
    state.shown = 30;
    renderList();
  });
  const f = $("#failForm");
  f.start.addEventListener("input", updateDuration);
  f.end.addEventListener("input", updateDuration);
  f.addEventListener("submit", (e) => {
    e.preventDefault();
    const start = new Date(f.start.value).getTime();
    const end = new Date(f.end.value).getTime();
    if (!(end > start)) return updateDuration();
    const rec = {
      id: "u" + Date.now(),
      eq: f.eq.value,
      type: f.type.value,
      start,
      end,
      action: f.action.value,
      worker: f.worker.value.trim(),
      memo: f.memo.value.trim(),
    };
    saveUserRecords(loadUserRecords().concat(rec));
    toast(`${eqName(rec.eq)} · ${typeName(rec.type)} 저장 완료`);
    resetForm();
    state.tab = "list";
    render();
  });
  $("#recordList").addEventListener("click", (e) => {
    if (e.target.id === "moreBtn") {
      state.shown += 30;
      renderList();
    }
    const id = e.target.dataset?.id;
    if (id && confirm("이 기록을 삭제할까요?")) {
      saveUserRecords(loadUserRecords().filter((r) => r.id !== id));
      renderList();
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
