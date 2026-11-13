/* mimi-bot.js – Mimi (LaLaHome), mèo chữ L ghép mảng vải & giấy. Đóng gói từ LaLaHome/src. */
(() => {
  // g:assets
  var A = window.MIMI_ASSETS;
  if (!A) throw new Error("C\u1EA7n n\u1EA1p mimi-svg.js tr\u01B0\u1EDBc mimi-bot.js");
  var { BADGES, CHUBBY_ART_REF, CHUBBY_FACE, CHUBBY_HATS, CHUBBY_SUIT, CHUBBY_WOOL, DECOR, EAR_FRAMES, EYEWEAR, FX, GEO, HAND, HATS, ITEMS, LEG_FRAMES, MIMI_DEFAULT_COLORS, POSE_GEO, POSE_REF, SCARF, STAND_ART_REF, STAND_SUIT, STATE_COLORS, SUIT, VARIANT_GEO, banner, buildChubbyFace, buildChubbySVG, buildFace, buildPoseSVG, buildSVG, buildStandSVG, chubbyVectorEyes, darken, deriveColors, hexToRgb, lighten, mix } = A;

  // ../LaLaHome/src/mimi-engine.js
  var G = { talk: "H\u1ED9i tho\u1EA1i", emo: "C\u1EA3m x\xFAc", sys: "H\u1EC7 th\u1ED1ng", time: "Th\u1EDDi gian trong ng\xE0y" };
  var STATES = {
    idle: { label: "M\u1EB7c \u0111\u1ECBnh", group: G.talk, trigger: "M\u1EDF trang / ch\u1EDD", color: "brand", face: { eyes: "open", mouth: "w" }, anim: "breathe", k: "dots", b: "Meo~ Mimi gi\xFAp g\xEC cho b\u1EA1n n\xE8?", pro: "T\xF4i c\xF3 th\u1EC3 h\u1ED7 tr\u1EE3 g\xEC cho b\u1EA1n?", play: { t: "Mua g\xEC n\xF3i l\u1EB9 nha b\u1EA1n \xEAy!", face: { eyes: "dong", mouth: "smirk" }, fx: "coin" }, wish: "CUNG CH\xDAC T\xC2N XU\xC2N" },
    greet: { label: "Ch\xE0o h\u1ECFi", group: G.talk, trigger: "findy.open()", color: "brand", face: { eyes: "happy", mouth: "open" }, anim: "bounce", item: "_wave", k: "heart", b: "Xin ch\xE0o! Meo~", pro: "Ch\xE0o b\u1EA1n!", fx: "heart", every: 900, play: { t: "H\u1EBF l\xF4 c\u01B0ng! Mimi n\xE8", face: { eyes: "heart", eyesR: "happy", mouth: "kiss" }, fx: "heart" }, wish: "CH\xDAC M\u1EEANG N\u0102M M\u1EDAI" },
    listening: { label: "L\u1EAFng nghe", group: G.talk, trigger: "Ng\u01B0\u1EDDi d\xF9ng \u0111ang g\xF5", color: "info", face: { eyes: "open", mouth: "smile", brow: "up" }, anim: "tilt", ear: true, k: "mic", pro: "\u0110ang l\u1EAFng nghe\u2026", fx: "note", every: 700, play: { t: "N\xF3i g\xEC c\u01A1? Meo?", face: { eyes: "big", eyesR: "tiny", mouth: "o" }, fx: "q" }, wish: "L\u1EAENG NGHE L\u1EDCI CH\xDAC" },
    thinking: { label: "Suy ngh\u0129", group: G.talk, trigger: "G\u1EEDi c\xE2u h\u1ECFi", color: "purple", face: { eyes: "up", mouth: "side", brow: "think" }, anim: "sway", k: "cloud", pro: "\u0110ang ph\xE2n t\xEDch y\xEAu c\u1EA7u", play: { t: "\u0110\u1EE3i x\xEDu nha b\u1EA1n \xEAy!", face: { eyes: "up", mouth: "hum" } }, wish: "T\xCDNH \u0110\xC2U TR\xDANG \u0110\xD3" },
    searching: { label: "T\xECm ki\u1EBFm", group: G.talk, trigger: "G\u1ECDi API t\xECm ki\u1EBFm", color: "info", face: { eyes: "look", mouth: "flat" }, anim: "scan", item: "magnifier", k: "search", pro: "\u0110ang tra c\u1EE9u d\u1EEF li\u1EC7u", play: { t: "\u1EDE \u0111\xE2u\u2026 \u1EDF \u0111\xE2u\u2026 aaa\u2026 \u1EDF \u0111\xE2u r\u1ED3i", face: { eyes: "big", mouth: "shout", sweat: 1 }, fx: "drop", anim: "shake" }, wish: "T\xCCM L\u1ED8C \u0110\u1EA6U XU\xC2N" },
    processing: { label: "\u0110ang x\u1EED l\xFD", group: G.talk, trigger: "Ch\u1EDD k\u1EBFt qu\u1EA3", color: "info", face: { eyes: "half", mouth: "flat" }, anim: "nod", k: "spin", pro: "\u0110ang x\u1EED l\xFD\u2026", play: { t: "Lag qu\xE1 b\u1EA1n \xEAy!", face: { eyes: "spiral", eyesR: "pixel", mouth: "wave" }, anim: "glitch" }, wish: "L\u1ED8C \u0110ANG V\u1EC0..." },
    talking: { label: "\u0110ang tr\u1EA3 l\u1EDDi", group: G.talk, trigger: "Tr\u1EA3 l\u1EDDi t\u1EEBng ch\u1EEF", color: "brand", face: { eyes: "open", mouth: "talk" }, anim: "nod", k: "lines", pro: "\u0110ang so\u1EA1n c\xE2u tr\u1EA3 l\u1EDDi", play: { t: "meo\u2026 meo\u2026 bla\u2026 bla\u2026", face: { eyes: "happy", mouth: "talk" } }, wish: "L\u1EDCI HAY \xDD \u0110\u1EB8P" },
    happy: { label: "Vui v\u1EBB", group: G.emo, trigger: "Ph\u1EA3n h\u1ED3i t\xEDch c\u1EF1c", color: "orange", thumb: true, face: { eyes: "happy", mouth: "open" }, anim: "bounce", fx: "sparkle", every: 600, b: "Vui qu\xE1 \u0111i!", pro: "R\u1EA5t vui \u0111\u01B0\u1EE3c h\u1ED7 tr\u1EE3 b\u1EA1n!", play: { t: "Vui gh\xEA!" }, wish: "V\u1EA0N S\u1EF0 NH\u01AF \xDD" },
    love: { label: "Y\xEAu th\xEDch", group: G.emo, trigger: "findy.thanks()", color: "pink", face: { eyes: "heart", mouth: "smile" }, anim: "bounce", item: "heartpaper", fx: "heart", every: 450, b: "Th\u01B0\u01A1ng b\u1EA1n nhi\u1EC1u l\u1EAFm!", pro: "C\u1EA3m \u01A1n b\u1EA1n r\u1EA5t nhi\u1EC1u!", play: { t: "B\u1EAFn Tym", fx: "heart" }, wish: "T\u1EBET SUM V\u1EA6Y" },
    wink: { label: "Nh\xE1y m\u1EAFt", group: G.emo, trigger: "G\u1EE3i \xFD / b\xED m\u1EADt", color: "pink", face: { eyes: "open", eyesR: "happy", mouth: "tongue" }, anim: "tilt", fx: "star", every: 900, b: "B\xED m\u1EADt nha!", pro: "M\u1ED9t m\u1EB9o nh\u1ECF cho b\u1EA1n", play: { t: "Hi\u1EC3u \xFD ch\u01B0a?" }, wish: "L\xCC X\xCC B\u1EA4T NG\u1EDC!" },
    surprised: { label: "Ng\u1EA1c nhi\xEAn", group: G.emo, trigger: "K\u1EBFt qu\u1EA3 b\u1EA5t ng\u1EDD", color: "yellow", face: { eyes: "big", mouth: "o", brow: "up" }, anim: "jump", fx: "ex", every: 800, b: "\u01A0 k\xECa!", pro: "\u1ED2, th\u1EADt b\u1EA5t ng\u1EDD!", play: { t: "\u1EE6a alo?!" }, wish: "H\u1ECEI L\u1EA0I \u0110\u1EA6U XU\xC2N NH\xC9" },
    confused: { label: "B\u1ED1i r\u1ED1i", group: G.emo, trigger: "C\xE2u h\u1ECFi ch\u01B0a r\xF5", color: "purple", face: { eyes: "open", eyesR: "tiny", mouth: "wave", brow: "worry" }, anim: "tilt", fx: "q", every: 800, b: "Mimi ch\u01B0a hi\u1EC3u l\u1EAFm\u2026", pro: "B\u1EA1n c\xF3 th\u1EC3 n\xF3i r\xF5 h\u01A1n kh\xF4ng?", play: { t: "H\u1EA3? G\xEC d\u1EE3?" }, wish: "H\u1EBET XUI T\u1EDAI H\xCAN" },
    sad: { label: "Bu\u1ED3n", group: G.emo, trigger: "findy.noResult()", color: "night", face: { eyes: "sad", mouth: "sad", tear: 1, brow: "worry" }, anim: "droop", fx: "drop", every: 900, b: "Ti\u1EBFc qu\xE1, ch\u01B0a t\xECm th\u1EA5y\u2026", pro: "R\u1EA5t ti\u1EBFc, ch\u01B0a c\xF3 k\u1EBFt qu\u1EA3 ph\xF9 h\u1EE3p", play: { t: "Huhu x\u1EC9u ngang" }, wish: "TH\u1EEC L\u1EA0I L\xC0 PH\xC1T T\xC0I" },
    info: { label: "Th\xF4ng tin", group: G.sys, trigger: "Th\xF4ng b\xE1o", color: "info", face: { eyes: "open", mouth: "smile" }, anim: "breathe", badge: "info", b: "Mimi c\xF3 tin m\u1EDBi cho b\u1EA1n", pro: "Th\xF4ng tin d\xE0nh cho b\u1EA1n", play: { t: "H\xF3ng n\xE8!" }, wish: "XIN CH\u1EEE \u0110\u1EA6U XU\xC2N" },
    success: { label: "Th\xE0nh c\xF4ng", group: G.sys, trigger: "findy.done()", color: "green", thumb: true, face: { eyes: "happy", mouth: "open" }, anim: "jump", badge: "success", fx: "check", every: 900, b: "Xong r\u1ED3i n\xE8!", pro: "Ho\xE0n t\u1EA5t th\xE0nh c\xF4ng", play: { t: "Slay!" }, wish: "M\xC3 \u0110\xC1O TH\xC0NH C\xD4NG" },
    request: { label: "Y\xEAu c\u1EA7u", group: G.sys, trigger: "findy.confirm()", color: "orange", face: { eyes: "open", mouth: "smile", brow: "up" }, anim: "nod", item: "clipboard", badge: "request", b: "B\u1EA1n x\xE1c nh\u1EADn gi\xFAp Mimi nha", pro: "Vui l\xF2ng x\xE1c nh\u1EADn th\xF4ng tin", play: { t: "Ch\u1ED1t \u0111\u01A1n h\xF4ng?" }, wish: "M\u1ED8T HAI BA DZ\xD4!" },
    warning: { label: "C\u1EA3nh b\xE1o", group: G.sys, trigger: "findy.warn()", color: "yellow", face: { eyes: "open", mouth: "flat", brow: "angry" }, anim: "shake", badge: "warning", wave: true, b: "L\u01B0u \xFD nh\xE9!", pro: "C\u1EA3nh b\xE1o: vui l\xF2ng ki\u1EC3m tra", play: { t: "Khoan \u0111\xE3 b\u1EA1n \xEAy!" }, wish: "C\u1EA8N T\u1EAEC V\xD4 \xC1Y N\xC1Y" },
    error: { label: "L\u1ED7i", group: G.sys, trigger: "findy.fail()", color: "red", face: { eyes: "x", mouth: "wave", brow: "worry" }, anim: "shake", badge: "error", pulse: true, b: "\u1ED0i, c\xF3 l\u1ED7i r\u1ED3i!", pro: "\u0110\xE3 x\u1EA3y ra l\u1ED7i, vui l\xF2ng th\u1EED l\u1EA1i", play: { t: "Toang r\u1ED3i b\u1EA1n \xEAy!" }, wish: "H\u1EBET XUI T\u1EDAI H\xCAN" },
    trash: { label: "B\u1ECF s\u1ECDt r\xE1c", group: G.sys, trigger: "Xo\xE1 m\u1EE5c", color: "wine", face: { eyes: "closed", mouth: "flat" }, anim: "nod", badge: "trash", fx: "paperball", every: 1100, b: "\u0110\xE3 b\u1ECF v\xE0o s\u1ECDt r\xE1c", pro: "\u0110\xE3 xo\xE1 m\u1EE5c n\xE0y", play: { t: "Bye bye nha!" }, wish: "TI\u1EC0N V\xD4 NH\u01AF N\u01AF\u1EDAC" },
    party: { label: "\u0102n m\u1EEBng t\u01B0ng b\u1EEBng", group: G.sys, trigger: "S\u1EF1 ki\u1EC7n l\u1EDBn", color: "party", face: { eyes: "star", mouth: "open" }, anim: "jump", fx: "confetti", every: 160, b: "Qu\u1EA9y l\xEAn n\xE0o!", pro: "Ch\xFAc m\u1EEBng b\u1EA1n!", play: { t: "Qu\u1EA9y l\xEAn!!!" }, wish: "NGH\u1EC8 T\u1EBET TH\xD4I!" },
    sleep: { label: "Ch\u1EDD l\xE2u / ng\u1EE7", group: G.sys, trigger: "Kh\xF4ng t\u01B0\u01A1ng t\xE1c", color: "wait", face: { eyes: "closed", mouth: "zz" }, anim: "droop", fx: "z", every: 1100, k: "zzz", b: "Zzz\u2026", pro: "\u0110ang ch\u1EDD\u2026", play: { t: "chill\u2026 x\u1EC9u\u2026" }, wish: "NG\u1EE6 NGON \u0110\xCAM XU\xC2N" },
    midnight: { label: "00:00 N\u1EEDa \u0111\xEAm", group: G.time, time: "00:00", color: "night", face: { eyes: "closed", mouth: "zz" }, anim: "droop", hat: "nightcap", tl: "moon", fx: "z", every: 1100, b: "Ng\u1EE7 say\u2026", wish: "GIAO TH\u1EEAA AN L\xC0NH" },
    dream: { label: "02:00 Ng\u1EE7 m\u01A1", group: G.time, time: "02:00", color: "night", face: { eyes: "closed", mouth: "smile" }, anim: "float", hat: "nightcap", tl: "moon", fx: "fish", every: 1e3, k: "dream", b: "M\u01A1 th\u1EA5y c\xE1\u2026", wish: "TH\u1EE8C \u0110\xD3N GIAO TH\u1EEAA" },
    meditate: { label: "04:00 Thi\u1EC1n s\u1EDBm", group: G.time, time: "04:00", color: "purple", face: { eyes: "closed", mouth: "smile" }, anim: "float", fx: "om", every: 1200, b: "H\xEDt v\xE0o\u2026 th\u1EDF ra\u2026", wish: "T\u0128NH T\xC2M \u0110\xD3N XU\xC2N" },
    dawn: { label: "06:00 T\u1EADp th\u1EC3 d\u1EE5c", group: G.time, time: "06:00", color: "orange", face: { eyes: "flat", mouth: "open", sweat: 1, brow: "angry" }, anim: "bounce", hat: "headband", item: "dumbbell", handAnim: "lift", tl: "sun", b: "M\u1ED9t, hai, ba, b\u1ED1n!", wish: "X\xD4NG \u0110\u1EA4T \u0110\u1EA6U N\u0102M" },
    morning: { label: "08:00 C\xE0 ph\xEA & b\xE1nh m\xEC", group: G.time, time: "08:00", color: "orange", face: { eyes: "happy", mouth: "smile" }, anim: "breathe", item: "phin", tl: "sun", b: "C\xE0 ph\xEA s\u1EEFa \u0111\xE1 n\xE8!", wish: "S\xC1NG XU\xC2N AN L\xC0NH" },
    work: { label: "10:00 L\xE0m vi\u1EC7c", group: G.time, time: "10:00", color: "info", face: { eyes: "look", mouth: "flat" }, anim: "nod", item: "laptop", front: true, eyewear: "reading", b: "T\u1EADp trung l\xE0m vi\u1EC7c", wish: "KHAI B\xDAT \u0110\u1EA6U N\u0102M" },
    noon: { label: "12:00 \u0102n tr\u01B0a", group: G.time, time: "12:00", color: "orange", face: { eyes: "happy", mouth: "open" }, anim: "bounce", item: "bento", tl: "sun", b: "C\u01A1m tr\u01B0a ngon qu\xE1!", wish: "M\xC2M C\u1ED6 NG\xC0Y T\u1EBET" },
    afternoon: { label: "14:00 H\u1ECDp online", group: G.time, time: "14:00", color: "info", face: { eyes: "open", mouth: "talk" }, anim: "nod", hat: "headset", tl: "cloud", b: "M\u1ECDi ng\u01B0\u1EDDi nghe r\xF5 kh\xF4ng?", wish: "\u0110I CH\xDAC T\u1EBET TH\xD4I" },
    teatime: { label: "16:00 Tr\xE0 s\u1EEFa", group: G.time, time: "16:00", color: "pink", face: { eyes: "happy", mouth: "w" }, anim: "sway", item: "milktea", tl: "cloud", b: "Tr\xE0 s\u1EEFa tr\xE2n ch\xE2u!", wish: "TR\xC0 XU\xC2N \u1EA4M \xC1P" },
    sunset: { label: "18:00 C\u01A1m t\u1ED1i", group: G.time, time: "18:00", color: "orange", face: { eyes: "heart", mouth: "tongue" }, anim: "bounce", item: "fishplate", tl: "sun", b: "T\u1ED1i nay c\xF3 c\xE1!", wish: "CHI\u1EC0U XU\xC2N AN Y\xCAN" },
    evening: { label: "20:00 \u0110\u1ECDc s\xE1ch", group: G.time, time: "20:00", color: "night", face: { eyes: "half", mouth: "smile" }, anim: "breathe", item: "book", eyewear: "reading", tl: "moon", b: "\u0110\u1ECDc th\xEAm v\xE0i trang\u2026", wish: "SUM H\u1ECCP \u0110\xCAM XU\xC2N" },
    night: { label: "22:00 Xem phim", group: G.time, time: "22:00", color: "night", face: { eyes: "big", mouth: "open" }, anim: "breathe", item: "popcorn", eyewear: "glasses3d", tl: "moon", b: "Phim hay qu\xE1!", wish: "GIAO TH\u1EEAA AN L\xC0NH" }
  };
  var PERSONAS = { friendly: { label: "Th\xE2n thi\u1EC7n" }, pro: { label: "Chuy\xEAn nghi\u1EC7p" }, premier: { label: "Premier" }, playful: { label: "Tinh ngh\u1ECBch" } };
  var VARIANTS = { pose: { label: "M\xE8o \xFA 12 t\u01B0 th\u1EBF" }, stand: { label: "M\xE8o \u0111\u1EE9ng" }, chubby: { label: "M\xE8o ng\u1ED3i" }, L: { label: "Ch\u1EEF L" }, LH: { label: "Ch\u1EEF L + nh\xE0 H" } };
  var PHOTO = (v) => v === "chubby" || v === "stand" || v === "pose";
  var POSE_OF = {
    idle: 1,
    listening: 1,
    talking: 1,
    warning: 1,
    greet: 2,
    thinking: 3,
    confused: 3,
    searching: 3,
    processing: 3,
    wink: 4,
    dawn: 4,
    happy: 5,
    success: 5,
    surprised: 6,
    morning: 7,
    work: 7,
    noon: 7,
    afternoon: 7,
    teatime: 7,
    sunset: 7,
    evening: 7,
    night: 7,
    info: 8,
    request: 8,
    love: 9,
    meditate: 9,
    sleep: 10,
    midnight: 10,
    dream: 10,
    sad: 11,
    error: 11,
    trash: 11,
    party: 12
  };
  var POSE_BASE = { zones: { tl: [40, 44], l: [30, 250], bl: [34, 352], r: [366, 300] }, badge: [340, 112], inhand: true };
  var VECTOR_EYES = { sad: 1, x: 1, big: 1, heart: 1, star: 1, spiral: 1, dong: 1, pixel: 1 };
  var VECTOR_MOUTH = { o: 1, sad: 1, shout: 1, wave: 1 };
  var GESTURE = {
    greet: "wave",
    happy: "cheer",
    success: "cheer",
    party: "cheer",
    love: "hug",
    wink: "hug",
    thinking: "tap",
    processing: "tap",
    listening: "tap",
    talking: "talk",
    searching: "tap",
    sad: "droop",
    sleep: "droop",
    error: "droop",
    trash: "droop",
    midnight: "droop",
    dream: "droop",
    meditate: "hug",
    surprised: "up",
    warning: "up",
    confused: "tap",
    dawn: "cheer",
    noon: "cheer",
    sunset: "hug"
  };
  var STEPS = { happy: "step", success: "step", party: "step", dawn: "step", greet: "step", surprised: "hop", warning: "hop" };
  var COSPLAYS = { bebe: { label: "C\u1EEBu Bebe" }, glass: { label: "Th\xE2n k\xEDnh" } };
  var SEASONS = {
    spring: { label: "Xu\xE2n", hat: "flowercrown", item: "pinwheel", particle: "petal", top: ["bee", "butterfly"], bottom: ["daisies", "butterfly"] },
    summer: { label: "H\u1EA1", eyewear: "sunglasses", item: "coconut", top: ["sun", "cloud"], bottom: ["ball", "ice"] },
    autumn: { label: "Thu", hat: "nonla", item: "teacup", particle: "leaf", top: ["cloud", "maple"], bottom: ["maple", "maple"] },
    winter: { label: "\u0110\xF4ng", hat: "santa", scarf: true, item: "candycane", particle: "snow", top: ["cloud", "giftround"], bottom: ["gift", "giftround"] }
  };
  var FESTIVALS = {
    tet: { label: "T\u1EBFt", item: "lixi", banner: "tet", top: ["fireworks", "mai"], bottom: ["banhchung", "dao"] },
    midautumn: { label: "Trung thu", item: "starlantern", top: ["fullmoon", "lantern"], bottom: ["mooncake", "carp"] },
    halloween: { label: "Halloween", hat: "witch", item: "pumpkin", top: ["moon", "bat"], bottom: ["pumpkins", "bat"] },
    sale: { label: "Sale", item: "shopbag", banner: "sale", top: ["dealbadge", "giftround"], bottom: ["gift", "giftround"] }
  };
  var SALE_TEXT = ["GI\u1EA2M GI\xC1", "\u01AFU \u0110\xC3I", "S\u0102N DEAL NGAY"];
  var PREMIER = {
    "--mm-p0": "#FF66C4",
    "--mm-p1": "#FF0099",
    "--mm-p": "#6F2A62",
    "--mm-p2": "#4A0084",
    "--mm-p3": "#30005A",
    "--mm-f0": "#FFB8E0",
    "--mm-f1": "#F05AB4",
    "--mm-f": "#D63C9E",
    "--mm-f2": "#A82A7C",
    "--mm-f3": "#7A1C5A",
    "--mm-a0": "#F6DA4E",
    "--mm-a1": "#ECB339",
    "--mm-a": "#DAA730",
    "--mm-a2": "#CC8D19",
    "--mm-a3": "#9C6A10",
    "--mm-hi": "#C27AB4",
    "--mm-stitch": "#F6DA4E",
    "--mm-stitchd": "#CC8D19"
  };
  var GLASS = {
    "--mm-p0": "#FFFFFF",
    "--mm-p1": "#F1F9FF",
    "--mm-p": "#D4EBFB",
    "--mm-p2": "#B2D6EF",
    "--mm-p3": "#8FBCDD",
    "--mm-f0": "#FFFFFF",
    "--mm-f1": "#E6F4FE",
    "--mm-f": "#C7E3F7",
    "--mm-f2": "#A6CDEA",
    "--mm-f3": "#86B4D6",
    "--mm-hi": "#FFFFFF",
    "--mm-stitch": "#FFFFFF",
    "--mm-stitchd": "#A6CDEA"
  };
  var GOLD = ["#F6DA4E", "#DAA730", "#CC8D19"];
  var CUTE = {
    love: { eyes: "sparkle" },
    happy: { puff: true },
    wink: { eyes: "sparkle", eyesR: "happy" },
    sad: { eyes: "sad" },
    sleep: { bubble: true },
    midnight: { bubble: true },
    teatime: { puff: true },
    success: { puff: true }
  };
  var EARS = {
    sad: "down",
    sleep: "down",
    midnight: "down",
    dream: "down",
    meditate: "down",
    trash: "down",
    surprised: "up",
    listening: "up",
    warning: "up",
    searching: "up",
    afternoon: "up",
    confused: "side",
    thinking: "side",
    error: "back",
    processing: "back"
  };
  var QUIRKS = ["slow", "cat3", "curious", "lick"];
  var EAR_FRAME = { down: "d2", back: "d2", up: "up", side: "fr" };
  var PREMIER_CHUBBY = {
    "--mm-f0": "#FF66C4",
    "--mm-f1": "#FF0099",
    "--mm-f": "#6F2A62",
    "--mm-f2": "#4A0084",
    "--mm-f3": "#30005A",
    "--mm-a0": "#F6DA4E",
    "--mm-a1": "#ECB339",
    "--mm-a": "#DAA730",
    "--mm-a2": "#CC8D19",
    "--mm-a3": "#9C6A10"
  };
  var CSS = `
.mm-root{position:relative;width:100%;aspect-ratio:400/410;font-family:Roboto,system-ui,-apple-system,"Segoe UI",Arial,sans-serif;user-select:none;-webkit-user-select:none;line-height:1.2}
.mm-root .mm-svg{position:absolute;inset:0;width:100%;height:100%;overflow:visible}
.mm-blink,.mm-pulse,.mm-spin,.mm-spinfast,.mm-spinslow,.mm-jaw,.mm-tear,.mm-sweat,.mm-tip,.mm-ear-l,.mm-ear-r,.mm-antenna,.mm-bell,.mm-scan,.mm-swing,.mm-glow,.mm-flutter,.mm-wobble,.mm-burst,.mm-lid,.mm-badge,.mm-badge-pulse,.mm-ring,.mm-look,.mm-drift,.mm-flyby{transform-box:fill-box}
.mm-bob{transform-box:view-box;transform-origin:236px 392px}
.mm-a-breathe .mm-bob{animation:mm-breathe 3.2s ease-in-out infinite}
.mm-a-bounce .mm-bob{animation:mm-bounce .62s ease-in-out infinite}
.mm-a-jump .mm-bob{animation:mm-jump 1.1s cubic-bezier(.3,.6,.4,1) infinite}
.mm-a-tilt .mm-bob{animation:mm-tilt 2.2s ease-in-out infinite}
.mm-a-sway .mm-bob{animation:mm-sway 3s ease-in-out infinite}
.mm-a-shake .mm-bob{animation:mm-shake .32s linear infinite}
.mm-a-droop .mm-bob{animation:mm-droop 3.6s ease-in-out infinite}
.mm-a-float .mm-bob{animation:mm-float 3s ease-in-out infinite}
.mm-a-scan .mm-bob{animation:mm-scan 1.8s ease-in-out infinite}
.mm-a-nod .mm-bob{animation:mm-nod 1.1s ease-in-out infinite}
.mm-a-glitch .mm-bob{animation:mm-glitch .9s steps(2) infinite}
.mm-spinning .mm-bob{animation:mm-spin360 .9s cubic-bezier(.4,1.4,.5,1) 1 !important}
@keyframes mm-breathe{0%,100%{transform:scale(1,1)}50%{transform:scale(1.012,.985)}}
@keyframes mm-bounce{0%,100%{transform:translateY(0) scale(1,1)}45%{transform:translateY(calc(var(--mm-e)*-12px)) scale(.99,1.02)}80%{transform:translateY(0) scale(1.03,.97)}}
@keyframes mm-jump{0%,100%{transform:translateY(0) scale(1,1)}12%{transform:translateY(0) scale(1.05,.93)}40%{transform:translateY(calc(var(--mm-e)*-30px)) scale(.97,1.04)}70%{transform:translateY(0) scale(1.04,.95)}82%{transform:translateY(0) scale(1,1)}}
@keyframes mm-tilt{0%,100%{transform:rotate(0)}30%{transform:rotate(calc(var(--mm-e)*-5deg))}70%{transform:rotate(calc(var(--mm-e)*3deg))}}
@keyframes mm-sway{0%,100%{transform:rotate(calc(var(--mm-e)*-2.5deg))}50%{transform:rotate(calc(var(--mm-e)*2.5deg))}}
@keyframes mm-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(calc(var(--mm-e)*-5px)) rotate(-1deg)}75%{transform:translateX(calc(var(--mm-e)*5px)) rotate(1deg)}}
@keyframes mm-droop{0%,100%{transform:translateY(4px) scale(1.02,.97)}50%{transform:translateY(7px) scale(1.035,.955)}}
@keyframes mm-float{0%,100%{transform:translateY(0)}50%{transform:translateY(calc(var(--mm-e)*-14px))}}
@keyframes mm-scan{0%,100%{transform:translateX(0) rotate(0)}30%{transform:translateX(calc(var(--mm-e)*-6px)) rotate(-2deg)}70%{transform:translateX(calc(var(--mm-e)*6px)) rotate(2deg)}}
@keyframes mm-nod{0%,100%{transform:translateY(0)}50%{transform:translateY(3px) scale(1.01,.99)}}
@keyframes mm-glitch{0%{transform:translate(0)}20%{transform:translate(-4px,1px) skewX(4deg)}40%{transform:translate(3px,-2px)}60%{transform:translate(-2px,0) skewX(-5deg)}80%{transform:translate(4px,2px)}100%{transform:translate(0)}}
@keyframes mm-spin360{0%{transform:rotate(0) scale(1)}50%{transform:rotate(180deg) scale(.9)}100%{transform:rotate(360deg) scale(1)}}
.mm-blink{animation:mm-blink 4.6s infinite;transform-box:fill-box;transform-origin:center}
@keyframes mm-blink{0%,93%,100%{transform:scaleY(1)}95.5%{transform:scaleY(.1)}}
.mm-look{animation:mm-look 1.8s ease-in-out infinite}
@keyframes mm-look{0%,100%{transform:translateX(-5px)}50%{transform:translateX(5px)}}
.mm-pulse{animation:mm-pulse .7s ease-in-out infinite;transform-origin:center}
@keyframes mm-pulse{50%{transform:scale(1.2)}}
.mm-spin{animation:mm-spin 1.4s linear infinite;transform-origin:center}
.mm-spinfast{animation:mm-spin .9s linear infinite;transform-origin:center}
.mm-spinslow{animation:mm-spin 14s linear infinite;transform-origin:center}
@keyframes mm-spin{to{transform:rotate(360deg)}}
.mm-jaw{animation:mm-jaw .26s ease-in-out infinite alternate}
@keyframes mm-jaw{from{transform:scaleY(.25)}to{transform:scaleY(1)}}
.mm-tear{animation:mm-tear 1.4s ease-in infinite}
@keyframes mm-tear{0%{transform:translateY(0) scale(.6)}70%{transform:translateY(14px) scale(1)}100%{transform:translateY(20px) scale(0)}}
.mm-sweat{animation:mm-tear 1s ease-in infinite}
.mm-tip{animation:mm-tip 2.6s ease-in-out infinite;transform-origin:center}
@keyframes mm-tip{0%,100%{transform:rotate(-14deg)}50%{transform:rotate(14deg)}}
.mm-ear-r{transform-origin:50% 100%;animation:mm-ear 5s ease-in-out infinite}
.mm-ear-twitch .mm-ear-l,.mm-ear-twitch .mm-ear-r{transform-origin:50% 100%;animation:mm-ear 1s ease-in-out infinite}
@keyframes mm-ear{0%,88%,100%{transform:rotate(0)}92%{transform:rotate(-9deg)}96%{transform:rotate(6deg)}}
.mm-antenna{transform-origin:50% 100%;animation:mm-ant 3s ease-in-out infinite}
@keyframes mm-ant{0%,100%{transform:rotate(-4deg)}50%{transform:rotate(4deg)}}
.mm-bell{transform-origin:50% 0;animation:mm-bell 1.6s ease-in-out infinite}
@keyframes mm-bell{0%,100%{transform:rotate(-10deg)}50%{transform:rotate(10deg)}}
/* ---- M\xE8o \xFA: l\xF4ng chuy\u1EC3n \u0111\u1ED9ng m\u01B0\u1EE3t ---- */
.mm-hold-r .mm-arm-r,.mm-thumb-on .mm-arm-l{display:none}
.mm-p-pro .mm-sleeve{stroke:var(--mm-d1) !important}
.mm-ctail{transform-box:view-box;transform-origin:296px 342px;animation:mm-ctail 3.2s cubic-bezier(.45,0,.55,1) infinite}
.mm-ctail2{transform-box:view-box;transform-origin:372px 300px;animation:mm-ctail2 3.2s cubic-bezier(.45,0,.55,1) -.45s infinite}
@keyframes mm-ctail{0%,100%{transform:rotate(-5deg)}50%{transform:rotate(6deg)}}
@keyframes mm-ctail2{0%,100%{transform:rotate(-7deg)}50%{transform:rotate(9deg)}}
.mm-a-bounce .mm-ctail,.mm-a-jump .mm-ctail{animation-duration:1.1s}
.mm-a-bounce .mm-ctail2,.mm-a-jump .mm-ctail2{animation-duration:1.1s}
.mm-a-droop .mm-ctail,.mm-a-droop .mm-ctail2{animation-duration:5.5s}
.mm-tuft{transform-box:fill-box;transform-origin:50% 100%;animation:mm-tuft 2.4s ease-in-out infinite}
.mm-tuft-b{animation-duration:2.8s;animation-delay:-.7s}
.mm-tuft-c{animation-duration:3.1s;animation-delay:-1.3s}
@keyframes mm-tuft{0%,100%{transform:rotate(-7deg) scaleY(.96)}50%{transform:rotate(7deg) scaleY(1.05)}}
.mm-cheekfur-l,.mm-cheekfur-r{transform-box:fill-box;animation:mm-cheek 2.6s ease-in-out infinite}
.mm-cheekfur-l{transform-origin:100% 50%}
.mm-cheekfur-r{transform-origin:0 50%;animation-delay:-1.1s}
@keyframes mm-cheek{0%,100%{transform:rotate(-3deg) scaleX(1)}50%{transform:rotate(3deg) scaleX(1.06)}}
.mm-whisk-l,.mm-whisk-r{transform-box:fill-box;animation:mm-whisk 4.2s ease-in-out infinite}
.mm-whisk-l{transform-origin:100% 50%}
.mm-whisk-r{transform-origin:0 50%;animation-delay:-.6s}
@keyframes mm-whisk{0%,80%,100%{transform:rotate(0)}86%{transform:rotate(-6deg)}92%{transform:rotate(4deg)}}
.mm-belly{transform-box:fill-box;transform-origin:50% 100%;animation:mm-belly 3.2s ease-in-out infinite}
@keyframes mm-belly{0%,100%{transform:scale(1,1)}50%{transform:scale(1.025,1.06)}}
.mm-v-chubby .mm-ear-l,.mm-v-chubby .mm-ear-r{animation:none;transform-box:fill-box}
.mm-v-chubby .mm-ear-l{transform-origin:85% 100%}.mm-v-chubby .mm-ear-r{transform-origin:15% 100%}
/* \u0111\u1EA7u t\xE1ch kh\u1ECFi th\xE2n: nghi\xEAng quanh c\u1ED5, m\u1EB7t tr\u01B0\u1EE3t nhanh h\u01A1n vi\u1EC1n \u0111\u1EA7u (gi\u1EA3 quay 3D) */
.mm-headm{transform-box:view-box;transform-origin:182px 246px;animation:mm-htilt 6.4s cubic-bezier(.45,0,.55,1) infinite}
@keyframes mm-htilt{0%,100%{transform:rotate(-2.6deg) translateX(-1px)}50%{transform:rotate(2.6deg) translateX(1px)}}
.mm-facefeat{animation:mm-fturn 6.4s cubic-bezier(.45,0,.55,1) infinite}
.mm-headturn{animation:mm-hturn 6.4s cubic-bezier(.45,0,.55,1) infinite}
@keyframes mm-fturn{0%,100%{transform:translate(-4.5px,.5px)}50%{transform:translate(4.5px,-.5px)}}
@keyframes mm-hturn{0%,100%{transform:translateX(-2px)}50%{transform:translateX(2px)}}
.mm-a-tilt .mm-headm,.mm-q-tilt .mm-headm{animation:mm-htilt2 2.4s cubic-bezier(.45,0,.55,1) infinite}
@keyframes mm-htilt2{0%,100%{transform:rotate(-5deg)}50%{transform:rotate(-2.4deg)}}
.mm-a-sway .mm-headm{animation:mm-htilt3 3s cubic-bezier(.45,0,.55,1) infinite}
@keyframes mm-htilt3{0%,100%{transform:rotate(5deg) translateY(-1px)}50%{transform:rotate(2deg)}}
.mm-a-sway .mm-facefeat{animation:none;transform:translate(5px,-2px)}
.mm-a-droop .mm-headm{animation:mm-hdroop 3.6s ease-in-out infinite}
@keyframes mm-hdroop{0%,100%{transform:rotate(-4deg) translateY(3px)}50%{transform:rotate(-6deg) translateY(5px)}}
.mm-a-shake .mm-headm,.mm-a-glitch .mm-headm{animation:none}
/* tai \u0111i tr\u1EC5 nh\u1ECBp so v\u1EDBi \u0111\u1EA7u */
.mm-earw{transform-box:fill-box;animation:mm-elag 6.4s cubic-bezier(.45,0,.55,1) -.55s infinite}
.mm-earw-l{transform-origin:85% 100%}.mm-earw-r{transform-origin:15% 100%}
@keyframes mm-elag{0%,100%{transform:rotate(2.5deg)}50%{transform:rotate(-2.5deg)}}
.mm-earp{transform-box:fill-box;transition:transform .45s cubic-bezier(.3,1.4,.5,1)}
.mm-earw-l .mm-earp{transform-origin:85% 100%}.mm-earw-r .mm-earp{transform-origin:15% 100%}
.mm-ears-down .mm-earw-l .mm-earp{transform:rotate(-26deg) scaleY(.9)}.mm-ears-down .mm-earw-r .mm-earp{transform:rotate(26deg) scaleY(.9)}
.mm-v-chubby.mm-ears-down .mm-earw-l .mm-earp{transform:rotate(-14deg) scaleY(.95)}.mm-v-chubby.mm-ears-down .mm-earw-r .mm-earp{transform:rotate(14deg) scaleY(.95)}
.mm-v-chubby.mm-ears-up .mm-earw-l .mm-earp{transform:rotate(4deg) scaleY(1.05)}.mm-v-chubby.mm-ears-up .mm-earw-r .mm-earp{transform:rotate(-4deg) scaleY(1.05)}
.mm-v-chubby.mm-ears-side .mm-earw-l .mm-earp{transform:rotate(-6deg)}.mm-v-chubby.mm-ears-side .mm-earw-r .mm-earp{transform:rotate(10deg)}
.mm-v-chubby.mm-ears-back .mm-earw-l .mm-earp{transform:rotate(-20deg) scaleY(.9)}.mm-v-chubby.mm-ears-back .mm-earw-r .mm-earp{transform:rotate(20deg) scaleY(.9)}
/* n\u01A1 \u0111i theo tai ph\u1EA3i nh\u01B0ng ch\u1EC9 l\u1EC7ch n\u1EEDa g\xF3c */
.mm-v-chubby.mm-ears-down .mm-bowfollow .mm-earp{transform:rotate(7deg) scaleY(.98)}.mm-v-chubby.mm-ears-up .mm-bowfollow .mm-earp{transform:rotate(-2deg)}
.mm-v-chubby.mm-ears-side .mm-bowfollow .mm-earp{transform:rotate(5deg)}.mm-v-chubby.mm-ears-back .mm-bowfollow .mm-earp{transform:rotate(10deg) scaleY(.96)}
.mm-v-chubby .mm-bowfollow{animation-name:mm-elagh}
@keyframes mm-elagh{0%,100%{transform:rotate(1.2deg)}50%{transform:rotate(-1.2deg)}}
.mm-ears-up .mm-earw-l .mm-earp{transform:rotate(5deg) scaleY(1.08)}.mm-ears-up .mm-earw-r .mm-earp{transform:rotate(-5deg) scaleY(1.08)}
.mm-ears-side .mm-earw-l .mm-earp{transform:rotate(-10deg)}.mm-ears-side .mm-earw-r .mm-earp{transform:rotate(18deg)}
.mm-ears-back .mm-earw-l .mm-earp{transform:rotate(-38deg) scaleY(.82)}.mm-ears-back .mm-earw-r .mm-earp{transform:rotate(38deg) scaleY(.82)}
.mm-flick-l .mm-ear-l,.mm-flick-r .mm-ear-r{animation:mm-flick .5s ease-out 1}
@keyframes mm-flick{0%,100%{transform:rotate(0)}25%{transform:rotate(-14deg) scaleY(.92)}55%{transform:rotate(8deg)}80%{transform:rotate(-3deg)}}
.mm-flick-r .mm-ear-r{animation-name:mm-flickr}
.mm-v-chubby.mm-flick-l .mm-ear-l{animation-name:mm-flickc}
.mm-v-chubby.mm-flick-r .mm-ear-r{animation-name:mm-flickcr}
.mm-v-chubby.mm-flick-r .mm-bowfollow .mm-ear-r{animation-name:mm-flickch}
@keyframes mm-flickc{0%,100%{transform:rotate(0)}25%{transform:rotate(-9deg) scaleY(.95)}55%{transform:rotate(5deg)}80%{transform:rotate(-2deg)}}
@keyframes mm-flickcr{0%,100%{transform:rotate(0)}25%{transform:rotate(9deg) scaleY(.95)}55%{transform:rotate(-5deg)}80%{transform:rotate(2deg)}}
@keyframes mm-flickch{0%,100%{transform:rotate(0)}25%{transform:rotate(4.5deg)}55%{transform:rotate(-2.5deg)}80%{transform:rotate(1deg)}}
@keyframes mm-flickr{0%,100%{transform:rotate(0)}25%{transform:rotate(14deg) scaleY(.92)}55%{transform:rotate(-8deg)}80%{transform:rotate(3deg)}}
/* m\u1EAFt: m\xED ch\u1EDBp, con ng\u01B0\u01A1i li\u1EBFc theo bi\u1EBFn --mm-gx/--mm-gy */
.mm-clid{transform-box:fill-box;transform-origin:50% 0;transition:transform .07s ease-in}
.mm-blinking .mm-clid{transform:scaleY(1) !important}
.mm-q-slow .mm-clid{transform:scaleY(.82) !important;transition:transform .55s ease-in-out}
.mm-v-chubby .mm-pupil{transform:translate(var(--mm-gx,0px),var(--mm-gy,0px));transition:transform .16s cubic-bezier(.3,.8,.4,1)}
.mm-v-chubby .mm-pup-up{transform:translate(5px,-6px) !important}
.mm-v-chubby .mm-plook{animation:mm-plook 1.8s ease-in-out infinite}
@keyframes mm-plook{0%,100%{transform:translateX(-6px)}50%{transform:translateX(6px)}}
/* hai tay \u0111an tr\u01B0\u1EDBc b\u1EE5ng nh\xFAc nh\xEDch lu\xE2n phi\xEAn */
.mm-fidget-l,.mm-fidget-r{transform-box:view-box;animation:mm-fidget 2.2s ease-in-out infinite}
.mm-fidget-l{transform-origin:110px 258px}.mm-fidget-r{transform-origin:246px 258px;animation-delay:-1.1s}
@keyframes mm-fidget{0%,100%{transform:rotate(0)}30%{transform:rotate(-2.4deg) translateY(-1.5px)}60%{transform:rotate(1.2deg)}}
.mm-hold-r .mm-fidget-l,.mm-thumb-on .mm-fidget-r{animation-duration:3s}
.mm-nbubble{transform-box:fill-box;transform-origin:0 100%;animation:mm-nbub 2.8s ease-in-out infinite}
@keyframes mm-nbub{0%,100%{transform:scale(.45)}55%{transform:scale(1.25)}62%{transform:scale(1.3)}}
.mm-cbow{transform-box:fill-box;transform-origin:50% 50%;animation:mm-bowb 3.2s ease-in-out infinite}
@keyframes mm-bowb{0%,100%{transform:rotate(-3deg)}50%{transform:rotate(3deg) scale(1.03)}}
.mm-hide-bow .mm-cbow{display:none}
/* ---- M\xE8o \xFA b\u1EA3n \u1EA3nh: \u0111i\u1EC3m xoay theo viewBox, th\u1EDF, \u0111u\xF4i, m\u1EAFt g\u1ED1c / m\u1EAFt vector ---- */
.mm-v-chubby .mm-headm{transform-origin:169px 212px}
.mm-v-chubby .mm-earw-l,.mm-v-chubby .mm-earw-l .mm-earp,.mm-v-chubby .mm-earw-l .mm-ear-l{transform-box:view-box;transform-origin:128px 102px}
.mm-v-chubby .mm-earw-r,.mm-v-chubby .mm-earw-r .mm-earp,.mm-v-chubby .mm-earw-r .mm-ear-r{transform-box:view-box;transform-origin:222px 102px}
.mm-v-chubby .mm-cbow{transform-box:fill-box;transform-origin:30% 45%}
.mm-rtail{transform-box:view-box;transform-origin:266px 350px;animation:mm-rtail 3.4s cubic-bezier(.45,0,.55,1) infinite}
@keyframes mm-rtail{0%,100%{transform:rotate(-1.6deg)}50%{transform:rotate(2.4deg)}}
.mm-a-bounce .mm-rtail,.mm-a-jump .mm-rtail{animation-duration:1.05s}
.mm-a-droop .mm-rtail{animation-duration:6s}
.mm-rbreath{transform-box:view-box;transform-origin:170px 388px;animation:mm-rbreath 3.2s ease-in-out infinite}
@keyframes mm-rbreath{0%,100%{transform:scale(1,1)}50%{transform:scale(1.007,1.013)}}
.mm-rhead{animation:mm-rhead 3.2s ease-in-out infinite}
@keyframes mm-rhead{0%,100%{transform:translateY(0)}50%{transform:translateY(-1.6px)}}
.mm-v-chubby .mm-eyepatch,.mm-v-chubby .mm-blinkov{display:none}
.mm-v-chubby.mm-veyes .mm-eyepatch,.mm-v-chubby.mm-blinking .mm-eyepatch,.mm-v-chubby.mm-q-slow .mm-eyepatch{display:inline}
.mm-v-chubby.mm-blinking .mm-blinkov,.mm-v-chubby.mm-q-slow .mm-blinkov{display:inline}
.mm-v-chubby.mm-blinking .mm-ceye,.mm-v-chubby.mm-q-slow .mm-ceye{display:none}
.mm-rmouth path{stroke-width:2.5px !important}
.mm-ground{animation:mm-ground 2.4s ease-in-out infinite}
@keyframes mm-ground{0%,100%{transform:translateY(0)}50%{transform:translateY(-2.5px)}}
.mm-cords{transform-box:fill-box;transform-origin:50% 0;animation:mm-cords 3.2s ease-in-out infinite}
@keyframes mm-cords{0%,100%{transform:rotate(-2deg)}50%{transform:rotate(2deg)}}
.mm-thumb{transform-box:view-box;transform-origin:110px 262px;animation:mm-thumb .9s cubic-bezier(.3,1.5,.5,1) both}
@keyframes mm-thumb{from{transform:rotate(30deg) scale(.6)}to{transform:rotate(0) scale(1)}}
.mm-v-chubby.mm-h-wave .mm-handg,.mm-v-chubby .mm-h-wave .mm-handg{transform-origin:240px 282px}
.mm-v-chubby .mm-h-hold .mm-handg{transform-origin:240px 282px}
/* ---- M\xE8o \xFA v7: tai + n\u01A1 d\xEDnh li\u1EC1n \u0111\u1EA7u (\u1EA3nh g\u1ED1c) \u2013 kh\xF4ng chuy\u1EC3n \u0111\u1ED9ng ri\xEAng; c\u1EA3m x\xFAc b\u1EB1ng t\u01B0 th\u1EBF \u0111\u1EA7u ---- */
.mm-v-chubby .mm-earw,.mm-v-chubby .mm-earp,.mm-v-chubby .mm-ear,.mm-v-chubby .mm-cbow{animation:none !important;transform:none !important;transition:none !important}
.mm-v-chubby .mm-rhead{transform-box:view-box;transform-origin:169px 214px}
.mm-v-chubby.mm-ears-down .mm-rhead{animation:mm-hp-down 3.6s ease-in-out infinite}
@keyframes mm-hp-down{0%,100%{transform:translateY(2.5px) rotate(-2.4deg)}50%{transform:translateY(3.5px) rotate(-2.8deg)}}
.mm-v-chubby.mm-ears-back .mm-rhead{animation:mm-hp-back 2.6s ease-in-out infinite}
@keyframes mm-hp-back{0%,100%{transform:translateY(2px) rotate(2.2deg)}50%{transform:translateY(2.8px) rotate(1.6deg)}}
.mm-v-chubby.mm-ears-up .mm-rhead{animation:mm-hp-up 2.4s ease-in-out infinite}
@keyframes mm-hp-up{0%,100%{transform:translateY(-3px)}50%{transform:translateY(-4.5px)}}
.mm-v-chubby.mm-ears-side .mm-rhead{animation:mm-hp-side 3s ease-in-out infinite}
@keyframes mm-hp-side{0%,100%{transform:rotate(-3deg)}50%{transform:rotate(-2deg)}}
/* khung tai (u\u1ED1n s\u1EB5n t\u1EEB \u1EA3nh g\u1ED1c): ch\u1EC9 hi\u1EC7n 1 khung */
.mm-v-chubby .mm-tf{display:none}
.mm-v-chubby.mm-ef-f0 .mm-tf-f0,.mm-v-chubby.mm-ef-d1 .mm-tf-d1,.mm-v-chubby.mm-ef-d2 .mm-tf-d2,.mm-v-chubby.mm-ef-up .mm-tf-up,.mm-v-chubby.mm-ef-fl .mm-tf-fl,.mm-v-chubby.mm-ef-fr .mm-tf-fr{display:inline}
/* l\u1EAFc \u0111\u1EA7u nh\u1EB9 m\u1ED9t nh\u1ECBp */
.mm-v-chubby .mm-head{transform-box:view-box;transform-origin:169px 214px}
.mm-v-chubby.mm-flick-l .mm-head{animation:mm-hshake .55s ease-out 1}
.mm-v-chubby.mm-flick-r .mm-head{animation:mm-hshake2 .55s ease-out 1}
@keyframes mm-hshake{0%,100%{transform:rotate(0)}30%{transform:rotate(-2.2deg)}65%{transform:rotate(1.2deg)}}
@keyframes mm-hshake2{0%,100%{transform:rotate(0)}30%{transform:rotate(2.2deg)}65%{transform:rotate(-1.2deg)}}
.mm-reduce .mm-rtail,.mm-reduce .mm-rbreath,.mm-reduce .mm-rhead,.mm-reduce .mm-ground,.mm-reduce .mm-headm,.mm-reduce .mm-facefeat,.mm-reduce .mm-headturn,.mm-reduce .mm-earw,.mm-reduce .mm-fidget-l,.mm-reduce .mm-fidget-r,.mm-reduce .mm-cbow,.mm-reduce .mm-nbubble,.mm-reduce .mm-ctail,.mm-reduce .mm-ctail2,.mm-reduce .mm-tuft,.mm-reduce .mm-cheekfur-l,.mm-reduce .mm-cheekfur-r,.mm-reduce .mm-whisk-l,.mm-reduce .mm-whisk-r,.mm-reduce .mm-cords{animation:none}
.mm-h-wave .mm-handg{transform-box:view-box;transform-origin:232px 300px;animation:mm-wave .5s ease-in-out infinite alternate}
@keyframes mm-wave{from{transform:rotate(-14deg)}to{transform:rotate(16deg)}}
.mm-h-hold .mm-handg{transform-box:view-box;transform-origin:232px 300px;animation:mm-hold 2.4s ease-in-out infinite}
@keyframes mm-hold{0%,100%{transform:rotate(0)}50%{transform:rotate(-4deg)}}
.mm-h-lift .mm-handg{animation:mm-liftp .8s ease-in-out infinite}
@keyframes mm-liftp{0%,100%{transform:translateY(8px)}50%{transform:translateY(-14px)}}
.mm-scan{animation:mm-scanm 1.2s ease-in-out infinite;transform-origin:center}
@keyframes mm-scanm{0%,100%{transform:translate(-4px,2px) rotate(-8deg)}50%{transform:translate(6px,-4px) rotate(8deg) scale(1.08)}}
.mm-swing{animation:mm-swing 2s ease-in-out infinite;transform-origin:50% 0}
@keyframes mm-swing{0%,100%{transform:rotate(-8deg)}50%{transform:rotate(8deg)}}
.mm-glow{animation:mm-glow 1s ease-in-out infinite;transform-origin:center}
@keyframes mm-glow{50%{transform:scale(1.1)}}
.mm-drift{animation:mm-drift 6s ease-in-out infinite}
@keyframes mm-drift{50%{transform:translateX(10px)}}
.mm-flyby{animation:mm-flyby 3s ease-in-out infinite}
@keyframes mm-flyby{0%,100%{transform:translate(0,0)}25%{transform:translate(8px,-6px)}50%{transform:translate(14px,2px)}75%{transform:translate(4px,6px)}}
.mm-flutter{animation:mm-flutter .5s ease-in-out infinite alternate;transform-origin:center}
@keyframes mm-flutter{from{transform:scaleX(1) translateY(0)}to{transform:scaleX(.55) translateY(-4px)}}
.mm-wobble{animation:mm-wobble 1.4s ease-in-out infinite;transform-origin:center}
@keyframes mm-wobble{0%,100%{transform:rotate(-4deg) scale(1)}50%{transform:rotate(4deg) scale(1.06)}}
.mm-burst{animation:mm-burst 1.6s ease-out infinite;transform-origin:center}
@keyframes mm-burst{0%{transform:scale(0) rotate(0)}55%{transform:scale(1.1) rotate(20deg)}80%,100%{transform:scale(0) rotate(30deg)}}
.mm-shine rect{animation:mm-shine 2.4s linear infinite}
@keyframes mm-shine{0%{transform:translateX(0) skewX(-20deg)}100%{transform:translateX(250px) skewX(-20deg)}}
.mm-lid{animation:mm-lid 1.1s ease-in-out infinite}
@keyframes mm-lid{0%,30%,100%{transform:rotate(0)}50%,80%{transform:rotate(-40deg)}}
.mm-lift{animation:none}
.mm-badge{animation:mm-pop .5s cubic-bezier(.3,1.6,.5,1) both}
.mm-badge-pulse{animation:mm-pop .5s cubic-bezier(.3,1.6,.5,1) both,mm-shakeb .4s .5s linear infinite}
@keyframes mm-pop{from{transform:scale(0)}to{transform:scale(1)}}
@keyframes mm-shakeb{0%,100%{transform:rotate(0)}25%{transform:rotate(-10deg)}75%{transform:rotate(10deg)}}
.mm-ring{animation:mm-ring 1.2s ease-out infinite;transform-origin:center}
@keyframes mm-ring{from{transform:scale(.6)}to{transform:scale(1.6)}}
.mm-fxp{animation:mm-up var(--d,1.6s) ease-out forwards}
@keyframes mm-up{0%{transform:translate(0,0) scale(0) rotate(0)}15%{transform:translate(calc(var(--dx)*.2),-8px) scale(1)}80%{transform:translate(calc(var(--dx)*.8),calc(var(--dy)*.85)) scale(1) rotate(var(--rot))}100%{transform:translate(var(--dx),var(--dy)) scale(0) rotate(var(--rot))}}
.mm-fall{animation:mm-fall var(--d,6s) linear forwards}
@keyframes mm-fall{0%{transform:translate(0,0) rotate(0) scale(1)}25%{transform:translate(10px,105px) rotate(90deg)}50%{transform:translate(-8px,210px) rotate(180deg)}75%{transform:translate(8px,315px) rotate(270deg)}100%{transform:translate(0,430px) rotate(360deg) scale(.6)}}
.mm-conf{animation:mm-conf var(--d,1.6s) cubic-bezier(.2,.7,.4,1) forwards}
@keyframes mm-conf{0%{transform:translate(0,0) rotate(0) scale(.4)}60%{transform:translate(var(--dx),var(--dy)) rotate(var(--rot)) scale(1)}100%{transform:translate(calc(var(--dx)*1.1),calc(var(--dy) + 120px)) rotate(calc(var(--rot)*2)) scale(0)}}

/* ---- box chat ---- */
.mm-bubble{position:absolute;left:66.5%;right:-5%;top:1%;font-size:var(--mm-fs,13px);z-index:2;animation:mm-bin .35s cubic-bezier(.3,1.5,.5,1) both;transform-origin:10% 100%;box-sizing:border-box}
.mm-bubble.mm-sm{font-size:calc(var(--mm-fs,13px)*.84);left:71%;right:-7%;top:-3%}
@keyframes mm-bin{from{transform:scale(.4)}to{transform:scale(1)}}
.mm-bubble .mm-bt{font-weight:700;line-height:1.25}
.mm-b-friendly,.mm-b-premier{background:linear-gradient(160deg,#fff,var(--mm-pa0) 60%,var(--mm-pa));border:2px solid var(--mm-a);color:var(--mm-d);border-radius:1.2em;padding:.6em .8em;box-shadow:0 .25em 0 var(--mm-pa2)}
.mm-b-friendly::after,.mm-b-premier::after{content:"";position:absolute;left:12%;bottom:-.62em;width:.9em;height:.9em;background:var(--mm-pa);border-right:2px solid var(--mm-a);border-bottom:2px solid var(--mm-a);transform:rotate(45deg) skew(8deg,8deg);border-radius:0 0 .25em 0}
.mm-b-premier{background:linear-gradient(160deg,#4A0084,#6F2A62 60%,#3A0A4C);border-color:#DAA730;color:#F6DA4E;box-shadow:0 .25em 0 #2A003F}
.mm-b-premier::after{background:#3A0A4C;border-color:#DAA730}
.mm-b-pro{background:#fff;border:1.5px solid var(--mm-d);border-radius:.3em;color:var(--mm-d);overflow:visible;box-shadow:.25em .25em 0 var(--mm-pa2)}
.mm-b-pro .mm-bh{background:var(--mm-d);color:#fff;font-size:.62em;font-weight:700;letter-spacing:.08em;padding:.35em .7em}
.mm-b-pro .mm-bc{padding:.5em .7em}
.mm-b-pro::after{content:"";position:absolute;left:14%;bottom:-.6em;border-left:.6em solid transparent;border-top:.6em solid var(--mm-d)}
.mm-b-playful{background:linear-gradient(135deg,var(--mm-s0),var(--mm-s1) 55%,var(--mm-s2));color:#fff;border-radius:1.1em;padding:.6em .8em;box-shadow:0 .3em 0 var(--mm-s2);text-shadow:0 .08em 0 var(--mm-s2)}
.mm-b-playful .mm-bt{font-size:1.15em;font-weight:900;letter-spacing:.01em}
.mm-b-playful.mm-k-cloud{border-radius:2em 2em 2em .6em}
.mm-b-playful.mm-k-search{clip-path:polygon(0 8%,10% 0,22% 7%,35% 0,50% 6%,64% 0,78% 7%,90% 0,100% 9%,96% 30%,100% 52%,95% 74%,100% 94%,86% 100%,70% 93%,52% 100%,36% 93%,20% 100%,6% 93%,0 100%,4% 70%,0 48%,5% 28%);padding:1em 1em;border-radius:0;box-shadow:none}
.mm-b-playful::after{content:"";position:absolute;left:10%;bottom:-.55em;width:.9em;height:.9em;background:var(--mm-s1);transform:rotate(45deg);border-radius:.15em}
.mm-b-playful.mm-k-search::after{display:none}
.mm-w{display:inline-block;animation:mm-wj 1s ease-in-out infinite;margin-right:.22em}
@keyframes mm-wj{0%,100%{transform:translateY(0)}30%{transform:translateY(-.22em) rotate(-3deg)}}
.mm-shk .mm-w{animation:mm-wshake .25s linear infinite}
@keyframes mm-wshake{0%,100%{transform:translate(0)}25%{transform:translate(-1px,1px) rotate(-3deg)}75%{transform:translate(1px,-1px) rotate(3deg)}}
.mm-gl .mm-w{animation:mm-wgl .5s steps(2) infinite}
@keyframes mm-wgl{0%{transform:translate(0);color:#fff}50%{transform:translate(2px,-1px) skewX(-12deg);color:#FFE14D}}
.mm-dots{display:inline-flex;gap:.22em;margin-top:.35em}
.mm-dots i{width:.42em;height:.42em;border-radius:50%;background:currentColor;animation:mm-dot 1s infinite}
.mm-dots i:nth-child(2){animation-delay:.15s}.mm-dots i:nth-child(3){animation-delay:.3s}
@keyframes mm-dot{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-.35em)}}
.mm-mic{display:flex;align-items:center;gap:.45em}
.mm-mic svg{width:1.6em;height:1.6em;animation:mm-micb .6s ease-in-out infinite alternate}
@keyframes mm-micb{to{transform:translateY(-.15em) scale(1.08)}}
.mm-bars{display:flex;gap:.18em;align-items:center;height:1.4em}
.mm-bars i{width:.24em;border-radius:.2em;background:var(--mm-s1);animation:mm-bar .5s ease-in-out infinite alternate}
.mm-b-playful .mm-bars i{background:#fff}
.mm-bars i:nth-child(1){height:40%}.mm-bars i:nth-child(2){height:90%;animation-delay:.1s}.mm-bars i:nth-child(3){height:60%;animation-delay:.2s}.mm-bars i:nth-child(4){height:100%;animation-delay:.3s}.mm-bars i:nth-child(5){height:50%;animation-delay:.15s}
@keyframes mm-bar{from{transform:scaleY(.35)}to{transform:scaleY(1)}}
.mm-lines{display:flex;flex-direction:column;gap:.3em;margin-top:.15em}
.mm-lines i{height:.42em;border-radius:.3em;background:var(--mm-s1);transform-origin:left;animation:mm-line 1.6s ease-in-out infinite}
.mm-b-playful .mm-lines i{background:#fff}
.mm-lines i:nth-child(1){width:95%}.mm-lines i:nth-child(2){width:75%;animation-delay:.25s}.mm-lines i:nth-child(3){width:55%;animation-delay:.5s}
@keyframes mm-line{0%{transform:scaleX(0)}50%,100%{transform:scaleX(1)}}
.mm-srch{display:flex;align-items:center;gap:.5em}
.mm-srch .mm-lines{flex:1}
.mm-srch svg{width:1.7em;height:1.7em;animation:mm-scanm 1.2s ease-in-out infinite}
.mm-spinr{display:flex;align-items:center;gap:.5em}
.mm-spinr b{width:1.2em;height:1.2em;border-radius:50%;border:.22em solid var(--mm-pa2);border-top-color:var(--mm-s1);animation:mm-spin .8s linear infinite;box-sizing:border-box;flex:none}
.mm-prog{height:.4em;border-radius:.3em;background:var(--mm-pa2);margin-top:.4em;overflow:hidden}
.mm-prog i{display:block;height:100%;width:40%;background:var(--mm-s1);border-radius:.3em;animation:mm-prog 1.6s ease-in-out infinite}
@keyframes mm-prog{0%{transform:translateX(-100%)}100%{transform:translateX(260%)}}
.mm-time{font-size:1.5em;font-weight:900;letter-spacing:.02em;line-height:1}
.mm-time+.mm-bt{font-weight:500;font-size:.9em;margin-top:.15em}
.mm-hrt{display:inline-block;color:#FF5C7A;animation:mm-pulse .7s infinite;margin-left:.2em}

/* ---- M\xC8O \u0110\u1EE8NG: \u0111i\u1EC3m xoay theo viewBox, khung ch\xE2n, tay, \u0111u\xF4i ---- */
.mm-v-stand .mm-headm,.mm-v-stand .mm-rhead,.mm-v-stand .mm-head{transform-origin:180px 151px}
.mm-v-stand .mm-rtail{transform-origin:257.6px 271.4px;animation:mm-stail 3s cubic-bezier(.45,0,.55,1) infinite}
@keyframes mm-stail{0%,100%{transform:rotate(-3.5deg)}50%{transform:rotate(4deg)}}
.mm-v-stand.mm-a-bounce .mm-rtail,.mm-v-stand.mm-a-jump .mm-rtail{animation-duration:.9s}
.mm-v-stand.mm-a-droop .mm-rtail{animation-duration:5.5s}
.mm-v-stand.mm-g-up .mm-rtail{animation:mm-stailup .5s ease-out 1 both}
@keyframes mm-stailup{0%{transform:rotate(0)}40%{transform:rotate(-5deg)}100%{transform:rotate(-3deg)}}
.mm-v-stand .mm-rbreath{transform-origin:182px 280px}
.mm-v-stand .mm-lf{display:none}
.mm-v-stand.mm-lf-on-f0 .mm-lf-f0,.mm-v-stand.mm-lf-on-L .mm-lf-L,.mm-v-stand.mm-lf-on-R .mm-lf-R,.mm-v-stand.mm-lf-on-B .mm-lf-B{display:inline}
.mm-v-stand .mm-armw{transform-box:view-box}
.mm-v-stand .mm-armw-l,.mm-v-stand .mm-arm-l{transform-box:view-box;transform-origin:139.3px 209px}
.mm-v-stand .mm-armw-r,.mm-v-stand .mm-arm-r{transform-box:view-box;transform-origin:208.9px 209px}
/* l\xFAc r\u1EA3nh: tay \u0111ung \u0111\u01B0a nh\u1EB9 l\u1EC7ch nh\u1ECBp */
.mm-v-stand .mm-arm-l{animation:mm-ail 3.2s ease-in-out infinite}
.mm-v-stand .mm-arm-r{animation:mm-air 3.2s ease-in-out -1.6s infinite}
@keyframes mm-ail{0%,100%{transform:rotate(0)}50%{transform:rotate(-3deg)}}
@keyframes mm-air{0%,100%{transform:rotate(0)}50%{transform:rotate(3deg)}}
/* v\u1EABy tay ch\xE0o: tay tr\xE1i v\u1EABy qua l\u1EA1i tr\u01B0\u1EDBc ng\u1EF1c */
.mm-v-stand.mm-g-wave .mm-arm-l{animation:mm-wave-l .42s ease-in-out infinite alternate}
@keyframes mm-wave-l{from{transform:rotate(-2deg)}to{transform:rotate(-16deg)}}
/* khua hai tay \u0103n m\u1EEBng */
.mm-v-stand.mm-g-cheer .mm-arm-l{animation:mm-ch-l .4s ease-in-out infinite alternate}
.mm-v-stand.mm-g-cheer .mm-arm-r{animation:mm-ch-r .4s ease-in-out -.2s infinite alternate}
@keyframes mm-ch-l{from{transform:rotate(4deg)}to{transform:rotate(-14deg)}}
@keyframes mm-ch-r{from{transform:rotate(-4deg)}to{transform:rotate(14deg)}}
/* g\xF5 tay suy ngh\u0129 */
.mm-v-stand.mm-g-tap .mm-arm-r{animation:mm-tap .32s ease-in-out infinite alternate}
@keyframes mm-tap{from{transform:rotate(0)}to{transform:rotate(7deg)}}
.mm-v-stand.mm-g-talk .mm-arm-l{animation:mm-talkl 1.1s ease-in-out infinite}
.mm-v-stand.mm-g-talk .mm-arm-r{animation:mm-talkr 1.1s ease-in-out -.55s infinite}
@keyframes mm-talkl{0%,100%{transform:rotate(0)}50%{transform:rotate(-9deg)}}
@keyframes mm-talkr{0%,100%{transform:rotate(0)}50%{transform:rotate(9deg)}}
/* \xF4m tim / ch\u1EAFp tay */
.mm-v-stand.mm-g-hug .mm-arm-l{animation:mm-hug-l 1.4s ease-in-out infinite}
.mm-v-stand.mm-g-hug .mm-arm-r{animation:mm-hug-r 1.4s ease-in-out infinite}
@keyframes mm-hug-l{0%,100%{transform:rotate(-12deg)}50%{transform:rotate(-15deg)}}
@keyframes mm-hug-r{0%,100%{transform:rotate(12deg)}50%{transform:rotate(15deg)}}
/* bu\u1ED3n / ng\u1EE7: tay r\u0169 kh\xE9p */
.mm-v-stand.mm-g-droop .mm-arm-l{animation:none;transform:rotate(-6deg)}
.mm-v-stand.mm-g-droop .mm-arm-r{animation:none;transform:rotate(6deg)}
/* ng\u1EA1c nhi\xEAn: hai tay b\u1EADt ra m\u1ED9t nh\u1ECBp */
.mm-v-stand.mm-g-up .mm-arm-l{animation:mm-up-l .45s cubic-bezier(.3,1.6,.5,1) 1 both}
.mm-v-stand.mm-g-up .mm-arm-r{animation:mm-up-r .45s cubic-bezier(.3,1.6,.5,1) 1 both}
@keyframes mm-up-l{from{transform:rotate(0)}to{transform:rotate(5deg)}}
@keyframes mm-up-r{from{transform:rotate(0)}to{transform:rotate(-5deg)}}
/* c\u1EA7m \u0111\u1ED3 b\u1EB1ng tay ph\u1EA3i: tay kh\xE9p v\xE0o gi\u1EEFa, gi\u1EEF y\xEAn */
.mm-v-stand.mm-g-hold .mm-arm-r{animation:mm-hold-r 2.4s ease-in-out infinite}
@keyframes mm-hold-r{0%,100%{transform:rotate(8deg)}50%{transform:rotate(11deg)}}
.mm-v-stand .mm-hand{animation:none !important}
.mm-reduce.mm-v-stand .mm-arm-l,.mm-reduce.mm-v-stand .mm-arm-r,.mm-reduce.mm-v-stand .mm-rtail{animation:none !important}
/* ---- M\xC8O \xDA 12 T\u01AF TH\u1EBE ---- */
.mm-v-pose .mm-pose{display:none}
.mm-pz-1 .mm-pose-1,.mm-pz-2 .mm-pose-2,.mm-pz-3 .mm-pose-3,.mm-pz-4 .mm-pose-4,.mm-pz-5 .mm-pose-5,.mm-pz-6 .mm-pose-6,.mm-pz-7 .mm-pose-7,.mm-pz-8 .mm-pose-8,.mm-pz-9 .mm-pose-9,.mm-pz-10 .mm-pose-10,.mm-pz-11 .mm-pose-11,.mm-pz-12 .mm-pose-12{display:inline}
.mm-v-pose .mm-posewrap{transform-box:view-box;transform-origin:188px 384px}
.mm-v-pose .mm-rbreath{transform-origin:188px 384px}
.mm-v-pose .mm-mouthp{display:none}
.mm-v-pose.mm-vmouth .mm-mouthp{display:inline}
.mm-noblink .mm-blinkov,.mm-noblink .mm-eyepatch{display:none !important}
/* khung c\u1EED \u0111\u1ED9ng 8 b\u01B0\u1EDBc (\u0111u\xF4i t, tay v\u1EABy p, ch\xE2n f/g) ch\u1EA1y theo nh\u1ECBp s\xF3ng; khung 0 = \u1EA3nh g\u1ED1c */
.mm-qf{visibility:hidden}
.mm-qn-0{visibility:visible}
${Array.from({ length: 8 }, (_, i) => `.mm-qk-t.mm-qn-${i},.mm-qk-p.mm-qn-${i},.mm-qk-f.mm-qn-${i},.mm-qk-g.mm-qn-${i}{animation:mm-q8-${i} var(--qd,1.6s) step-end infinite}
@keyframes mm-q8-${i}{${i ? `0%{visibility:hidden}${i * 12.5}%{visibility:visible}` : "0%{visibility:visible}"}${(i + 1) * 12.5}%,100%{visibility:hidden}}`).join("\n")}
.mm-qk-t{--qd:1.6s}.mm-qk-p{--qd:.72s}.mm-qk-f{--qd:1s}.mm-qk-g{--qd:1s;animation-delay:-.5s !important}
.mm-a-bounce .mm-qk-t,.mm-a-jump .mm-qk-t{--qd:.8s}
.mm-a-droop .mm-qk-t{--qd:3.2s}
.mm-q-wag .mm-qk-t{--qd:.48s}
/* gi\u1EADt tai 3 khung: e1 \u2192 e2 \u2192 e1 \u2192 e0 */
.mm-ef-fl .mm-qk-e,.mm-ef-fr .mm-qk-e{animation:var(--qe) .5s step-end 1 both}
.mm-qk-e.mm-qn-0{--qe:mm-qe0}.mm-qk-e.mm-qn-1{--qe:mm-qe1}.mm-qk-e.mm-qn-2{--qe:mm-qe2}
.mm-ef-fl .mm-qk-e.mm-qn-0,.mm-ef-fr .mm-qk-e.mm-qn-0{animation-name:mm-qe0}
.mm-ef-fl .mm-qk-e.mm-qn-1,.mm-ef-fr .mm-qk-e.mm-qn-1{animation-name:mm-qe1}
.mm-ef-fl .mm-qk-e.mm-qn-2,.mm-ef-fr .mm-qk-e.mm-qn-2{animation-name:mm-qe2}
@keyframes mm-qe0{0%{visibility:hidden}80%,100%{visibility:visible}}
@keyframes mm-qe1{0%{visibility:visible}20%{visibility:hidden}60%{visibility:visible}80%,100%{visibility:hidden}}
@keyframes mm-qe2{0%{visibility:hidden}20%{visibility:visible}60%,100%{visibility:hidden}}
/* th\xE2n: th\u1EDF co gi\xE3n, l\u1EAFc l\u01B0 quanh b\xE0n ch\xE2n, ki\u1EC3u ri\xEAng t\u1EEBng t\u01B0 th\u1EBF */
.mm-v-pose .mm-bob{transform-origin:188px 384px}
.mm-v-pose .mm-rbreath{animation:mm-pbreath 3s ease-in-out infinite}
@keyframes mm-pbreath{0%,100%{transform:scale(1,1)}50%{transform:scale(1.016,1.026)}}
.mm-v-pose .mm-posewrap{animation:mm-psway 4.4s ease-in-out infinite}
@keyframes mm-psway{0%,100%{transform:rotate(-1.1deg)}50%{transform:rotate(1.1deg)}}
.mm-v-pose.mm-pz-5 .mm-posewrap{animation:mm-pjump .86s cubic-bezier(.45,0,.55,1) infinite}
@keyframes mm-pjump{0%,100%{transform:translateY(0) scale(1.03,.96)}18%{transform:translateY(-4px) scale(.98,1.03)}50%{transform:translateY(-16px) scale(1,1)}82%{transform:translateY(-3px) scale(.99,1.02)}}
.mm-v-pose.mm-pz-6 .mm-posewrap{animation:mm-plunge 1s ease-in-out infinite}
@keyframes mm-plunge{0%,100%{transform:translate(-4px,2px) rotate(-1.5deg)}50%{transform:translate(5px,-6px) rotate(1.5deg)}}
.mm-v-pose.mm-pz-4 .mm-posewrap{animation:mm-pplay 1.3s ease-in-out infinite}
@keyframes mm-pplay{0%,100%{transform:translateX(0) scale(1,1)}50%{transform:translateX(-3px) scale(1.02,.97)}}
.mm-v-pose.mm-pz-10 .mm-rbreath,.mm-v-pose.mm-pz-11 .mm-rbreath{animation:mm-psleep 3.6s ease-in-out infinite}
@keyframes mm-psleep{0%,100%{transform:scale(1,1)}50%{transform:scale(1.025,1.04)}}
.mm-v-pose.mm-pz-10 .mm-posewrap,.mm-v-pose.mm-pz-11 .mm-posewrap{animation:none}
.mm-v-pose.mm-pz-12 .mm-posewrap{animation:mm-roll 1.5s ease-in-out infinite;transform-origin:188px 330px}
@keyframes mm-roll{0%,100%{transform:rotate(-4deg)}50%{transform:rotate(4deg)}}
/* c\u1EED ch\u1EC9 l\xFAc r\u1EA3nh */
.mm-v-pose.mm-q-tilt .mm-posewrap{animation:mm-ptilt 1.8s ease-in-out 1}
@keyframes mm-ptilt{0%,100%{transform:rotate(0)}30%,70%{transform:rotate(-4deg)}}
.mm-v-pose.mm-q-hop .mm-posewrap{animation:mm-phop .55s cubic-bezier(.3,1.4,.5,1) 1}
@keyframes mm-phop{0%{transform:scale(1.04,.94)}40%{transform:translateY(-10px) scale(.98,1.04)}100%{transform:translateY(0) scale(1,1)}}
/* \u0111\u1ED5i t\u01B0 th\u1EBF 3 nh\u1ECBp: co xu\u1ED1ng \u2192 \u0111\u1ED5i h\xECnh \u2192 b\u1EADt l\xEAn */
.mm-v-pose.mm-pzout .mm-posewrap{animation:mm-pzout .13s ease-in 1 forwards}
@keyframes mm-pzout{0%{transform:scale(1,1)}100%{transform:scale(1.06,.84)}}
.mm-v-pose.mm-pzout :is(.mm-head,.mm-hand,.mm-scarf,.mm-outfit){visibility:hidden}
.mm-v-pose.mm-pzin .mm-posewrap{animation:mm-pzin .42s cubic-bezier(.3,1.55,.5,1) 1}
@keyframes mm-pzin{0%{transform:scale(.9,.8) translateY(0)}45%{transform:scale(.97,1.08) translateY(-6px)}75%{transform:scale(1.02,.98)}100%{transform:scale(1,1)}}
/* m\u1EB7t vector tr\xEAn t\u01B0 th\u1EBF: n\xE9t n\xE2u \u1EA5m, m\u1EC1m nh\u01B0 n\xE9t v\u1EBD */
.mm-v-pose .mm-face [style*="#3A2214"]{stroke:#7A3A1C !important}
.mm-v-pose .mm-face [style*="#1E0E05"]{fill:#4A2410 !important}
/* \u0111\u1ED3 v\u1EADt, trang tr\xED: vi\u1EC1n n\xE2u m\u1EA3nh cho h\u1EE3p n\xE9t v\u1EBD */
.mm-v-pose :is(.mm-hand,.mm-back,.mm-front,.mm-eyewear) :is(path,rect,circle,ellipse,polygon):not([style*="stroke"]){stroke:#7A3A1C;stroke-width:1.3px;paint-order:stroke;stroke-linejoin:round}
.mm-reduce .mm-qf{animation:none !important}
.mm-reduce .mm-qn-0{visibility:visible !important}.mm-reduce .mm-qf:not(.mm-qn-0){visibility:hidden !important}
.mm-reduce.mm-v-pose .mm-posewrap,.mm-reduce.mm-v-pose .mm-rbreath{animation:none !important}
/* gi\u1EA3m chuy\u1EC3n \u0111\u1ED9ng */
.mm-reduce .mm-bob,.mm-reduce .mm-handg{animation-duration:6s !important;animation-name:mm-breathe !important}
.mm-reduce .mm-w{animation:none}
@media (prefers-reduced-motion: reduce){.mm-root .mm-tip,.mm-root .mm-antenna,.mm-root .mm-bell{animation:none}}
`;
  function injectCSS() {
    if (typeof document === "undefined" || document.getElementById("mimi-style")) return;
    const st = document.createElement("style");
    st.id = "mimi-style";
    st.textContent = CSS;
    document.head.appendChild(st);
  }
  var SEQ = 0;
  var NS = "http://www.w3.org/2000/svg";
  var rnd = (a, b) => a + Math.random() * (b - a);
  var esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  var MIC = '<svg viewBox="0 0 24 24"><rect x="8" y="2" width="8" height="13" rx="4" fill="currentColor"/><path d="M5 11a7 7 0 0 0 14 0M12 18v4M8 22h8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
  var LENS = '<svg viewBox="0 0 24 24"><circle cx="10" cy="10" r="6.5" fill="none" stroke="currentColor" stroke-width="2.6"/><path d="M15 15l6 6" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>';
  var RECOLOR_CACHE = /* @__PURE__ */ new Map();
  function recolorImage(src, { color, ref, mode }) {
    const key = src.length + ":" + src.slice(-32) + "|" + color + "|" + mode;
    if (RECOLOR_CACHE.has(key)) return RECOLOR_CACHE.get(key);
    const pr = new Promise((resolve) => {
      const im = new Image();
      im.onload = () => {
        try {
          const c = document.createElement("canvas");
          c.width = im.naturalWidth;
          c.height = im.naturalHeight;
          const g = c.getContext("2d");
          g.drawImage(im, 0, 0);
          const d = g.getImageData(0, 0, c.width, c.height), a = d.data;
          const [tr, tg, tb] = hexToRgb(color), refL = 0.299 * ref[0] + 0.587 * ref[1] + 0.114 * ref[2];
          for (let i = 0; i < a.length; i += 4) {
            if (!a[i + 3]) continue;
            const r = a[i], gg = a[i + 1], b = a[i + 2];
            const mx = Math.max(r, gg, b), mn = Math.min(r, gg, b), sat = mx ? (mx - mn) / mx : 0;
            let w = 1;
            if (mode === "hue") {
              let h = 0;
              if (mx !== mn) {
                if (mx === r) h = (gg - b) / (mx - mn) % 6;
                else if (mx === gg) h = (b - r) / (mx - mn) + 2;
                else h = (r - gg) / (mx - mn) + 4;
                h *= 60;
                if (h < 0) h += 360;
              }
              const hueW = h <= 22 || h >= 340 ? 1 : h <= 30 ? (30 - h) / 8 : 0;
              w = hueW * Math.min(1, Math.max(0, (sat - 0.12) / 0.2)) * Math.min(1, mx / 150);
              if (w <= 0) continue;
            }
            const k = (0.299 * r + 0.587 * gg + 0.114 * b) / refL;
            let nr, ng, nb;
            if (k <= 1) {
              nr = tr * k;
              ng = tg * k;
              nb = tb * k;
            } else {
              const t = Math.min(1, (k - 1) / (255 / refL - 1));
              nr = tr + (255 - tr) * t;
              ng = tg + (255 - tg) * t;
              nb = tb + (255 - tb) * t;
            }
            a[i] = r + (nr - r) * w;
            a[i + 1] = gg + (ng - gg) * w;
            a[i + 2] = b + (nb - b) * w;
          }
          g.putImageData(d, 0, 0);
          resolve(c.toDataURL("image/webp", 0.9));
        } catch (e) {
          resolve(null);
        }
      };
      im.onerror = () => resolve(null);
      im.src = src;
    });
    RECOLOR_CACHE.set(key, pr);
    return pr;
  }
  var MimiBot = class {
    constructor(el, opts = {}) {
      injectCSS();
      this.el = el;
      this.u = "mm" + ++SEQ + "_";
      this.o = {
        variant: "pose",
        colors: {},
        state: "idle",
        persona: "friendly",
        season: null,
        festival: null,
        cosplay: null,
        energy: 1,
        bubble: true,
        ...opts
      };
      this.ev = {};
      this.timers = [];
      this.fxTimer = null;
      this.partTimer = null;
      this.playTimer = null;
      this.reduce = typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
      this.root = document.createElement("div");
      this.root.className = "mm-root";
      el.appendChild(this.root);
      this._build();
      if (typeof ResizeObserver !== "undefined") {
        this.ro = new ResizeObserver(() => this._fit());
        this.ro.observe(this.root);
      }
      this._fit();
    }
    /* ---------- public API ---------- */
    setState(s) {
      if (!STATES[s]) return;
      this.o.state = s;
      this._render();
      this._emit("state", s, STATES[s]);
    }
    setPersona(p) {
      if (!PERSONAS[p]) return;
      this.o.persona = p;
      this._render();
      this._emit("persona", p);
    }
    setSeason(s) {
      this.o.season = SEASONS[s] ? s : null;
      this._render();
      this._emit("season", this.o.season);
    }
    setFestival(f) {
      this.o.festival = FESTIVALS[f] ? f : null;
      this._render();
      this._emit("festival", this.o.festival);
    }
    setCosplay(c) {
      this.o.cosplay = COSPLAYS[c] ? c : null;
      this._render();
      this._emit("cosplay", this.o.cosplay);
    }
    setVariant(v) {
      if (!VARIANTS[v] || v === this.o.variant) return;
      this.o.variant = v;
      this._build();
      this._emit("variant", v);
    }
    setColors(c) {
      this.o.colors = { ...c || {} };
      this._applyColors();
      this._emit("colors", this.o.colors);
    }
    setEnergy(e) {
      this.o.energy = Math.max(0, Math.min(1.5, +e || 0));
      this.root.style.setProperty("--mm-e", this.o.energy);
    }
    celebrate() {
      if (this.reduce) return;
      this.root.classList.remove("mm-spinning");
      void this.root.offsetWidth;
      this.root.classList.add("mm-spinning");
      this._later(() => this.root.classList.remove("mm-spinning"), 950);
      const cols = ["#FF5C9A", "#FFC94D", "#5CC8E8", "#7ED67E", "#B69CFF", "var(--mm-a)", "var(--mm-p)"];
      for (let i = 0; i < 46; i++) {
        const a = rnd(-Math.PI, 0), r = rnd(90, 200);
        this._particle(FX.confetti(cols[i % cols.length]), 200, 180, {
          cls: "mm-conf",
          d: rnd(1.2, 1.9),
          dx: Math.cos(a) * r,
          dy: Math.sin(a) * r * 0.9,
          rot: rnd(-540, 540)
        });
      }
    }
    play(seq, loop = false) {
      this.stop();
      let i = 0;
      const step = () => {
        if (i >= seq.length) {
          if (!loop) {
            this._emit("playend");
            return;
          }
          i = 0;
        }
        const [s, ms] = seq[i++];
        this.setState(s);
        this._emit("step", s, i - 1);
        this.playTimer = setTimeout(step, ms || 1800);
      };
      step();
    }
    tour(ms = 2200) {
      this.play(Object.keys(STATES).map((k) => [k, ms]), true);
    }
    stop() {
      clearTimeout(this.playTimer);
      this.playTimer = null;
    }
    on(e, fn) {
      (this.ev[e] = this.ev[e] || []).push(fn);
      return this;
    }
    off(e, fn) {
      this.ev[e] = (this.ev[e] || []).filter((f) => f !== fn);
      return this;
    }
    destroy() {
      this.stop();
      this._clearFx();
      this._lifeStop();
      this._earStop();
      this._legsStop();
      clearTimeout(this._pzT);
      clearTimeout(this._pzT2);
      this.timers.forEach(clearTimeout);
      if (this.ro) this.ro.disconnect();
      this.root.remove();
    }
    /* ---------- nội bộ ---------- */
    _emit(e, ...a) {
      (this.ev[e] || []).forEach((f) => {
        try {
          f(...a);
        } catch (err) {
        }
      });
    }
    _later(fn, ms) {
      const t = setTimeout(fn, ms);
      this.timers.push(t);
      return t;
    }
    _fit() {
      const w = this.root.clientWidth || 320;
      this.root.style.setProperty("--mm-fs", Math.max(9, w * 0.04).toFixed(1) + "px");
    }
    _q(sel) {
      return this.svg.querySelector(sel);
    }
    _build() {
      this.root.innerHTML = buildSVG(this.u, this.o.variant);
      this.svg = this.root.querySelector("svg");
      this.bubble = document.createElement("div");
      this.root.appendChild(this.bubble);
      if (this.o.variant === "chubby") {
        const headArt = this.svg.querySelector(".mm-art-head"), earL = this.svg.querySelector(".mm-earw-l");
        if (headArt && earL && headArt.parentNode && earL.parentNode) earL.parentNode.insertBefore(headArt.parentNode, earL);
        const patch = this.svg.querySelector(".mm-patch"), top = this.svg.querySelector(".mm-art-hoodtop");
        if (patch && top && top.parentNode && top.parentNode.parentNode) top.parentNode.parentNode.appendChild(patch);
      }
      this.slots = {};
      ["face", "hat", "eyewear", "scarf", "outfit", "hand", "back", "front", "fx", "cos-head"].forEach((k) => {
        this.slots[k] = this._q(".mm-" + k);
      });
      this.root.style.setProperty("--mm-e", this.o.energy);
      if (this.reduce) this.root.classList.add("mm-reduce");
      this._applyColors();
      this._render();
      this._recolorKey = null;
      this._applyColors();
      this._lifeStop();
      if (this.o.variant !== "stand") {
        this._legsStop();
        this._legMode = void 0;
      }
      if (PHOTO(this.o.variant) && !this.reduce) this._life();
    }
    _applyColors() {
      const v = deriveColors(this.o.colors);
      if (this.o.persona === "premier") Object.assign(v, PHOTO(this.o.variant) ? PREMIER_CHUBBY : PREMIER);
      if (this.o.cosplay === "glass") Object.assign(v, GLASS);
      Object.entries(v).forEach(([k, x]) => this.root.style.setProperty(k, x));
      const rk = JSON.stringify([this.o.colors, this.o.persona, this.o.cosplay, this.o.variant]);
      if (this.svg && rk !== this._recolorKey) {
        this._recolorKey = rk;
        this._recolorArt();
      }
      this._stateColor();
    }
    _stateColor() {
      const st = STATES[this.o.state];
      let c = STATE_COLORS[st.color];
      if (!c) c = this.o.persona === "premier" ? GOLD : null;
      const cs = getComputedStyle(this.root);
      const brand = [cs.getPropertyValue("--mm-a0"), cs.getPropertyValue("--mm-a"), cs.getPropertyValue("--mm-a2")].map((x) => x.trim());
      const arr = c || brand;
      ["--mm-s0", "--mm-s1", "--mm-s2"].forEach((k, i) => this.root.style.setProperty(k, arr[i]));
    }
    _render() {
      const o = this.o, st = STATES[o.state], u = this.u;
      const isTime = st.group === G.time;
      const playful = o.persona === "playful";
      const pl = playful && st.play || {};
      const season = SEASONS[o.season], fest = FESTIVALS[o.festival];
      const poseV = o.variant === "pose";
      const pz = poseV ? o.persona === "playful" && o.state === "idle" ? 4 : POSE_OF[o.state] || 1 : 0;
      const vg = poseV ? { ...POSE_BASE, ...POSE_GEO[pz] } : VARIANT_GEO[o.variant] || VARIANT_GEO.L, chubby = PHOTO(o.variant), stand = o.variant === "stand";
      this._pg = vg;
      this._applyColors();
      const anim = pl.anim || st.anim;
      this.root.className = `mm-root mm-a-${anim} mm-p-${o.persona} mm-v-${o.variant}` + (stand || poseV ? " mm-v-chubby" : "") + (poseV ? ` mm-pz-${pz}` + (vg.open ? "" : " mm-noblink") : "") + (this.reduce ? " mm-reduce" : "") + (st.ear ? " mm-ear-twitch" : "") + (chubby && EARS[o.state] ? ` mm-ears-${EARS[o.state]}` : "");
      if (chubby) {
        this._ef = this._ef || "f0";
        this.root.classList.add("mm-ef-" + this._ef);
        this._earTo(EAR_FRAME[EARS[o.state]] || "f0");
      }
      if (poseV) {
        clearTimeout(this._pzT);
        clearTimeout(this._pzT2);
        const old = this._pz;
        if (old && old !== pz && !this.reduce) {
          this.root.classList.remove("mm-pz-" + pz);
          this.root.classList.add("mm-pz-" + old, "mm-pzout");
          this._pzT = setTimeout(() => {
            this.root.classList.remove("mm-pz-" + old, "mm-pzout");
            this.root.classList.add("mm-pz-" + pz, "mm-pzin");
            this._pzT2 = setTimeout(() => this.root.classList.remove("mm-pzin"), 440);
          }, 130);
        }
        this._pz = pz;
      }
      if (stand) {
        this._lf = this._lf || "f0";
        this.root.classList.add("mm-lf-on-" + this._lf);
        const g = GESTURE[o.state];
        if (g) this.root.classList.add("mm-g-" + g);
        this._legsTo(STEPS[o.state] || null);
      }
      this._face = chubby ? { ...st.face, ...pl.face ? {} : CUTE[o.state] || {}, ...pl.face || {} } : { ...st.face, ...pl.face || {} };
      this._paintFace();
      let hatKey = null, eyeKey = null, scarf = false;
      if (isTime) {
        hatKey = st.hat || null;
        eyeKey = st.eyewear || null;
      } else {
        hatKey = fest && fest.hat || season && season.hat || null;
        eyeKey = season && season.eyewear || null;
        scarf = !!(season && season.scarf);
      }
      if (!hatKey && o.cosplay === "bebe") hatKey = "halo";
      const hat = hatKey && HATS[hatKey];
      this.slots.hat.innerHTML = hat ? chubby && CHUBBY_HATS[hatKey] ? `<g class="mm-chat"${vg.hatMap ? ` transform="${vg.hatMap}"` : ""}>${CHUBBY_HATS[hatKey]}</g>` : `<g transform="${vg.hat || "translate(178 52)"}">${hat.svg}</g>` : "";
      this.root.classList.toggle("mm-hide-bow", false);
      const ant = this._q(".mm-antenna");
      if (ant) ant.style.display = hat && hatKey !== "headband" && hatKey !== "headset" ? "none" : "";
      const up = eyeKey === "sunglasses" && !isTime;
      const ewT = up ? vg.sunglasses || "translate(178 104) scale(.78) translate(-178 -150)" : vg.eyewear;
      this.slots.eyewear.innerHTML = eyeKey ? ewT ? `<g transform="${ewT}">${EYEWEAR[eyeKey]}</g>` : EYEWEAR[eyeKey] : "";
      this.slots.scarf.innerHTML = scarf && vg.scarf !== null ? vg.scarf ? `<g transform="${vg.scarf}">${SCARF}</g>` : SCARF : "";
      let outfit = o.persona === "pro" ? poseV ? vg.suit || "" : stand ? STAND_SUIT : chubby ? CHUBBY_SUIT : SUIT : "";
      let cosHead = "";
      if (o.cosplay === "bebe" && chubby) {
        cosHead = vg.hatMap ? `<g transform="${vg.hatMap}">${CHUBBY_WOOL}</g>` : CHUBBY_WOOL;
      } else if (o.cosplay === "bebe") {
        const { cx, cy, r } = vg.head;
        for (let i = 0; i < 18; i++) {
          const a = i / 18 * Math.PI * 2, rr = r + 2 + i % 3 * 2;
          if (chubby && Math.sin(a) > 0.2) continue;
          cosHead += `<circle cx="${(cx + Math.cos(a) * rr).toFixed(1)}" cy="${(cy + Math.sin(a) * rr).toFixed(1)}" r="${14 + i % 2 * 3}" style="fill:${i % 2 ? "#FFFFFF" : "#F4EFE6"}"/>`;
        }
        if (!outfit && !chubby) outfit = [[136, 270, 16], [168, 262, 18], [204, 268, 17], [226, 280, 13], [130, 286, 12]].map(([x, y, rr], i) => `<circle cx="${x}" cy="${y}" r="${rr}" style="fill:${i % 2 ? "#FFFFFF" : "#F4EFE6"}"/>`).join("");
      } else if (o.cosplay === "glass") {
        const { cx, cy } = vg.head;
        cosHead = `<path d="M${cx - 70} ${cy - 70} L${cx - 40} ${cy - 92} L${cx - 96} ${cy + 10} L${cx - 100} ${cy - 20} Z" style="fill:#FFFFFF"/><path d="M${cx + 80} ${cy + 40} L${cx + 92} ${cy + 20} L${cx + 50} ${cy + 88} L${cx + 40} ${cy + 86} Z" style="fill:#FFFFFF"/>`;
        if (!outfit && !chubby) outfit = `<path d="M128 300 L146 290 L130 360 L122 362 Z M248 300 L262 296 L250 368 L240 370 Z" style="fill:#FFFFFF"/>`;
      }
      this.slots.outfit.innerHTML = outfit;
      this.slots["cos-head"].innerHTML = cosHead;
      let item = isTime ? st.item : fest && fest.item || season && season.item || st.item || (playful ? "lightstick" : null);
      let front = "";
      let hand = "";
      let handCls = "";
      if (item === "laptop") {
        front = `<g transform="${vg.laptop || "translate(178 352)"}">${ITEMS.laptop}</g>`;
        item = null;
      }
      if (vg.inhand) {
        if (item && item !== "_wave" && ITEMS[item]) {
          const [ix, iy] = vg.item;
          hand = `<g transform="translate(${ix} ${iy}) scale(.72)">${ITEMS[item]}</g>`;
          this.root.classList.add("mm-g-hold");
        }
      } else if (vg.ground) {
        if (item && item !== "_wave" && ITEMS[item]) {
          const [ix, iy] = vg.item;
          hand = `<g class="mm-handg mm-ground"><g transform="translate(${ix} ${iy}) scale(.9)">${ITEMS[item]}</g></g>`;
          handCls = st.handAnim === "lift" && isTime ? "mm-h-lift" : "";
        }
      } else if (item === "_wave") {
        hand = `<g class="mm-handg">${HAND}</g>`;
        handCls = "mm-h-wave";
      } else if (item && ITEMS[item]) {
        const [ix, iy] = vg.item;
        hand = `<g class="mm-handg"><g transform="translate(${ix} ${iy})">${ITEMS[item]}</g>${HAND}</g>`;
        handCls = st.handAnim === "lift" && isTime ? "mm-h-lift" : "mm-h-hold";
      }
      this.slots.hand.innerHTML = hand;
      this.slots.hand.setAttribute("class", "mm-hand " + handCls);
      const zones = { tl: null, l: null, bl: null, r: null };
      if (isTime && st.tl) zones.tl = st.tl;
      const fill = (list, keys) => list.forEach((d, i) => {
        const z = keys[i];
        if (z && !zones[z]) zones[z] = d;
      });
      if (season && fest) {
        fill(season.top, ["tl", "l"]);
        fill(fest.bottom, ["bl", "r"]);
      } else if (season || fest) {
        const t = season || fest;
        fill(t.top, ["tl", "l"]);
        fill(t.bottom, ["bl", "r"]);
      }
      if (item && zones.r && !chubby) zones.r = null;
      let back = "";
      Object.entries(zones).forEach(([z, d]) => {
        if (d && DECOR[d]) {
          const [x, y] = vg.zones[z];
          back += `<g transform="translate(${x} ${y})">${DECOR[d]}</g>`;
        }
      });
      if (o.festival === "halloween" && !isTime) back += `<g transform="translate(96 100) scale(.7)">${DECOR.bat}</g>`;
      this.slots.back.innerHTML = back;
      if (fest && fest.banner) {
        const text = fest.banner === "tet" ? st.wish || "CH\xDAC M\u1EEANG N\u0102M M\u1EDAI" : SALE_TEXT[Object.keys(STATES).indexOf(o.state) % SALE_TEXT.length];
        front += `<g transform="translate(206 398)">${banner(esc(text), fest.banner)}</g>`;
      }
      if (st.badge) {
        const [bx, by] = vg.badge;
        const ring = st.pulse || st.wave ? `<circle class="mm-ring" r="24" style="fill:none;stroke:var(--mm-s0);stroke-width:3"/>` : "";
        front += `<g transform="translate(${bx} ${by})">${ring}<g class="${st.pulse || st.badge === "warning" ? "mm-badge-pulse" : "mm-badge"}">${BADGES[st.badge]}</g></g>`;
      }
      this.slots.front.innerHTML = front;
      this._bubble(st, hat && hat.big);
      this._clearFx();
      const fxKind = pl.fx || st.fx;
      if (!this.reduce) {
        if (fxKind) {
          const every = st.every || 800;
          const spawn = () => this._stateFx(fxKind);
          spawn();
          this.fxTimer = setInterval(spawn, every);
        }
        const partKind = season && season.particle;
        if (partKind) {
          const sp = () => this._edgeFx(partKind);
          sp();
          this.partTimer = setInterval(sp, 800);
        }
        if (o.festival === "tet" || o.state === "party") {
        }
      }
    }
    _bubble(st, bigHat) {
      const o = this.o;
      const b = this.bubble;
      if (!o.bubble) {
        b.style.display = "none";
        return;
      }
      b.style.display = "";
      const p = o.persona;
      const playful = p === "playful";
      const isTime = st.group === G.time;
      let text = playful && st.play ? st.play.t : p === "pro" && st.pro ? st.pro : st.b;
      let k = st.k || "plain";
      let extra = "";
      if (!text && !isTime) text = "";
      if (isTime) k = st.k === "dream" ? "dream" : "time";
      const words = (t) => esc(t).split(" ").map((w, i) => `<span class="mm-w" style="animation-delay:${(i * 0.08).toFixed(2)}s">${w}</span>`).join("");
      const T = (t) => t ? `<div class="mm-bt">${playful ? words(t) : esc(t)}</div>` : "";
      let html = "";
      switch (k) {
        case "dots":
          html = T(text) + (playful ? "" : '<div class="mm-dots"><i></i><i></i><i></i></div>');
          break;
        case "heart":
          html = `<div class="mm-bt">${playful ? words(text) : esc(text)}<span class="mm-hrt">\u2665</span></div>`;
          break;
        case "mic":
          html = p === "friendly" || p === "premier" ? `<div class="mm-mic" style="color:var(--mm-s1)">${MIC}<div class="mm-bars"><i></i><i></i><i></i><i></i><i></i></div></div>` : T(text) + `<div class="mm-bars" style="margin-top:.3em"><i></i><i></i><i></i><i></i><i></i></div>`;
          break;
        case "cloud":
          html = p === "friendly" || p === "premier" ? `<div class="mm-dots" style="margin:.2em .4em;color:var(--mm-s1)"><i></i><i></i><i></i></div>` : T(text) + (playful ? "" : '<div class="mm-dots"><i></i><i></i><i></i></div>');
          break;
        case "search":
          html = p === "friendly" || p === "premier" ? `<div class="mm-srch" style="color:var(--mm-d)"><div class="mm-lines"><i></i><i></i><i></i></div>${LENS}</div>` : T(text) + (playful ? "" : `<div class="mm-srch" style="color:var(--mm-d)"><div class="mm-lines"><i></i><i></i></div>${LENS}</div>`);
          break;
        case "spin":
          html = playful ? T(text) : `<div class="mm-spinr"><b></b>${T(p === "pro" ? text : "\u0110ang x\u1EED l\xFD")}</div><div class="mm-prog"><i></i></div>`;
          break;
        case "lines":
          html = playful ? T(text) : (p === "pro" ? T(text) : "") + '<div class="mm-lines"><i></i><i></i><i></i></div>';
          break;
        case "zzz":
          html = T(text);
          break;
        case "time":
          html = `<div class="mm-time">${st.time}</div>` + T(text);
          break;
        case "dream":
          html = `<div class="mm-time">${st.time}</div><div class="mm-bt">${esc(text)} <svg viewBox="-16 -10 32 20" style="width:1.6em;height:1em;vertical-align:middle">${FX.fish()}</svg></div>`;
          break;
        default:
          html = T(text);
      }
      if (p === "pro") html = `<div class="mm-bh">MIMI \xB7 H\u1ED6 TR\u1EE2</div><div class="mm-bc">${html}</div>`;
      const anim = playful ? st.play && st.play.anim === "glitch" ? " mm-gl" : st.play && st.play.anim === "shake" ? " mm-shk" : "" : "";
      b.className = `mm-bubble mm-b-${p} mm-k-${k}${bigHat ? " mm-sm" : ""}${anim}`;
      b.innerHTML = html + extra;
    }
    _paintFace(over) {
      const f = over ? { ...this._face, ...over } : this._face;
      const chubby = PHOTO(this.o.variant), vg = this._pg || VARIANT_GEO[this.o.variant];
      if (this.o.variant === "pose") {
        const g = { ...f };
        if (!vg.open || !VECTOR_EYES[g.eyes || "open"]) g.eyes = "open";
        if (!vg.open || g.eyesR && !VECTOR_EYES[g.eyesR]) delete g.eyesR;
        const vMouth = !!(vg.hasMouth && VECTOR_MOUTH[g.mouth || "w"]);
        delete g.brow;
        g.puff = false;
        this.slots.face.innerHTML = `<g transform="${vg.face}">${buildChubbyFace(this.u, g, { nose: vg.nose, noMouth: !vMouth })}</g>`;
        this.root.classList.toggle("mm-veyes", vg.open && chubbyVectorEyes(g));
        this.root.classList.toggle("mm-vmouth", vMouth);
        return;
      }
      this.slots.face.innerHTML = this.o.variant === "stand" ? `<g transform="${vg.face}">${buildChubbyFace(this.u, f, { nose: vg.nose })}</g>` : chubby ? buildChubbyFace(this.u, f) : buildFace(this.u, f);
      if (chubby) this.root.classList.toggle("mm-veyes", chubbyVectorEyes(f));
    }
    /* Mèo ú: nhuộm lại áo / nơ (hoặc cả con khi Thân kính) bằng canvas – chỉ chạy khi đổi màu */
    _recolorArt() {
      if (!PHOTO(this.o.variant) || typeof document === "undefined") return;
      const REF = this.o.variant === "pose" ? POSE_REF : this.o.variant === "stand" ? STAND_ART_REF : CHUBBY_ART_REF;
      const cs = getComputedStyle(this.root), get = (k) => cs.getPropertyValue(k).trim();
      const fabric = this.o.colors && this.o.colors.fabric || MIMI_DEFAULT_COLORS.fabric;
      const accent = this.o.colors && this.o.colors.accent || MIMI_DEFAULT_COLORS.accent;
      const p = this.o.persona, glass = this.o.cosplay === "glass";
      const hoodC = p === "pro" ? get("--mm-d") : p === "premier" ? "#6F2A62" : fabric.toUpperCase() === MIMI_DEFAULT_COLORS.fabric.toUpperCase() ? null : fabric;
      const bowC = p === "premier" ? "#DAA730" : accent.toUpperCase() === MIMI_DEFAULT_COLORS.accent.toUpperCase() ? null : accent;
      const plan = {
        hood: hoodC && { color: hoodC, ref: REF.hood, mode: "hue" },
        hoodtop: hoodC && { color: hoodC, ref: REF.hood, mode: "hue" },
        cuffL: hoodC && { color: hoodC, ref: REF.hood, mode: "hue" },
        cuffR: hoodC && { color: hoodC, ref: REF.hood, mode: "hue" },
        bow: bowC && { color: bowC, ref: REF.bow, mode: "hue" }
      };
      if (glass) this.svg.querySelectorAll("image.mm-art").forEach((el) => {
        plan[el.getAttribute("data-layer")] = { color: "#BFE3FA", ref: [235, 170, 110], mode: "all" };
      });
      const job = this._recolorJob = (this._recolorJob || 0) + 1;
      this.svg.querySelectorAll("image.mm-art").forEach((el) => {
        const n = el.getAttribute("data-layer");
        const orig = el.__orig || (el.__orig = el.getAttribute("href"));
        const pl = plan[n] || (n.startsWith("ht_") ? plan.head : n.endsWith("_hood") ? plan.hood : n.endsWith("_bow") ? plan.bow : null);
        if (!pl) {
          if (el.getAttribute("href") !== orig) el.setAttribute("href", orig);
          return;
        }
        recolorImage(orig, pl).then((url) => {
          if (job === this._recolorJob && url) el.setAttribute("href", url);
        }).catch(() => {
        });
      });
    }
    /* Mèo ú: chớp mắt, liếc mắt, giật tai, cử chỉ ngẫu nhiên lúc rảnh */
    _life() {
      const L = this.life = [];
      const loop = (fn, min, max) => {
        const tick = () => {
          fn();
          L.push(setTimeout(tick, rnd(min, max)));
        };
        L.push(setTimeout(tick, rnd(min, max)));
      };
      const flash = (cls, ms) => {
        this.root.classList.add(cls);
        L.push(setTimeout(() => this.root.classList.remove(cls), ms));
      };
      loop(() => {
        flash("mm-blinking", 140);
        if (Math.random() < 0.25) L.push(setTimeout(() => flash("mm-blinking", 130), 260));
      }, 2600, 5600);
      loop(() => {
        const home = Math.random() < 0.35;
        this.root.style.setProperty("--mm-gx", (home ? 0 : rnd(-3.6, 3.6)).toFixed(1) + "px");
        this.root.style.setProperty("--mm-gy", (home ? 0 : rnd(-2.4, 2)).toFixed(1) + "px");
      }, 1400, 3800);
      loop(() => this._earFlick(Math.random() < 0.5 ? "fl" : "fr"), 4e3, 9e3);
      loop(() => {
        if (this.o.state !== "idle" || this.playTimer) return;
        const QS = this.o.variant === "pose" ? ["slow", "curious", "wag", "hop", "wag"] : QUIRKS;
        const q = QS[Math.floor(Math.random() * QS.length)];
        if (q === "slow") flash("mm-q-slow", 1700);
        else if (q === "wag") flash("mm-q-wag", 1500);
        else if (q === "hop") flash("mm-q-hop", 600);
        else if (q === "curious") {
          flash("mm-q-tilt", 1800);
          this._stateFx("q");
        } else {
          this._paintFace(q === "cat3" ? { eyes: "happy", mouth: "w", puff: true } : { mouth: "tongue" });
          const st = this.o.state;
          L.push(setTimeout(() => {
            if (this.o.state === st) this._paintFace();
          }, q === "cat3" ? 1600 : 1100));
        }
      }, 7e3, 12e3);
    }
    _lifeStop() {
      (this.life || []).forEach(clearTimeout);
      this.life = [];
    }
    /* Mèo đứng: khung chân – bước luân phiên (step), nhón một nhịp (hop), đứng yên (null) */
    _setLF(f) {
      if (this._lf) this.root.classList.remove("mm-lf-on-" + this._lf);
      this._lf = f;
      this.root.classList.add("mm-lf-on-" + f);
    }
    _legsStop() {
      clearInterval(this._legI);
      this._legI = null;
      (this._legT || []).forEach(clearTimeout);
      this._legT = [];
    }
    _legsTo(mode) {
      if (mode === this._legMode) return;
      this._legsStop();
      this._legMode = mode;
      if (!mode || this.reduce) {
        this._setLF("f0");
        return;
      }
      if (mode === "step") {
        let k = 0;
        const seq = ["L", "f0", "R", "f0"];
        this._setLF("L");
        this._legI = setInterval(() => this._setLF(seq[++k % 4]), 170);
        return;
      }
      if (mode === "hop") {
        const seq = ["B", "f0", "B", "f0"];
        seq.forEach((f, i) => this._legT.push(setTimeout(() => this._setLF(f), i * 150)));
      }
    }
    /* khung tai: chuyển từng bước f0 ↔ d1 ↔ d2 cho tai cụp từ từ */
    _setEF(f) {
      if (this._ef) this.root.classList.remove("mm-ef-" + this._ef);
      this._ef = f;
      this.root.classList.add("mm-ef-" + f);
    }
    _earStop() {
      (this._earT || []).forEach(clearTimeout);
      this._earT = [];
    }
    _earTo(target) {
      this._earStop();
      const cur = this._ef || "f0";
      if (cur === target) return;
      let path = [target];
      if (!this.reduce) {
        if (target === "d2" && cur !== "d1") path = ["d1", "d2"];
        else if (cur === "d2" && target !== "d1") path = ["d1", target];
      }
      path.forEach((f, i) => {
        const t = setTimeout(() => this._setEF(f), i * 90);
        this._earT.push(t);
      });
    }
    _earFlick(f) {
      if ((this._ef || "f0") !== "f0" || this._earT && this._earT.length) return;
      this._setEF(f);
      const t = setTimeout(() => {
        this._earT = [];
        if (this._ef === f) this._setEF("f0");
      }, this.o.variant === "pose" ? 520 : 150);
      this._earT = [t];
    }
    _clearFx() {
      clearInterval(this.fxTimer);
      clearInterval(this.partTimer);
      this.fxTimer = this.partTimer = null;
    }
    /* hạt bay theo trạng thái – xuất phát quanh góc trên phải, dưới box chat */
    _stateFx(kind) {
      const [bx, by] = (VARIANT_GEO[this.o.variant] || VARIANT_GEO.L).badge;
      const cols = ["#FF5C9A", "#FFC94D", "#5CC8E8", "#7ED67E", "#B69CFF"];
      const make = {
        heart: () => FX.heart(["#FF5C7A", "#FF8FAB", "#E9405A"][Math.floor(rnd(0, 3))]),
        sparkle: () => FX.sparkle(["#F6B300", "#FFFFFF", "var(--mm-a)"][Math.floor(rnd(0, 3))]),
        star: () => FX.star(),
        confetti: () => FX.confetti(cols[Math.floor(rnd(0, cols.length))])
      };
      const svg = (make[kind] || FX[kind] || FX.sparkle)();
      if (kind === "confetti") {
        const x2 = rnd(20, 380);
        this._particle(svg, x2, -10, { cls: "mm-fall", d: rnd(2.6, 3.6), dx: 0, dy: 0, rot: 0 });
        return;
      }
      if (kind === "paperball") {
        this._particle(svg, bx, by - 40, { d: 1.1, dx: 0, dy: 44, rot: 200 });
        return;
      }
      const x = bx + rnd(-26, 30), y = by + rnd(10, 40);
      this._particle(svg, x, y, { d: rnd(1.4, 2), dx: rnd(-20, 24), dy: -rnd(60, 100), rot: rnd(-30, 30) });
    }
    /* hạt rơi theo mùa – chỉ bay ở hai mép */
    _edgeFx(kind) {
      const left = Math.random() < 0.5;
      const x = left ? rnd(4, 70) : rnd(338, 398);
      this._particle(FX[kind](), x, -14, { cls: "mm-fall", d: rnd(5, 7.5), dx: 0, dy: 0, rot: 0 });
    }
    _particle(inner, x, y, { cls = "mm-fxp", d = 1.6, dx = 0, dy = -80, rot = 0 } = {}) {
      const fx = this.slots.fx;
      if (!fx || fx.childNodes.length > 70) return;
      const g = document.createElementNS(NS, "g");
      g.setAttribute("transform", `translate(${x.toFixed(1)} ${y.toFixed(1)})`);
      const inn = document.createElementNS(NS, "g");
      inn.setAttribute("class", cls);
      inn.setAttribute("style", `--d:${d.toFixed(2)}s;--dx:${dx.toFixed(1)}px;--dy:${dy.toFixed(1)}px;--rot:${rot.toFixed(0)}deg;transform-box:view-box;transform-origin:0 0`);
      inn.innerHTML = inner;
      g.appendChild(inn);
      fx.appendChild(g);
      const t = setTimeout(() => {
        g.remove();
        this.timers = this.timers.filter((z) => z !== t);
      }, d * 1e3 + 80);
      this.timers.push(t);
    }
  };
  MimiBot.STATES = STATES;
  MimiBot.PERSONAS = PERSONAS;
  MimiBot.SEASONS = SEASONS;
  MimiBot.FESTIVALS = FESTIVALS;
  MimiBot.COSPLAYS = COSPLAYS;
  MimiBot.VARIANTS = VARIANTS;
  MimiBot.STATE_COLORS = STATE_COLORS;
  MimiBot.DEFAULT_COLORS = MIMI_DEFAULT_COLORS;

  // <stdin>
  window.MimiBot = MimiBot;
})();
