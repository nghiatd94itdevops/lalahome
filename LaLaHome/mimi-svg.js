/* mimi-svg.js – Mimi (LaLaHome), mèo chữ L ghép mảng vải & giấy. Đóng gói từ LaLaHome/src. */
(() => {
  var __defProp = Object.defineProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };

  // ../LaLaHome/src/mimi-assets.js
  var mimi_assets_exports = {};
  __export(mimi_assets_exports, {
    BADGES: () => BADGES,
    DECOR: () => DECOR,
    EYEWEAR: () => EYEWEAR,
    FX: () => FX,
    GEO: () => GEO,
    HAND: () => HAND,
    HATS: () => HATS,
    ITEMS: () => ITEMS,
    MIMI_DEFAULT_COLORS: () => MIMI_DEFAULT_COLORS,
    SCARF: () => SCARF,
    STATE_COLORS: () => STATE_COLORS,
    SUIT: () => SUIT,
    banner: () => banner,
    buildFace: () => buildFace,
    buildSVG: () => buildSVG,
    darken: () => darken,
    deriveColors: () => deriveColors,
    hexToRgb: () => hexToRgb,
    lighten: () => lighten,
    mix: () => mix
  });
  var MIMI_DEFAULT_COLORS = {
    primary: "#F2A65A",
    // thân vải chính
    dark: "#5B3A29",
    // màu đậm: nét mặt, khung nhà, chữ (vai trò như navy của Go-Find)
    fabric: "#E9806A",
    // mảng vải hoạ tiết
    paper: "#FFF4E2",
    // mảng giấy, đĩa mặt
    accent: "#E85D75"
    // nhấn: cúc đuôi, chuông, mũi
  };
  var clamp = (v) => Math.max(0, Math.min(255, Math.round(v)));
  function hexToRgb(h) {
    h = String(h || "").trim().replace("#", "");
    if (h.length === 3) h = h.split("").map((c) => c + c).join("");
    const n = parseInt(h, 16);
    if (Number.isNaN(n) || h.length !== 6) return [128, 128, 128];
    return [n >> 16 & 255, n >> 8 & 255, n & 255];
  }
  var toHex = (r, g, b) => "#" + [r, g, b].map((v) => clamp(v).toString(16).padStart(2, "0")).join("").toUpperCase();
  function mix(a, b, t) {
    const A = hexToRgb(a), B = hexToRgb(b);
    return toHex(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t);
  }
  var lighten = (c, t) => mix(c, "#FFFFFF", t);
  var darken = (c, t) => mix(c, "#000000", t);
  var lum = (c) => {
    const [r, g, b] = hexToRgb(c);
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  };
  function deriveColors(c = {}) {
    const k = { ...MIMI_DEFAULT_COLORS, ...c };
    const v = {};
    const ramp = (name, base) => {
      v[`--mm-${name}0`] = lighten(base, 0.38);
      v[`--mm-${name}1`] = lighten(base, 0.16);
      v[`--mm-${name}`] = base;
      v[`--mm-${name}2`] = darken(base, 0.16);
      v[`--mm-${name}3`] = darken(base, 0.34);
    };
    ramp("p", k.primary);
    ramp("d", k.dark);
    ramp("f", k.fabric);
    ramp("a", k.accent);
    v["--mm-pa0"] = lighten(k.paper, 0.6);
    v["--mm-pa"] = k.paper;
    v["--mm-pa1"] = mix(k.paper, k.dark, 0.08);
    v["--mm-pa2"] = mix(k.paper, k.dark, 0.18);
    v["--mm-pa3"] = mix(k.paper, k.dark, 0.32);
    v["--mm-ink"] = lum(k.paper) > 0.45 ? darken(k.dark, 0.1) : "#FFFFFF";
    v["--mm-hi"] = mix(k.primary, "#FFFFFF", 0.5);
    v["--mm-shadow"] = mix(k.dark, "#FFFFFF", 0.82);
    v["--mm-shadow2"] = mix(k.dark, "#FFFFFF", 0.9);
    v["--mm-blush"] = mix(k.accent, k.paper, 0.45);
    v["--mm-stitch"] = mix(k.primary, "#FFFFFF", 0.62);
    v["--mm-stitchd"] = darken(k.primary, 0.28);
    return v;
  }
  var STATE_COLORS = {
    brand: null,
    // dùng accent của brand
    info: ["#5AA9F0", "#0B7CE4", "#0A5FB0"],
    green: ["#4CC98A", "#009B4B", "#007A3B"],
    yellow: ["#FFC97A", "#FFA21F", "#D9820A"],
    red: ["#FF6B6B", "#EC0001", "#B30000"],
    wine: ["#E0525A", "#C00B12", "#8A070C"],
    wait: ["#6C757D", "#343A40", "#1F2327"],
    orange: ["#FFAE5C", "#FB7800", "#C85A00"],
    pink: ["#FF9EC4", "#FF5C9A", "#D63C78"],
    purple: ["#B69CFF", "#7C5CFF", "#5636D6"],
    night: ["#6F7FC9", "#3B4A9C", "#253274"],
    party: ["#1BF1BB", "#09BAFD", "#4285ED"],
    gold: ["#F6DA4E", "#DAA730", "#CC8D19"]
  };
  var ST = (prop, w, extra = "") => `style="fill:none;stroke:var(--mm-${prop});stroke-width:${w}${extra ? ";" + extra : ""}"`;
  var GEO = {
    view: [400, 410],
    head: { cx: 178, cy: 148, r: 100, face: 76 },
    L: "M118 214 H238 V290 H330 A44 44 0 0 1 330 378 H158 A40 40 0 0 1 118 338 Z",
    tip: [336, 334],
    // cúc áo đầu đuôi (như đầu kính lúp của Findy)
    hand: [266, 256],
    // bàn chân giơ lên khi cầm đồ
    item: [292, 232],
    // tâm món đồ cầm tay
    eyes: [[150, 150], [206, 150]],
    zones: { tl: [52, 60], tr: [330, 64], l: [30, 230], bl: [52, 360], br: [360, 380], hat: [178, 50] }
  };
  function defs(u) {
    const g = (id, stops, attrs = 'x1="0" y1="0" x2="0" y2="1"', kind = "linearGradient") => `<${kind} id="${u}${id}" ${attrs}>${stops.map(([o, c]) => `<stop offset="${o}" style="stop-color:var(--mm-${c})"/>`).join("")}</${kind}>`;
    return `<defs>
${g("ring", [[0, "p1"], [0.55, "p"], [1, "p2"]], 'x1="0" y1="0" x2="1" y2="1"')}
${g("body", [[0, "p1"], [0.6, "p"], [1, "p2"]], 'x1="0" y1="0" x2="1" y2="1"')}
${g("face", [[0, "pa0"], [0.55, "pa"], [1, "pa2"]], 'cx=".38" cy=".3" r=".85"', "radialGradient")}
${g("fab", [[0, "f1"], [1, "f2"]], 'x1="0" y1="0" x2="1" y2="1"')}
${g("paper", [[0, "pa0"], [1, "pa1"]], 'x1="0" y1="0" x2="1" y2="1"')}
${g("house", [[0, "d1"], [0.55, "d"], [1, "d3"]], 'x1="0" y1="0" x2="1" y2="1"')}
${g("acc", [[0, "a0"], [0.5, "a"], [1, "a2"]])}
${g("st", [[0, "s0"], [0.5, "s1"], [1, "s2"]])}
${g("shadow", [[0, "shadow"], [1, "shadow2"]], 'cx=".5" cy=".5" r=".5"', "radialGradient")}
<pattern id="${u}dots" width="14" height="14" patternUnits="userSpaceOnUse"><rect width="14" height="14" style="fill:var(--mm-f)"/><circle cx="3.5" cy="3.5" r="2.2" style="fill:var(--mm-f0)"/><circle cx="10.5" cy="10.5" r="2.2" style="fill:var(--mm-f0)"/></pattern>
<pattern id="${u}plaid" width="18" height="18" patternUnits="userSpaceOnUse"><rect width="18" height="18" style="fill:var(--mm-p)"/><rect y="7" width="18" height="4" style="fill:var(--mm-p2)"/><rect x="7" width="4" height="18" style="fill:var(--mm-p2)"/><rect x="7" y="7" width="4" height="4" style="fill:var(--mm-p3)"/></pattern>
<clipPath id="${u}Lclip"><path d="${GEO.L}"/></clipPath>
<clipPath id="${u}headclip"><circle cx="${GEO.head.cx}" cy="${GEO.head.cy}" r="${GEO.head.r}"/></clipPath>
</defs>`;
  }
  function house(u) {
    return `<g class="mm-house">
<path d="M20 180 L184 24 L348 180" ${ST("d3", 40, "stroke-linecap:round;stroke-linejoin:round")} transform="translate(5 7)"/>
<rect x="34" y="150" width="54" height="236" rx="16" style="fill:var(--mm-d3)" transform="translate(5 7)"/>
<rect x="290" y="130" width="54" height="170" rx="16" style="fill:var(--mm-d3)" transform="translate(5 7)"/>
<rect x="34" y="150" width="54" height="236" rx="16" fill="url(#${u}house)"/>
<rect x="290" y="130" width="54" height="170" rx="16" fill="url(#${u}house)"/>
<rect x="80" y="218" width="216" height="38" style="fill:var(--mm-d2)"/>
<path d="M88 228 H290" ${ST("d1", 3, "stroke-dasharray:8 7;stroke-linecap:round")}/>
<path d="M20 180 L184 24 L348 180" ${ST("f2", 40, "stroke-linecap:round;stroke-linejoin:round")}/>
<path d="M20 180 L184 24 L348 180" ${ST("f", 30, "stroke-linecap:round;stroke-linejoin:round")}/>
<path d="M30 168 L184 22 L338 168" ${ST("f0", 2.5, "stroke-dasharray:9 8;stroke-linecap:round")}/>
<path d="M44 170 V200 M44 330 V360" ${ST("d0", 5, "stroke-linecap:round")}/>
<rect x="46" y="250" width="30" height="34" rx="5" style="fill:var(--mm-pa1)"/><path d="M61 250 V284 M46 267 H76" ${ST("d", 3)}/>
</g>`;
  }
  function body(u) {
    const L = GEO.L;
    return `<g class="mm-body">
<path d="${L}" style="fill:var(--mm-p3)" transform="translate(7 9)"/>
<g clip-path="url(#${u}Lclip)">
  <rect x="110" y="200" width="140" height="92" fill="url(#${u}body)"/>
  <rect x="110" y="290" width="128" height="100" fill="url(#${u}paper)"/>
  <path d="M118 290 L238 378 H118 Z" style="fill:var(--mm-pa1)"/>
  <path d="M118 290 L238 378" ${ST("pa2", 2.5)}/>
  <rect x="238" y="286" width="62" height="100" fill="url(#${u}dots)"/>
  <rect x="300" y="286" width="90" height="100" fill="url(#${u}paper)"/>
  <path d="M300 290 L374 334 L300 378 Z" style="fill:var(--mm-pa1)"/>
  <path d="M300 290 L374 334 L300 378" ${ST("pa2", 2.5)}/>
  <path d="M238 290 V378 M300 290 V378 M118 290 H238" ${ST("p3", 4)}/>
  <path d="M128 300 V340 Q128 368 156 368 H228" ${ST("pa3", 2.2, "stroke-dasharray:3 5;stroke-linecap:round")}/>
  <path d="M246 298 H292 M246 370 H292" ${ST("f0", 2.5, "stroke-dasharray:7 6;stroke-linecap:round")}/>
  <path d="M128 262 V282 M228 262 V282" ${ST("stitch", 2.5, "stroke-dasharray:6 6;stroke-linecap:round")}/>
</g>
<path d="M130 268 Q 132 252 140 246" ${ST("hi", 6, "stroke-linecap:round")}/>
<g class="mm-paws">
  <ellipse cx="154" cy="378" rx="25" ry="14" style="fill:var(--mm-p)"/>
  <ellipse cx="206" cy="378" rx="25" ry="14" style="fill:var(--mm-p)"/>
  <path d="M146 372 V382 M160 372 V382 M198 372 V382 M212 372 V382" ${ST("p3", 3, "stroke-linecap:round")}/>
</g>
<g class="mm-tip"><circle cx="${GEO.tip[0]}" cy="${GEO.tip[1]}" r="24" style="fill:var(--mm-d)"/>
  <circle cx="${GEO.tip[0]}" cy="${GEO.tip[1]}" r="18" fill="url(#${u}st)"/>
  <circle cx="${GEO.tip[0]}" cy="${GEO.tip[1]}" r="12" ${ST("s0", 2.5)}/>
  <g style="fill:var(--mm-d)"><circle cx="${GEO.tip[0] - 4}" cy="${GEO.tip[1] - 4}" r="2.6"/><circle cx="${GEO.tip[0] + 4}" cy="${GEO.tip[1] - 4}" r="2.6"/><circle cx="${GEO.tip[0] - 4}" cy="${GEO.tip[1] + 4}" r="2.6"/><circle cx="${GEO.tip[0] + 4}" cy="${GEO.tip[1] + 4}" r="2.6"/></g>
  <path d="M${GEO.tip[0] - 12} ${GEO.tip[1] - 8} A14 14 0 0 1 ${GEO.tip[0] - 3} ${GEO.tip[1] - 14}" ${ST("s0", 3, "stroke-linecap:round")}/>
</g>
</g>`;
  }
  function collar(u) {
    return `<g class="mm-collar">
<path d="M116 238 Q 178 272 240 238 L 240 256 Q 178 290 116 256 Z" fill="url(#${u}st)"/>
<path d="M122 246 Q 178 276 234 246" ${ST("s0", 2.5, "stroke-dasharray:6 5;stroke-linecap:round")}/>
<g class="mm-bell"><circle cx="178" cy="278" r="14" fill="url(#${u}acc)"/><path d="M166 276 H190" ${ST("a3", 2.5)}/><circle cx="178" cy="284" r="3" style="fill:var(--mm-a3)"/><circle cx="173" cy="272" r="3.5" style="fill:var(--mm-a0)"/></g>
</g>`;
  }
  function head(u) {
    const { cx, cy, r, face } = GEO.head;
    return `<g class="mm-head">
<g class="mm-ear mm-ear-l"><path d="M92 112 L100 18 L160 66 Z" style="fill:var(--mm-pa2)" transform="translate(4 5)"/><path d="M92 112 L100 18 L160 66 Z" style="fill:var(--mm-pa)"/><path d="M100 18 L160 66 L120 84 Z" style="fill:var(--mm-pa2)"/><path d="M106 82 L110 44 L138 70 Z" style="fill:var(--mm-blush)"/></g>
<g class="mm-ear mm-ear-r"><path d="M264 112 L256 18 L196 66 Z" style="fill:var(--mm-pa2)" transform="translate(4 5)"/><path d="M264 112 L256 18 L196 66 Z" style="fill:var(--mm-pa)"/><path d="M256 18 L196 66 L236 84 Z" style="fill:var(--mm-pa2)"/><path d="M250 82 L246 44 L218 70 Z" style="fill:var(--mm-blush)"/></g>
<g class="mm-antenna">
  <path d="M178 ${cy - r + 4} V30" ${ST("d", 5, "stroke-linecap:round")}/>
  <rect x="164" y="8" width="28" height="6" rx="3" style="fill:var(--mm-d)"/>
  <rect x="167" y="13" width="22" height="16" fill="url(#${u}st)"/>
  <path d="M167 18 H189 M167 23 H189" ${ST("s2", 2)}/>
  <rect x="164" y="28" width="28" height="6" rx="3" style="fill:var(--mm-d)"/>
  <path d="M192 18 L210 4" ${ST("d1", 3, "stroke-linecap:round")}/><circle cx="208" cy="6" r="1.6" style="fill:var(--mm-pa)"/>
</g>
<circle cx="${cx + 6}" cy="${cy + 8}" r="${r}" style="fill:var(--mm-p3)"/>
<circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#${u}ring)"/>
<g clip-path="url(#${u}headclip)">
  <path d="M${cx} ${cy} L${cx - 140} ${cy - 40} L${cx - 140} ${cy + 60} Z" style="fill:var(--mm-pa)"/>
  <path d="M${cx} ${cy} L${cx - 140} ${cy + 10} L${cx - 140} ${cy + 60} Z" style="fill:var(--mm-pa1)"/>
  <path d="M${cx} ${cy} L${cx + 140} ${cy - 40} L${cx + 140} ${cy + 60} Z" fill="url(#${u}dots)"/>
  <g ${ST("p3", 4)}><path d="M${cx} ${cy} L${cx - 140} ${cy - 40} M${cx} ${cy} L${cx - 140} ${cy + 60} M${cx} ${cy} L${cx + 140} ${cy - 40} M${cx} ${cy} L${cx + 140} ${cy + 60}"/></g>
</g>
<circle cx="${cx}" cy="${cy}" r="${r - 12}" ${ST("stitch", 2.5, "stroke-dasharray:7 7;stroke-linecap:round")}/>
<path d="M${cx - 78} ${cy - 46} A92 92 0 0 1 ${cx - 40} ${cy - 84}" ${ST("hi", 6, "stroke-linecap:round")}/>
<path d="M${cx - 30} ${cy - 89} A92 92 0 0 1 ${cx - 14} ${cy - 91}" ${ST("hi", 6, "stroke-linecap:round")}/>
<g class="mm-cos-head"></g>
<circle cx="${cx}" cy="${cy + 2}" r="${face}" fill="url(#${u}face)"/>
<g class="mm-cheeks"><ellipse cx="132" cy="178" rx="15" ry="9" style="fill:var(--mm-blush)"/><ellipse cx="224" cy="178" rx="15" ry="9" style="fill:var(--mm-blush)"/></g>
<g class="mm-whisk" ${ST("ink", 2.6, "stroke-linecap:round")}><path d="M122 166 L106 163 M122 176 L105 178"/><path d="M234 166 L250 163 M234 176 L251 178"/></g>
<g class="mm-face"></g>
</g>`;
  }
  function buildSVG(u, variant = "L") {
    const [w, h] = GEO.view;
    return `<svg class="mm-svg" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${defs(u)}
<g class="mm-back"></g>
<ellipse class="mm-shadow" cx="236" cy="394" rx="168" ry="13" fill="url(#${u}shadow)"/>
${variant === "LH" ? house(u) : ""}
<g class="mm-char"><g class="mm-bob">
${body(u)}
<g class="mm-outfit"></g>
${collar(u)}
<g class="mm-scarf"></g>
${head(u)}
<g class="mm-eyewear"></g>
<g class="mm-hat"></g>
<g class="mm-hand"></g>
</g></g>
<g class="mm-front"></g>
<g class="mm-fx"></g>
</svg>`;
  }
  var EYE = {
    open: (x, y) => `<g class="mm-blink" style="transform-origin:center"><ellipse cx="${x}" cy="${y}" rx="11" ry="14" style="fill:var(--mm-ink)"/><circle cx="${x + 4}" cy="${y - 5}" r="4.2" fill="#fff"/><circle cx="${x - 4}" cy="${y + 5}" r="2" fill="#fff"/></g>`,
    big: (x, y) => `<ellipse cx="${x}" cy="${y}" rx="15" ry="18" style="fill:var(--mm-ink)"/><circle cx="${x + 5}" cy="${y - 6}" r="5.5" fill="#fff"/><circle cx="${x - 5}" cy="${y + 7}" r="2.6" fill="#fff"/>`,
    tiny: (x, y) => `<circle cx="${x}" cy="${y}" r="5.5" style="fill:var(--mm-ink)"/>`,
    happy: (x, y) => `<path d="M${x - 12} ${y + 5} Q ${x} ${y - 12} ${x + 12} ${y + 5}" ${ST("ink", 5.5, "stroke-linecap:round")}/>`,
    closed: (x, y) => `<path d="M${x - 12} ${y - 1} Q ${x} ${y + 11} ${x + 12} ${y - 1}" ${ST("ink", 5.5, "stroke-linecap:round")}/>`,
    flat: (x, y) => `<path d="M${x - 11} ${y + 2} H${x + 11}" ${ST("ink", 5.5, "stroke-linecap:round")}/>`,
    half: (x, y) => `<path d="M${x - 11} ${y - 2} H${x + 11}" ${ST("ink", 4, "stroke-linecap:round")}/><path d="M${x - 10} ${y} A10 9 0 0 0 ${x + 10} ${y} Z" style="fill:var(--mm-ink)"/>`,
    up: (x, y) => `<ellipse cx="${x}" cy="${y}" rx="11" ry="14" style="fill:var(--mm-ink)"/><circle cx="${x + 4}" cy="${y - 8}" r="4.5" fill="#fff"/>`,
    look: (x, y) => `<g class="mm-look"><ellipse cx="${x}" cy="${y}" rx="11" ry="14" style="fill:var(--mm-ink)"/><circle cx="${x + 5}" cy="${y - 3}" r="4.5" fill="#fff"/></g>`,
    heart: (x, y) => `<g class="mm-pulse" style="transform-origin:center"><path d="M${x} ${y + 12} C ${x - 20} ${y}, ${x - 13} ${y - 15}, ${x} ${y - 6} C ${x + 13} ${y - 15}, ${x + 20} ${y}, ${x} ${y + 12} Z" style="fill:#E9405A"/><circle cx="${x - 6}" cy="${y - 4}" r="3" fill="#fff"/></g>`,
    star: (x, y) => `<path class="mm-spin" style="transform-origin:center;fill:#F6B300" d="M${x} ${y - 14} L${x + 4} ${y - 4} L${x + 14} ${y - 3} L${x + 6} ${y + 4} L${x + 9} ${y + 14} L${x} ${y + 8} L${x - 9} ${y + 14} L${x - 6} ${y + 4} L${x - 14} ${y - 3} L${x - 4} ${y - 4} Z"/>`,
    x: (x, y) => `<path d="M${x - 9} ${y - 9} L${x + 9} ${y + 9} M${x + 9} ${y - 9} L${x - 9} ${y + 9}" ${ST("ink", 5.5, "stroke-linecap:round")}/>`,
    spiral: (x, y) => `<path class="mm-spin" style="transform-origin:center" d="M${x} ${y} m-2 0 a2 2 0 1 1 4 0 a5 5 0 1 1 -10 0 a8 8 0 1 1 16 0 a11 11 0 1 1 -22 0" ${ST("ink", 3.2, "stroke-linecap:round")}/>`,
    sad: (x, y) => `<ellipse cx="${x}" cy="${y + 2}" rx="11" ry="12" style="fill:var(--mm-ink)"/><circle cx="${x + 4}" cy="${y - 2}" r="4" fill="#fff"/><path d="M${x - 13} ${y - 16} L${x + 9} ${y - 20}" ${ST("ink", 4, "stroke-linecap:round")}/>`,
    dong: (x, y) => `<circle cx="${x}" cy="${y}" r="13" style="fill:#F6B300"/><text x="${x}" y="${y + 6}" text-anchor="middle" font-family="Roboto,Arial,sans-serif" font-weight="900" font-size="17" style="fill:var(--mm-d)">\u20AB</text>`,
    pixel: (x, y) => `<g style="fill:var(--mm-ink)"><rect x="${x - 10}" y="${y - 10}" width="7" height="7"/><rect x="${x + 3}" y="${y - 10}" width="7" height="7"/><rect x="${x - 3}" y="${y - 3}" width="7" height="7"/><rect x="${x - 10}" y="${y + 4}" width="7" height="7"/><rect x="${x + 3}" y="${y + 4}" width="7" height="7"/></g>`
  };
  var BROW = {
    worry: () => `<path d="M138 128 L160 132 M196 132 L218 128" ${ST("ink", 4, "stroke-linecap:round")}/>`,
    angry: () => `<path d="M138 128 L160 136 M196 136 L218 128" ${ST("ink", 4, "stroke-linecap:round")}/>`,
    up: () => `<path d="M138 126 Q 150 118 162 124 M194 124 Q 206 118 218 126" ${ST("ink", 4, "stroke-linecap:round")}/>`,
    think: () => `<path d="M138 130 L160 130 M194 124 Q 206 118 218 126" ${ST("ink", 4, "stroke-linecap:round")}/>`
  };
  var NOSE = `<path d="M170 168 Q 178 164 186 168 Q 183 175 178 177 Q 173 175 170 168 Z" fill="url(#__u__acc)"/>`;
  var MOUTH = {
    w: `<path d="M178 177 V182 M166 182 Q 172 190 178 182 Q 184 190 190 182" ${ST("ink", 3.6, "stroke-linecap:round;stroke-linejoin:round")}/>`,
    smile: `<path d="M178 177 V181" ${ST("ink", 3.6, "stroke-linecap:round")}/><path d="M164 181 Q 178 198 192 181" ${ST("ink", 3.6, "stroke-linecap:round")}/>`,
    open: `<path d="M178 177 V181" ${ST("ink", 3.6, "stroke-linecap:round")}/><path d="M164 181 Q 178 206 192 181 Z" style="fill:#B8434B;stroke:var(--mm-ink);stroke-width:3.4;stroke-linejoin:round"/><path d="M170 192 Q 178 186 186 192 Q 178 199 170 192 Z" style="fill:#F28C96"/>`,
    o: `<ellipse cx="178" cy="190" rx="7" ry="9" style="fill:#B8434B;stroke:var(--mm-ink);stroke-width:3.4"/>`,
    flat: `<path d="M168 186 H188" ${ST("ink", 3.6, "stroke-linecap:round")}/>`,
    sad: `<path d="M166 192 Q 178 180 190 192" ${ST("ink", 3.6, "stroke-linecap:round")}/>`,
    wave: `<path d="M164 188 q 4.5 -6 9 0 t 9 0 t 9 0" ${ST("ink", 3.4, "stroke-linecap:round")}/>`,
    side: `<path d="M168 186 Q 180 190 190 180" ${ST("ink", 3.6, "stroke-linecap:round")}/>`,
    smirk: `<path d="M166 184 Q 180 192 192 178" ${ST("ink", 3.6, "stroke-linecap:round")}/>`,
    kiss: `<path d="M174 182 Q 184 186 176 190 Q 186 194 174 198" ${ST("ink", 3.6, "stroke-linecap:round;stroke-linejoin:round")}/>`,
    tongue: `<path d="M166 182 Q 178 196 190 182" ${ST("ink", 3.6, "stroke-linecap:round")}/><path d="M174 188 Q 174 198 180 198 Q 186 198 185 188 Z" style="fill:#F07A86"/>`,
    shout: `<path d="M162 180 Q 178 172 194 180 Q 194 206 178 208 Q 162 206 162 180 Z" style="fill:#B8434B;stroke:var(--mm-ink);stroke-width:3.4;stroke-linejoin:round"/>`,
    talk: `<g class="mm-talk"><path d="M178 177 V181" ${ST("ink", 3.6, "stroke-linecap:round")}/><path class="mm-jaw" d="M166 181 Q 178 200 190 181 Z" style="fill:#B8434B;stroke:var(--mm-ink);stroke-width:3.4;stroke-linejoin:round;transform-origin:50% 0"/></g>`,
    hum: `<path d="M172 186 Q 178 182 184 186" ${ST("ink", 3.6, "stroke-linecap:round")}/><text x="196" y="196" font-family="Roboto,Arial,sans-serif" font-weight="700" font-size="11" style="fill:var(--mm-ink)">~</text>`,
    zz: `<ellipse cx="178" cy="188" rx="5" ry="4" style="fill:var(--mm-ink)"/>`
  };
  function buildFace(u, f) {
    const [[lx, ly], [rx, ry]] = GEO.eyes;
    const le = EYE[f.eyes] || EYE.open;
    const re = EYE[f.eyesR || f.eyes] || EYE.open;
    let s = "";
    if (f.brow && BROW[f.brow]) s += BROW[f.brow]();
    s += le(lx, ly) + re(rx, ry);
    if (f.tear) s += `<path class="mm-tear" d="M136 166 Q 130 178 136 182 Q 142 178 136 166 Z" style="fill:#7CC4F2"/>`;
    if (f.sweat) s += `<path class="mm-sweat" d="M236 118 Q 228 132 236 138 Q 244 132 236 118 Z" style="fill:#7CC4F2"/>`;
    s += NOSE.replace("__u__", u) + (MOUTH[f.mouth] || MOUTH.w);
    return s;
  }
  var F = (c) => `style="fill:${c}"`;
  var K = (c, w, x = "") => `style="fill:none;stroke:${c};stroke-width:${w};stroke-linecap:round;stroke-linejoin:round${x ? ";" + x : ""}"`;
  var TXT = (x, y, t, size, fill, extra = "") => `<text x="${x}" y="${y}" text-anchor="middle" font-family="Roboto,Arial,sans-serif" font-weight="900" font-size="${size}" style="fill:${fill};${extra}">${t}</text>`;
  var star5 = (r, r2 = r * 0.45) => {
    let d = "";
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r2 : r;
      d += (i ? "L" : "M") + (Math.cos(a) * rr).toFixed(1) + " " + (Math.sin(a) * rr).toFixed(1) + " ";
    }
    return d + "Z";
  };
  var heartD = (s) => `M0 ${s * 0.9} C ${-s * 1.5} ${-s * 0.05}, ${-s * 0.95} ${-s * 1.15}, 0 ${-s * 0.4} C ${s * 0.95} ${-s * 1.15}, ${s * 1.5} ${-s * 0.05}, 0 ${s * 0.9} Z`;
  var sparkleD = (s) => `M0 ${-s} Q ${s * 0.18} ${-s * 0.18} ${s} 0 Q ${s * 0.18} ${s * 0.18} 0 ${s} Q ${-s * 0.18} ${s * 0.18} ${-s} 0 Q ${-s * 0.18} ${-s * 0.18} 0 ${-s} Z`;
  var ITEMS = {
    magnifier: `<g class="mm-scan"><circle cx="-6" cy="-10" r="24" style="fill:var(--mm-d)"/><circle cx="-6" cy="-10" r="17" style="fill:#DDF1FF"/><path d="M-16 -18 A12 12 0 0 1 -4 -24" ${K("#FFFFFF", 4)}/><path d="M10 8 L28 30" ${K("var(--mm-d)", 10)}/><path d="M12 10 L24 25" ${K("var(--mm-a)", 5)}/></g>`,
    clipboard: `<rect x="-22" y="-30" width="44" height="58" rx="6" style="fill:var(--mm-d)"/><rect x="-17" y="-24" width="34" height="48" rx="2" style="fill:var(--mm-pa)"/><rect x="-9" y="-34" width="18" height="9" rx="3" style="fill:var(--mm-a)"/><path d="M-10 -10 L-5 -5 L5 -15 M-10 6 H10 M-10 14 H6" ${K("var(--mm-d)", 3)}/>`,
    pinwheel: `<path d="M0 0 V44" ${K("#9C6B3F", 4)}/><g class="mm-spinfast"><path d="M0 0 L0 -26 Q 16 -22 0 0" ${F("#FF6FA8")}/><path d="M0 0 L26 0 Q 22 16 0 0" ${F("#FFC94D")}/><path d="M0 0 L0 26 Q -16 22 0 0" ${F("#5CC8E8")}/><path d="M0 0 L-26 0 Q -22 -16 0 0" ${F("#7ED67E")}/><circle r="4" ${F("#FFFFFF")}/></g>`,
    coconut: `<path d="M-4 -36 Q 10 -54 30 -46" ${K("#FF6FA8", 3)}/><path d="M18 -44 Q 30 -62 42 -44 Z" ${F("#FFC94D")}/><path d="M30 -54 V-40" ${K("#9C6B3F", 2)}/><path d="M-2 -40 L4 -14" ${K("#FF5C9A", 4)}/><ellipse cx="0" cy="4" rx="26" ry="24" ${F("#7BB661")}/><ellipse cx="0" cy="-12" rx="22" ry="8" ${F("#F7F3E3")}/><path d="M-20 8 Q 0 20 20 8" ${K("#5E9449", 3)}/>`,
    teacup: `<path d="M-6 -30 q -6 -8 0 -16 M6 -30 q -6 -8 0 -16" ${K("#D9CBB2", 3)}/><path d="M-24 -20 H24 L18 10 Q 0 20 -18 10 Z" ${F("#FFFFFF")}/><path d="M-24 -20 H24" ${K("#5C8C5A", 4)}/><path d="M22 -12 Q 36 -10 30 4 Q 26 8 18 6" ${K("#FFFFFF", 5)}/><ellipse cx="0" cy="16" rx="30" ry="6" ${F("#E7DCC8")}/><path d="M-10 -6 q 10 6 20 0" ${K("#7BB661", 3)}/>`,
    candycane: `<path d="M8 40 V-18 A14 14 0 0 0 -20 -18" ${K("#FFFFFF", 12)}/><path d="M8 40 V-18 A14 14 0 0 0 -20 -18" ${K("#E63950", 12, "stroke-dasharray:7 7")}/><path d="M8 40 V-18 A14 14 0 0 0 -20 -18" ${K("#2E9E5B", 3, "stroke-dasharray:3 11")}/>`,
    lixi: `<rect x="-22" y="-32" width="44" height="62" rx="5" ${F("#E5282E")}/><path d="M-22 -26 L0 -8 L22 -26" ${K("#B3161C", 3)}/><circle cy="-6" r="10" ${F("#FFC94D")}/>${TXT(0, -2, "\u798F", 11, "#E5282E")}<path d="M-14 14 H14 M-10 22 H10" ${K("#FFC94D", 3)}/>`,
    starlantern: `<path d="M0 40 V8" ${K("#9C6B3F", 4)}/><g class="mm-swing"><path d="${star5(30, 14)}" ${F("#E5282E")}/><path d="${star5(22, 10)}" ${F("#FF6B4A")}/><circle r="7" ${F("#FFD45C")}/><path d="M-6 26 L-10 40 M6 26 L10 40 M0 28 V44" ${K("#FFC94D", 3)}/></g>`,
    pumpkin: `<path d="M-20 -22 Q 0 -44 20 -22" ${K("#4A3428", 4)}/><ellipse cx="-12" cy="4" rx="16" ry="22" ${F("#E8742C")}/><ellipse cx="12" cy="4" rx="16" ry="22" ${F("#E8742C")}/><ellipse cy="4" rx="14" ry="24" ${F("#F58A3A")}/><path d="M-12 -2 L-6 -8 L-2 -2 Z M12 -2 L6 -8 L2 -2 Z" ${F("#4A2A12")}/><path d="M-12 10 L-6 14 L0 10 L6 14 L12 10" ${K("#4A2A12", 3)}/><path d="M0 -20 V-28" ${K("#5E8A3A", 5)}/>`,
    shopbag: `<path d="M-14 -24 Q -14 -42 0 -42 Q 14 -42 14 -24" ${K("var(--mm-d)", 4)}/><rect x="-26" y="-26" width="52" height="56" rx="6" ${F("#FF5C9A")}/><rect x="-26" y="-26" width="52" height="12" ${F("#D63C78")}/>${TXT(0, 14, "SALE", 14, "#FFFFFF")}<path d="M-20 22 H20" ${K("#FFFFFF", 2, "stroke-dasharray:4 4")}/>`,
    lightstick: `<path d="M0 44 V6" ${K("#22252A", 9)}/><g class="mm-glow"><circle r="26" ${F("var(--mm-a0)")}/><circle r="20" ${F("var(--mm-pa0)")}/><path d="M-9 -12 V8 H10" ${K("var(--mm-a)", 7)}/><circle cx="8" cy="-8" r="3" ${F("var(--mm-a)")}/></g><path d="M-30 -12 L-38 -16 M30 -12 L38 -16 M0 -30 V-38" ${K("var(--mm-a0)", 3)}/>`,
    dumbbell: `<g class="mm-lift"><path d="M-30 0 H30" ${K("#6C757D", 6)}/><rect x="-36" y="-14" width="10" height="28" rx="3" ${F("#343A40")}/><rect x="26" y="-14" width="10" height="28" rx="3" ${F("#343A40")}/><rect x="-44" y="-9" width="8" height="18" rx="3" ${F("#343A40")}/><rect x="36" y="-9" width="8" height="18" rx="3" ${F("#343A40")}/></g>`,
    phin: `<path d="M-6 -50 q -6 -8 0 -16 M4 -50 q -6 -8 0 -16" ${K("#D9CBB2", 3)}/><rect x="-16" y="-44" width="32" height="16" rx="3" ${F("#B8BEC4")}/><rect x="-22" y="-30" width="44" height="5" rx="2" ${F("#9AA1A8")}/><path d="M-18 -24 H18 L14 22 H-14 Z" ${F("#F2EDE4")}/><path d="M-16 -2 H16 L14 22 H-14 Z" ${F("#7A4A28")}/><path d="M-15 8 H15 L14 22 H-14 Z" ${F("#E9D5B0")}/><g transform="translate(26 6) rotate(-30)"><path d="M-8 -26 Q 0 -32 8 -26 V24 Q 0 30 -8 24 Z" ${F("#E3A55A")}/><path d="M-4 -18 L4 -12 M-4 -4 L4 2 M-4 10 L4 16" ${K("#C07A35", 2.5)}/></g>`,
    laptop: `<path d="M-46 -38 H46 L40 6 H-40 Z" ${F("#3A3F46")}/><path d="M-40 -32 H40 L35 0 H-35 Z" ${F("#DDF1FF")}/><path d="M-30 -24 H10 M-30 -16 H22 M-30 -8 H0" ${K("var(--mm-a)", 3.5)}/><path d="M-56 6 H56 L50 16 H-50 Z" ${F("#9AA1A8")}/><circle cx="0" cy="-16" r="0"/>`,
    bento: `<rect x="-30" y="-14" width="60" height="38" rx="6" ${F("#C9473C")}/><rect x="-26" y="-10" width="30" height="30" rx="3" ${F("#FFFFFF")}/><rect x="6" y="-10" width="20" height="14" rx="3" ${F("#7BB661")}/><rect x="6" y="6" width="20" height="14" rx="3" ${F("#F2A65A")}/><circle cx="-11" cy="5" r="5" ${F("#E5282E")}/><path d="M-30 -30 L10 -14 M-24 -36 L14 -18" ${K("#9C6B3F", 3)}/>`,
    milktea: `<path d="M4 -52 L-2 -10" ${K("#FF5C9A", 6)}/><path d="M-20 -30 H20 L15 26 Q 0 32 -15 26 Z" ${F("#F7F3EC")}/><path d="M-18 -10 H18 L15 26 Q 0 32 -15 26 Z" ${F("#D9A877")}/><g ${F("#4A2A1A")}><circle cx="-8" cy="18" r="4"/><circle cx="3" cy="21" r="4"/><circle cx="10" cy="14" r="4"/><circle cx="-2" cy="11" r="4"/></g><ellipse cy="-30" rx="22" ry="6" ${F("#FFFFFF")}/><path d="M-22 -30 Q 0 -42 22 -30" ${K("#E3D8C8", 3)}/>`,
    fishplate: `<ellipse cy="14" rx="36" ry="12" ${F("#FFFFFF")}/><ellipse cy="12" rx="30" ry="8" ${F("#E7EEF5")}/><g transform="translate(0 2)"><path d="M-22 0 Q -4 -16 14 0 Q -4 16 -22 0 Z" ${F("#F2A65A")}/><path d="M12 0 L26 -10 L26 10 Z" ${F("#E8742C")}/><circle cx="-14" cy="-2" r="2.5" ${F("#3B2A20")}/><path d="M-4 -6 Q 0 0 -4 6 M4 -6 Q 8 0 4 6" ${K("#E8742C", 2)}/></g><path d="M30 -24 L22 18 M38 -22 L26 18" ${K("#9C6B3F", 3)}/>`,
    book: `<path d="M0 -20 Q -20 -30 -40 -22 V22 Q -20 14 0 24 Q 20 14 40 22 V-22 Q 20 -30 0 -20 Z" ${F("var(--mm-f)")}/><path d="M0 -16 Q -18 -24 -34 -18 V16 Q -18 10 0 18 Z" ${F("var(--mm-pa)")}/><path d="M0 -16 Q 18 -24 34 -18 V16 Q 18 10 0 18 Z" ${F("var(--mm-pa1)")}/><path d="M-28 -10 H-8 M-28 -2 H-8 M-28 6 H-12 M8 -10 H28 M8 -2 H28 M8 6 H22" ${K("var(--mm-pa3)", 2.5)}/><path d="M0 -16 V18" ${K("var(--mm-pa3)", 2)}/>`,
    popcorn: `<g ${F("#FFF6D8")}><circle cx="-14" cy="-26" r="9"/><circle cx="0" cy="-30" r="10"/><circle cx="14" cy="-26" r="9"/><circle cx="-6" cy="-36" r="8"/><circle cx="8" cy="-38" r="7"/></g><path d="M-24 -22 H24 L18 30 H-18 Z" ${F("#FFFFFF")}/><path d="M-16 -22 L-12 30 M0 -22 V30 M16 -22 L12 30" ${K("#E63950", 7)}/><path d="M-24 -22 H24" ${K("#E63950", 4)}/>`,
    heartpaper: `<path d="${heartD(28)}" ${F("#FF6F8F")}/><path d="M0 -11 V25" ${K("#D9475F", 2.5, "stroke-dasharray:5 4")}/><path d="M-22 -8 Q -20 -20 -8 -20" ${K("#FFFFFF", 4)}/>`
  };
  var HAND = `<path d="M232 300 Q 248 286 262 266" style="fill:none;stroke:var(--mm-p3);stroke-width:30;stroke-linecap:round"/><path d="M232 300 Q 248 286 262 266" style="fill:none;stroke:var(--mm-p);stroke-width:24;stroke-linecap:round"/><g class="mm-paw"><circle cx="266" cy="258" r="15" style="fill:var(--mm-p1)"/><path d="M261 250 V258 M271 250 V258" style="fill:none;stroke:var(--mm-p3);stroke-width:3;stroke-linecap:round"/></g>`;
  var HATS = {
    flowercrown: { big: false, svg: `<path d="M-74 26 Q 0 -6 74 26" ${K("#5E9449", 6)}/>${[[-66, 20], [-40, 8], [-12, 2], [16, 2], [44, 8], [68, 20]].map(([x, y], i) => `<g transform="translate(${x} ${y})">${[0, 72, 144, 216, 288].map((a) => `<ellipse cy="-8" rx="5" ry="8" transform="rotate(${a})" ${F(i % 2 ? "#FFFFFF" : "#FFB3D1")}/>`).join("")}<circle r="4.5" ${F("#FFC94D")}/></g>`).join("")}` },
    nonla: { big: true, svg: `<path d="M-104 34 L0 -58 L104 34 Q 0 52 -104 34 Z" ${F("#E9CF8E")}/><path d="M0 -58 L104 34 Q 50 46 0 46 Z" ${F("#D7B66C")}/><path d="M-70 4 Q 0 18 70 4 M-40 -22 Q 0 -12 40 -22" ${K("#C49E52", 2.5)}/><path d="M-60 40 Q -40 90 -20 96" ${K("#E5282E", 3)}/>` },
    santa: { big: true, svg: `<path d="M-70 24 Q -40 -64 30 -60 Q 70 -54 84 -12 L60 4 Q 40 -30 10 -20 Z" ${F("#E63950")}/><path d="M-76 30 Q 0 0 76 30" ${K("#FFFFFF", 22)}/><circle cx="84" cy="-12" r="15" ${F("#FFFFFF")}/><path d="M-40 -10 Q -20 -40 10 -40" ${K("#F06A7E", 4)}/>` },
    witch: { big: true, svg: `<path d="M-96 32 Q 0 6 96 32 Q 0 50 -96 32 Z" ${F("#3B2A5C")}/><path d="M-50 26 L-8 -86 Q 6 -100 20 -84 L12 -76 L50 26 Z" ${F("#4A3470")}/><path d="M-44 14 Q 0 2 44 14 L42 26 Q 0 16 -46 26 Z" ${F("#F58A3A")}/><path d="M-6 -40 l3 7 7 1 -5 5 1 7 -6 -3 -6 3 1 -7 -5 -5 7 -1 Z" ${F("#FFC94D")}/>` },
    nightcap: { big: false, svg: `<path d="M-74 24 Q -50 -50 20 -44 Q 64 -40 96 4 Q 70 -6 50 -2 Q 20 -18 -10 -8 Z" ${F("#6F7FC9")}/><path d="M-76 30 Q 0 2 76 30" ${K("#FFFFFF", 18)}/><circle cx="98" cy="6" r="12" ${F("#FFFFFF")}/>${[[-30, -26], [10, -30], [50, -16]].map(([x, y]) => `<path d="${star5(5)}" transform="translate(${x} ${y})" ${F("#FFD45C")}/>`).join("")}` },
    headband: { big: false, svg: `<path d="M-90 52 Q 0 20 90 52" ${K("#E63950", 14)}/><path d="M-90 52 Q 0 20 90 52" ${K("#FFFFFF", 3, "stroke-dasharray:10 10")}/><path d="M86 50 L104 40 M86 54 L104 64" ${K("#E63950", 8)}/>` },
    headset: { big: false, svg: `<path d="M-100 92 Q -104 -6 0 -8 Q 104 -6 100 92" ${K("#3A3F46", 9)}/><rect x="-116" y="76" width="26" height="44" rx="12" ${F("#2B2F35")}/><rect x="90" y="76" width="26" height="44" rx="12" ${F("#2B2F35")}/><path d="M-112 86 V110 M112 86 V110" ${K("var(--mm-a)", 3)}/><path d="M-104 116 Q -96 150 -50 146" ${K("#3A3F46", 4)}/><ellipse cx="-46" cy="146" rx="7" ry="5" ${F("#2B2F35")}/>` },
    halo: { big: false, svg: `<ellipse cy="-30" rx="44" ry="11" ${K("#FFD45C", 7)}/><ellipse cy="-30" rx="44" ry="11" ${K("#FFF3B0", 2.5)}/>` }
  };
  var EYEWEAR = {
    sunglasses: `<path d="M122 140 H234" ${K("#2B2F35", 5)}/><path d="M126 136 H170 Q 172 164 148 166 Q 126 164 126 136 Z" ${F("#2B2F35")}/><path d="M186 136 H230 Q 230 164 208 166 Q 186 164 186 136 Z" ${F("#2B2F35")}/><path d="M134 142 L146 142 M194 142 L206 142" ${K("#7A8590", 3)}/>`,
    reading: `<circle cx="150" cy="150" r="20" ${K("var(--mm-d)", 4)}/><circle cx="206" cy="150" r="20" ${K("var(--mm-d)", 4)}/><path d="M170 148 Q 178 142 186 148 M130 146 L108 140 M226 146 L248 140" ${K("var(--mm-d)", 4)}/>`,
    glasses3d: `<rect x="122" y="134" width="112" height="32" rx="8" ${F("#FFFFFF")}/><rect x="128" y="139" width="44" height="22" rx="5" ${F("#E63950")}/><rect x="184" y="139" width="44" height="22" rx="5" ${F("#3FA8F0")}/>`
  };
  var SCARF = `<path d="M112 236 Q 178 276 244 236 L246 262 Q 178 300 110 262 Z" ${F("#E63950")}/><path d="M118 248 Q 178 282 238 248" ${K("#2E9E5B", 6, "stroke-dasharray:10 10")}/><path d="M206 262 L222 320 L200 324 L192 268 Z" ${F("#D12C45")}/><path d="M204 312 L224 312 M206 320 L222 320" ${K("#FFFFFF", 3)}/>`;
  var SUIT = `<g><path d="M118 244 H238 V336 Q 178 346 118 336 Z" style="fill:var(--mm-d)"/><path d="M118 244 H178 V341 Q 140 340 118 336 Z" style="fill:var(--mm-d1)"/><path d="M156 250 L178 318 L200 250 Z" ${F("#FFFFFF")}/><path d="M178 282 L171 310 L178 320 L185 310 Z" ${F("#343A40")}/><path d="M172 276 H184 L182 284 H174 Z" ${F("#343A40")}/><path d="M146 250 L170 298 L160 318 M210 250 L186 298 L196 318" ${K("var(--mm-d3)", 3.5)}/><path d="M208 270 l6 -6 l4 4" ${K("var(--mm-a)", 3)}/><circle cx="196" cy="326" r="3.2" style="fill:var(--mm-d3)"/><path d="M128 260 V330 M228 260 V330" ${K("var(--mm-d2)", 3)}/></g>`;
  var DECOR = {
    sun: `<g class="mm-spinslow"><circle r="24" ${F("#FFC94D")}/>${Array.from({ length: 10 }, (_, i) => `<path d="M0 -30 V-40" transform="rotate(${i * 36})" ${K("#FFB020", 5)}/>`).join("")}</g>`,
    cloud: `<g class="mm-drift" ${F("#FFFFFF")}><circle cx="-14" r="12"/><circle cx="2" cy="-8" r="15"/><circle cx="18" r="11"/><rect x="-26" y="0" width="54" height="11" rx="5"/></g>`,
    moon: `<circle r="26" ${F("#FFE08A")}/><circle cx="10" cy="-8" r="22" ${F("#FFEFB8")}/><circle cx="-8" cy="6" r="4" ${F("#F2CE6B")}/><circle cx="6" cy="12" r="3" ${F("#F2CE6B")}/>`,
    fullmoon: `<circle r="30" ${F("#FFE08A")}/><circle cx="-8" cy="-6" r="6" ${F("#F7CF62")}/><circle cx="10" cy="8" r="4" ${F("#F7CF62")}/><circle cx="8" cy="-12" r="3" ${F("#F7CF62")}/>`,
    bee: `<g class="mm-flyby"><ellipse rx="11" ry="8" ${F("#FFC94D")}/><path d="M-3 -7 V7 M4 -6 V6" ${K("#3B2A20", 3)}/><ellipse cx="-2" cy="-10" rx="6" ry="5" ${F("#DDF1FF")}/><ellipse cx="5" cy="-10" rx="6" ry="5" ${F("#EAF6FF")}/></g>`,
    butterfly: `<g class="mm-flutter"><ellipse cx="-8" cy="-4" rx="9" ry="11" ${F("#FF8CC0")}/><ellipse cx="8" cy="-4" rx="9" ry="11" ${F("#FFB3D1")}/><ellipse cx="-6" cy="8" rx="6" ry="7" ${F("#C9A0FF")}/><ellipse cx="6" cy="8" rx="6" ry="7" ${F("#C9A0FF")}/><path d="M0 -10 V14" ${K("#3B2A20", 3)}/></g>`,
    daisies: `${[[-20, 6], [6, -4], [26, 10]].map(([x, y]) => `<path d="M${x} ${y} V40" ${K("#5E9449", 3)}/><g transform="translate(${x} ${y})">${[0, 45, 90, 135, 180, 225, 270, 315].map((a) => `<ellipse cy="-7" rx="3.5" ry="7" transform="rotate(${a})" ${F("#FFFFFF")}/>`).join("")}<circle r="4" ${F("#FFC94D")}/></g>`).join("")}`,
    ball: `<circle r="20" ${F("#FFFFFF")}/><path d="M-20 0 A20 20 0 0 1 0 -20 L0 0 Z" ${F("#FF5C5C")}/><path d="M0 20 A20 20 0 0 1 -20 0 L0 0 Z" ${F("#3FA8F0")}/><path d="M20 0 A20 20 0 0 1 0 20 L0 0 Z" ${F("#FFC94D")}/>`,
    ice: `<rect x="-12" y="-12" width="24" height="24" rx="5" ${F("#DDF4FF")}/><path d="M-6 -6 L2 -6" ${K("#FFFFFF", 3)}/>`,
    maple: `<path d="M0 -16 L4 -6 L14 -10 L10 0 L18 4 L6 6 L8 16 L0 10 L-8 16 L-6 6 L-18 4 L-10 0 L-14 -10 L-4 -6 Z" ${F("#E8693A")}/><path d="M0 10 V22" ${K("#B8471E", 2)}/>`,
    gift: `<rect x="-24" y="-14" width="48" height="36" rx="3" ${F("#E63950")}/><rect x="-27" y="-24" width="54" height="12" rx="3" ${F("#D12C45")}/><rect x="-5" y="-24" width="10" height="46" ${F("#2E9E5B")}/><path d="M0 -24 Q -18 -40 -16 -26 Z M0 -24 Q 18 -40 16 -26 Z" ${F("#2E9E5B")}/><g ${F("#F06A7E")}><circle cx="-14" cy="0" r="2.5"/><circle cx="14" cy="10" r="2.5"/><circle cx="12" cy="-4" r="2.5"/></g>`,
    giftround: `<ellipse cy="14" rx="26" ry="10" ${F("#B24AA0")}/><rect x="-26" y="-12" width="52" height="26" ${F("#E05BB8")}/><ellipse cy="-12" rx="28" ry="10" ${F("#F4C34E")}/><ellipse cy="-14" rx="24" ry="7" ${F("#FF8AD0")}/><g ${F("#FFFFFF")}><circle cx="-14" cy="2" r="3"/><circle cx="10" cy="6" r="3"/><circle cx="0" cy="-2" r="2.5"/></g><path d="M0 -16 Q -16 -32 -18 -18 Z M0 -16 Q 16 -32 18 -18 Z" ${F("#FFFFFF")}/>`,
    mai: `<path d="M-50 30 Q -10 0 10 -24 M-20 8 Q -6 -6 -10 -28 M0 -12 Q 14 -10 26 -20" ${K("#5A3A24", 4)}/>${[[10, -24], [-10, -28], [26, -20], [-24, 12], [-40, 22], [2, -6]].map(([x, y]) => `<g transform="translate(${x} ${y})">${[0, 72, 144, 216, 288].map((a) => `<ellipse cy="-5" rx="3.5" ry="5.5" transform="rotate(${a})" ${F("#FFC72C")}/>`).join("")}<circle r="2.5" ${F("#E8742C")}/></g>`).join("")}`,
    dao: `<path d="M-50 30 Q -10 0 10 -24 M-20 8 Q -6 -6 -10 -28 M0 -12 Q 14 -10 26 -20" ${K("#5A3A24", 4)}/>${[[10, -24], [-10, -28], [26, -20], [-24, 12], [-40, 22], [2, -6]].map(([x, y]) => `<g transform="translate(${x} ${y})">${[0, 72, 144, 216, 288].map((a) => `<ellipse cy="-5" rx="3.5" ry="5.5" transform="rotate(${a})" ${F("#FF8CB4")}/>`).join("")}<circle r="2.5" ${F("#D63C78")}/></g>`).join("")}`,
    banhchung: `<rect x="-24" y="-20" width="48" height="40" rx="3" ${F("#3E8E41")}/><path d="M-24 -6 H24 M-24 8 H24 M-8 -20 V20 M8 -20 V20" ${K("#F2E8C9", 2.5)}/><path d="M-24 -20 L-14 -28 H32 L24 -20 Z" ${F("#2F7533")}/><path d="M24 -20 L32 -28 V12 L24 20 Z" ${F("#2A6A2E")}/>`,
    lantern: `<g class="mm-swing"><path d="M0 -40 V-26" ${K("#9C6B3F", 2)}/><ellipse rx="18" ry="22" cy="-4" ${F("#E5282E")}/><path d="M-10 -24 Q -18 -4 -10 16 M10 -24 Q 18 -4 10 16 M0 -26 V18" ${K("#B3161C", 2)}/><rect x="-10" y="-28" width="20" height="5" rx="2" ${F("#FFC94D")}/><rect x="-10" y="15" width="20" height="5" rx="2" ${F("#FFC94D")}/><path d="M-4 20 V32 M0 20 V34 M4 20 V32" ${K("#FFC94D", 2)}/></g>`,
    carp: `<g class="mm-swing"><path d="M0 -40 V-24" ${K("#9C6B3F", 2)}/><path d="M-26 0 Q 0 -26 26 0 Q 0 22 -26 0 Z" ${F("#FF7A3A")}/><path d="M22 0 L38 -12 L36 0 L38 12 Z" ${F("#FFC94D")}/><circle cx="-14" cy="-3" r="3" ${F("#3B2A20")}/><path d="M-6 -8 q 6 8 0 16 M4 -8 q 6 8 0 16" ${K("#FFC94D", 2)}/></g>`,
    mooncake: `<rect x="-28" y="-10" width="56" height="30" rx="4" ${F("#C0392B")}/><rect x="-28" y="-18" width="56" height="10" rx="3" ${F("#E74C3C")}/>${TXT(0, 12, "\u4E2D\u79CB", 12, "#FFD45C")}<circle cx="34" cy="10" r="12" ${F("#D99A4E")}/><circle cx="34" cy="10" r="8" ${K("#B97A30", 2)}/>`,
    bat: `<g class="mm-flutter"><path d="M0 0 Q -10 -10 -24 -6 Q -18 0 -20 6 Q -12 2 -8 8 Q -4 2 0 4 Q 4 2 8 8 Q 12 2 20 6 Q 18 0 24 -6 Q 10 -10 0 0 Z" ${F("#3B2A5C")}/><circle cx="-3" cy="0" r="1.6" ${F("#FFC94D")}/><circle cx="3" cy="0" r="1.6" ${F("#FFC94D")}/></g>`,
    pumpkins: `<g transform="scale(.9)">${ITEMS.pumpkin}</g><g transform="translate(42 12) scale(.6)">${ITEMS.pumpkin}</g>`,
    web: `<path d="M0 0 L50 0 M0 0 L0 50 M0 0 L36 36 M14 0 Q 10 10 0 14 M28 0 Q 22 22 0 28 M42 0 Q 36 36 0 42" ${K("#B9B2C9", 2)}/>`,
    dealbadge: `<g class="mm-wobble"><path d="${star5(30, 24).replace(/L/g, "L")}" ${F("#FFC94D")}/><path d="${Array.from({ length: 24 }, (_, i) => {
      const a = i * Math.PI / 12, r = i % 2 ? 26 : 32;
      return (i ? "L" : "M") + (Math.cos(a) * r).toFixed(1) + " " + (Math.sin(a) * r).toFixed(1);
    }).join(" ")} Z" ${F("#FF2D55")}/>${TXT(0, -2, "DEAL", 13, "#FFFFFF")}${TXT(0, 12, "HOT", 11, "#FFE14D")}</g>`,
    fireworks: `<g class="mm-burst">${Array.from({ length: 12 }, (_, i) => `<path d="M0 -10 V-26" transform="rotate(${i * 30})" ${K(["#FFC94D", "#FF5C9A", "#5CC8E8"][i % 3], 3.5)}/>`).join("")}<circle r="4" ${F("#FFF3B0")}/></g>`
  };
  var banner = (text, kind) => kind === "sale" ? `<g class="mm-wobble"><rect x="-120" y="-17" width="240" height="34" rx="17" ${F("#111111")}/><rect x="-116" y="-13" width="232" height="26" rx="13" ${F("#FF2D55")}/>${TXT(0, 6, text, 16, "#FFFFFF", "letter-spacing:.5px")}<path d="${sparkleD(8)}" transform="translate(-104 -16)" ${F("#FFE14D")}/><path d="${sparkleD(6)}" transform="translate(108 14)" ${F("#FFFFFF")}/></g>` : `<path d="M-140 -14 L-124 0 L-140 14 H-108 V-14 Z M140 -14 L124 0 L140 14 H108 V-14 Z" ${F("#B3161C")}/><rect x="-116" y="-18" width="232" height="36" rx="4" ${F("#E5282E")}/><rect x="-110" y="-13" width="220" height="26" rx="3" ${K("#FFC94D", 2)}/><g class="mm-shine"><rect x="-116" y="-18" width="18" height="36" ${F("#FF6B6B")} transform="skewX(-20)"/></g>${TXT(0, 6, text, 15, "#FFE14D", "letter-spacing:.5px")}`;
  var FX = {
    heart: (c = "#FF5C7A") => `<path d="${heartD(9)}" ${F(c)}/>`,
    note: () => `<path d="M-4 8 V-12 L10 -16 V4" ${K("var(--mm-s1)", 3)}/><circle cx="-8" cy="8" r="5" ${F("var(--mm-s1)")}/><circle cx="6" cy="4" r="5" ${F("var(--mm-s1)")}/>`,
    z: () => TXT(0, 6, "z", 20, "var(--mm-s1)"),
    q: () => TXT(0, 9, "?", 26, "var(--mm-s1)"),
    ex: () => TXT(0, 9, "!", 26, "var(--mm-s1)"),
    drop: () => `<path d="M0 -10 Q -8 2 0 8 Q 8 2 0 -10 Z" ${F("#7CC4F2")}/>`,
    sparkle: (c = "#F6B300") => `<path d="${sparkleD(9)}" ${F(c)}/>`,
    star: (c = "#F6B300") => `<path d="${star5(9)}" ${F(c)}/>`,
    check: () => `<circle r="10" ${F("#009B4B")}/><path d="M-5 0 L-1 4 L6 -4" ${K("#FFFFFF", 3)}/>`,
    cross: () => `<circle r="10" ${F("#EC0001")}/><path d="M-4 -4 L4 4 M4 -4 L-4 4" ${K("#FFFFFF", 3)}/>`,
    paperball: () => `<circle r="8" ${F("var(--mm-pa1)")}/><path d="M-5 -3 L2 -1 L-1 5 M3 -6 L5 2" ${K("var(--mm-pa3)", 1.6)}/>`,
    confetti: (c) => `<rect x="-4" y="-7" width="8" height="14" rx="2" ${F(c)}/>`,
    petal: () => `<ellipse rx="5" ry="8" ${F("#FFB3D1")}/>`,
    leaf: () => `<g transform="scale(.7)">${DECOR.maple}</g>`,
    snow: () => `<g ${K("#FFFFFF", 2.5)}><path d="M0 -8 V8 M-7 -4 L7 4 M-7 4 L7 -4"/></g><g ${K("#BFE6FF", 1)}><path d="M0 -8 V8"/></g>`,
    coin: () => `<circle r="10" ${F("#FFC94D")}/>${TXT(0, 5, "\u20AB", 13, "#B8860B")}`,
    money: () => `<rect x="-12" y="-7" width="24" height="14" rx="2" ${F("#7BC67E")}/><circle r="4" ${F("#4E9A51")}/>`,
    om: () => `<circle r="10" ${K("var(--mm-s1)", 2.5)}/>`,
    fish: () => `<path d="M-10 0 Q 0 -8 8 0 Q 0 8 -10 0 Z M8 0 L14 -5 V5 Z" ${F("#5CC8E8")}/>`
  };
  var BADGES = {
    info: `<circle r="22" ${F("var(--mm-s1)")}/><circle r="22" ${K("var(--mm-s0)", 3)}/>${TXT(0, 9, "i", 26, "#FFFFFF", "font-family:Georgia,serif")}`,
    success: `<circle r="22" ${F("var(--mm-s1)")}/><path d="M-10 0 L-3 8 L11 -8" ${K("#FFFFFF", 6)}/>`,
    request: `<rect x="-20" y="-24" width="40" height="48" rx="6" ${F("var(--mm-s1)")}/><rect x="-14" y="-17" width="28" height="35" rx="2" ${F("#FFFFFF")}/>${TXT(0, 9, "?", 22, "var(--mm-s1)")}`,
    warning: `<path d="M0 -24 L24 18 Q 26 24 20 24 H-20 Q -26 24 -24 18 Z" ${F("var(--mm-s2)")} transform="translate(2 3)"/><path d="M0 -24 L24 18 Q 26 24 20 24 H-20 Q -26 24 -24 18 Z" ${F("var(--mm-s1)")}/><path d="M0 -24 L12 -3 H-12 Z" ${F("var(--mm-s0)")}/><path d="M0 -8 V8" ${K("#FFFFFF", 6)}/><circle cy="16" r="3.5" ${F("#FFFFFF")}/>`,
    error: `<circle r="22" ${F("var(--mm-s1)")}/><path d="M-8 -8 L8 8 M8 -8 L-8 8" ${K("#FFFFFF", 6)}/>`,
    trash: `<g><rect x="-17" y="-12" width="34" height="38" rx="6" ${F("var(--mm-s1)")}/><path d="M-7 -4 V18 M0 -4 V18 M7 -4 V18" ${K("var(--mm-s2)", 3)}/><g class="mm-lid" style="transform-origin:-20px -14px"><rect x="-21" y="-20" width="42" height="8" rx="4" ${F("var(--mm-s2)")}/><path d="M-6 -20 Q 0 -28 6 -20" ${K("var(--mm-s2)", 3.5)}/></g></g>`
  };

  // <stdin>
  window.MIMI_ASSETS = mimi_assets_exports;
})();
