import { useEffect } from "react";
import { imageUrl } from "./api.js";

const SITE_URL = (import.meta.env.VITE_SITE_URL || window.location.origin).replace(/\/$/, "");
// Same mapping as the server (speech-service/app/lalaflow_pages.py AVAILABILITY).
const AVAILABILITY = {
  "Có sẵn": "https://schema.org/InStock",
  "Đang nhập": "https://schema.org/PreOrder",
  "Hết hàng": "https://schema.org/OutOfStock",
};
// The page the server rendered its JSON-LD for.
const SERVER_RENDERED_PATH = window.location.pathname;

function setMeta(attribute, key, value) {
  let tag = document.head.querySelector(`meta[${attribute}="${key}"]`);
  if (!value) {
    tag?.remove();
    return;
  }
  if (!tag) {
    tag = document.createElement("meta");
    tag.setAttribute(attribute, key);
    document.head.appendChild(tag);
  }
  tag.setAttribute("content", value);
}

function setStructuredData(data) {
  // The server's JSON-LD is richer (reviews, rating, breadcrumbs), so it stays while the visitor is on the page it was
  // rendered for; crawlers only render that first page. After navigating elsewhere, the app's copy is the single source.
  const serverTags = document.head.querySelectorAll('script[type="application/ld+json"][data-ssr]');
  if (serverTags.length && window.location.pathname === SERVER_RENDERED_PATH) return;
  serverTags.forEach((tag) => tag.remove());
  let script = document.getElementById("lalaflow-structured-data");
  if (!script) {
    script = document.createElement("script");
    script.type = "application/ld+json";
    script.id = "lalaflow-structured-data";
    document.head.appendChild(script);
  }
  script.textContent = JSON.stringify(data);
}

function organization(company) {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${SITE_URL}/#organization`,
    name: company.name,
    url: SITE_URL,
    description: company.description,
    email: company.email,
    telephone: company.phone,
    address: { "@type": "PostalAddress", streetAddress: company.address, addressCountry: "VN" },
    sameAs: [company.facebookUrl, company.zaloUrl].filter(Boolean),
  };
}

export function useSeo({ title, description, path, product, company, noindex = false }) {
  useEffect(() => {
    const canonical = `${SITE_URL}${import.meta.env.BASE_URL.replace(/\/$/, "")}${path}`;
    const image = product ? imageUrl(product.images?.[0]?.path || product.image) : "";
    document.title = title;
    document.documentElement.lang = "vi";
    setMeta("name", "description", description);
    setMeta("name", "robots", noindex ? "noindex,nofollow" : "index,follow,max-image-preview:large");
    setMeta("property", "og:type", product ? "product" : "website");
    setMeta("property", "og:locale", "vi_VN");
    setMeta("property", "og:site_name", company.name);
    setMeta("property", "og:title", title);
    setMeta("property", "og:description", description);
    setMeta("property", "og:url", canonical);
    setMeta("property", "og:image", image);
    setMeta("name", "twitter:card", image ? "summary_large_image" : "summary");
    setMeta("name", "twitter:title", title);
    setMeta("name", "twitter:description", description);
    setMeta("name", "twitter:image", image);

    let link = document.head.querySelector('link[rel="canonical"]');
    if (!link) {
      link = document.createElement("link");
      link.rel = "canonical";
      document.head.appendChild(link);
    }
    link.href = canonical;

    setStructuredData(
      product
        ? {
            "@context": "https://schema.org",
            "@type": "Product",
            name: product.name,
            description: product.description,
            image: image || undefined,
            category: product.category,
            brand: { "@type": "Brand", name: company.name },
            offers: {
              "@type": "Offer",
              priceCurrency: "VND",
              price: Number(product.price || 0),
              availability: AVAILABILITY[product.status] || AVAILABILITY["Có sẵn"],
              url: canonical,
              seller: { "@id": `${SITE_URL}/#organization` },
            },
          }
        : organization(company),
    );
  }, [title, description, path, product, company, noindex]);
}
