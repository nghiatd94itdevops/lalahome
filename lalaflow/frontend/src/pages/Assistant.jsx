import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { money } from "../api.js";
import { useSeo } from "../seo.js";
import { primaryImage, ProductImage, RatingSummary, RollSize, StatusPill } from "../components/Cards.jsx";
import { AssistantHead, ChatComposer, ChatProducts, ChatThread, chooserFor, isChoice, SuggestionLabel, useFollowLatest } from "../components/ChatAssistant.jsx";
import { PHONE_QUERY } from "../components/Shell.jsx";

const IN_STOCK = "Có sẵn";
const SHELF_SORTS = {
  fit: { label: "Phù hợp nhất", compare: () => 0 },
  priceAsc: { label: "Giá tăng dần", compare: (a, b) => a.price - b.price },
  priceDesc: { label: "Giá giảm dần", compare: (a, b) => b.price - a.price },
};

function ShelfCard({ product, number, onChoose }) {
  const image = primaryImage(product);
  return (
    <li className="shelf-card">
      <Link to={`/san-pham/${product.id}`} className="shelf-card-photo" tabIndex={-1} aria-hidden="true">
        <ProductImage key={image} path={image} alt="" label={product.category} loading="lazy" />
        <StatusPill status={product.status} />
      </Link>
      <div className="shelf-card-body">
        {number && <SuggestionLabel number={number} onChoose={onChoose} />}
        <span className="kicker">{product.category}</span>
        <h3><Link to={`/san-pham/${product.id}`}>{product.name}</Link></h3>
        <RatingSummary rating={product.rating} />
        <RollSize product={product} />
        <span className="product-price">{money(product.price)}{product.unit && <small> / {product.unit}</small>}</span>
        <span className="shelf-card-links">
          <Link to={`/san-pham/${product.id}`} className="text-link">Xem chi tiết →</Link>
          <Link to={`/yeu-cau-bao-gia?product=${product.id}`} className="btn btn-door">Báo giá</Link>
        </span>
      </div>
    </li>
  );
}

// The products of one answer as large cards. The chat sends compact cards, so rating and photos come from the
// catalogue the site already loaded, falling back to the chat's card for a product not in it.
function ProductShelf({ answer, question, catalogue, onAsk, onChoose }) {
  const [sort, setSort] = useState("fit");
  const [onlyInStock, setOnlyInStock] = useState(false);
  const shown = useMemo(() => {
    if (!answer) return [];
    const numbered = isChoice(answer.products);
    // The suggestion number is fixed before sorting, so "Đề xuất 2" stays the second product of the answer.
    return answer.products
      .map((p, i) => ({ ...p, ...catalogue.get(p.id), suggestion: numbered ? i + 1 : null }))
      .filter((p) => !onlyInStock || p.status === IN_STOCK)
      .sort(SHELF_SORTS[sort].compare);
  }, [answer, catalogue, sort, onlyInStock]);

  if (!answer) {
    return (
      <section className="assistant-shelf is-empty" aria-label="Kệ sản phẩm">
        <h2>Kệ sản phẩm của bạn</h2>
        <p>Kể cho Mimi bạn cần giấy gì, dùng vào việc gì và giá khoảng bao nhiêu. Sản phẩm phù hợp sẽ bày ở đây để bạn so sánh.</p>
        <button type="button" className="btn btn-door" onClick={onAsk}>Bắt đầu hỏi →</button>
      </section>
    );
  }

  return (
    <section className="assistant-shelf" aria-label="Kệ sản phẩm">
      <div className="shelf-head">
        <div>
          <p className="eyebrow">{answer.suggested ? "Gợi ý gần nhất" : "Sản phẩm phù hợp"} · {answer.products.length}</p>
          {question && <h2>“{question}”</h2>}
        </div>
        <div className="shelf-tools">
          <label className="sort-field">
            <span>Sắp xếp</span>
            <select value={sort} onChange={(e) => setSort(e.target.value)}>
              {Object.entries(SHELF_SORTS).map(([key, option]) => <option key={key} value={key}>{option.label}</option>)}
            </select>
          </label>
          <label className="stock-toggle"><input type="checkbox" checked={onlyInStock} onChange={(e) => setOnlyInStock(e.target.checked)} /> Chỉ hàng có sẵn</label>
        </div>
      </div>
      {shown.length
        ? <ul className="shelf-grid">{shown.map((p) => <ShelfCard key={p.id} product={p} number={p.suggestion} onChoose={onChoose} />)}</ul>
        : <p className="empty-note">Không có sản phẩm nào đang có sẵn trong lần tìm này. Bỏ chọn “Chỉ hàng có sẵn” để xem cả hàng đang nhập.</p>}
    </section>
  );
}

// Desktop: the answer's products sit on the shelf, so the conversation only shows a button to put them there.
// Phone: there is no shelf, the compact cards stay under the answer (CSS shows one or the other).
function AnswerProducts({ message, index, onShelf, onShow, onChoose }) {
  return (
    <>
      <button type="button" className={`shelf-pick ${onShelf ? "is-on" : ""}`} aria-pressed={onShelf} onClick={() => onShow(index)}>
        {onShelf ? `Đang bày ${message.products.length} sản phẩm trên kệ` : `Xem ${message.products.length} sản phẩm trên kệ →`}
      </button>
      <div className="answer-inline-products"><ChatProducts message={message} onChoose={onChoose} /></div>
    </>
  );
}

export default function AssistantPage({ content, products, assistant, onTalk }) {
  useSeo({ title: `Trợ lý AI Mimi – ${content.company.name}`, description: "Hỏi Mimi loại giấy bạn cần, xem và so sánh sản phẩm phù hợp ngay trên kệ.", path: "/tro-ly", company: content.company });
  const listRef = useRef(null);
  const inputRef = useRef(null);
  const [picked, setPicked] = useState(null);
  useFollowLatest(listRef, assistant, true);

  // A new answer (or a new conversation) brings the shelf back to the latest products.
  useEffect(() => {
    setPicked(null);
  }, [assistant.messages.length]);

  // On phones focusing would pop the keyboard over the page as soon as it opens.
  useEffect(() => {
    if (!window.matchMedia(PHONE_QUERY).matches) inputRef.current?.focus();
  }, []);

  const { messages } = assistant;
  const catalogue = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const shelfIndex = picked ?? messages.findLastIndex((m) => m.role === "assistant" && m.products?.length > 0);
  const answer = messages[shelfIndex] || null;
  const question = answer ? messages[messages.slice(0, shelfIndex).findLastIndex((m) => m.role === "user")]?.content : "";

  return (
    <div className="assistant-page">
      <section className="assistant-chat" aria-label="Trò chuyện với trợ lý AI">
        <AssistantHead assistant={assistant} onTalk={onTalk} />
        <ChatThread
          assistant={assistant}
          listRef={listRef}
          renderProducts={(m, i) => <AnswerProducts message={m} index={i} onShelf={i === shelfIndex} onShow={setPicked} onChoose={chooserFor(assistant, i)} />}
        />
        <ChatComposer assistant={assistant} inputRef={inputRef} />
      </section>
      <ProductShelf answer={answer} question={question} catalogue={catalogue} onAsk={() => inputRef.current?.focus()} onChoose={chooserFor(assistant, shelfIndex)} />
    </div>
  );
}
