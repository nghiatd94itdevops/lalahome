import { useState } from "react";
import { Link } from "react-router-dom";
import { formatDate, imageUrl, money } from "../api.js";
import { PRODUCT_STATUS_TONE } from "../content.js";

const PRODUCT_FALLBACK = "Sản phẩm giấy chất lượng cao, phù hợp nhiều nhu cầu sử dụng.";

export function primaryImage(product) {
  return product.images?.[0]?.path || product.image || "";
}

// Drawn stand-in for products that have no photo yet: a stack of paper sheets with the category name.
export function ProductArt({ label }) {
  return (
    <span className="product-art" aria-hidden="true">
      <svg viewBox="0 0 120 90">
        <rect x="26" y="22" width="64" height="50" rx="3" fill="#efe2c4" stroke="#b9783f" strokeWidth="2" transform="rotate(-7 58 47)" />
        <rect x="30" y="18" width="64" height="50" rx="3" fill="#fbf3e4" stroke="#b9783f" strokeWidth="2" transform="rotate(4 62 43)" />
        <rect x="28" y="20" width="64" height="50" rx="3" fill="#fff" stroke="#6b4423" strokeWidth="2" />
        <path d="M38 34h44M38 42h36M38 50h40M38 58h24" stroke="#d9c6a3" strokeWidth="3" strokeLinecap="round" />
        <path d="M84 62c6-9 16-9 20-3-5 7-13 8-20 3z" fill="#8dbb3e" stroke="#4f6f2a" strokeWidth="1.5" />
      </svg>
      {label && <span className="product-art-label">{label}</span>}
    </span>
  );
}

// Product images can point at files that were never uploaded; fall back to the drawing instead of a broken icon.
export function ProductImage({ path, alt, label, ...rest }) {
  const [failed, setFailed] = useState(false);
  if (!path || failed) return <ProductArt label={label} />;
  return <img src={imageUrl(path)} alt={alt} onError={() => setFailed(true)} {...rest} />;
}

const MAX_STARS = 5;
const ratingNumber = (value) => Number(value).toLocaleString("vi-VN", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

// Five grey stars with a gold copy clipped to the average, so 4.3 shows as four and a third stars.
export function RatingStars({ value, size = "md" }) {
  const filled = `${(Math.min(Math.max(value, 0), MAX_STARS) / MAX_STARS) * 100}%`;
  return (
    <span className={`stars stars-${size}`} role="img" aria-label={`${ratingNumber(value)} trên ${MAX_STARS} sao`}>
      <span className="stars-empty" aria-hidden="true">★★★★★</span>
      <span className="stars-filled" style={{ width: filled }} aria-hidden="true">★★★★★</span>
    </span>
  );
}

// Always rendered, even without reviews, so every product card keeps the same rows and stays aligned.
export function RatingSummary({ rating }) {
  if (!rating?.count) return <span className="rating-summary is-empty">Chưa có đánh giá</span>;
  return (
    <span className="rating-summary">
      <RatingStars value={rating.average} size="sm" />
      <strong>{ratingNumber(rating.average)}</strong>
      <span>({rating.count} đánh giá)</span>
    </span>
  );
}

export function StatusPill({ status }) {
  return <span className={`pill pill-${PRODUCT_STATUS_TONE[status] || "wait"}`}>{status}</span>;
}

export function ProductCard({ product }) {
  const image = primaryImage(product);
  return (
    <Link to={`/san-pham/${product.id}`} className="product-card">
      <div className="product-photo">
        <ProductImage key={image} path={image} alt={product.name} label={product.category} loading="lazy" />
        <StatusPill status={product.status} />
      </div>
      <div className="product-body">
        <span className="kicker">{product.category}</span>
        <h3>{product.name}</h3>
        <RatingSummary rating={product.rating} />
        <p>{product.description || PRODUCT_FALLBACK}</p>
        <div className="product-foot">
          <span className="product-price">{money(product.price)}{product.unit && <small> / {product.unit}</small>}</span>
          <span className="text-link">Chi tiết →</span>
        </div>
      </div>
    </Link>
  );
}

export function ActivityCard({ activity, expanded = false }) {
  return (
    <article className="activity-card">
      <span className="pin" aria-hidden="true" />
      {activity.image ? (
        <img src={imageUrl(activity.image)} alt="" loading="lazy" />
      ) : (
        <div className="activity-glyph" aria-hidden="true">
          <svg viewBox="0 0 48 48"><path d="M24 40V18M24 24c-8-2-12-8-12-14 8 0 12 6 12 14zM24 30c8-2 12-8 12-14-8 0-12 6-12 14z" /></svg>
          <span>{activity.category}</span>
        </div>
      )}
      <p className="kicker">{activity.category} · {formatDate(activity.date)}</p>
      {expanded ? <h2>{activity.title}</h2> : <h3>{activity.title}</h3>}
      <p className="activity-summary">{activity.summary}</p>
    </article>
  );
}
