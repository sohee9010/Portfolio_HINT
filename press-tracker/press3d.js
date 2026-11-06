// 직동식 기계 프레스 3D 가상 모델 (Three.js)
// 드래그로 360° 회전, 휠로 확대·축소. 부위(F01~F09)를 누르면 입력창의 고장 유형이 바뀝니다.
// 실제 설비 도면이 아닌 교육용 가상 모델입니다.
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { CSS2DRenderer, CSS2DObject } from "three/addons/renderers/CSS2DRenderer.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

const STATUS_COLOR = { over: "#e05252", soon: "#e0a32e", ok: "#3f9e68", done: "#3b6fc4", none: "#a3adba" };

export function mountPress3D(container, { onPick }) {
  const size = () => [Math.max(1, container.clientWidth), Math.max(1, container.clientHeight)];
  let [W, H] = size();

  // ---------- 렌더러 ----------
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(W, H);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  container.appendChild(renderer.domElement);

  const labels = new CSS2DRenderer();
  labels.setSize(W, H);
  labels.domElement.className = "p3d-labels";
  container.appendChild(labels.domElement);

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  const camera = new THREE.PerspectiveCamera(36, W / H, 0.1, 100);
  camera.position.set(9.4, 6.0, 11.0);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 3.0, 0);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 5;
  controls.maxDistance = 22;
  controls.maxPolarAngle = Math.PI * 0.495;
  controls.autoRotate = true;
  controls.autoRotateSpeed = 0.7;
  controls.addEventListener("start", () => (controls.autoRotate = false));

  // ---------- 조명 ----------
  scene.add(new THREE.HemisphereLight("#ffffff", "#9aa6b5", 0.6));
  const sun = new THREE.DirectionalLight("#ffffff", 1.6);
  sun.position.set(6, 12, 7);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -8, right: 8, top: 9, bottom: -3, near: 1, far: 30 });
  sun.shadow.bias = -0.0004;
  scene.add(sun);
  const fill = new THREE.DirectionalLight("#dfe9ff", 0.5);
  fill.position.set(-7, 5, -4);
  scene.add(fill);

  // 바닥
  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(10, 64),
    new THREE.MeshStandardMaterial({ color: "#dde3ea", roughness: 0.95 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);
  const grid = new THREE.GridHelper(20, 40, "#b9c3cf", "#cfd6df");
  grid.position.y = 0.002;
  grid.material.transparent = true;
  grid.material.opacity = 0.5;
  scene.add(grid);
  // 안전 구역 표시선
  const zone = new THREE.Mesh(
    new THREE.RingGeometry(3.15, 3.25, 4, 1, Math.PI / 4),
    new THREE.MeshBasicMaterial({ color: "#e0b23a", side: THREE.DoubleSide })
  );
  zone.rotation.x = -Math.PI / 2;
  zone.scale.set(1.25, 0.85, 1);
  zone.position.y = 0.004;
  scene.add(zone);

  // ---------- 재질 ----------
  const M = {
    frame: new THREE.MeshStandardMaterial({ color: "#6f86a0", metalness: 0.35, roughness: 0.5 }),
    dark: new THREE.MeshStandardMaterial({ color: "#2f3a48", metalness: 0.5, roughness: 0.45 }),
    steel: new THREE.MeshStandardMaterial({ color: "#c3ccd6", metalness: 0.9, roughness: 0.28 }),
    glass: new THREE.MeshPhysicalMaterial({
      color: "#8fa6bf", metalness: 0.1, roughness: 0.15, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide,
    }),
    blank: new THREE.MeshStandardMaterial({ color: "#d7dce2", metalness: 0.95, roughness: 0.22 }),
    screen: new THREE.MeshStandardMaterial({ color: "#0b2545", emissive: "#1b4f9c", emissiveIntensity: 0.6 }),
    red: new THREE.MeshStandardMaterial({ color: "#d64545", emissive: "#d64545", emissiveIntensity: 0.4 }),
    green: new THREE.MeshStandardMaterial({ color: "#3f9e68", emissive: "#3f9e68", emissiveIntensity: 0.3 }),
    edge: new THREE.LineBasicMaterial({ color: "#4b5b70", transparent: true, opacity: 0.55 }),
    beam: new THREE.LineBasicMaterial({ color: "#ff5a5a", transparent: true, opacity: 0.55 }),
  };

  // ---------- 고장 부위 ----------
  const parts = {};
  const pickables = [];
  const partMat = (code) => {
    if (!parts[code]) {
      parts[code] = {
        mat: new THREE.MeshStandardMaterial({ color: STATUS_COLOR.none, metalness: 0.35, roughness: 0.45 }),
        meshes: [],
      };
    }
    return parts[code].mat;
  };
  const tag = (mesh, code) => {
    mesh.userData.type = code;
    pickables.push(mesh);
    if (parts[code]) parts[code].meshes.push(mesh);
    return mesh;
  };

  // ---------- 도형 도우미 ----------
  const finish = (m, parent) => {
    m.castShadow = true;
    m.receiveShadow = true;
    (parent || scene).add(m);
    return m;
  };
  const box = (w, h, d, mat, x, y, z, parent) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    return finish(m, parent);
  };
  const cyl = (r, len, mat, x, y, z, axis = "y", parent, seg = 40) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, seg), mat);
    if (axis === "x") m.rotation.z = Math.PI / 2;
    if (axis === "z") m.rotation.x = Math.PI / 2;
    m.position.set(x, y, z);
    return finish(m, parent);
  };
  const tube = (pts, r, mat, parent) => {
    const path = new THREE.CurvePath();
    for (let i = 0; i < pts.length - 1; i++) path.add(new THREE.LineCurve3(new THREE.Vector3(...pts[i]), new THREE.Vector3(...pts[i + 1])));
    const m = new THREE.Mesh(new THREE.TubeGeometry(path, pts.length * 24, r, 10, false), mat);
    return finish(m, parent);
  };
  const outline = (mesh) => {
    const e = new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry), M.edge);
    e.position.copy(mesh.position);
    e.rotation.copy(mesh.rotation);
    mesh.parent.add(e);
    return mesh;
  };

  // ===== 본체 =====
  box(4.1, 0.3, 2.3, M.dark, 0, 0.15, 0); // 기초 플레이트
  const bed = box(3.8, 1.0, 2.0, M.glass, 0, 0.8, 0); // 베드 (투시)
  bed.castShadow = false;
  outline(bed);
  [-1, 1].forEach((sx) =>
    [-1, 1].forEach((sz) => {
      box(0.5, 2.8, 0.5, M.frame, sx * 1.55, 2.7, sz * 0.65); // 업라이트(기둥)
      cyl(0.07, 4.9, M.steel, sx * 1.55, 2.75, sz * 0.65 + sz * 0.27, "y", undefined, 16); // 타이로드
    })
  );
  const crown = box(3.8, 1.3, 2.0, M.glass, 0, 4.75, 0); // 크라운 (투시)
  crown.castShadow = false;
  outline(crown);
  box(3.0, 0.18, 1.5, M.steel, 0, 1.39, 0); // 볼스터
  box(4.0, 0.08, 2.1, M.frame, 0, 4.06, 0); // 크라운 하판
  box(3.9, 0.08, 2.1, M.frame, 0, 1.26, 0); // 베드 상판 테두리

  // ===== 구동부 (크랭크축은 중립, 베어링·기어·플라이휠·모터 = F06) =====
  const rot = new THREE.Group(); // 회전하는 부품 묶음 (x축 회전)
  rot.position.set(0, 4.75, 0);
  scene.add(rot);
  cyl(0.12, 4.6, M.steel, 0, 0, 0, "x", rot);
  [-0.6, 0.6].forEach((x) => {
    const ecc = cyl(0.28, 0.2, M.steel, x, 0, 0, "x", rot);
    ecc.position.y = 0.1; // 편심
  });

  partMat("F06");
  [-1.35, 1.35].forEach((x) => tag(cyl(0.25, 0.32, parts.F06.mat, x, 4.75, 0, "x"), "F06")); // 메인 베어링
  const gear = new THREE.Group();
  gear.position.set(1.05, 0, 0);
  rot.add(gear);
  tag(cyl(0.62, 0.16, parts.F06.mat, 0, 0, 0, "x", gear), "F06");
  for (let i = 0; i < 30; i++) {
    const a = (i / 30) * Math.PI * 2;
    const t = box(0.16, 0.1, 0.1, parts.F06.mat, 0, Math.cos(a) * 0.66, Math.sin(a) * 0.66, gear);
    t.rotation.x = -a;
    tag(t, "F06");
  }
  const fly = new THREE.Group(); // 플라이휠
  fly.position.set(2.27, 4.75, 0);
  scene.add(fly);
  tag(cyl(0.85, 0.28, parts.F06.mat, 0, 0, 0, "x", fly, 64), "F06");
  cyl(0.64, 0.3, M.dark, 0, 0, 0, "x", fly, 48);
  cyl(0.18, 0.42, M.steel, 0, 0, 0, "x", fly, 24);
  for (let i = 0; i < 6; i++) {
    const s = box(0.12, 1.05, 0.12, M.steel, 0, 0, 0, fly);
    s.rotation.x = (i / 6) * Math.PI;
  }
  // 메인 모터 + 풀리 + V벨트
  box(1.0, 0.12, 0.7, M.dark, 1.55, 5.46, -0.55);
  tag(cyl(0.34, 0.95, parts.F06.mat, 1.55, 5.85, -0.55, "x"), "F06");
  for (let i = 0; i < 7; i++) tag(cyl(0.36, 0.04, parts.F06.mat, 1.2 + i * 0.12, 5.85, -0.55, "x"), "F06"); // 냉각핀
  cyl(0.06, 0.3, M.steel, 2.12, 5.85, -0.55, "x");
  cyl(0.17, 0.14, M.steel, 2.27, 5.85, -0.55, "x");
  tube([[2.27, 6.02, -0.55], [2.27, 5.6, 0.04]], 0.035, M.dark);
  tube([[2.27, 5.7, -0.68], [2.27, 4.62, -0.84]], 0.035, M.dark);

  // ===== F01 클러치·브레이크 =====
  partMat("F01");
  tag(cyl(0.46, 0.22, parts.F01.mat, 2.02, 4.75, 0, "x"), "F01"); // 클러치 팩
  for (let i = 0; i < 4; i++) tag(cyl(0.48, 0.02, M.dark, 1.94 + i * 0.05, 4.75, 0, "x"), "F01");
  tag(cyl(0.42, 0.1, M.steel, -2.02, 4.75, 0, "x"), "F01"); // 브레이크 디스크
  tag(box(0.26, 0.34, 0.32, parts.F01.mat, -2.02, 5.08, 0), "F01"); // 캘리퍼
  tag(box(0.3, 0.12, 0.2, parts.F01.mat, -2.02, 5.3, 0), "F01");

  // ===== F09 인코더 (축 끝) =====
  partMat("F09");
  tag(cyl(0.12, 0.16, parts.F09.mat, -2.22, 4.75, 0, "x"), "F09");

  // ===== 슬라이드 (상하 왕복) =====
  const slide = new THREE.Group();
  scene.add(slide);
  outline(box(2.5, 0.9, 1.3, M.frame, 0, 0, 0, slide));
  box(2.6, 0.08, 1.36, M.steel, 0, -0.45, 0, slide); // 슬라이드 하면 플레이트

  // F03 과부하 장치: 유압 오버로드 매니폴드 + 밸브 + 압력계
  partMat("F03");
  tag(box(1.7, 0.24, 0.14, parts.F03.mat, 0, 0.26, 0.71, slide), "F03");
  tag(cyl(0.09, 0.26, parts.F03.mat, 0.98, 0.26, 0.76, "z", slide), "F03");
  tag(cyl(0.11, 0.05, M.steel, -0.98, 0.26, 0.79, "z", slide), "F03");
  tube([[0.98, 0.26, 0.9], [0.98, 0.6, 0.9], [0.98, 0.6, 0.5]], 0.025, parts.F03.mat, slide).userData.type = "F03";

  // F04 지브: 슬라이드 모서리 지브 + 기둥 쪽 마모판
  partMat("F04");
  [-1, 1].forEach((sx) =>
    [-1, 1].forEach((sz) => {
      tag(box(0.06, 0.9, 0.3, parts.F04.mat, sx * 1.27, 0, sz * 0.5, slide), "F04");
      tag(box(0.035, 2.1, 0.34, parts.F04.mat, sx * 1.29, 2.95, sz * 0.5), "F04");
    })
  );

  // F07 금형 체결·다이쿠션
  partMat("F07");
  tag(box(2.2, 0.35, 1.05, parts.F07.mat, 0, -0.665, 0, slide), "F07"); // 상형
  tag(box(1.3, 0.1, 0.6, M.steel, 0, -0.88, 0, slide), "F07"); // 펀치
  [-1, 1].forEach((sx) =>
    [-1, 1].forEach((sz) => tag(box(0.18, 0.16, 0.22, parts.F07.mat, sx * 1.2, -0.55, sz * 0.4, slide), "F07"))
  );
  tag(box(2.2, 0.35, 1.05, parts.F07.mat, 0, 1.655, 0), "F07"); // 하형
  tag(box(1.3, 0.04, 0.6, M.dark, 0, 1.845, 0), "F07"); // 하형 캐비티
  [-1, 1].forEach((sx) =>
    [-1, 1].forEach((sz) => tag(box(0.18, 0.16, 0.22, parts.F07.mat, sx * 1.2, 1.56, sz * 0.4), "F07"))
  );
  tag(box(1.7, 0.24, 0.95, parts.F07.mat, 0, 0.78, 0), "F07"); // 다이쿠션 패드
  tag(cyl(0.26, 0.4, parts.F07.mat, 0, 0.45, 0), "F07"); // 쿠션 실린더
  [-0.6, -0.2, 0.2, 0.6].forEach((x) => [-0.25, 0.25].forEach((z) => cyl(0.035, 0.45, M.steel, x, 1.12, z, "y", undefined, 12)));

  // 소재(블랭크)
  box(2.5, 0.03, 1.2, M.blank, 0, 1.86, 0);

  // 커넥팅 로드 (크랭크 ↔ 슬라이드, 매 프레임 길이 갱신)
  const rods = [-0.6, 0.6].map((x) => {
    const r = new THREE.Mesh(new THREE.BoxGeometry(0.24, 1, 0.24), M.steel);
    r.position.x = x;
    return finish(r);
  });

  // ===== F02 유압·공압 계통 (크라운 위 밸런서 실린더·에어탱크·배관) =====
  partMat("F02");
  [-1.25, -0.8].forEach((x) => {
    tag(cyl(0.15, 0.85, parts.F02.mat, x, 5.83, 0.55), "F02");
    cyl(0.17, 0.06, M.steel, x, 6.27, 0.55);
    cyl(0.05, 0.4, M.steel, x, 5.3, 0.55, "y", undefined, 12);
  });
  tag(cyl(0.26, 1.2, parts.F02.mat, -0.55, 5.72, -0.55, "x"), "F02");
  [-1.15, 0.05].forEach((x) => {
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.26, 24, 16), parts.F02.mat);
    cap.position.set(x, 5.72, -0.55);
    tag(finish(cap), "F02");
  });
  tag(tube([[-0.55, 5.98, -0.55], [-0.55, 6.15, -0.55], [-1.25, 6.15, -0.55], [-1.25, 6.15, 0.55]], 0.035, parts.F02.mat), "F02");
  tag(tube([[-0.8, 6.15, 0.2], [-0.8, 6.15, 0.55]], 0.035, parts.F02.mat), "F02");
  tag(cyl(0.11, 0.05, M.steel, 0.2, 5.72, -0.27, "z"), "F02"); // 압력계

  // ===== F05 윤활 (집중 윤활 펌프 유닛·분배 밸브·배관) =====
  partMat("F05");
  tag(box(0.75, 0.85, 0.55, parts.F05.mat, 2.75, 0.43, -0.95), "F05");
  cyl(0.17, 0.42, M.glass, 2.6, 1.07, -0.95);
  tag(cyl(0.09, 0.05, M.steel, 2.95, 0.6, -0.66, "z"), "F05");
  tag(tube([[2.4, 0.75, -0.75], [1.83, 0.75, -0.75], [1.83, 3.95, -0.75], [1.83, 3.95, -0.3]], 0.03, parts.F05.mat), "F05");
  tag(tube([[1.83, 2.9, -0.75], [1.83, 2.9, -0.3]], 0.03, parts.F05.mat), "F05");
  tag(box(0.14, 0.22, 0.14, parts.F05.mat, 1.83, 2.9, -0.75), "F05");
  tag(box(0.14, 0.22, 0.14, parts.F05.mat, 1.83, 3.95, -0.75), "F05");

  // ===== F08 이송장치 (피더 컨베이어·트랜스퍼 바·서보) =====
  partMat("F08");
  tag(box(1.9, 0.12, 1.15, parts.F08.mat, -3.35, 1.78, 0), "F08");
  [-1, 1].forEach((sx) => [-1, 1].forEach((sz) => box(0.08, 1.72, 0.08, M.dark, -3.35 + sx * 0.85, 0.86, sz * 0.5)));
  for (let i = 0; i < 7; i++) cyl(0.06, 1.12, M.steel, -4.2 + i * 0.28, 1.88, 0, "z", undefined, 16);
  box(1.3, 0.14, 1.0, M.blank, -3.45, 1.98, 0); // 소재 적재
  [-0.62, 0.62].forEach((z) => {
    tag(box(3.4, 0.09, 0.09, parts.F08.mat, -2.1, 2.02, z), "F08"); // 트랜스퍼 바
    for (let i = 0; i < 3; i++) tag(box(0.08, 0.12, 0.2, parts.F08.mat, -1.0 - i * 0.7, 1.95, z * 0.82), "F08"); // 핑거
  });
  tag(box(0.38, 0.38, 0.38, parts.F08.mat, -4.0, 2.05, 0.82), "F08"); // 서보 모터
  cyl(0.06, 0.25, M.steel, -4.0, 2.05, 0.6, "z", undefined, 12);

  // ===== F09 전기·센서 (제어반·광전 안전장치·리미트스위치) =====
  tag(box(0.85, 1.9, 0.45, parts.F09.mat, -2.95, 0.95, 1.55), "F09");
  box(0.58, 0.42, 0.02, M.screen, -2.95, 1.45, 1.785);
  cyl(0.06, 0.04, M.green, -3.12, 1.05, 1.79, "z", undefined, 16);
  cyl(0.06, 0.04, M.green, -2.95, 1.05, 1.79, "z", undefined, 16);
  cyl(0.08, 0.05, M.red, -2.75, 1.05, 1.79, "z", undefined, 16); // 비상정지
  tag(tube([[-2.95, 1.9, 1.55], [-2.95, 2.2, 1.55], [-1.8, 2.2, 1.55], [-1.8, 2.2, 0.9]], 0.03, M.dark), "F09");
  [-1, 1].forEach((sx) => tag(box(0.08, 1.35, 0.08, parts.F09.mat, sx * 1.42, 2.25, 1.02), "F09")); // 광전 안전장치 기둥
  const beams = new THREE.BufferGeometry().setFromPoints(
    Array.from({ length: 8 }, (_, i) => [new THREE.Vector3(-1.38, 1.7 + i * 0.15, 1.02), new THREE.Vector3(1.38, 1.7 + i * 0.15, 1.02)]).flat()
  );
  scene.add(new THREE.LineSegments(beams, M.beam));
  tag(box(0.12, 0.2, 0.12, parts.F09.mat, 1.86, 3.45, 0.62), "F09"); // 리미트스위치

  // ---------- 번호 라벨 ----------
  const ANCHORS = {
    F06: [[2.27, 5.75, 0.3]],
    F01: [[-2.02, 5.55, 0.2]],
    F02: [[-1.02, 6.45, 0.55]],
    F03: [[0, 0.26, 0.85], slide],
    F04: [[1.27, 0.2, 0.75], slide],
    F07: [[1.3, 1.7, 0.7]],
    F05: [[2.75, 1.05, -0.65]],
    F08: [[-3.35, 2.4, 0.4]],
    F09: [[-2.95, 2.15, 1.8]],
  };
  const tags = {};
  Object.entries(ANCHORS).forEach(([code, [p, parent]]) => {
    const el = document.createElement("button");
    el.type = "button";
    el.className = "p3d-tag";
    el.textContent = code;
    el.setAttribute("aria-label", `${code} 선택`);
    el.addEventListener("pointerdown", (e) => e.stopPropagation());
    el.addEventListener("click", (e) => {
      e.stopPropagation();
      onPick(code);
    });
    const obj = new CSS2DObject(el);
    obj.position.set(...p);
    (parent || scene).add(obj);
    tags[code] = el;
  });

  // ---------- 선택(클릭) ----------
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  let down = null;
  const hit = (e) => {
    const r = renderer.domElement.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    return ray.intersectObjects(pickables, false).find((h) => h.object.userData.type);
  };
  renderer.domElement.addEventListener("pointerdown", (e) => (down = [e.clientX, e.clientY]));
  renderer.domElement.addEventListener("pointerup", (e) => {
    if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 5) return;
    const h = hit(e);
    if (h) onPick(h.object.userData.type);
  });
  let lastMove = 0;
  renderer.domElement.addEventListener("pointermove", (e) => {
    const now = performance.now();
    if (now - lastMove < 60 || e.buttons) return;
    lastMove = now;
    renderer.domElement.style.cursor = hit(e) ? "pointer" : "grab";
  });

  // ---------- 상태 반영 ----------
  let selected = null;
  function update(keys, sel) {
    selected = sel;
    Object.entries(parts).forEach(([code, p]) => {
      const key = keys[code] || "none";
      p.mat.color.set(STATUS_COLOR[key]);
      p.mat.emissive.set(code === sel ? "#3d7bff" : "#000000");
      tags[code].className = `p3d-tag t-${key}${code === sel ? " sel" : ""}`;
    });
  }

  // ---------- 애니메이션 ----------
  let running = true;
  let active = true;
  let theta = 0;
  const clock = new THREE.Clock();
  function frame() {
    if (!active) return;
    requestAnimationFrame(frame);
    const dt = Math.min(clock.getDelta(), 0.05);
    if (running) theta += dt * 1.3;
    rot.rotation.x = theta;
    fly.rotation.x = theta * 3.2;
    const slideY = 2.98 + 0.31 * Math.cos(theta); // 하사점에서 상형이 소재에 닿음
    slide.position.y = slideY;
    const top = slideY + 0.45;
    rods.forEach((r) => {
      const crankY = 4.75 + 0.1 * Math.cos(theta);
      r.scale.y = crankY - top;
      r.position.y = (crankY + top) / 2;
    });
    if (selected && parts[selected]) parts[selected].mat.emissiveIntensity = 0.35 + 0.25 * Math.sin(performance.now() / 260);
    controls.update();
    renderer.render(scene, camera);
    labels.render(scene, camera);
  }
  frame();

  const ro = new ResizeObserver(() => {
    [W, H] = size();
    camera.aspect = W / H;
    camera.updateProjectionMatrix();
    renderer.setSize(W, H);
    labels.setSize(W, H);
  });
  ro.observe(container);

  return {
    update,
    toggleRun() {
      running = !running;
      return running;
    },
    resetView() {
      camera.position.set(9.4, 6.0, 11.0);
      controls.target.set(0, 3.0, 0);
      controls.autoRotate = true;
    },
    setActive(on) {
      if (on === active) return;
      active = on;
      if (on) {
        clock.getDelta();
        frame();
      }
    },
  };
}
