"""Server-rendered SEO for the LalaFlow single-page app.

The React app renders in the browser, so a crawler that does not run JavaScript (GPTBot, ClaudeBot, PerplexityBot,
link previews in Zalo/Facebook) would see an empty <div id="root">. For every public route this module serves the built
index.html with the page's own title, description, canonical URL, Open Graph tags, JSON-LD and a plain-HTML copy of
the content inside #root. React replaces that copy when it mounts, so visitors still get the app.

Also serves /robots.txt, /sitemap.xml and /llms.txt for the whole host.
"""

import asyncio
import html
import json
import logging
import time
import urllib.error
import urllib.request
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, Request, Response

logger = logging.getLogger("speech-service.lalaflow-pages")

BASE_PATH = "/lalaflow"
DATA_TTL_SECONDS = 60
UPSTREAM_TIMEOUT_SECONDS = 5
SAMPLE_PREFIX = "[Mẫu]"
FEATURED_LIMIT = 8
REVIEWS_IN_PAGE = 10
REVIEWS_IN_SCHEMA = 5
DESCRIPTION_MAX_CHARS = 160
ROBOTS_INDEX = "index,follow,max-image-preview:large"
ROBOTS_NOINDEX = "noindex,nofollow"
# The shop's own status labels (see PRODUCT_STATUS_TONE in the frontend), not the stock count.
AVAILABILITY = {
    "Có sẵn": "https://schema.org/InStock",
    "Đang nhập": "https://schema.org/PreOrder",
    "Hết hàng": "https://schema.org/OutOfStock",
}
# Search and AI crawlers named explicitly so the intent is unambiguous; each repeats the shared disallows because a
# crawler that matches its own group ignores the "*" group.
NAMED_CRAWLERS = ["Googlebot", "Bingbot", "GPTBot", "OAI-SearchBot", "ChatGPT-User", "ClaudeBot", "Claude-SearchBot",
                  "PerplexityBot", "Google-Extended", "Applebot"]
DISALLOWED_PATHS = ["/api/", f"{BASE_PATH}/admin"]
STATIC_ROUTES = [
    ("/", "Trang chủ"),
    ("/san-pham", "Danh mục sản phẩm"),
    ("/gioi-thieu", "Giới thiệu"),
    ("/thong-tin", "Thông tin công ty"),
    ("/hoat-dong", "Hoạt động"),
    ("/yeu-cau-bao-gia", "Yêu cầu báo giá"),
]


@dataclass
class Page:
    title: str
    description: str
    path: str
    body: str = ""
    robots: str = ROBOTS_INDEX
    og_type: str = "website"
    image: str = ""
    json_ld: list[dict] = field(default_factory=list)
    status: int = 200


def esc(value: object) -> str:
    return html.escape(str(value or ""), quote=True)


def shorten(text: str, limit: int = DESCRIPTION_MAX_CHARS) -> str:
    flat = " ".join(str(text or "").split())
    return flat if len(flat) <= limit else flat[: limit - 1].rsplit(" ", 1)[0] + "…"


def money(value: object) -> str:
    return f"{int(value or 0):,}".replace(",", ".") + "đ"


def is_sample(product: dict) -> bool:
    return str(product.get("name", "")).startswith(SAMPLE_PREFIX)


class SiteData:
    """Backend reads with a short cache: crawlers can hit many pages per second, the backend should see one fetch."""

    def __init__(self, upstream: str) -> None:
        self._upstream = upstream.rstrip("/")
        self._cache: dict[str, tuple[float, object]] = {}

    def _fetch(self, path: str) -> object:
        with urllib.request.urlopen(f"{self._upstream}{path}", timeout=UPSTREAM_TIMEOUT_SECONDS) as response:
            return json.load(response)

    async def get(self, path: str, default: object) -> object:
        cached = self._cache.get(path)
        if cached and cached[0] > time.monotonic():
            return cached[1]
        try:
            value = await asyncio.to_thread(self._fetch, path)
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as error:
            # The page still renders with generic tags; the SPA fetches the data itself in the browser.
            logger.warning("SEO data %s unavailable from %s: %s", path, self._upstream, error)
            return cached[1] if cached else default
        self._cache[path] = (time.monotonic() + DATA_TTL_SECONDS, value)
        return value


class Template:
    """The Vite-built index.html, reloaded when a new build replaces it."""

    def __init__(self, path: Path) -> None:
        self._path = path
        self._mtime = 0.0
        self._text = ""

    def text(self) -> str:
        mtime = self._path.stat().st_mtime
        if mtime != self._mtime:
            self._text = self._path.read_text(encoding="utf-8")
            self._mtime = mtime
        return self._text


def json_ld_tag(data: dict) -> str:
    # Customer text (review names, comments) ends up in here. "</script>" would close the element early and "<!--" or
    # "<script" can switch the HTML parser into escaped-script states, so no markup character survives: < etc. are
    # the same string to a JSON parser.
    payload = (json.dumps(data, ensure_ascii=False)
               .replace("<", "\\u003c").replace(">", "\\u003e").replace("&", "\\u0026"))
    return f'<script type="application/ld+json" data-ssr>{payload}</script>'


def render(template: str, page: Page, site: str, company_name: str) -> str:
    canonical = f"{site}{BASE_PATH}{page.path if page.path != '/' else '/'}"
    head = [
        f'<meta name="robots" content="{page.robots}" />',
        f'<link rel="canonical" href="{esc(canonical)}" />',
        '<meta property="og:locale" content="vi_VN" />',
        f'<meta property="og:site_name" content="{esc(company_name)}" />',
        f'<meta property="og:type" content="{page.og_type}" />',
        f'<meta property="og:title" content="{esc(page.title)}" />',
        f'<meta property="og:description" content="{esc(page.description)}" />',
        f'<meta property="og:url" content="{esc(canonical)}" />',
        f'<meta name="twitter:card" content="{"summary_large_image" if page.image else "summary"}" />',
    ]
    if page.image:
        head += [f'<meta property="og:image" content="{esc(page.image)}" />',
                 f'<meta name="twitter:image" content="{esc(page.image)}" />']
    head += [json_ld_tag(data) for data in page.json_ld]

    result = template
    start, end = result.find("<title>"), result.find("</title>")
    if start != -1 and end != -1:
        result = f"{result[:start]}<title>{esc(page.title)}</title>{result[end + len('</title>'):]}"
    marker = '<meta name="description" content="'
    start = result.find(marker)
    if start != -1:
        end = result.find('"', start + len(marker))
        result = f"{result[:start + len(marker)]}{esc(page.description)}{result[end:]}"
    result = result.replace("</head>", "    " + "\n    ".join(head) + "\n  </head>", 1)
    return result.replace('<div id="root"></div>', f'<div id="root">{page.body}</div>', 1)


def nav_html() -> str:
    links = "".join(f'<li><a href="{BASE_PATH}{path}">{esc(label)}</a></li>' for path, label in STATIC_ROUTES)
    return f'<nav aria-label="Điều hướng chính"><ul>{links}</ul></nav>'


def product_url(site: str, product: dict) -> str:
    return f"{site}{BASE_PATH}/san-pham/{product['id']}"


def image_url(site: str, product: dict) -> str:
    image = product.get("image") or ((product.get("images") or [{}])[0].get("path"))
    return f"{site}/api{image}" if image else ""


def product_list_html(products: list[dict]) -> str:
    items = "".join(
        f'<li><a href="{BASE_PATH}/san-pham/{product["id"]}">{esc(product["name"])}</a> – {esc(product["category"])}, '
        f'{money(product["price"])}{(" / " + esc(product["unit"])) if product.get("unit") else ""}</li>'
        for product in products
    )
    return f"<ul>{items}</ul>"


def organization(site: str, company: dict) -> dict:
    return {
        "@context": "https://schema.org",
        "@type": "Organization",
        "@id": f"{site}/#organization",
        "name": company.get("name"),
        "url": f"{site}{BASE_PATH}/",
        "description": company.get("description"),
        "email": company.get("email"),
        "telephone": company.get("phone"),
        "address": {"@type": "PostalAddress", "streetAddress": company.get("address"), "addressCountry": "VN"},
        "sameAs": [url for url in (company.get("facebookUrl"), company.get("zaloUrl")) if url],
    }


def breadcrumb(site: str, trail: list[tuple[str, str]]) -> dict:
    return {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "itemListElement": [
            {"@type": "ListItem", "position": index, "name": name, "item": f"{site}{BASE_PATH}{path}"}
            for index, (name, path) in enumerate(trail, start=1)
        ],
    }


def contact_html(company: dict) -> str:
    rows = [("Địa chỉ", company.get("address")), ("Điện thoại", company.get("phone")),
            ("Email", company.get("email")), ("Giờ làm việc", company.get("workingHours"))]
    return "<dl>" + "".join(f"<dt>{esc(label)}</dt><dd>{esc(value)}</dd>" for label, value in rows if value) + "</dl>"


def home_page(site: str, content: dict, products: list[dict]) -> Page:
    company = content.get("company", {})
    name = company.get("name", "LalaFlow")
    body = (f"<header><h1>{esc(name)}</h1><p>{esc(company.get('tagline'))}</p></header>{nav_html()}"
            f"<main><p>{esc(company.get('description'))}</p><h2>Sản phẩm tiêu biểu</h2>"
            f"{product_list_html(products[:FEATURED_LIMIT])}<h2>Liên hệ</h2>{contact_html(company)}</main>")
    website = {"@context": "https://schema.org", "@type": "WebSite", "name": name, "url": f"{site}{BASE_PATH}/",
               "inLanguage": "vi", "publisher": {"@id": f"{site}/#organization"}}
    return Page(title=f"{name} | Giấy, bao bì và giải pháp in ấn", description=shorten(company.get("description")),
                path="/", body=body, json_ld=[organization(site, company), website])


def products_page(site: str, content: dict, products: list[dict]) -> Page:
    company, pages = content.get("company", {}), content.get("pages", {})
    name = company.get("name", "LalaFlow")
    item_list = {
        "@context": "https://schema.org",
        "@type": "ItemList",
        "itemListElement": [{"@type": "ListItem", "position": index, "url": product_url(site, product), "name": product["name"]}
                            for index, product in enumerate(products, start=1)],
    }
    body = (f"{nav_html()}<main><h1>{esc(pages.get('productHeroTitle') or 'Danh mục sản phẩm')}</h1>"
            f"<p>{esc(pages.get('productHeroText'))}</p>{product_list_html(products)}</main>")
    return Page(title=f"Danh mục sản phẩm | {name}",
                description=shorten(pages.get("productHeroText") or f"Danh mục giấy và bao bì của {name}."),
                path="/san-pham", body=body, json_ld=[item_list, breadcrumb(site, [("Sản phẩm", "/san-pham")])])


def product_page(site: str, content: dict, product: dict | None, reviews: list[dict]) -> Page:
    company = content.get("company", {})
    name = company.get("name", "LalaFlow")
    if not product or not product.get("active", True):
        return Page(title=f"Sản phẩm không tồn tại | {name}", description="Sản phẩm không tồn tại hoặc đã ngừng bán.",
                    path="/san-pham", robots=ROBOTS_NOINDEX, status=404,
                    body=f"{nav_html()}<main><h1>Sản phẩm không tồn tại</h1></main>")

    path = f"/san-pham/{product['id']}"
    rating = product.get("rating") or {}
    description = product.get("description") or f"{product['name']} thuộc danh mục {product['category']} của {name}."
    image = image_url(site, product)
    offer = {"@type": "Offer", "priceCurrency": "VND", "price": int(product.get("price") or 0),
             "availability": AVAILABILITY.get(product.get("status"), "https://schema.org/InStock"),
             "url": product_url(site, product), "seller": {"@id": f"{site}/#organization"}}
    schema = {"@context": "https://schema.org", "@type": "Product", "name": product["name"], "description": description,
              "category": product["category"], "brand": {"@type": "Brand", "name": name}, "offers": offer}
    if image:
        schema["image"] = image
    if rating.get("count"):
        schema["aggregateRating"] = {"@type": "AggregateRating", "ratingValue": rating["average"],
                                     "reviewCount": rating["count"], "bestRating": 5, "worstRating": 1}
        schema["review"] = [{"@type": "Review", "author": {"@type": "Person", "name": review["reviewerName"]},
                             "reviewRating": {"@type": "Rating", "ratingValue": review["rating"], "bestRating": 5},
                             "reviewBody": review.get("comment") or "", "datePublished": str(review.get("createdAt", ""))[:10]}
                            for review in reviews[:REVIEWS_IN_SCHEMA]]

    rating_html = (f"<p>Đánh giá: {esc(rating['average'])}/5 ({esc(rating['count'])} đánh giá)</p>"
                   if rating.get("count") else "<p>Chưa có đánh giá.</p>")
    reviews_html = "".join(
        f"<li><strong>{esc(review['reviewerName'])}</strong> – {esc(review['rating'])}/5"
        f"{(': ' + esc(review['comment'])) if review.get('comment') else ''}</li>"
        for review in reviews[:REVIEWS_IN_PAGE]
    )
    body = (f'{nav_html()}<main><nav aria-label="Đường dẫn"><a href="{BASE_PATH}/san-pham">Sản phẩm</a> / '
            f"{esc(product['category'])}</nav><article><h1>{esc(product['name'])}</h1>"
            f"<p>Danh mục: {esc(product['category'])} · Tình trạng: {esc(product.get('status'))}</p>"
            f"<p>Giá tham khảo: {money(product.get('price'))}{(' / ' + esc(product['unit'])) if product.get('unit') else ''}</p>"
            f"<p>{esc(description)}</p>{rating_html}{('<h2>Đánh giá của khách hàng</h2><ul>' + reviews_html + '</ul>') if reviews_html else ''}"
            f'<p><a href="{BASE_PATH}/yeu-cau-bao-gia?product={product["id"]}">Nhận tư vấn và báo giá</a></p></article></main>')
    return Page(title=f"{product['name']} | {name}", description=shorten(description), path=path, body=body,
                robots=ROBOTS_NOINDEX if is_sample(product) else ROBOTS_INDEX, og_type="product", image=image,
                json_ld=[schema, breadcrumb(site, [("Sản phẩm", "/san-pham"), (product["name"], path)])])


def text_page(content: dict, path: str) -> Page:
    company, pages, about = content.get("company", {}), content.get("pages", {}), content.get("about", {})
    name = company.get("name", "LalaFlow")
    if path == "/gioi-thieu":
        text = pages.get("aboutHeroText") or about.get("story")
        return Page(title=f"Giới thiệu {name}", description=shorten(text), path=path,
                    body=f"{nav_html()}<main><h1>{esc(pages.get('aboutHeroTitle') or 'Giới thiệu')}</h1>"
                         f"<p>{esc(text)}</p><p>{esc(about.get('story'))}</p></main>")
    if path == "/thong-tin":
        return Page(title=f"Thông tin công ty {name}",
                    description=shorten(f"{name} – {company.get('address')}. Liên hệ {company.get('phone')}."), path=path,
                    body=f"{nav_html()}<main><h1>{esc(pages.get('infoHeroTitle') or 'Thông tin công ty')}</h1>"
                         f"<p>{esc(pages.get('infoHeroText'))}</p>{contact_html(company)}"
                         f"<p>Mã số thuế: {esc(company.get('taxCode'))}</p></main>")
    return Page(title=f"Yêu cầu báo giá | {name}",
                description=f"Gửi yêu cầu để nhận tư vấn sản phẩm và báo giá từ {name}.", path=path,
                body=f"{nav_html()}<main><h1>Yêu cầu báo giá</h1><p>Gửi yêu cầu để nhận tư vấn sản phẩm và báo giá từ "
                     f"{esc(name)}.</p>{contact_html(company)}</main>")


def activities_page(content: dict, activities: list[dict]) -> Page:
    company, pages = content.get("company", {}), content.get("pages", {})
    name = company.get("name", "LalaFlow")
    items = "".join(f"<li><h2>{esc(item.get('title'))}</h2><p>{esc(item.get('category'))} · {esc(str(item.get('date', ''))[:10])}</p>"
                    f"<p>{esc(item.get('summary'))}</p></li>" for item in activities)
    return Page(title=f"Hoạt động | {name}",
                description=shorten(pages.get("activityHeroText") or f"Tin tức và hoạt động của {name}."),
                path="/hoat-dong", body=f"{nav_html()}<main><h1>{esc(pages.get('activityHeroTitle') or 'Hoạt động')}</h1><ul>{items}</ul></main>")


def site_url(request: Request, configured: str) -> str:
    """Absolute origin for canonical URLs: a configured public URL wins; otherwise the host the visitor used (ngrok)."""
    if configured:
        return configured.rstrip("/")
    return f"{request.url.scheme}://{request.headers.get('host', request.url.netloc)}"


def create_lalaflow_pages_router(upstream: str, web_root: Path, public_site_url: str) -> APIRouter:
    router = APIRouter()
    data = SiteData(upstream)
    template = Template(web_root / "lalaflow" / "index.html")

    async def public_products() -> list[dict]:
        products = await data.get("/products", [])
        return [product for product in products if product.get("active", True) and not is_sample(product)]

    def respond(request: Request, page: Page, content: dict) -> Response:
        company_name = content.get("company", {}).get("name", "LalaFlow")
        body = render(template.text(), page, site_url(request, public_site_url), company_name)
        return Response(body, status_code=page.status, media_type="text/html; charset=utf-8",
                        headers={"Cache-Control": "no-cache"})

    @router.get(BASE_PATH, include_in_schema=False)
    @router.get(f"{BASE_PATH}/", include_in_schema=False)
    async def home(request: Request) -> Response:
        content = await data.get("/site-content", {})
        return respond(request, home_page(site_url(request, public_site_url), content, await public_products()), content)

    @router.get(f"{BASE_PATH}/san-pham", include_in_schema=False)
    async def products(request: Request) -> Response:
        content = await data.get("/site-content", {})
        return respond(request, products_page(site_url(request, public_site_url), content, await public_products()), content)

    @router.get(f"{BASE_PATH}/san-pham/{{product_id}}", include_in_schema=False)
    async def product(request: Request, product_id: str) -> Response:
        content = await data.get("/site-content", {})
        all_products = await data.get("/products", [])
        found = next((item for item in all_products if str(item.get("id")) == product_id), None)
        reviews = await data.get(f"/products/{found['id']}/reviews", []) if found else []
        return respond(request, product_page(site_url(request, public_site_url), content, found, reviews), content)

    @router.get(f"{BASE_PATH}/hoat-dong", include_in_schema=False)
    async def activities(request: Request) -> Response:
        content = await data.get("/site-content", {})
        return respond(request, activities_page(content, await data.get("/activities", [])), content)

    for page_path in ("/gioi-thieu", "/thong-tin", "/yeu-cau-bao-gia"):
        async def text_route(request: Request, page_path: str = page_path) -> Response:
            content = await data.get("/site-content", {})
            return respond(request, text_page(content, page_path), content)
        router.add_api_route(f"{BASE_PATH}{page_path}", text_route, methods=["GET"], include_in_schema=False)

    @router.get(f"{BASE_PATH}/tro-ly", include_in_schema=False)
    async def assistant(request: Request) -> Response:
        content = await data.get("/site-content", {})
        name = content.get("company", {}).get("name", "LalaFlow")
        text = "Hỏi Mimi loại giấy bạn cần, xem và so sánh sản phẩm phù hợp ngay trên kệ."
        page = Page(title=f"Trợ lý AI Mimi – {name}", description=text, path="/tro-ly",
                    body=f"{nav_html()}<main><h1>Trợ lý AI Mimi</h1><p>{esc(text)}</p></main>")
        return respond(request, page, content)

    @router.get(f"{BASE_PATH}/admin", include_in_schema=False)
    @router.get(f"{BASE_PATH}/admin/{{tab:path}}", include_in_schema=False)
    async def admin(request: Request) -> Response:
        page = Page(title="Quản trị LalaFlow", description="Trang quản trị nội bộ.", path="/admin", robots=ROBOTS_NOINDEX)
        return respond(request, page, {})

    @router.get("/robots.txt", include_in_schema=False)
    async def robots(request: Request) -> Response:
        site = site_url(request, public_site_url)
        disallows = "".join(f"Disallow: {path}\n" for path in DISALLOWED_PATHS)
        groups = [f"User-agent: {agent}\nAllow: /\n{disallows}" for agent in ["*", *NAMED_CRAWLERS]]
        return Response("\n".join(groups) + f"\nSitemap: {site}/sitemap.xml\n", media_type="text/plain; charset=utf-8")

    @router.get("/sitemap.xml", include_in_schema=False)
    async def sitemap(request: Request) -> Response:
        site = site_url(request, public_site_url)
        today = datetime.now(timezone.utc).date().isoformat()
        entries = [(f"{site}{BASE_PATH}{path}", today) for path, _ in STATIC_ROUTES]
        entries += [(product_url(site, product), str(product.get("created_at") or today)[:10]) for product in await public_products()]
        urls = "".join(f"<url><loc>{esc(loc)}</loc><lastmod>{lastmod}</lastmod></url>" for loc, lastmod in entries)
        xml = f'<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">{urls}</urlset>'
        return Response(xml, media_type="application/xml")

    @router.get("/llms.txt", include_in_schema=False)
    async def llms(request: Request) -> Response:
        site = site_url(request, public_site_url)
        content = await data.get("/site-content", {})
        company = content.get("company", {})
        lines = [f"# {company.get('name', 'LalaFlow')}", "", f"> {shorten(company.get('description'), 300)}", "",
                 "## Trang chính"]
        lines += [f"- [{label}]({site}{BASE_PATH}{path})" for path, label in STATIC_ROUTES]
        lines += ["", "## Sản phẩm"]
        lines += [f"- [{product['name']}]({product_url(site, product)}): {product['category']}, giá tham khảo "
                  f"{money(product['price'])}{(' / ' + product['unit']) if product.get('unit') else ''}"
                  for product in await public_products()]
        lines += ["", "## Liên hệ", f"- Địa chỉ: {company.get('address', '')}", f"- Điện thoại: {company.get('phone', '')}",
                  f"- Email: {company.get('email', '')}", f"- Giờ làm việc: {company.get('workingHours', '')}"]
        return Response("\n".join(lines) + "\n", media_type="text/markdown; charset=utf-8")

    return router
