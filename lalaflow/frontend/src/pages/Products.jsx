import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { formatDate, getJson, money, postJson } from "../api.js";
import { ProductCard, ProductImage, RatingStars, RatingSummary, rollSize, StatusPill } from "../components/Cards.jsx";
import { PaintedPanel, SectionHead } from "../components/Scenery.jsx";
import { Mimi, MimiNote } from "../components/Mimi.jsx";
import { PageHero } from "../components/Shell.jsx";
import { useSeo } from "../seo.js";

const ALL = "Tất cả";
const IN_STOCK = "Có sẵn";
const SORTS = {
  newest: { label: "Mới nhất", compare: (a, b) => b.id - a.id },
  priceAsc: { label: "Giá tăng dần", compare: (a, b) => a.price - b.price },
  priceDesc: { label: "Giá giảm dần", compare: (a, b) => b.price - a.price },
  name: { label: "Tên A–Z", compare: (a, b) => a.name.localeCompare(b.name, "vi") },
};
// What the product page says, and how Mimi acts it out, when there is no product to show.
const NOT_FOUND = {
  loading: { state: "processing", text: "Đang tải sản phẩm…" },
  error: { state: "error", text: "Chưa tải được sản phẩm, bạn thử tải lại trang nhé." },
  ready: { state: "confused", text: "Sản phẩm không tồn tại hoặc đã ngừng bán." },
};
const DETAIL_FALLBACK = "Sản phẩm giấy chất lượng cao được LalaFlow tuyển chọn cho nhu cầu sản xuất và văn phòng.";
const RELATED_COUNT = 3;
const REVIEWS_ANCHOR = "danh-gia";
const SAMPLE_PREFIX = "[Mẫu]";
const STAR_LEVELS = [5, 4, 3, 2, 1];

const REVIEW_NAME_MAX = 60;
const REVIEW_COMMENT_MAX = 1000;
const STAR_LABELS = { 1: "Rất tệ", 2: "Chưa tốt", 3: "Tạm được", 4: "Tốt", 5: "Tuyệt vời" };
const REVIEWER_KEY_STORAGE = "lalaflow.reviewer";

// The server rate-limits reviews per browser by this key (many visitors can share one IP). Storage can be blocked
// (private mode); then the key lives for this page view only, which still lets the review through.
function reviewerKey() {
  const fresh = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  try {
    const saved = localStorage.getItem(REVIEWER_KEY_STORAGE);
    if (saved) return saved;
    localStorage.setItem(REVIEWER_KEY_STORAGE, fresh);
  } catch {
    // blocked storage: fall back to a key for this page view
  }
  return fresh;
}

// isThanked lives in ProductReviews: the first review moves this form into another layout, which remounts it.
function ReviewForm({ productId, onSubmitted, isThanked, onThankedChange }) {
  const [name, setName] = useState("");
  const [stars, setStars] = useState(0);
  const [hoverStars, setHoverStars] = useState(0);
  const [comment, setComment] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState("");
  const shownStars = hoverStars || stars;

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    if (!stars) return setError("Vui lòng chọn số sao.");
    setIsSending(true);
    const { ok, data } = await postJson(`/products/${productId}/reviews`, { reviewerKey: reviewerKey(), reviewerName: name, rating: stars, comment })
      .catch((failure) => {
        console.error(`Sending review for product ${productId} failed:`, failure);
        return { ok: false, data: { error: "Không kết nối được máy chủ, vui lòng thử lại." } };
      });
    setIsSending(false);
    if (!ok) return setError(data.error || "Gửi đánh giá không thành công, vui lòng thử lại.");
    onSubmitted(data.review, data.rating);
    setStars(0);
    setComment("");
    onThankedChange(true);
  };

  if (isThanked) {
    return (
      <div className="review-form review-thanks" role="status">
        <Mimi state="love" className="review-thanks-mimi" />
        <strong>Cảm ơn bạn đã đánh giá!</strong>
        <span>Đánh giá của bạn đã hiển thị bên dưới.</span>
        <button type="button" className="text-link" onClick={() => onThankedChange(false)}>Viết thêm đánh giá</button>
      </div>
    );
  }

  return (
    <form className="review-form" onSubmit={submit}>
      <strong className="review-form-title">Viết đánh giá của bạn</strong>
      <div className="star-picker" role="radiogroup" aria-label="Số sao" onMouseLeave={() => setHoverStars(0)}>
        {STAR_LEVELS.slice().reverse().map((value) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={stars === value}
            aria-label={`${value} sao – ${STAR_LABELS[value]}`}
            className={value <= shownStars ? "is-on" : ""}
            onMouseEnter={() => setHoverStars(value)}
            onClick={() => setStars(value)}
          >
            ★
          </button>
        ))}
        <span className="star-picker-label">{shownStars ? STAR_LABELS[shownStars] : "Chọn số sao"}</span>
      </div>
      <label>
        <span>Tên của bạn</span>
        <input value={name} onChange={(event) => setName(event.target.value)} maxLength={REVIEW_NAME_MAX} required minLength={2} placeholder="Ví dụ: Chị Lan" />
      </label>
      <label>
        <span>Nhận xét <em>(không bắt buộc)</em></span>
        <textarea value={comment} onChange={(event) => setComment(event.target.value)} maxLength={REVIEW_COMMENT_MAX} rows={3} placeholder="Chất lượng, màu sắc, giao hàng…" />
      </label>
      {error && <p className="review-error" role="alert">{error}</p>}
      <button type="submit" className="btn btn-door" disabled={isSending}>{isSending ? "Đang gửi…" : "Gửi đánh giá"}</button>
    </form>
  );
}

function ProductReviews({ productId, rating, onRatingChange }) {
  const [isThanked, setIsThanked] = useState(false);
  const [reviews, setReviews] = useState([]);
  const [loadState, setLoadState] = useState("loading");

  useEffect(() => {
    let isCurrent = true;
    setLoadState("loading");
    setIsThanked(false);
    getJson(`/products/${productId}/reviews`)
      .then((rows) => {
        if (!isCurrent) return;
        setReviews(rows);
        setLoadState("ready");
      })
      .catch((error) => {
        console.error(`Loading reviews for product ${productId} failed:`, error);
        if (isCurrent) setLoadState("error");
      });
    return () => {
      isCurrent = false;
    };
  }, [productId]);

  const countByStars = STAR_LEVELS.map((stars) => ({ stars, count: reviews.filter((review) => review.rating === stars).length }));
  const addReview = (review, summary) => {
    setReviews((current) => [review, ...current]);
    onRatingChange(summary);
  };
  const form = <ReviewForm productId={productId} onSubmitted={addReview} isThanked={isThanked} onThankedChange={setIsThanked} />;

  return (
    <section className="wrap section reviews" id={REVIEWS_ANCHOR}>
      <SectionHead eyebrow="KHÁCH HÀNG NÓI GÌ" title="Đánh giá sản phẩm" />
      {loadState === "error" && <MimiNote state="error"><p>Không tải được đánh giá, vui lòng thử lại sau.</p></MimiNote>}
      {loadState === "ready" && reviews.length === 0 && (
        <div className="reviews-empty">
          <MimiNote state="greet"><p>Chưa có đánh giá nào. Bạn là người đầu tiên chia sẻ cảm nhận nhé!</p></MimiNote>
          {form}
        </div>
      )}
      {loadState === "ready" && reviews.length > 0 && (
        <div className="reviews-grid">
          <div className="reviews-side">
          <div className="reviews-score">
            <strong>{Number(rating.average).toLocaleString("vi-VN", { minimumFractionDigits: 1 })}</strong>
            <RatingStars value={rating.average} size="lg" />
            <span>{rating.count} đánh giá</span>
            <ul className="reviews-bars">
              {countByStars.map(({ stars, count }) => (
                <li key={stars}>
                  <span>{stars}★</span>
                  <span className="bar"><span style={{ width: `${(count / reviews.length) * 100}%` }} /></span>
                  <span>{count}</span>
                </li>
              ))}
            </ul>
          </div>
          {form}
          </div>
          <ul className="reviews-list">
            {reviews.map((review) => (
              <li key={review.id} className="review">
                <div className="review-head">
                  <strong>{review.reviewerName}</strong>
                  <RatingStars value={review.rating} size="sm" />
                  <span className="muted">{formatDate(review.createdAt)}</span>
                  {review.isSample && <span className="review-sample">Đánh giá mẫu</span>}
                </div>
                {review.comment && <p>{review.comment}</p>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

export function ProductsPage({ content, products, dataState, openAssistant }) {
  const { company, pages } = content;
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState(ALL);
  const [sort, setSort] = useState("newest");
  const [onlyInStock, setOnlyInStock] = useState(false);
  useSeo({
    title: `Danh mục sản phẩm | ${company.name}`,
    description: pages.productHeroText || `Danh mục giấy và bao bì của ${company.name}.`,
    path: "/san-pham",
    company,
  });

  const categoryCounts = useMemo(() => {
    const counts = new Map();
    products.forEach((p) => p.category && counts.set(p.category, (counts.get(p.category) || 0) + 1));
    return [[ALL, products.length], ...counts];
  }, [products]);
  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return products
      .filter((p) => {
        const inCategory = category === ALL || p.category === category;
        const matches = !needle || `${p.name} ${p.category} ${p.description || ""}`.toLowerCase().includes(needle);
        return inCategory && matches && (!onlyInStock || p.status === IN_STOCK);
      })
      .sort(SORTS[sort].compare);
  }, [products, query, category, sort, onlyInStock]);
  const resetFilters = () => {
    setQuery("");
    setCategory(ALL);
    setOnlyInStock(false);
  };

  return (
    <>
      <PageHero eyebrow={pages.productEyebrow} title={pages.productHeroTitle} text={pages.productHeroText} focus="88% 88%" />

      <section className="wrap section">
        <div className="shelf-toolbar">
          <div className="toolbar-row">
            <label className="search-field">
              <span className="visually-hidden">Tìm sản phẩm</span>
              <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4.5 4.5" /></svg>
              <input id="product-search" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Tìm tên, loại hoặc công dụng..." />
            </label>
            <label className="sort-field">
              <span>Sắp xếp</span>
              <select id="product-sort" value={sort} onChange={(e) => setSort(e.target.value)}>
                {Object.entries(SORTS).map(([key, option]) => <option key={key} value={key}>{option.label}</option>)}
              </select>
            </label>
          </div>
          <div className="chip-row" role="group" aria-label="Lọc theo loại sản phẩm">
            <div className="chip-scroll">
              {categoryCounts.map(([item, count]) => (
                <button key={item} type="button" className={`chip ${item === category ? "is-active" : ""}`} aria-pressed={item === category} onClick={() => setCategory(item)}>
                  {item} <span className="chip-count">{count}</span>
                </button>
              ))}
            </div>
            <label className="stock-toggle"><input type="checkbox" checked={onlyInStock} onChange={(e) => setOnlyInStock(e.target.checked)} /> Chỉ hàng có sẵn</label>
          </div>
        </div>
        {dataState === "error" && <MimiNote state="error"><p>Chưa tải được danh mục sản phẩm, bạn thử tải lại trang nhé.</p></MimiNote>}
        {dataState !== "error" && <p className="result-line"><strong>{visible.length} sản phẩm</strong>{category !== ALL && ` trong “${category}”`}{query.trim() && ` khớp “${query.trim()}”`}</p>}
        {dataState === "loading" && <p className="muted">Đang mở kho hàng…</p>}
        {dataState === "ready" && !visible.length && (
          <MimiNote state="sad">
            <p>Mimi chưa tìm thấy sản phẩm phù hợp. Bạn thử xoá bộ lọc, hoặc kể Mimi nghe bạn cần gì nhé.</p>
            <div className="actions">
              <button type="button" className="btn btn-paper" onClick={resetFilters}>Xóa bộ lọc</button>
              <button type="button" className="btn btn-door" onClick={openAssistant}>Hỏi Mimi →</button>
            </div>
          </MimiNote>
        )}
        <div className="product-grid">
          {visible.map((product) => <ProductCard key={product.id} product={product} />)}
        </div>
      </section>
    </>
  );
}

export function ProductDetail({ content, products, dataState }) {
  const { id } = useParams();
  const { company } = content;
  const product = products.find((p) => String(p.id) === String(id));
  const gallery = useMemo(() => {
    if (!product) return [];
    if (product.images?.length) return product.images.map((image) => image.path);
    return product.image ? [product.image] : [];
  }, [product]);
  const [selected, setSelected] = useState(0);
  // A review posted on this page returns the new average; it overrides the list's copy until the product changes.
  const [postedRating, setPostedRating] = useState(null);
  useEffect(() => {
    setSelected(0);
    setPostedRating(null);
  }, [id]);

  useSeo({
    title: product ? `${product.name} | ${company.name}` : `Sản phẩm | ${company.name}`,
    description: product
      ? product.description || `${product.name} thuộc danh mục ${product.category}, liên hệ ${company.name} để nhận báo giá.`
      : company.description,
    path: `/san-pham/${id}`,
    product,
    company,
    // Placeholder rows copied from other stores for testing must never be indexed.
    noindex: Boolean(product?.name?.startsWith(SAMPLE_PREFIX)),
  });

  if (!product) {
    const notFound = NOT_FOUND[dataState] || NOT_FOUND.ready;
    return (
      <section className="wrap section">
        <MimiNote state={notFound.state}><p>{notFound.text}</p></MimiNote>
        <Link to="/san-pham" className="btn btn-paper">← Về danh mục sản phẩm</Link>
      </section>
    );
  }

  const sameCategory = products.filter((p) => p.id !== product.id && p.category === product.category);
  const others = products.filter((p) => p.id !== product.id && p.category !== product.category);
  const related = [...sameCategory, ...others].slice(0, RELATED_COUNT);
  const roll = rollSize(product);

  return (
    <>
      <section className="wrap section product-detail">
        <nav className="breadcrumb" aria-label="Đường dẫn">
          <Link to="/san-pham">Sản phẩm</Link> / <span>{product.category}</span> / <strong>{product.name}</strong>
        </nav>
        <div className="detail-grid">
          <div className="gallery">
            <div className="gallery-frame">
              {gallery.length ? (
                <ProductImage key={gallery[selected]} path={gallery[selected]} alt={product.name} label={product.category} />
              ) : (
                <PaintedPanel focus="86% 92%" className="gallery-empty" drift={false}>
                  <span>{product.category}</span>
                </PaintedPanel>
              )}
            </div>
            {gallery.length > 1 && (
              <div className="thumbs">
                {gallery.map((path, i) => (
                  <button key={path} type="button" className={i === selected ? "is-active" : ""} aria-label={`Xem hình ${i + 1}`} onClick={() => setSelected(i)}>
                    <ProductImage path={path} alt="" label="" />
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="detail-copy">
            <p className="eyebrow">{product.category}</p>
            <h1>{product.name}</h1>
            <div className="detail-meta">
              <StatusPill status={product.status} />
              {/* A button, not href="#…": with HashRouter a fragment link would be read as a route. */}
              <button type="button" className="detail-rating" onClick={() => document.getElementById(REVIEWS_ANCHOR)?.scrollIntoView({ behavior: "smooth" })}>
                <RatingSummary rating={postedRating ?? product.rating} />
              </button>
            </div>
            <p className="lead">{product.description || DETAIL_FALLBACK}</p>
            <div className="price-board">
              <span>Giá tham khảo</span>
              <strong>{money(product.price)}</strong>
              {product.unit && <em>/ {product.unit}</em>}
            </div>
            <ul className="spec-list">
              {roll && <li><span>Kích thước</span>{roll.dimensions}</li>}
              {roll && <li><span>Diện tích</span>{roll.coverage}</li>}
              <li><span>Tồn kho</span>{product.stock} {product.unit || "đơn vị"}</li>
              <li><span>Danh mục</span>{product.category}</li>
              <li><span>Giao hàng</span>Toàn quốc</li>
            </ul>
            <Link to={`/yeu-cau-bao-gia?product=${product.id}`} className="btn btn-door btn-large">Nhận tư vấn & báo giá →</Link>
          </div>
        </div>
      </section>

      <ProductReviews productId={product.id} rating={postedRating ?? product.rating} onRatingChange={setPostedRating} />

      {related.length > 0 && (
        <section className="wrap section">
          <SectionHead eyebrow="CÓ THỂ BẠN QUAN TÂM" title={sameCategory.length ? "Sản phẩm cùng danh mục" : "Sản phẩm khác"} />
          <div className="product-grid">
            {related.map((item) => <ProductCard key={item.id} product={item} />)}
          </div>
        </section>
      )}
    </>
  );
}
