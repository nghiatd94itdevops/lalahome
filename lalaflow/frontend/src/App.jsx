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

function Site() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const onAssistantPage = pathname === ASSISTANT_PATH;
  const [content, setContent] = useState(fallbackContent);
  const [products, setProducts] = useState([]);
  const [activities, setActivities] = useState([]);
  const [dataState, setDataState] = useState("loading");
  const [alert, setAlert] = useState(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const assistant = useAssistantChat({ active: chatOpen || onAssistantPage });

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
          <Route path={ASSISTANT_PATH} element={<AssistantPage {...shared} assistant={assistant} />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </ErrorBoundary>
      </main>
      {!onAssistantPage && <Footer company={content.company} />}
      <ContactChannels company={content.company} open={contactOpen} onOpenChange={changeContact} />
      {!onAssistantPage && <ChatAssistant open={chatOpen} onOpenChange={changeChat} onExpand={openAssistantPage} assistant={assistant} />}
      <TabBar company={content.company} chatOpen={chatOpen || onAssistantPage} onChat={onAssistantPage ? undefined : () => changeChat(!chatOpen)} contactOpen={contactOpen} onContact={() => changeContact(!contactOpen)} />
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
