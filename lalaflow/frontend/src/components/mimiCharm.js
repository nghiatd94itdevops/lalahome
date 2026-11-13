// Extra liveliness for the 12-pose cat, added from the site so the brand kit in /LaLaHome stays untouched. It drives
// the kit's public MimiBot API (setState, play, stop) plus its own idle quirk classes.
//
// The kit already animates a lot on its own: every state is its own pose with a squash-and-pop change, 8-frame tail
// and paws, ear frames, blinking and idle hops. On top of that the site adds poses while idle with a dance bounce,
// small fidgets in the calm poses the kit leaves still for long, a hover wave, and a talking mouth (the kit keeps the
// drawn mouth still). Paws and legs only move where the kit's art has frames for them (poses 2, 8 and 12).
const CHARMS = {
  pose: {
    // Each of these is a different pose; longer holds and gaps let every pose change finish and be seen. Only the
    // waving (greet) and paw-up (info) poses have moving paws and only the party pose has kicking legs, so the paw
    // poses are listed twice to come up more often.
    gestures: ["greet", "greet", "info", "info", "wink", "love", "happy", "party"],
    gestureMs: 2600,
    gestureGapMs: [4500, 8000],
    hover: [["greet", 2200]],
    // Poses that hold still in place, so a bounce on top reads as dancing; "happy" already jumps and "party" rolls.
    danceStates: ["greet", "info", "love", "wink"],
    // Kit poses that only breathe and sway: standing, head tilt, sitting, paw raised, hugging.
    fidgetPoses: [1, 3, 7, 8, 9],
    fidgetGapMs: [3000, 6000],
    talkingMouth: true,
    // Bends the drawing itself: leaning body, breathing belly, head turning on the neck (mimiRig.js).
    softBody: true,
  },
};

// The kit's own idle quirk classes (fast tail, head tilt, hop) and how long each plays.
const FIDGETS = [["mm-q-wag", 1500], ["mm-q-tilt", 1800], ["mm-q-hop", 600]];
// A pose change is a 130 ms squash and a 420 ms pop; wait it out before reading which pose is showing.
const POSE_SETTLE_MS = 600;
// Talking mouth in the kit's face units, origin at the nose: brown outline, dark mouth, pink tongue. Scaled to match
// the drawing's own open mouth, which is about twice the kit's vector "talk" mouth.
const TALKING_MOUTH = `<g class="mimi-talk" transform="scale(1.45)">
<path d="M0 0 V5" style="fill:none;stroke:#7A3A1C;stroke-width:1.8;stroke-linecap:round"/>
<g class="mimi-jaw"><path d="M-13 5 Q0 27 13 5 Z" style="fill:#9B3B33;stroke:#7A3A1C;stroke-width:1.7;stroke-linejoin:round"/>
<path d="M-6.5 16 Q0 10 6.5 16 Q4.5 21.5 0 21.5 Q-4.5 21.5 -6.5 16 Z" style="fill:#F28C8C"/></g></g>`;

const HOVER_COOLDOWN_MS = 4000;
// Moods where a cheerful reaction would read as not listening.
const QUIET_STATES = new Set(["sad", "error", "warning", "sleep"]);
// play() needs a duration for its last step; the step only has to land, nothing follows it.
const SETTLE_MS = 1;

const between = ([min, max]) => min + Math.random() * (max - min);
const pickFrom = (list) => list[Math.floor(Math.random() * list.length)];

// The charm settings for a variant, or null when it has none or the visitor asked for reduced motion.
export function charmFor(variant) {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return null;
  return CHARMS[variant] || null;
}

function repeatEvery(gapMs, action) {
  let timer;
  const tick = () => {
    action();
    timer = setTimeout(tick, between(gapMs));
  };
  timer = setTimeout(tick, between(gapMs));
  return () => clearTimeout(timer);
}

function flashClass(bot, name, ms) {
  bot.root.classList.add(name);
  setTimeout(() => bot.root?.classList.remove(name), ms);
}


// The 12-pose cat's current pose number, from the kit's mm-pz-N class.
function poseShowing(bot) {
  const poseClass = [...bot.root.classList].find((name) => /^mm-pz-\d+$/.test(name));
  return poseClass ? Number(poseClass.slice("mm-pz-".length)) : null;
}

function fidget(bot, charm, state) {
  const isBusy = bot.playTimer || state === "idle" || QUIET_STATES.has(state);
  if (isBusy || !charm.fidgetPoses.includes(poseShowing(bot))) return;
  if ([...bot.root.classList].some((name) => name.startsWith("mm-q-"))) return;
  const [name, ms] = pickFrom(FIDGETS);
  flashClass(bot, name, ms);
}

// Always-on extras for one mascot, plus a hover reaction when a mouse moves onto its parent. `host` is the element
// the bot draws into; `currentState()` is the state the site asked for, which the hover reaction returns to.
// Returns `perform(steps)` to play a sequence of states, `interrupt()` to cut one short, `isBusy()`, and `stop()`.
export function startCharm(bot, charm, host, currentState) {
  let performing = false;
  let danceTimer;
  // Bounce the whole figure while a pose played here is showing one of the dance states; the site's own states
  // (a "greet" card on the About page, say) stay still. The bounce starts once the kit's pose change has popped in,
  // so it never stacks on the squash of the outgoing pose.
  const setDancing = (isDancing) => {
    clearTimeout(danceTimer);
    if (isDancing) danceTimer = setTimeout(() => { host.dataset.dance = "on"; }, POSE_SETTLE_MS);
    else delete host.dataset.dance;
  };
  const followState = (state) => setDancing(performing && Boolean(charm.danceStates?.includes(state)));
  const finish = () => {
    performing = false;
    setDancing(false);
    // The kit's play() leaves its timer set after the last step, and its own idle quirks skip while that timer is
    // set: without this, the first pose played here would silence the kit's hops, tail wags and head tilts for good.
    bot.stop();
  };
  const perform = (steps) => {
    performing = true;
    bot.play(steps);
  };
  bot.on("state", followState);
  bot.on("playend", finish);

  const stopFidgets = charm.fidgetPoses ? repeatEvery(charm.fidgetGapMs, () => fidget(bot, charm, currentState())) : null;

  let lastHover = 0;
  const react = (event) => {
    const state = currentState();
    if (event.pointerType !== "mouse" || QUIET_STATES.has(state) || Date.now() - lastHover < HOVER_COOLDOWN_MS) return;
    lastHover = Date.now();
    perform([...charm.hover, [state, SETTLE_MS]]);
  };
  const hoverTarget = host.parentElement;
  hoverTarget?.addEventListener("pointerenter", react);

  return {
    perform,
    interrupt: finish,
    isBusy: () => Boolean(bot.playTimer),
    stop() {
      clearTimeout(danceTimer);
      bot.off("state", followState);
      bot.off("playend", finish);
      stopFidgets?.();
      hoverTarget?.removeEventListener("pointerenter", react);
    },
  };
}

// While the site says she is talking, cover the drawing's still mouth with the kit's own mouth patch (the mm-vmouth
// class shows it) and draw a mouth that opens and closes on top. The kit repaints the face on the next state, which
// removes this mouth and resets the patch.
export function startTalkingMouth(bot) {
  let mouth = null;
  const timer = setTimeout(() => {
    const geo = window.MIMI_ASSETS.POSE_GEO[poseShowing(bot)];
    if (!geo?.hasMouth) return;
    const [noseX, noseY] = geo.nose;
    bot.root.classList.add("mm-vmouth");
    bot.svg.querySelector(".mm-face")?.insertAdjacentHTML("beforeend", `<g class="mimi-talking" transform="${geo.face}"><g transform="translate(${noseX} ${noseY})">${TALKING_MOUTH}</g></g>`);
    mouth = bot.svg.querySelector(".mimi-talking");
  }, POSE_SETTLE_MS);
  return () => {
    clearTimeout(timer);
    mouth?.remove();
  };
}

// While idle, strike a cute pose every few seconds and settle back to idle. `control` is what startCharm returned.
export function startIdleGestures(control, charm) {
  const stop = repeatEvery(charm.gestureGapMs, () => {
    // A hover wave may be playing; let it finish.
    if (control.isBusy()) return;
    control.perform([[pickFrom(charm.gestures), charm.gestureMs], ["idle", SETTLE_MS]]);
  });
  return () => {
    stop();
    control.interrupt();
  };
}
