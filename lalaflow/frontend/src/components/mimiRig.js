// A soft body for the 12-pose cat. Each pose in the brand kit is one flat drawing (only tail, ears and a few paws are
// separate frames), so the kit's breathing and swaying move the whole picture like a stiff card. This cuts each
// pose's drawing (body and hoodie layers) into thin horizontal bands and gives every band its own angle and width,
// chained bottom-up like a spine:
// - the body leans from the feet, more towards the top, shifting its weight like someone standing;
// - the belly swells and settles with each breath;
// - above the neck the bands turn together as one head, blended over the neck so it bends instead of breaking;
//   the head looks around on a spring (it overshoots a little and settles) and stays roughly level as the body leans;
// - the bands above the head top (ears, bow) trail the head's turns.
// Everything else the kit draws on the pose (tail, paws, ears frames, bow, eye and mouth patches, the logo stitch, and
// the face, hat and glasses slots) is moved with the band it sits on, so it stays attached.
//
// Only the kit's exported POSE_GEO is used: its drawing transform T, its head circle, and the neck point inside its
// scarf placement (the kit anchors scarves at the neck).

const SVG_NS = "http://www.w3.org/2000/svg";
// Band heights in drawing pixels. Every band is a separately painted shape and the cost grows with their number
// (about 480 thin bands for five cats ran at 12 fps, 160 at 58), so bands are thin only across the neck, where the
// head's turn bends into the body, and thick down the body, where lean and breathing change slowly. The head and the
// ears above it are one band each, since they move as a block. Each band overlaps its neighbours to hide the hairline
// gaps that open at the edges when they turn.
const NECK_BAND_PX = 6;
const BODY_BAND_PX = 24;
const BAND_OVERLAP_PX = 4;
// The neck blends body into head over this many drawing pixels around the neck point.
const NECK_BLEND_PX = 44;
// Where the ears start, in head widths below the head top.
const EAR_ZONE = 0.28;

const LEAN_DEG = 3.2;
const LEAN_WOBBLE_DEG = 1.2;
const LEAN_PERIOD_S = 5.3;
const LEAN_WOBBLE_PERIOD_S = 3.1;
const LOOK_DEG = 9;
const LOOK_EVERY_S = [1.8, 3.5];
const HEAD_SWAY_DEG = 1.8;
const HEAD_SWAY_PERIOD_S = 2.7;
const RAISED_PAW_HEAD_REACH = 0.35;
// How much of the body's lean the head undoes to stay level.
const HEAD_LEVELING = 0.6;
// Springs: stiffness per s², and damping as a share of critical (below 1 overshoots).
const HEAD_SPRING = { stiffness: 34, damping: 0.55 };
const EAR_SPRING = { stiffness: 70, damping: 0.25 };
const BREATH_PERIOD_S = 2.8;
const BELLY_SWELL = 0.03;
const CHEST_RISE = 0.012;
// Longest frame step the springs integrate, so a stalled tab does not fling the head.
const MAX_STEP_S = 0.05;

const DRAWING_TRANSFORM = /translate\((-?[\d.]+) (-?[\d.]+)\) scale\((-?[\d.]+)\)/;
const SCARF_ANCHOR = /^translate\((-?[\d.]+) (-?[\d.]+)\) rotate\((-?[\d.]+)\)/;

const rigs = new Set();
let frame = 0;
let lastTime = 0;

function svgElement(name, attributes) {
  const node = document.createElementNS(SVG_NS, name);
  Object.entries(attributes).forEach(([key, value]) => node.setAttribute(key, value));
  return node;
}

const smoothstep = (edge0, edge1, x) => {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
};
const between = ([min, max]) => min + Math.random() * (max - min);
const wave = (t, periodS, phase = 0) => Math.sin((2 * Math.PI * t) / periodS + phase);

// The pose's drawing transform and, when it has a neck, its head and neck in the drawing's own pixels.
function poseGeometry(geo) {
  const [tx, ty, scale] = geo.T.match(DRAWING_TRANSFORM).slice(1).map(Number);
  const toDrawing = (x, y) => [(x - tx) / scale, (y - ty) / scale];
  const anchor = geo.scarf?.match(SCARF_ANCHOR);
  if (!anchor) return { tx, ty, scale, neck: null };
  const { cx, cy, r } = geo.head;
  // POSE_GEO puts the head circle's centre 0.45 head-widths below the head top, with a radius of half a width.
  const [, headTop] = toDrawing(cx, cy - 0.9 * r);
  const [, neckY] = toDrawing(Number(anchor[1]), Number(anchor[2]));
  return { tx, ty, scale, neck: { neckY, headTop, headWidth: (2 * r) / scale } };
}

function layerOf(image) {
  return image.dataset.layer.replace(/^q\d+_/, "").replace(/\d+$/, "");
}

function boxOf(image) {
  const [x, y, width, height] = ["x", "y", "width", "height"].map((key) => Number(image.getAttribute(key)));
  return { x, y, width, height };
}

// Band edges from the top of the drawing to the ground: ears, head, thin bands across the neck, thick ones below.
function bandEdges({ top, ground, neckY, earLine, hasNeck }) {
  const neckTop = hasNeck ? neckY - NECK_BLEND_PX / 2 : top;
  const neckBottom = hasNeck ? Math.min(ground, neckY + NECK_BLEND_PX / 2) : top;
  const edges = [top];
  if (earLine > top && earLine < neckTop) edges.push(earLine);
  if (neckTop > top) edges.push(neckTop);
  for (let y = neckTop + NECK_BAND_PX; y < neckBottom; y += NECK_BAND_PX) edges.push(y);
  if (neckBottom > edges.at(-1)) edges.push(neckBottom);
  for (let y = edges.at(-1) + BODY_BAND_PX; y < ground; y += BODY_BAND_PX) edges.push(y);
  edges.push(ground);
  return edges;
}

// Replaces one drawing layer with bands filled from a pattern of the same image. The pattern image keeps the kit's
// classes and data-layer, so the kit's recolouring still finds and updates it.
function bandLayer(image, prefix, bands) {
  const { x, y, width, height } = boxOf(image);
  const id = `${prefix}${image.dataset.layer}`;
  const pattern = svgElement("pattern", { id, patternUnits: "userSpaceOnUse", x, y, width, height });
  // Pattern content is laid out from the tile's own corner, which already sits at the image's x, y.
  const tile = image.cloneNode();
  tile.setAttribute("x", 0);
  tile.setAttribute("y", 0);
  pattern.appendChild(tile);
  const group = svgElement("g", { class: "mimi-bands" });
  group.appendChild(pattern);
  bands.forEach((band) => {
    const bandTop = Math.max(y, band.top - BAND_OVERLAP_PX);
    const bandBottom = Math.min(y + height, band.bottom + BAND_OVERLAP_PX);
    if (bandBottom <= bandTop) return;
    const rect = svgElement("rect", { x, y: bandTop, width, height: bandBottom - bandTop, fill: `url(#${id})` });
    band.nodes.push(rect);
    group.appendChild(rect);
  });
  image.replaceWith(group);
}

// What a pose needs each frame: its bands bottom-up and the kit layers riding on them.
function buildPose(poseGroup, geo, prefix) {
  const art = poseGroup.firstElementChild;
  const layers = [...art.querySelectorAll(":scope > image.mm-art")].filter((image) => ["base", "hood"].includes(layerOf(image)));
  const boxes = layers.map(boxOf);
  const top = Math.min(...boxes.map((box) => box.y));
  const ground = Math.max(...boxes.map((box) => box.y + box.height));
  const base = boxes[layers.findIndex((image) => layerOf(image) === "base")];
  const centerX = base.x + base.width / 2;
  const shape = poseGeometry(geo);
  const neckY = shape.neck?.neckY ?? top + (ground - top) * 0.35;
  const earLine = shape.neck ? shape.neck.headTop + shape.neck.headWidth * EAR_ZONE : -Infinity;
  const bands = bandEdges({ top, ground, neckY, earLine, hasNeck: Boolean(shape.neck) })
    .slice(0, -1)
    .map((edge, index, edges) => ({ top: edge, bottom: edges[index + 1] ?? ground, nodes: [], transform: "" }));
  layers.forEach((image) => bandLayer(image, `${prefix}${poseGroup.classList[1]}`, bands));
  const bandAt = (y) => Math.max(0, bands.findLastIndex((band) => band.top <= y));

  const riders = [...art.children]
    .filter((node) => !node.matches(".mimi-bands, mask, defs"))
    .map((node) => {
      // Drawn layers are images (some wrapped in a group); the logo stitch is a rect masked by its image.
      const shaped = node.matches("image, rect") ? node : node.querySelector("image");
      if (!shaped) return null;
      const { y, height } = boxOf(shaped);
      return { node, band: bandAt(y + height / 2) };
    })
    .filter(Boolean);

  const eyeBand = shape.neck ? bandAt(shape.neck.headTop + shape.neck.headWidth * 0.45) : 0;
  // Poses with a raised, moving paw have the arm reaching above the neck: a full head turn would shear the sleeve
  // between the head and body bands, so those heads turn less.
  const hasRaisedPaw = Boolean(art.querySelector(".mm-qk-p"));
  return {
    shape, bands, riders, top, ground, centerX, neckY,
    headReach: hasRaisedPaw ? RAISED_PAW_HEAD_REACH : 1,
    earLine,
    bellyY: neckY + (ground - neckY) * 0.55,
    bellySpread: (ground - neckY) * 0.22,
    eyeBand,
  };
}

// Places every band of a pose for this moment and returns the face slots' transform in the SVG's coordinates.
function pose(rigged, motion) {
  const { bands, ground, top, centerX, neckY, shape } = rigged;
  const height = ground - top;
  const squashY = 1 + CHEST_RISE * motion.breath;
  const squashX = 1 / Math.sqrt(squashY);
  const neckLean = motion.lean * ((ground - neckY) / height) ** 1.5;
  let chainX = centerX;
  let chainY = ground;
  for (let index = bands.length - 1; index >= 0; index -= 1) {
    const band = bands[index];
    const middle = (band.top + band.bottom) / 2;
    // The last band can reach a little past the ground; it does not lean.
    const rise = Math.max(0, Math.min(ground - band.bottom, ground - neckY)) / height;
    const headShare = shape.neck ? smoothstep(neckY + NECK_BLEND_PX / 2, neckY - NECK_BLEND_PX / 2, middle) : 0;
    const earShare = middle < rigged.earLine ? 1 : 0;
    const head = motion.head * rigged.headReach;
    const angle = motion.lean * rise ** 1.5 * (1 - headShare) + (neckLean + head) * headShare + motion.ear * earShare;
    const belly = 1 + BELLY_SWELL * motion.breath * Math.exp(-(((middle - rigged.bellyY) / rigged.bellySpread) ** 2));
    band.transform = `translate(${chainX.toFixed(2)} ${chainY.toFixed(2)}) rotate(${angle.toFixed(2)}) scale(${(squashX * belly).toFixed(4)} ${squashY.toFixed(4)}) translate(${-centerX} ${-band.bottom})`;
    band.nodes.forEach((node) => node.setAttribute("transform", band.transform));
    const radians = (angle * Math.PI) / 180;
    chainX += Math.sin(radians) * (band.bottom - band.top) * squashY;
    chainY -= Math.cos(radians) * (band.bottom - band.top) * squashY;
  }
  rigged.riders.forEach(({ node, band }) => node.setAttribute("transform", bands[band].transform));
  const { tx, ty, scale } = shape;
  return `translate(${tx} ${ty}) scale(${scale}) ${bands[rigged.eyeBand].transform} scale(${1 / scale}) translate(${-tx} ${-ty})`;
}

function spring(state, target, { stiffness, damping }, step) {
  const acceleration = stiffness * (target - state.value) - 2 * damping * Math.sqrt(stiffness) * state.speed;
  state.speed += acceleration * step;
  state.value += state.speed * step;
  return state.value;
}

function move(rig, time, step) {
  const t = time / 1000 + rig.phase;
  if (t >= rig.nextLook) {
    rig.lookAt = (Math.random() * 2 - 1) * LOOK_DEG;
    rig.nextLook = t + between(LOOK_EVERY_S);
  }
  const lean = LEAN_DEG * wave(t, LEAN_PERIOD_S) + LEAN_WOBBLE_DEG * wave(t, LEAN_WOBBLE_PERIOD_S, 1);
  const headTarget = rig.lookAt + HEAD_SWAY_DEG * wave(t, HEAD_SWAY_PERIOD_S, 2) - HEAD_LEVELING * lean;
  const head = spring(rig.head, headTarget, HEAD_SPRING, step);
  const earAngle = spring(rig.ears, head, EAR_SPRING, step);
  return { lean, head, ear: earAngle - head, breath: wave(t, BREATH_PERIOD_S) };
}

function poseShowing(root) {
  const poseClass = [...root.classList].find((name) => /^mm-pz-\d+$/.test(name));
  return poseClass ? Number(poseClass.slice("mm-pz-".length)) : null;
}

function animate(time) {
  const step = Math.min(MAX_STEP_S, (time - (lastTime || time)) / 1000);
  lastTime = time;
  rigs.forEach((rig) => {
    if (!rig.visible) return;
    const number = poseShowing(rig.bot.root);
    if (!rig.poses.has(number)) {
      const group = rig.bot.svg.querySelector(`.mm-pose-${number}`);
      if (!group) return;
      rig.poses.set(number, buildPose(group, window.MIMI_ASSETS.POSE_GEO[number], rig.bot.u));
    }
    const motion = move(rig, time, step);
    rig.face.setAttribute("transform", pose(rig.poses.get(number), motion));
  });
  frame = rigs.size ? requestAnimationFrame(animate) : 0;
}

// Gives a MimiBot showing the "pose" variant its soft body. Returns a function that stops it.
export function rigPoseCat(bot) {
  // The kit's face, hat and glasses slots sit in .mm-head; wrap them so they follow the head while the kit keeps
  // writing into the same slot elements.
  const headSlots = bot.svg.querySelector(".mm-head");
  const face = svgElement("g", { class: "mimi-rig-face" });
  face.append(...headSlots.childNodes);
  headSlots.appendChild(face);

  const rig = {
    bot, face, poses: new Map(), visible: true,
    phase: Math.random() * 100, nextLook: 0, lookAt: 0,
    head: { value: 0, speed: 0 }, ears: { value: 0, speed: 0 },
  };
  // Mascots scrolled out of view stop moving until they come back.
  const watcher = new IntersectionObserver(([entry]) => { rig.visible = entry.isIntersecting; });
  watcher.observe(bot.svg);
  rigs.add(rig);
  if (!frame) frame = requestAnimationFrame(animate);
  return () => {
    watcher.disconnect();
    rigs.delete(rig);
    if (!rigs.size) {
      cancelAnimationFrame(frame);
      frame = 0;
      lastTime = 0;
    }
  };
}
