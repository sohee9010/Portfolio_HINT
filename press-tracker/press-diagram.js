// 직동식(스트레이트 사이드) 기계식 프레스 가상 투시도
// 부위마다 data-type 으로 고장 유형 코드(F01~F09)와 연결됩니다. 실제 설비 도면이 아닌 교육용 가상 모델입니다.

const PRESS_MARKERS = {
  // code: [마커 x, y, 지시선 끝 x, y]
  F06: [574, 56, 522, 40],
  F01: [574, 150, 452, 112],
  F02: [38, 46, 150, 48],
  F03: [574, 266, 392, 287],
  F04: [574, 322, 412, 322],
  F07: [574, 412, 372, 404],
  F05: [574, 560, 536, 500],
  F08: [36, 452, 44, 412],
  F09: [36, 334, 55, 300],
};

const PRESS_SVG = `
<svg viewBox="0 0 610 600" xmlns="http://www.w3.org/2000/svg" role="group" aria-label="프레스 설비 고장 부위도">
  <defs>
    <pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <line x1="0" y1="0" x2="0" y2="6" stroke="#b6c2d1" stroke-width="1.2"/>
    </pattern>
    <pattern id="oil" width="8" height="8" patternUnits="userSpaceOnUse">
      <circle cx="2" cy="2" r="1.1" fill="#8aa0bb"/>
    </pattern>
  </defs>

  <!-- 바닥 기준선 -->
  <line x1="0" y1="560" x2="610" y2="560" class="ground"/>

  <!-- ===== 본체 구조 (고장 코드 없음) ===== -->
  <g class="frame">
    <rect x="110" y="70" width="340" height="110" rx="6"/>
    <rect x="110" y="180" width="40" height="262"/>
    <rect x="410" y="180" width="40" height="262"/>
    <rect x="100" y="442" width="360" height="80" rx="4"/>
    <rect x="90" y="522" width="380" height="24" rx="3"/>
    <rect x="100" y="546" width="56" height="14"/>
    <rect x="404" y="546" width="56" height="14"/>
    <!-- 타이로드 -->
    <line x1="120" y1="72" x2="120" y2="520" class="tie"/>
    <line x1="440" y1="72" x2="440" y2="520" class="tie"/>
  </g>
  <!-- 크라운·베드 절개 창 -->
  <rect x="124" y="84" width="312" height="82" rx="4" class="cutwin"/>
  <rect x="196" y="456" width="168" height="60" rx="4" class="cutwin"/>
  <!-- 가이드 레일 -->
  <rect x="146" y="196" width="6" height="236" class="rail"/>
  <rect x="408" y="196" width="6" height="236" class="rail"/>

  <!-- 크랭크축·커넥팅로드 (구동 전달, 중립) -->
  <rect x="132" y="117" width="296" height="11" rx="5" class="mech"/>
  <circle cx="222" cy="122" r="13" class="mech"/>
  <circle cx="322" cy="122" r="13" class="mech"/>
  <rect x="214" y="124" width="16" height="148" rx="4" class="mech"/>
  <rect x="314" y="124" width="16" height="148" rx="4" class="mech"/>
  <circle cx="222" cy="272" r="6" class="pin"/>
  <circle cx="322" cy="272" r="6" class="pin"/>

  <!-- ===== F06 모터·플라이휠·베어링 ===== -->
  <g class="part" data-type="F06" tabindex="0" role="button" aria-label="F06 모터·플라이휠·베어링">
    <title>F06 모터·플라이휠·베어링 — 진동, 소음, 과열</title>
    <rect x="446" y="16" width="84" height="44" rx="7" class="pz"/>
    <line x1="458" y1="24" x2="458" y2="52" class="detail"/>
    <line x1="466" y1="24" x2="466" y2="52" class="detail"/>
    <line x1="474" y1="24" x2="474" y2="52" class="detail"/>
    <circle cx="512" cy="38" r="11" class="pz"/>
    <line x1="503" y1="46" x2="472" y2="88" class="belt"/>
    <line x1="522" y1="44" x2="532" y2="104" class="belt"/>
    <circle cx="492" cy="122" r="44" class="pz"/>
    <circle cx="492" cy="122" r="30" class="detail-fill"/>
    <circle cx="492" cy="122" r="8" class="pz"/>
    <circle cx="360" cy="146" r="0" />
    <circle cx="380" cy="122" r="28" class="pz"/>
    <circle cx="380" cy="122" r="32" class="teeth"/>
    <rect x="148" y="110" width="18" height="25" rx="3" class="pz"/>
    <rect x="392" y="110" width="18" height="25" rx="3" class="pz"/>
  </g>

  <!-- ===== F01 클러치·브레이크 ===== -->
  <g class="part" data-type="F01" tabindex="0" role="button" aria-label="F01 클러치·브레이크 마모">
    <title>F01 클러치·브레이크 마모 — 정지 위치 밀림, 오버런</title>
    <rect x="432" y="98" width="16" height="48" rx="2" class="pz"/>
    <line x1="436" y1="100" x2="436" y2="144" class="detail"/>
    <line x1="440" y1="100" x2="440" y2="144" class="detail"/>
    <line x1="444" y1="100" x2="444" y2="144" class="detail"/>
    <rect x="114" y="100" width="16" height="44" rx="2" class="pz"/>
    <line x1="118" y1="102" x2="118" y2="142" class="detail"/>
    <line x1="122" y1="102" x2="122" y2="142" class="detail"/>
    <line x1="126" y1="102" x2="126" y2="142" class="detail"/>
  </g>

  <!-- ===== F02 유압·공압 계통 (밸런서 실린더·에어탱크·배관) ===== -->
  <g class="part" data-type="F02" tabindex="0" role="button" aria-label="F02 유압·공압 계통 누설">
    <title>F02 유압·공압 계통 누설 — 압력 저하, 밸런서 실린더 이상</title>
    <rect x="150" y="26" width="22" height="44" rx="4" class="pz"/>
    <rect x="184" y="26" width="22" height="44" rx="4" class="pz"/>
    <line x1="161" y1="70" x2="161" y2="88" class="rod"/>
    <line x1="195" y1="70" x2="195" y2="88" class="rod"/>
    <rect x="226" y="36" width="70" height="28" rx="14" class="pz"/>
    <path d="M226 50 H206 M172 48 H184" class="pipe"/>
    <path d="M296 50 H318 V70" class="pipe"/>
    <circle cx="318" cy="38" r="7" class="pz"/>
    <line x1="318" y1="34" x2="321" y2="38" class="detail"/>
  </g>

  <!-- 슬라이드(램) 본체 -->
  <rect x="155" y="266" width="250" height="76" rx="3" class="slide"/>
  <text x="280" y="333" class="cap">SLIDE</text>

  <!-- ===== F03 과부하 장치 (유압식 오버로드 프로텍터) ===== -->
  <g class="part" data-type="F03" tabindex="0" role="button" aria-label="F03 과부하 장치 작동">
    <title>F03 과부하 장치 작동 — 오버로드로 라인 정지</title>
    <rect x="184" y="276" width="192" height="20" rx="3" class="pz"/>
    <rect x="186" y="278" width="188" height="16" rx="2" fill="url(#oil)"/>
    <circle cx="390" cy="286" r="7" class="pz"/>
    <path d="M376 286 H383" class="pipe"/>
  </g>

  <!-- ===== F04 슬라이드·가이드(지브) ===== -->
  <g class="part" data-type="F04" tabindex="0" role="button" aria-label="F04 슬라이드·가이드(지브) 마모">
    <title>F04 슬라이드·가이드(지브) 마모 — 하사점 편차, 치수 불량</title>
    <rect x="152" y="258" width="8" height="92" rx="1" class="pz"/>
    <rect x="400" y="258" width="8" height="92" rx="1" class="pz"/>
    <rect x="160" y="300" width="240" height="4" class="pz thin"/>
  </g>

  <!-- ===== F07 금형 체결·다이쿠션 ===== -->
  <g class="part" data-type="F07" tabindex="0" role="button" aria-label="F07 금형 체결·다이쿠션 이상">
    <title>F07 금형 체결·다이쿠션 이상 — 금형 들뜸, 성형 불량</title>
    <path d="M188 342 H372 L362 374 H198 Z" class="pz"/>
    <path d="M232 374 H328 L320 382 H240 Z" class="pz"/>
    <path d="M198 398 H362 L372 430 H188 Z" class="pz"/>
    <rect x="174" y="344" width="14" height="14" rx="2" class="pz"/>
    <rect x="372" y="344" width="14" height="14" rx="2" class="pz"/>
    <rect x="174" y="414" width="14" height="14" rx="2" class="pz"/>
    <rect x="372" y="414" width="14" height="14" rx="2" class="pz"/>
    <line x1="232" y1="444" x2="232" y2="472" class="rod"/>
    <line x1="256" y1="444" x2="256" y2="472" class="rod"/>
    <line x1="280" y1="444" x2="280" y2="472" class="rod"/>
    <line x1="304" y1="444" x2="304" y2="472" class="rod"/>
    <line x1="328" y1="444" x2="328" y2="472" class="rod"/>
    <rect x="214" y="472" width="132" height="20" rx="3" class="pz"/>
    <rect x="262" y="492" width="36" height="20" rx="2" class="pz"/>
  </g>

  <!-- 소재(블랭크)와 볼스터 -->
  <rect x="150" y="388" width="260" height="4" class="blank"/>
  <rect x="158" y="430" width="244" height="14" class="bolster"/>
  <rect x="158" y="430" width="244" height="14" fill="url(#hatch)" opacity=".6"/>

  <!-- ===== F05 윤활 (집중 윤활 펌프·분배 밸브·배관) ===== -->
  <g class="part" data-type="F05" tabindex="0" role="button" aria-label="F05 윤활 불량">
    <title>F05 윤활 불량 — 윤활 압력 알람, 마찰부 발열</title>
    <rect x="478" y="472" width="58" height="50" rx="5" class="pz"/>
    <circle cx="495" cy="488" r="8" class="detail-fill"/>
    <line x1="495" y1="488" x2="500" y2="483" class="detail"/>
    <rect x="508" y="482" width="20" height="30" rx="2" class="detail-fill"/>
    <path d="M478 482 H466 V304 H410" class="pipe oilline"/>
    <path d="M466 304 V176 H452" class="pipe oilline"/>
    <rect x="460" y="296" width="12" height="16" rx="2" class="pz"/>
    <rect x="460" y="190" width="12" height="16" rx="2" class="pz"/>
  </g>

  <!-- ===== F08 이송장치(피더) ===== -->
  <g class="part" data-type="F08" tabindex="0" role="button" aria-label="F08 이송장치(피더) 오급송">
    <title>F08 이송장치(피더) 오급송 — 소재 걸림, 미스피드 정지</title>
    <rect x="8" y="396" width="96" height="8" rx="2" class="pz"/>
    <circle cx="24" cy="408" r="6" class="pz"/>
    <circle cx="52" cy="408" r="6" class="pz"/>
    <circle cx="80" cy="408" r="6" class="pz"/>
    <rect x="16" y="390" width="70" height="5" class="blankpart"/>
    <rect x="58" y="376" width="128" height="7" rx="2" class="pz"/>
    <path d="M186 376 v12 h-6" class="rod"/>
    <rect x="14" y="418" width="34" height="24" rx="3" class="pz"/>
    <circle cx="31" cy="430" r="6" class="detail-fill"/>
  </g>

  <!-- ===== F09 전기·센서 (제어반·광전 안전장치·리미트스위치·인코더) ===== -->
  <g class="part" data-type="F09" tabindex="0" role="button" aria-label="F09 전기·센서 이상">
    <title>F09 전기·센서 이상 — 광전 안전장치, 리미트스위치, 인코더 오류</title>
    <rect x="16" y="196" width="78" height="104" rx="5" class="pz"/>
    <rect x="25" y="206" width="60" height="34" rx="2" class="screen"/>
    <circle cx="34" cy="258" r="6" class="detail-fill"/>
    <circle cx="55" cy="258" r="6" class="detail-fill"/>
    <circle cx="76" cy="258" r="6" class="estop"/>
    <path d="M94 230 H110" class="pipe"/>
    <rect x="132" y="348" width="9" height="84" rx="2" class="pz"/>
    <rect x="419" y="348" width="9" height="84" rx="2" class="pz"/>
    <line x1="141" y1="360" x2="419" y2="360" class="beam"/>
    <line x1="141" y1="380" x2="419" y2="380" class="beam"/>
    <line x1="141" y1="400" x2="419" y2="400" class="beam"/>
    <line x1="141" y1="420" x2="419" y2="420" class="beam"/>
    <circle cx="140" cy="152" r="7" class="pz"/>
    <rect x="452" y="262" width="10" height="18" rx="2" class="pz"/>
  </g>

  <!-- 부위 이름 -->
  <text x="300" y="104" class="cap">CROWN</text>
  <text x="280" y="467" class="cap small">DIE CUSHION</text>
  <text x="280" y="532" class="cap">BED</text>

  <g id="markers"></g>
</svg>`;
