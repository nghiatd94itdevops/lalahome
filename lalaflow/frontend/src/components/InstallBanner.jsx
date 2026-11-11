import { useEffect, useState } from "react";

// Versioned: v1 told in-app iPhone users to tap a Share button they do not have, so anyone who closed it sees the fix once.
const DISMISSED_KEY = "lalaflow.installBanner.dismissed.v2";
// In-app browsers (Zalo, Facebook, Messenger, Instagram, Line, TikTok) cannot add pages to the home screen at all.
const IN_APP_BROWSER = /zalo|fban|fbav|fb_iab|messenger|instagram|line\/|tiktok|bytedance/i;

// Opened from the home-screen icon: the page runs without browser UI (no address bar, no reload button).
export function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
}

// iPadOS reports a desktop Safari user agent, so touch support tells it apart from a Mac.
function isIos() {
  const { userAgent, maxTouchPoints } = window.navigator;
  return /iphone|ipad|ipod/i.test(userAgent) || (/macintosh/i.test(userAgent) && maxTouchPoints > 1);
}

function detectPlatform() {
  const { userAgent } = window.navigator;
  const isAndroid = /android/i.test(userAgent);
  if (IN_APP_BROWSER.test(userAgent)) return isAndroid ? "in-app-android" : "in-app-ios";
  if (isIos()) {
    // Real iOS browsers (Safari, Chrome, Edge…) carry a "Safari/" token; app web views such as Zalo's do not,
    // and their user agent does not always name the app either.
    return /Safari\//.test(userAgent) ? "ios" : "in-app-ios";
  }
  if (isAndroid) return "android";
  return "desktop";
}

function readDismissed() {
  try {
    return window.localStorage.getItem(DISMISSED_KEY) === "1";
  } catch {
    // Storage blocked (private mode): the banner simply shows again next visit.
    return false;
  }
}

function rememberDismissed() {
  try {
    window.localStorage.setItem(DISMISSED_KEY, "1");
  } catch (error) {
    console.warn(`Could not remember that the install banner was dismissed: ${error.message}`);
  }
}

// What to tell the visitor when the browser has not (or cannot) hand us an install prompt.
const MANUAL_STEPS = {
  ios: <>Bấm nút <b>Chia sẻ</b> <span aria-hidden="true">⬆︎</span> rồi chọn <b>“Thêm vào MH chính”</b>.</>,
  android: <>Bấm menu <b>⋮</b> của trình duyệt rồi chọn <b>“Thêm vào màn hình chính”</b> hoặc <b>“Cài đặt ứng dụng”</b>.</>,
  "in-app-ios": <>Bạn đang xem trong ứng dụng (Zalo, Facebook…). Bấm <b>⋯</b> ở góc trên → <b>“Mở bằng Safari”</b>, rồi trong Safari bấm <b>Chia sẻ</b> → <b>“Thêm vào MH chính”</b>.</>,
  "in-app-android": <>Bạn đang xem trong ứng dụng (Zalo, Facebook…). Bấm <b>⋯</b> ở góc trên → <b>“Mở bằng trình duyệt”</b>, rồi chọn <b>“Thêm vào màn hình chính”</b>.</>,
};

// Chrome only fires beforeinstallprompt after some engagement, and in-app browsers never do, so on phones the banner
// shows manual steps straight away and swaps to a one-tap "Cài đặt" button once the browser offers the prompt.
export default function InstallBanner() {
  const [installPrompt, setInstallPrompt] = useState(null);
  const [isHidden, setIsHidden] = useState(() => isStandalone() || readDismissed());
  const [platform] = useState(detectPlatform);

  useEffect(() => {
    const onPrompt = (event) => {
      event.preventDefault();
      setInstallPrompt(event);
    };
    const onInstalled = () => setIsHidden(true);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const manualSteps = MANUAL_STEPS[platform];
  if (isHidden || (!installPrompt && !manualSteps)) return null;

  const dismiss = () => {
    rememberDismissed();
    setIsHidden(true);
  };

  const install = async () => {
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    setInstallPrompt(null);
    if (outcome === "accepted") setIsHidden(true);
  };

  return (
    <div className="wrap install-banner" role="region" aria-label="Cài ứng dụng LalaFlow" data-platform={platform}>
      <img src={`${import.meta.env.BASE_URL}icons/icon-192.png`} alt="" width="44" height="44" />
      <div className="install-copy">
        <strong>Thêm LalaFlow vào màn hình chính</strong>
        <span>{installPrompt ? "Mở nhanh như một ứng dụng, không cần tải từ cửa hàng." : manualSteps}</span>
      </div>
      {installPrompt && (
        <button type="button" className="btn btn-door install-action" onClick={install}>Cài đặt</button>
      )}
      <button type="button" className="install-close" aria-label="Ẩn gợi ý cài đặt" onClick={dismiss}>×</button>
    </div>
  );
}
