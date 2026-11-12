"""Internal test catalogue: sample products from two public WooCommerce stores.

These rows are placeholders for testing LalaFlow screens. Names, specs and photos belong to the source stores,
so every row is prefixed "[Mẫu]", carries its source in the description, and is listed in a manifest so
`remove` takes them all out before go-live.

    python scripts/sample_products.py fetch    # download data + one image per product into backups/sample-products/
    python scripts/sample_products.py import   # back up tables, then insert into the running lalaflow-db container
    python scripts/sample_products.py reprice  # give imported rows without a public price an assumed line price
    python scripts/sample_products.py sizes    # fill roll width/length (parsed, else assumed) and set unit "cuộn"
    python scripts/sample_products.py reviews # add generated test reviews (is_sample=1) to the imported products
    python scripts/sample_products.py remove   # delete every row and image listed in the manifest
"""

import html
import json
import random
import re
import subprocess
import sys
import time
import urllib.parse
import urllib.request
from datetime import date
from pathlib import Path

LALAFLOW_DIR = Path(__file__).resolve().parent.parent
WORK_DIR = LALAFLOW_DIR / "backups" / "sample-products"
IMAGES_DIR = WORK_DIR / "images"
DATA_FILE = WORK_DIR / "products.json"
MANIFEST_FILE = WORK_DIR / "manifest.json"

USER_AGENT = "LalaFlow-sample-import/1.0 (internal test data)"
PER_SOURCE = 25
FETCH_PAGE_SIZE = 100
REQUEST_PAUSE_SECONDS = 0.5
TARGET_IMAGE_WIDTH = 1024
DESCRIPTION_MAX_CHARS = 600
MIN_DESCRIPTION_LETTERS = 20
SAMPLE_PREFIX = "[Mẫu] "
UPLOAD_URL_PREFIX = "/uploads/"
CONTAINER_UPLOADS = "/app/uploads/"

SOURCES = [
    {
        "key": "gdt",
        "domain": "giaydantuongcnc.com",
        "url": "https://giaydantuongcnc.com/wp-json/wc/store/v1/products?category=72&orderby=popularity",
        "category": "Giấy dán tường",
        "in_stock_status": "Có sẵn",
        "requires_price": True,
    },
    {
        "key": "cr",
        "domain": "caroyal.com.vn",
        "url": "https://caroyal.com.vn/wp-json/wc/store/v1/products?orderby=popularity",
        "category": "Vải dán tường",
        # The store sells these as pre-order ("Hàng Đặt Trước") without public prices.
        "in_stock_status": "Đang nhập",
        "requires_price": False,
    },
]

DEFAULT_UNIT = "đơn vị"
ASSUMED_PRICE_UNIT = "cuộn"
# Placeholder per-roll prices for stores that publish none, so the catalogue never shows 0đ. Not market prices.
ASSUMED_LINE_PRICES = {"ULTRA": 1_450_000, "R": 1_100_000, "MS": 850_000}
PRODUCT_LINE = re.compile(r"\b(ULTRA|R|MS)(?=[\s\d-])")
ASSUMED_PRICE_NOTE = "Giá giả định để test."

PHONE = re.compile(r"(\+?84|0)[\d .]{8,13}\d")
URL = re.compile(r"https?://\S+|www\.\S+")
BRANDS = re.compile(r"\b(caroyal|cnc wallpaper)\b", re.IGNORECASE)
NON_CONTENT = re.compile(r"(hotline|zalo|chat với|liên hệ)[^.;]*[.;]?", re.IGNORECASE)


def open_url(url: str):
    # Store image paths contain Vietnamese file names; HTTP needs them percent-encoded.
    safe_url = urllib.parse.quote(url, safe=":/?=&%#,")
    return urllib.request.urlopen(urllib.request.Request(safe_url, headers={"User-Agent": USER_AGENT}), timeout=60)


def get_json(url: str):
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(request, timeout=60) as response:
        return json.load(response)


def plain_text(markup: str | None) -> str:
    text = html.unescape(re.sub(r"<[^>]+>", " ", markup or ""))
    return re.sub(r"\s+", " ", text).strip()


def clean_text(text: str) -> str:
    for pattern in (URL, PHONE, NON_CONTENT, BRANDS):
        text = pattern.sub(" ", text)
    return re.sub(r"\s+", " ", text).strip(" ;,.-|:")


def has_content(text: str) -> bool:
    """Stripping hotlines from contact-only blurbs leaves debris like "HN : |"; that is not a description."""
    return sum(char.isalpha() for char in text) >= MIN_DESCRIPTION_LETTERS


def pick_diverse(products: list[dict], count: int) -> list[dict]:
    """Round-robin across each product's most specific category so the sample is not 25 variants of one line."""
    buckets: dict[str, list[dict]] = {}
    for product in products:
        key = product["categories"][-1]["slug"] if product["categories"] else "-"
        buckets.setdefault(key, []).append(product)
    picked: list[dict] = []
    while len(picked) < count and any(buckets.values()):
        for bucket in buckets.values():
            if bucket and len(picked) < count:
                picked.append(bucket.pop(0))
    return picked


def image_url(product: dict) -> str | None:
    if not product["images"]:
        return None
    image = product["images"][0]
    candidates = []
    for entry in (image.get("srcset") or "").split(","):
        parts = entry.strip().split(" ")
        if len(parts) == 2 and parts[1].endswith("w"):
            candidates.append((int(parts[1][:-1]), parts[0]))
    fitting = [candidate for candidate in candidates if candidate[0] <= TARGET_IMAGE_WIDTH]
    return max(fitting)[1] if fitting else image["src"]


def assumed_price(name: str) -> int:
    match = PRODUCT_LINE.search(name)
    if not match:
        raise ValueError(f"no assumed price for product line of {name!r}; add it to ASSUMED_LINE_PRICES")
    return ASSUMED_LINE_PRICES[match.group(1)]


def with_assumed_price(row: dict) -> dict:
    if row["price"] > 0:
        return row
    return {
        **row,
        "price": assumed_price(row["name"]),
        "unit": ASSUMED_PRICE_UNIT,
        "description": f"{row['description']} {ASSUMED_PRICE_NOTE}",
    }


def to_row(product: dict, source: dict) -> dict:
    prices = product["prices"]
    price = int(prices["price"] or 0) // (10 ** prices["currency_minor_unit"])
    name = clean_text(html.unescape(product["name"])) or f"Sản phẩm {product['id']}"
    details = clean_text(plain_text(product["short_description"]) or plain_text(product["description"]))
    if not has_content(details):
        line = product["categories"][-1]["name"] if product["categories"] else source["category"]
        details = f"{name}, thuộc dòng {html.unescape(line)}."
    details = details[:DESCRIPTION_MAX_CHARS].rsplit(" ", 1)[0] if len(details) > DESCRIPTION_MAX_CHARS else details
    note = f"Dữ liệu mẫu nội bộ để test, nguồn: {source['domain']}. Không dùng cho trang thật."
    status = source["in_stock_status"] if product["is_in_stock"] else "Hết hàng"
    row = {
        "source": source["domain"],
        "source_id": product["id"],
        "source_url": product["permalink"],
        "name": SAMPLE_PREFIX + name,
        "category": source["category"],
        "price": price,
        "unit": DEFAULT_UNIT,
        "status": status,
        "description": f"{details}\n\n{note}" if details else note,
        "image_url": image_url(product),
        "image_file": None,
    }
    return with_assumed_price(row)


def fetch() -> None:
    IMAGES_DIR.mkdir(parents=True, exist_ok=True)
    rows = []
    for source in SOURCES:
        products = get_json(f"{source['url']}&per_page={FETCH_PAGE_SIZE}")
        if source["requires_price"]:
            products = [product for product in products if product["prices"]["price"] not in ("", "0")]
        products = [product for product in products if product["images"]]
        picked = pick_diverse(products, PER_SOURCE)
        print(f"{source['domain']}: {len(products)} usable, picked {len(picked)}")
        for product in picked:
            row = to_row(product, source)
            extension = Path(row["image_url"].split("?")[0]).suffix.lower() or ".jpg"
            row["image_file"] = f"sample-{source['key']}-{product['id']}{extension}"
            with open_url(row["image_url"]) as response:
                (IMAGES_DIR / row["image_file"]).write_bytes(response.read())
            rows.append(row)
            time.sleep(REQUEST_PAUSE_SECONDS)
    DATA_FILE.write_text(json.dumps(rows, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"wrote {len(rows)} products to {DATA_FILE}")


def sql_text(value: str | None) -> str:
    """Scraped text goes into SQL as a hex literal, so no quote or backslash in it can break out of the string."""
    if value is None:
        return "NULL"
    return f"CONVERT(X'{value.encode('utf-8').hex()}' USING utf8mb4)"


def run_sql(sql: str, *, capture: bool = False) -> str:
    command = ["docker", "compose", "exec", "-T", "db", "sh", "-c",
               'mariadb -uroot -p"$MARIADB_ROOT_PASSWORD" --batch --skip-column-names lalaflow']
    result = subprocess.run(command, input=sql.encode("utf-8"), cwd=LALAFLOW_DIR, capture_output=True, check=False)
    if result.returncode != 0:
        raise RuntimeError(f"mariadb failed ({result.returncode}): {result.stderr.decode('utf-8', 'replace')}")
    return result.stdout.decode("utf-8") if capture else ""


def backup_tables() -> Path:
    target = LALAFLOW_DIR / "backups" / f"before-sample-import-{date.today():%Y%m%d}.sql"
    command = ["docker", "compose", "exec", "-T", "db", "sh", "-c",
               'mariadb-dump -uroot -p"$MARIADB_ROOT_PASSWORD" lalaflow products product_images product_categories']
    result = subprocess.run(command, cwd=LALAFLOW_DIR, capture_output=True, check=False)
    if result.returncode != 0 or not result.stdout:
        raise RuntimeError(f"backup failed ({result.returncode}): {result.stderr.decode('utf-8', 'replace')}")
    target.write_bytes(result.stdout)
    return target


def import_rows() -> None:
    if MANIFEST_FILE.exists():
        raise SystemExit(f"{MANIFEST_FILE} exists: samples already imported. Run `remove` first.")
    rows = json.loads(DATA_FILE.read_text(encoding="utf-8"))
    print(f"backup: {backup_tables()}")

    for row in rows:
        subprocess.run(["docker", "compose", "cp", str(IMAGES_DIR / row["image_file"]),
                        f"backend:{CONTAINER_UPLOADS}{row['image_file']}"], cwd=LALAFLOW_DIR, check=True,
                       capture_output=True)

    existing = set(run_sql("SELECT name FROM product_categories;", capture=True).splitlines())
    new_categories = sorted({row["category"] for row in rows} - existing)
    statements = ["START TRANSACTION;"]
    for category in new_categories:
        statements.append("INSERT INTO product_categories (name, description) VALUES "
                          f"({sql_text(category)}, {sql_text('Nhóm sản phẩm mẫu để test')});")
    for row in rows:
        image_path = UPLOAD_URL_PREFIX + row["image_file"]
        statements.append(
            "INSERT INTO products (name, category, stock, price, unit, status, image, description) VALUES "
            f"({sql_text(row['name'])}, {sql_text(row['category'])}, 0, {int(row['price'])}, "
            f"{sql_text(row.get('unit', DEFAULT_UNIT))}, "
            f"{sql_text(row['status'])}, {sql_text(image_path)}, {sql_text(row['description'])});")
        statements.append("INSERT INTO product_images (product_id, image_path, sort_order) "
                          f"VALUES (LAST_INSERT_ID(), {sql_text(image_path)}, 0);")
    statements.append("COMMIT;")
    run_sql("\n".join(statements))

    inserted = run_sql(f"SELECT id, image FROM products WHERE image LIKE '{UPLOAD_URL_PREFIX}sample-%';",
                       capture=True)
    product_ids = [int(line.split("\t")[0]) for line in inserted.splitlines()]
    manifest = {
        "imported_on": f"{date.today():%Y-%m-%d}",
        "product_ids": product_ids,
        "image_files": [row["image_file"] for row in rows],
        "created_categories": new_categories,
    }
    MANIFEST_FILE.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"imported {len(product_ids)} products, created categories {new_categories}; manifest {MANIFEST_FILE}")


def reprice() -> None:
    """Give already-imported rows that still show 0đ their assumed line price (matched by unique image path)."""
    rows = json.loads(DATA_FILE.read_text(encoding="utf-8"))
    updated = [with_assumed_price(row) for row in rows]
    changed = [new for old, new in zip(rows, updated) if old["price"] != new["price"]]
    statements = ["START TRANSACTION;"]
    for row in changed:
        statements.append(
            f"UPDATE products SET price = {int(row['price'])}, unit = {sql_text(row['unit'])}, "
            f"description = {sql_text(row['description'])} "
            f"WHERE price = 0 AND image = {sql_text(UPLOAD_URL_PREFIX + row['image_file'])};")
    statements.append("COMMIT;")
    run_sql("\n".join(statements))
    DATA_FILE.write_text(json.dumps(updated, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"repriced {len(changed)} sample products")


ROLL_UNIT = "cuộn"
# "52″ – 54″ (132 – 137 cm) x 50m": a width range keeps its narrower end, so roll counts round towards more rolls.
ROLL_SIZE = re.compile(r"(\d+(?:[.,]\d+)?)(?:\s*[–-]\s*\d+(?:[.,]\d+)?)?\s*cm\)?\s*[x×]\s*(\d+(?:[.,]\d+)?)\s*m\b")
# Common Korean wallpaper roll for sources that publish no size. Placeholder, not the product's real spec.
ASSUMED_ROLL_SIZES = {"Giấy dán tường": (106, 15.6)}


def decimal(text: str) -> float:
    return float(text.replace(",", "."))


def roll_size(row: dict) -> tuple[float, float, str | None]:
    """Width (cm), length (m) and the note to add to the description when the size is assumed."""
    match = ROLL_SIZE.search(row["description"])
    if match:
        return decimal(match.group(1)), decimal(match.group(2)), None
    if row["category"] not in ASSUMED_ROLL_SIZES:
        raise ValueError(f"no roll size in {row['name']!r}; add its category to ASSUMED_ROLL_SIZES")
    width, length = ASSUMED_ROLL_SIZES[row["category"]]
    shown_length = f"{length:g}".replace(".", ",")
    return width, length, f"Kích thước cuộn: {width:g} cm x {shown_length} m (giả định để test)."


def sizes() -> None:
    """Fill roll width/length of imported rows (matched by unique image path) and sell them by the roll."""
    rows = json.loads(DATA_FILE.read_text(encoding="utf-8"))
    print(f"backup: {backup_tables()}")
    statements = ["START TRANSACTION;"]
    for row in rows:
        width, length, note = roll_size(row)
        description = f"{row['description']} {note}" if note else row["description"]
        statements.append(
            f"UPDATE products SET roll_width_cm = {width}, roll_length_m = {length}, unit = {sql_text(ROLL_UNIT)}, "
            f"description = {sql_text(description)} "
            f"WHERE roll_width_cm IS NULL AND image = {sql_text(UPLOAD_URL_PREFIX + row['image_file'])};")
        print(f"{'assumed' if note else 'parsed '}  {width:g} cm x {length:g} m  {row['name']}")
    statements.append("COMMIT;")
    run_sql("\n".join(statements))


REVIEWERS = [
    "Anh Tuấn", "Chị Hoa", "Anh Minh", "Chị Lan", "Anh Phúc", "Chị Thảo", "Anh Đức", "Chị Ngọc",
    "Anh Khoa", "Chị Vy", "Anh Hưng", "Chị Mai", "Anh Nam", "Chị Trang", "Anh Long", "Chị Hạnh",
]
REVIEW_COMMENTS = {
    5: ["Màu đẹp, dán lên tường phẳng, đúng như ảnh.", "Chất liệu dày dặn, phòng khách nhìn sang hẳn.",
        "Thợ thi công khen dễ dán, mép nối gần như không thấy.", "Đặt lần hai rồi, vẫn ưng như lần đầu."],
    4: ["Chất lượng ổn, giao hàng hơi chậm một chút.", "Màu thực tế đậm hơn ảnh một tí nhưng vẫn đẹp.",
        "Bề mặt sờ mịn, lau được vết bẩn nhẹ.", "Giá hợp lý so với chất lượng."],
    3: ["Tạm ổn, màu hơi khác so với ảnh mẫu.", "Dán được nhưng phải canh hoa văn khá lâu."],
    2: ["Mép nối hơi lộ sau vài tuần, cần dán kỹ hơn."],
}
# Mostly positive with a long tail, roughly like a real catalogue; never 1 star so the fixtures stay plausible.
RATING_WEIGHTS = {5: 50, 4: 32, 3: 13, 2: 5}
MAX_REVIEWS_PER_PRODUCT = 6
NO_REVIEW_SHARE = 0.15
REVIEW_AGE_DAYS = 120


def reviews() -> None:
    """Generated reviews for the [Mẫu] products only; seeded by product id so a re-run produces the same set."""
    manifest = json.loads(MANIFEST_FILE.read_text(encoding="utf-8"))
    ids = [int(product_id) for product_id in manifest["product_ids"]]
    existing = run_sql(f"SELECT COUNT(*) FROM product_reviews WHERE is_sample = 1 AND product_id IN ({','.join(map(str, ids))});",
                       capture=True).strip()
    if existing != "0":
        raise SystemExit(f"{existing} sample reviews already exist; run `remove` and re-import to regenerate.")

    statements = ["START TRANSACTION;"]
    total = 0
    for product_id in ids:
        generator = random.Random(product_id)
        if generator.random() < NO_REVIEW_SHARE:
            continue
        for _ in range(generator.randint(1, MAX_REVIEWS_PER_PRODUCT)):
            rating = generator.choices(list(RATING_WEIGHTS), weights=list(RATING_WEIGHTS.values()))[0]
            age_minutes = generator.randint(60, REVIEW_AGE_DAYS * 24 * 60)
            statements.append(
                "INSERT INTO product_reviews (product_id, reviewer_name, rating, comment, status, is_sample, created_at) "
                f"VALUES ({product_id}, {sql_text(generator.choice(REVIEWERS))}, {rating}, "
                f"{sql_text(generator.choice(REVIEW_COMMENTS[rating]))}, 'approved', 1, "
                f"NOW() - INTERVAL {age_minutes} MINUTE);")
            total += 1
    statements.append("COMMIT;")
    run_sql("\n".join(statements))
    print(f"added {total} sample reviews across {len(ids)} sample products")


def remove() -> None:
    manifest = json.loads(MANIFEST_FILE.read_text(encoding="utf-8"))
    ids = ",".join(str(int(product_id)) for product_id in manifest["product_ids"])
    statements = ["START TRANSACTION;",
                  f"DELETE FROM product_reviews WHERE product_id IN ({ids});",
                  f"DELETE FROM product_images WHERE product_id IN ({ids});",
                  f"DELETE FROM products WHERE id IN ({ids});"]
    for category in manifest["created_categories"]:
        statements.append("DELETE FROM product_categories WHERE name = "
                          f"{sql_text(category)} AND NOT EXISTS (SELECT 1 FROM products WHERE category = {sql_text(category)});")
    statements.append("COMMIT;")
    run_sql("\n".join(statements))
    files = [CONTAINER_UPLOADS + name for name in manifest["image_files"]]
    subprocess.run(["docker", "compose", "exec", "-T", "backend", "rm", "-f", *files], cwd=LALAFLOW_DIR, check=True)
    MANIFEST_FILE.unlink()
    print(f"removed {len(manifest['product_ids'])} sample products and their images")


COMMANDS = {"fetch": fetch, "import": import_rows, "reprice": reprice, "sizes": sizes, "reviews": reviews,
            "remove": remove}

if __name__ == "__main__":
    if len(sys.argv) != 2 or sys.argv[1] not in COMMANDS:
        raise SystemExit(f"usage: {Path(__file__).name} {{{'|'.join(COMMANDS)}}}")
    COMMANDS[sys.argv[1]]()
