import { useCallback, useEffect, useState } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { getJson } from "./api.js";
import { fallbackContent, mergeContent } from "./content.js";
import { AlertPopup, ContactChannels, Footer, Header, TabBar } from "./components/Shell.jsx";
import HomePage from "./pages/Home.jsx";
import { AboutPage, InfoPage } from "./pages/Company.jsx";
import ActivitiesPage from "./pages/Activities.jsx";
import { ProductDetail, ProductsPage } from "./pages/Products.jsx";
import QuoteRequestPage from "./pages/Quote.jsx";
import AssistantPage from "./pages/Assistant.jsx";
import AdminApp from "./admin/AdminApp.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import ChatAssistant from "./components/ChatAssistant.jsx";
import { useAssistantChat } from "./components/useAssistantChat.js";
import MimiConversation, { MIMI_GREETING, MIMI_WELCOME_BACK, MimiReturnHint } from "./components/MimiConversation.jsx";
import InstallBanner from "./components/InstallBanner.jsx";
import "./admin/admin.css";

function ScrollToTop() {
  const { pathname } = useLocation();
  // Braces matter: newer Chromium returns a Promise from scrollTo, which React would treat as a cleanup function.
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [pathname]);
  return null;
}

const ASSISTANT_PATH = "/tro-ly";
const PRODUCTS_PATH = "/san-pham";
// The cover's Welcome door links to /lalaflow/?mimi=1: the site opens with Mimi greeting the visitor face to face.
const MIMI_PARAM = "mimi";

function Site() {
  const { pathname, search } = useLocation();
  const navigate = useNavigate();
  const onAssistantPage = pathname === ASSISTANT_PATH;
  const [conversing, setConversing] = useState(() => new URLSearchParams(search).has(MIMI_PARAM));
  const [mimiGreeting, setMimiGreeting] = useState(MIMI_GREETING);
  const [returnHint, setReturnHint] = useState(false);
  const [content, setContent] = useState(fallbackContent);
  const [products, setProducts] = useState([]);
  const [activities, setActivities] = useState([]);
  const [dataState, setDataState] = useState("loading");
  const [alert, setAlert] = useState(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const assistant = useAssistantChat({ active: chatOpen || onAssistantPage || conversing, conversing });

  useEffect(() => {
    setContactOpen(false);
  }, [pathname]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getJson("/products"), getJson("/activities"), getJson("/site-content")])
      .then(([productList, activityList, siteContent]) => {
        if (cancelled) return;
        setProducts(productList);
        setActivities(activityList);
        setContent(mergeContent(siteContent));
        setDataState("ready");
      })
      .catch((error) => {
        console.error(`LalaFlow public data failed to load from the API: ${error.message}`);
        if (!cancelled) setDataState("error");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const notify = useCallback((type, message) => setAlert({ type, message }), []);
  const closeAlert = useCallback(() => setAlert(null), []);
  const changeChat = (open) => {
    setChatOpen(open);
    if (open) setContactOpen(false);
  };
  // The full page takes over from the floating panel, carrying on the same conversation.
  const openAssistantPage = () => {
    setChatOpen(false);
    navigate(ASSISTANT_PATH);
  };
  // Dropping ?mimi=1 keeps a reload or a shared link from greeting again; a product link clicked on the screen
  // navigates right after this.
  const closeConversation = useCallback(() => {
    setConversing(false);
    setReturnHint(true);
    if (new URLSearchParams(window.location.search).has(MIMI_PARAM)) navigate(pathname, { replace: true });
  }, [navigate, pathname]);
  const openConversation = () => {
    setChatOpen(false);
    setContactOpen(false);
    setReturnHint(false);
    setMimiGreeting(MIMI_WELCOME_BACK);
    setConversing(true);
  };
  const hideReturnHint = useCallback(() => setReturnHint(false), []);
  const shared = { content, products, activities, dataState, notify, openAssistant: () => changeChat(true), openAssistantPage };
  const changeContact = (open) => {
    setContactOpen(open);
    if (open) setChatOpen(false);
  };

  return (
    <div className={`site ${onAssistantPage ? "is-assistant-page" : ""}`}>
      <ScrollToTop />
      <Header company={content.company} />
      <InstallBanner />
      <main>
        <ErrorBoundary resetKey={pathname}>
        <Routes>
          <Route path="/" element={<HomePage {...shared} />} />
          <Route path="/gioi-thieu" element={<AboutPage {...shared} />} />
          <Route path="/thong-tin" element={<InfoPage {...shared} />} />
          <Route path="/hoat-dong" element={<ActivitiesPage {...shared} />} />
          <Route path="/san-pham" element={<ProductsPage {...shared} />} />
          <Route path="/san-pham/:id" element={<ProductDetail {...shared} />} />
          <Route path="/yeu-cau-bao-gia" element={<QuoteRequestPage {...shared} />} />
          <Route path={ASSISTANT_PATH} element={<AssistantPage {...shared} assistant={assistant} onTalk={openConversation} />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </ErrorBoundary>
      </main>
      {!onAssistantPage && <Footer company={content.company} />}
      <ContactChannels company={content.company} open={contactOpen} onOpenChange={changeContact} />
      {!onAssistantPage && <ChatAssistant open={chatOpen} onOpenChange={changeChat} onExpand={openAssistantPage} onTalk={openConversation} assistant={assistant} />}
      <TabBar company={content.company} chatOpen={chatOpen || onAssistantPage} onChat={onAssistantPage ? undefined : () => changeChat(!chatOpen)} contactOpen={contactOpen} onContact={() => changeContact(!contactOpen)} />
      {conversing && (
        <MimiConversation
          assistant={assistant}
          greetingText={mimiGreeting}
          onClose={closeConversation}
          onBrowse={() => { closeConversation(); navigate(PRODUCTS_PATH); }}
          onOpenChat={() => { closeConversation(); navigate(ASSISTANT_PATH); }}
        />
      )}
      {returnHint && !conversing && !chatOpen && <MimiReturnHint onOpen={openConversation} onDone={hideReturnHint} />}
      <AlertPopup alert={alert} onClose={closeAlert} />
    </div>
  );
}

export default function App() {
  const { pathname } = useLocation();
  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    return (
      <Routes>
        <Route path="/admin" element={<AdminApp />} />
        <Route path="/admin/:tab" element={<AdminApp />} />
      </Routes>
    );
  }
  return <Site />;
}
