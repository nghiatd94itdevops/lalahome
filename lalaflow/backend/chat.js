// AI shopping assistant for the customer site. The model finds products through its search_products tool and marks
// the ones it recommends with [#id]; the server turns those into cards, checked against the real catalogue.
import crypto from 'crypto';
import { REFUSAL, SECURITY_RULES, replyLeaks, screenConversation } from './chatGuard.js';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const OPENAI_MODEL = process.env.OPENAI_MODEL || '';
const OPENAI_BASE_URL = (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/+$/, '');
const CHAT_DAILY_LIMIT = Number(process.env.CHAT_DAILY_LIMIT || 1000);

const MAX_MESSAGE_CHARS = 500;
const MAX_ASSISTANT_CHARS = 2000;
// The latest messages go to the model whole. Before them only the visitor's own questions are kept: that is where
// their name, phone, email and needs are (the assistant is told not to repeat contact details), and the long
// answers would cost the most tokens. Without them a long chat "forgot" a phone number given a few turns earlier.
const RECENT_MESSAGES = 10;
const EARLIER_QUESTIONS = 20;
const MAX_TOOL_ROUNDS = 3;
const MAX_REPLY_TOKENS = 700;
const OPENAI_TIMEOUT_MS = 25000;
const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_MAX_PER_SESSION = 20;
// Many visitors can share one address (office NAT, the Docker gateway, a proxy), so the per-address cap is wider.
const RATE_MAX_PER_IP = 60;
const MATCH_LIMIT = 6;
const SUGGESTION_LIMIT = 4;
const DESCRIPTION_CHARS = 300;
const DETAIL_CHARS = 1500;
const RECENT_ACTIVITIES = 3;
// Only these company fields are public on the site; nothing else from site_content reaches the model.
const PUBLIC_COMPANY_FIELDS = ['name', 'tagline', 'description', 'address', 'phone', 'email', 'workingHours', 'foundedYear', 'zaloUrl'];
const CANCELLED = 'Đã hủy';
const SESSION_ID = /^[A-Za-z0-9-]{8,64}$/;
const PRODUCT_MARKER = /\s*\[#(\d+)\]/g;
// Words customers add around a criterion but product texts never contain ("giấy dán tường phong cách Hàn Quốc"):
// left in, they make every product miss the phrase. Matched on normalized text.
const FILLER_WORDS = /\b(phong cach|theo|kieu|style)\b/g;

const DETAILS_TOOL = {
  type: 'function',
  function: {
    name: 'get_product_details',
    description: 'Xem đầy đủ mô tả và thông số kỹ thuật của một sản phẩm (kích thước, thành phần, trọng lượng, tiêu chuẩn...). Dùng khi khách hỏi chi tiết về một sản phẩm cụ thể.',
    parameters: {
      type: 'object',
      properties: { product_id: { type: 'number', description: 'Mã sản phẩm (id) lấy từ kết quả search_products.' } },
      required: ['product_id'],
      additionalProperties: false,
    },
  },
};

const SEARCH_TOOL = {
  type: 'function',
  function: {
    name: 'search_products',
    description: 'Tìm sản phẩm đang bán của LalaFlow theo nhu cầu của khách. Gọi trước khi giới thiệu bất kỳ sản phẩm nào.',
    parameters: {
      type: 'object',
      properties: {
        keywords: {
          type: 'array',
          items: { type: 'string' },
          description: 'Các cụm từ ngắn tách từ nhu cầu: loại sản phẩm, công dụng, đặc tính. Ví dụ ["giấy dán tường", "chống nước", "chống cháy"].',
        },
        min_price: { type: 'number', description: 'Giá thấp nhất mỗi đơn vị (VNĐ), nếu khách nêu.' },
        max_price: { type: 'number', description: 'Giá cao nhất mỗi đơn vị (VNĐ), nếu khách nêu.' },
        category: { type: 'string', description: 'Tên loại sản phẩm nếu khách nói rõ.' },
      },
      required: ['keywords'],
      additionalProperties: false,
    },
  },
};

const QUOTE_TOOL = {
  type: 'function',
  function: {
    name: 'draft_quote_request',
    description: 'Lên phiếu yêu cầu báo giá NHÁP hiện ngay dưới câu trả lời để khách xem lại, sửa và tự bấm gửi. Phiếu chưa được gửi; bạn không gửi được. Chỉ gọi khi khách muốn báo giá và đã cho biết họ tên, số điện thoại và ít nhất một sản phẩm (đã tìm bằng search_products) kèm số lượng.',
    parameters: {
      type: 'object',
      properties: {
        customer_name: { type: 'string', description: 'Họ tên khách tự nêu.' },
        phone: { type: 'string', description: 'Số điện thoại khách tự nêu, chép nguyên văn.' },
        email: { type: 'string', description: 'Email nếu khách nêu.' },
        company_name: { type: 'string', description: 'Tên công ty nếu khách nêu.' },
        items: {
          type: 'array',
          description: 'Sản phẩm và số lượng khách cần.',
          items: {
            type: 'object',
            properties: {
              product_id: { type: 'number', description: 'Mã sản phẩm (id) lấy từ kết quả search_products.' },
              quantity: { type: 'number', description: 'Số lượng khách nêu, theo đơn vị unit của sản phẩm.' },
            },
            required: ['product_id', 'quantity'],
            additionalProperties: false,
          },
        },
        note: { type: 'string', description: 'Nhu cầu thêm khách nêu (mục đích dùng, thời gian cần hàng, nơi giao...), ngắn gọn.' },
      },
      required: ['customer_name', 'phone', 'items'],
      additionalProperties: false,
    },
  },
};

const priceText = (n) => `${Number(n).toLocaleString('vi-VN')}đ`;

// What the shop sells: one line per category with how many products and the price range.
function catalogOverview(catalog) {
  const byCategory = new Map();
  for (const p of catalog) {
    const group = byCategory.get(p.category) || [];
    group.push(p);
    byCategory.set(p.category, group);
  }
  return [...byCategory.entries()].map(([category, items]) => {
    const prices = items.map((p) => p.price);
    return `- ${category}: ${items.length} sản phẩm, giá ${priceText(Math.min(...prices))} – ${priceText(Math.max(...prices))}`;
  }).join('\n');
}

function storeFacts(store) {
  const c = store.company;
  return [
    `Cửa hàng: ${c.name || 'LalaFlow'}${c.tagline ? ` – ${c.tagline}` : ''}. ${c.description || ''}`,
    c.foundedYear && `Thành lập năm ${c.foundedYear}.`,
    c.address && `Địa chỉ: ${c.address}.`,
    c.phone && `Hotline: ${c.phone}${c.zaloUrl ? ' (Zalo cùng số)' : ''}.`,
    c.email && `Email liên hệ: ${c.email}.`,
    c.workingHours && `Giờ làm việc: ${c.workingHours}.`,
    'Giao hàng toàn quốc. Báo giá miễn phí, phản hồi trong ngày làm việc.',
    store.mission && `Sứ mệnh: ${store.mission}`,
    store.values && `Giá trị: ${store.values.split('|').join(', ')}.`,
  ].filter(Boolean).join('\n');
}

const SITE_GUIDE = [
  'Trang web: "Sản phẩm" (lọc theo loại, tìm kiếm, sắp xếp giá), trang chi tiết từng sản phẩm (ảnh, giá, thông số, nút Báo giá),',
  '"Yêu cầu báo giá" (form gửi tên, số điện thoại, email, sản phẩm, số lượng), "Hoạt động", "Giới thiệu", "Thông tin" (liên hệ).',
  'Mua hàng: khách chọn sản phẩm → bấm "Báo giá" → điền form → nhân viên liên hệ và gửi báo giá chính thức qua email hoặc điện thoại → chốt đơn và giao hàng.',
].join('\n');

function systemPrompt(catalog, store) {
  return [
    'Bạn là trợ lý bán hàng của LalaFlow, cửa hàng giấy, bao bì, giấy và vải dán tường, vật tư in ấn.',
    storeFacts(store),
    'Danh mục sản phẩm hiện có:',
    catalogOverview(catalog) || '- chưa có',
    SITE_GUIDE,
    store.activities.length ? `Hoạt động gần đây: ${store.activities.join('; ')}.` : '',
    'Trạng thái hàng: dùng đúng trường status như trang web hiển thị và không nêu số lượng tồn kho. "Có sẵn" = có hàng, giao được ngay; "Đang nhập" = hàng đang về, chưa có sẵn (không nói là còn hàng), mời khách hỏi hotline về thời gian dự kiến; "Hết hàng" = tạm hết.',
    'Câu hỏi về cửa hàng (địa chỉ, giờ làm, liên hệ, giao hàng, cách mua) trả lời từ thông tin ở trên, không cần gọi công cụ.',
    SECURITY_RULES,
    'Quy tắc:',
    '1. Khi khách tìm hoặc hỏi về sản phẩm, luôn gọi search_products trước. Tách nhu cầu thành từ khoá ngắn, mỗi tiêu chí một từ khoá riêng (ví dụ ["giấy dán tường", "hàn quốc"]); giá khách nêu đưa vào min_price/max_price (VNĐ, ví dụ "dưới 200k" là max_price 200000).',
    '2. Chỉ giới thiệu sản phẩm có trong kết quả của công cụ. Không bịa tên, giá hay đặc tính. Chỉ khẳng định một đặc tính khi nó nằm trong "matched" hoặc trong mô tả/thông số của sản phẩm đó. Sản phẩm khớp nhưng status là "Đang nhập" hoặc "Hết hàng" thì nói có mẫu đó kèm trạng thái, không nói là không có.',
    '3. Nếu fully_matching_count là 0: nói rõ tiêu chí nào chưa có, rồi BẮT BUỘC giới thiệu 2–4 sản phẩm từ "matches" hoặc "suggestions" (kèm [#id]), nói ngắn vì sao nên tham khảo.',
    '4. Khách hỏi tiếp về sản phẩm đã nhắc (trạng thái, đơn vị, giá...): gọi search_products với tên sản phẩm đó rồi trả lời theo kết quả (status, unit, price). Khách hỏi thông số (kích thước, thành phần, trọng lượng, chống cháy...): gọi get_product_details. Không đoán.',
    '4b. Mã sản phẩm khách nêu (ví dụ MS8-093, H6038-1S, R-24) phải đưa nguyên văn vào keywords; không tự đoán loại sản phẩm từ mã. Không bao giờ chỉ hứa "mình sẽ tìm, chờ chút" – hãy gọi công cụ ngay.',
    '5. Mỗi khi nhắc một sản phẩm, viết đúng tên đầy đủ như trong kết quả công cụ và ghi mã ngay sau tên, ví dụ: Giấy Kraft [#2].',
    '6. Trả lời tiếng Việt, xưng "mình", gọi khách là "bạn", thân thiện, ngắn gọn (tối đa khoảng 90 từ), như đang nói chuyện: văn bản trơn, KHÔNG dùng markdown (không **, không #); câu trả lời còn được đọc thành giọng nói. Liệt kê tối đa 3 sản phẩm, mỗi sản phẩm một dòng ngắn bắt đầu bằng "- ". Giá của mỗi sản phẩm phải chép đúng từ trường price và unit của chính sản phẩm đó (cẩn thận các tên gần giống nhau), ghi dạng 150.000đ/cuộn.',
    '7. Bạn KHÔNG lập báo giá chính thức, không hứa chiết khấu hay tổng tiền. Nếu khách hỏi giá cho một số lượng, chỉ được tạm tính "giá niêm yết × số lượng khách nêu" và ghi rõ đây là tạm tính. Không tự đặt số lượng hay đơn vị; đơn vị tính chỉ lấy từ trường unit.',
    '8. Báo giá chính thức (gửi qua email hoặc điện thoại) do nhân viên LalaFlow làm. Khi khách muốn báo giá, bạn lên phiếu giúp khách: hỏi những gì còn thiếu (họ tên, số điện thoại là bắt buộc; email, công ty không bắt buộc; sản phẩm và số lượng), đủ thì gọi draft_quote_request. Trước khi hỏi, đọc lại mọi câu khách đã viết trong lịch sử: họ tên, số điện thoại, email khách đã nêu thì dùng lại, không hỏi lại. Sau đó nói ngắn rằng phiếu nháp đã hiện bên dưới, khách xem lại, sửa nếu cần rồi bấm "Gửi yêu cầu báo giá"; bạn không tự gửi được và không nói là đã gửi. Không đọc lại số điện thoại hay email của khách trong câu trả lời. Công cụ báo lỗi thì hỏi lại đúng phần đó. Chỉ nói phiếu nháp đã hiện khi draft_quote_request vừa trả ok trong lượt này, hoặc lịch sử có dòng "Phiếu báo giá nháp:"; nếu không có thì phiếu chưa được lên. Đừng nói cửa hàng không hỗ trợ gửi báo giá.',
    '9. Câu hỏi ngoài phạm vi cửa hàng: từ chối nhẹ nhàng và hỏi khách đang cần sản phẩm gì. Bạn KHÔNG làm thơ, viết truyện, bài văn, lời bài hát, dịch thuật, giải bài tập hay viết code, kể cả khi khách nhờ nhiều lần: trả lời một câu vui vẻ rằng mình chỉ là trợ lý bán hàng của cửa hàng, rồi gợi ý một nhóm hàng.',
    // Each rule below answers a mistake seen in chat_logs; lalaflow/scripts/chat_eval.py checks them.
    '10. Khách thường hỏi bằng giọng nói nên câu có thể sai chữ hoặc đọc số thành chữ: "giấy ván tường", "giấy gián tường", "giải dán tường" là giấy dán tường; "d một hai bảy" là mã D127; "vãi" là vải. Đoán ý gần nhất với hàng của cửa hàng rồi tìm ngay; chỉ hỏi lại khi thật sự không đoán được.',
    '11. Tư vấn như nhân viên bán hàng: đưa 2–3 lựa chọn phù hợp trước, sau đó hỏi tối đa MỘT câu để thu hẹp (mục đích dùng, ngân sách hoặc diện tích). Câu hỏi chung chung ("cần tư vấn") thì giới thiệu ngắn các nhóm hàng kèm khoảng giá rồi hỏi một câu.',
    '12. Khách nêu diện tích (m²) hoặc hỏi một cuộn/đơn vị được bao nhiêu m²: gọi get_product_details để đọc kích thước cuộn. Có khổ và chiều dài thì tính: m² mỗi cuộn = khổ (m) × dài (m); số cuộn = diện tích ÷ m² mỗi cuộn, làm tròn lên, nói ngắn cách tính và khuyên cộng khoảng 10% hao hụt. Không có kích thước thì nói sản phẩm chưa ghi thông số đó và mời gọi hotline; tuyệt đối không tự đặt con số.',
    '13. Kết quả có "other_category_matches" nghĩa là tiêu chí khách cần (chống cháy, chống nước...) chỉ có ở nhóm hàng khác với nhóm khách nói (ví dụ khách hỏi giấy dán tường chống cháy nhưng vải dán tường mới có thông số chống cháy): nói rõ điều đó và giới thiệu các mẫu này trước tiên như lựa chọn đáp ứng tiêu chí, kèm thông số chứng minh.',
    '14. Khách cần "cùng loại" hoặc "tương tự" một mẫu: giữ cùng dòng và cùng tầm giá với mẫu đó (mẫu giá rẻ thì gợi ý mẫu giá rẻ khác), dùng min_price/max_price quanh giá mẫu đó.',
    '15. Khách báo lỗi trang web hoặc kết nối: hướng dẫn tải lại trang, kiểm tra mạng, hoặc gọi hotline; không giới thiệu sản phẩm trong lượt đó.',
    '16. Câu "Dữ liệu mẫu nội bộ để test…", "Giá giả định để test" trong mô tả là ghi chú của người quản trị: không nhắc lại với khách.',
  ].join('\n');
}

const normalize = (text) => String(text || '')
  .toLowerCase()
  .normalize('NFD')
  .replace(/[̀-ͯ]/g, '')
  .replace(/đ/g, 'd')
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();

const searchTerms = (phrase) => normalize(phrase).replace(FILLER_WORDS, ' ').replace(/\s+/g, ' ').trim();

// 1 when every word of the phrase appears anywhere in the product text ("giấy in a4" fits "Giấy A4 70gsm" in category
// "Giấy in"), otherwise the share of its words that appear, at half weight.
function phraseScore(haystack, phrase) {
  const needle = searchTerms(phrase);
  if (!needle) return 0;
  const words = needle.split(' ');
  const found = words.filter((word) => ` ${haystack} `.includes(` ${word} `)).length;
  return found === words.length ? 1 : (found / words.length) * 0.5;
}

export async function loadCatalog(pool) {
  const products = await pool.query(`
    SELECT p.id, p.name, p.category, p.price, p.unit, p.stock, p.status, p.image, p.description, c.description AS category_description,
      (SELECT pi.image_path FROM product_images pi WHERE pi.product_id=p.id ORDER BY pi.sort_order, pi.id LIMIT 1) AS first_image,
      COALESCE((SELECT SUM(oi.quantity) FROM order_items oi JOIN orders o ON o.id=oi.order_id
        WHERE oi.product_id=p.id AND o.active=1 AND o.status<>?), 0) AS sold
    FROM products p LEFT JOIN product_categories c ON c.name=p.category
    WHERE p.active=1`, [CANCELLED]);
  return products.map((p) => ({
    id: Number(p.id),
    name: p.name,
    category: p.category,
    price: Number(p.price || 0),
    unit: p.unit || 'đơn vị',
    stock: Number(p.stock || 0),
    status: p.status,
    image: p.first_image || p.image || null,
    description: p.description || '',
    sold: Number(p.sold || 0),
    text: normalize([p.name, p.category, p.description, p.category_description].join(' ')),
  }));
}

const forModel = (product, extra = {}) => ({
  id: product.id,
  name: product.name,
  category: product.category,
  price: product.price,
  unit: product.unit,
  status: product.status,
  description: product.description.slice(0, DESCRIPTION_CHARS),
  ...extra,
});

// Model numbers such as "MS8-093", "H6038-1S", "R-24" or "ULTRA Q1": letters and digits mixed, at least 3 long.
const PRODUCT_CODE = /\b(?=[A-Za-z0-9-]*\d)(?=[A-Za-z0-9-]*[A-Za-z])[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*\b/g;
const NOT_CODES = new Set(['a4', 'a3', 'a5', 'a0', 'a1', 'a2', 'a6', '70gsm', '80gsm', '2k', '4k']);

export function productCodes(text) {
  return [...new Set((String(text).match(PRODUCT_CODE) || []).filter((c) => c.length >= 3 && !NOT_CODES.has(c.toLowerCase())))].slice(0, 5);
}

// Products whose name or description carries one of the codes, as whole words ("ms8 093" inside "... ms8 093 ...").
function productsWithCodes(catalog, codes) {
  const wanted = codes.map((c) => ` ${normalize(c)} `);
  return catalog.filter((p) => wanted.some((code) => ` ${p.text} `.includes(code)));
}

const OTHER_CATEGORY_LIMIT = 3;

// "giấy dán tường chống cháy": the model files the search under "giấy dán tường" (as a category or a keyword), so the
// fire-rated wall fabric was never seen and the visitor heard "chưa có". When nothing in that type fits, products of
// other types that carry one of the wanted features (the keywords that are not a category name) are offered too.
function featureMatchesElsewhere(catalog, phrases, wantedCategory, shown) {
  const categories = new Set(catalog.map((p) => normalize(p.category)));
  const typeOf = wantedCategory || phrases.map(normalize).find((k) => categories.has(k));
  const features = phrases.filter((k) => !categories.has(normalize(k)));
  if (!typeOf || !features.length) return [];
  return catalog
    .filter((p) => !shown.has(p.id) && normalize(p.category) !== typeOf)
    .map((product) => ({ product, matched: features.filter((k) => phraseScore(product.text, k) === 1) }))
    .filter((r) => r.matched.length > 0)
    .sort((a, b) => b.matched.length - a.matched.length || Number(b.product.stock > 0) - Number(a.product.stock > 0))
    .slice(0, OTHER_CATEGORY_LIMIT);
}

export function searchProducts(catalog, { keywords = [], min_price: minPrice, max_price: maxPrice, category }, codes = []) {
  const phrases = (Array.isArray(keywords) ? keywords : [keywords]).map(String).filter((k) => searchTerms(k)).slice(0, 8);
  const wantedCategory = normalize(category);
  const inBudget = (p) => (!Number.isFinite(minPrice) || p.price >= minPrice) && (!Number.isFinite(maxPrice) || p.price <= maxPrice);
  const scored = catalog
    .filter((p) => !wantedCategory || normalize(p.category).includes(wantedCategory) || wantedCategory.includes(normalize(p.category)))
    .map((p) => {
      const scores = phrases.map((phrase) => phraseScore(p.text, phrase));
      return {
        product: p,
        score: scores.reduce((sum, s) => sum + s, 0),
        matched: phrases.filter((_, i) => scores[i] === 1),
        missing: phrases.filter((_, i) => scores[i] < 1),
        withinBudget: inBudget(p),
      };
    })
    .filter((r) => r.score > 0 || phrases.length === 0)
    .sort((a, b) => Number(b.withinBudget) - Number(a.withinBudget)
      || b.matched.length - a.matched.length
      || b.score - a.score
      || Number(b.product.stock > 0) - Number(a.product.stock > 0)
      || b.product.sold - a.product.sold);
  // The model sometimes guesses a category for a code ("MS8-093" → giấy in); exact code matches always come first.
  const coded = productsWithCodes(catalog, codes).map((product) => ({ product, score: 99, matched: codes, missing: [], withinBudget: inBudget(product) }));
  const codedIds = new Set(coded.map((r) => r.product.id));
  const matches = [...coded, ...scored.filter((r) => !codedIds.has(r.product.id))].slice(0, MATCH_LIMIT);
  const fullMatches = coded.length + scored.filter((r) => !codedIds.has(r.product.id) && r.withinBudget && r.missing.length === 0).length;
  const shown = new Set(matches.map((r) => r.product.id));
  const otherCategory = fullMatches > 0 ? [] : featureMatchesElsewhere(catalog, phrases, wantedCategory, shown);
  otherCategory.forEach((r) => shown.add(r.product.id));
  const suggestions = fullMatches > 0 ? [] : catalog
    .filter((p) => !shown.has(p.id) && p.stock > 0)
    .sort((a, b) => b.sold - a.sold || b.id - a.id)
    .slice(0, SUGGESTION_LIMIT);
  return {
    result: {
      fully_matching_count: fullMatches,
      ...(fullMatches ? {} : { instruction: 'Không có sản phẩm đáp ứng đủ. Nêu tiêu chí còn thiếu, rồi giới thiệu 2–4 sản phẩm bên dưới kèm [#id].' }),
      // a product asked for by its code comes with its full specification, so no second lookup is needed
      matches: matches.map((r) => ({
        ...forModel(r.product, { matched: r.matched, missing: r.missing, within_budget: r.withinBudget }),
        ...(codedIds.has(r.product.id) ? { description: r.product.description.slice(0, DETAIL_CHARS) } : {}),
      })),
      ...(otherCategory.length ? {
        other_category_matches: otherCategory.map((r) => forModel(r.product, {
          matched: r.matched,
          note: 'Khác nhóm hàng khách nói nhưng có tiêu chí khách cần (xem matched và mô tả). Giới thiệu như lựa chọn đáp ứng tiêu chí đó.',
        })),
      } : {}),
      suggestions: suggestions.map((p) => forModel(p, { note: 'sản phẩm bán chạy / nổi bật của cửa hàng' })),
    },
    fallback: fullMatches
      ? { products: scored.filter((r) => r.withinBudget && r.missing.length === 0).slice(0, SUGGESTION_LIMIT).map((r) => r.product), suggested: false }
      : { products: [...otherCategory.map((r) => r.product), ...matches.map((r) => r.product), ...suggestions].slice(0, SUGGESTION_LIMIT), suggested: true },
  };
}

// In-memory and per process: enough for one backend container, resets on restart.
const recentBySession = new Map();
const recentByIp = new Map();
const daily = { day: '', count: 0 };
const recentIn = (map, key, now) => (map.get(key) || []).filter((t) => now - t < RATE_WINDOW_MS);

function allowRequest(ip, sessionId) {
  const now = Date.now();
  const today = new Date().toISOString().slice(0, 10);
  if (daily.day !== today) Object.assign(daily, { day: today, count: 0 });
  if (daily.count >= CHAT_DAILY_LIMIT) return 'Trợ lý đã nhận đủ số câu hỏi hôm nay, bạn vui lòng quay lại vào ngày mai hoặc gọi hotline.';
  const bySession = recentIn(recentBySession, sessionId, now);
  if (bySession.length >= RATE_MAX_PER_SESSION) return 'Bạn đã hỏi khá nhiều trong ít phút, vui lòng chờ một lát rồi hỏi tiếp nhé.';
  const byIp = recentIn(recentByIp, ip, now);
  if (byIp.length >= RATE_MAX_PER_IP) return 'Trợ lý đang nhận nhiều câu hỏi từ cùng mạng của bạn, vui lòng thử lại sau ít phút.';
  recentBySession.set(sessionId, [...bySession, now]);
  recentByIp.set(ip, [...byIp, now]);
  daily.count += 1;
  return '';
}

function parseConversation(body) {
  const { sessionId, messages } = body || {};
  if (!SESSION_ID.test(String(sessionId || ''))) return { error: 'Phiên trò chuyện không hợp lệ' };
  if (!Array.isArray(messages) || !messages.length) return { error: 'Thiếu nội dung câu hỏi' };
  const earlier = messages.slice(0, -RECENT_MESSAGES).filter((m) => m?.role === 'user').slice(-EARLIER_QUESTIONS);
  const history = [...earlier, ...messages.slice(-RECENT_MESSAGES)].map((m) => ({ role: m?.role, content: String(m?.content ?? '').trim() }));
  for (const m of history) {
    if (m.role !== 'user' && m.role !== 'assistant') return { error: 'Tin nhắn không hợp lệ' };
    const limit = m.role === 'user' ? MAX_MESSAGE_CHARS : MAX_ASSISTANT_CHARS;
    if (!m.content || m.content.length > limit) return { error: `Mỗi câu hỏi tối đa ${MAX_MESSAGE_CHARS} ký tự` };
  }
  if (history[history.length - 1].role !== 'user') return { error: 'Tin nhắn cuối phải là câu hỏi của khách' };
  return { sessionId, history };
}

async function callOpenAI(messages, toolChoice = 'auto') {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), OPENAI_TIMEOUT_MS);
  // gpt-5 and o-series reasoning models reject a custom temperature.
  const supportsTemperature = !/^(gpt-5|o\d)/.test(OPENAI_MODEL);
  try {
    const response = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        messages,
        tools: [SEARCH_TOOL, DETAILS_TOOL, QUOTE_TOOL],
        tool_choice: toolChoice,
        max_completion_tokens: MAX_REPLY_TOKENS,
        ...(supportsTemperature ? { temperature: 0.3 } : {}),
      }),
      signal: controller.signal,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(`OpenAI ${response.status}: ${data?.error?.message || 'no body'}`.slice(0, 400));
    return data;
  } finally {
    clearTimeout(timer);
  }
}

// "mình sẽ tìm / sẽ dùng search_products để kiểm tra / chờ chút": a promise to look instead of looking.
const ONLY_PROMISES = /(mình|tôi|em) (sẽ|xin phép|đang|để)[^.!?\n]{0,40}(tìm|kiểm tra|tra cứu|xem|gọi|dùng)|search_products|get_product_details|chờ (chút|mình|một chút|xíu)|đợi (chút|mình|xíu)/i;

async function loadStore(pool) {
  const rows = await pool.query("SELECT content_key, content_value FROM site_content WHERE content_key IN ('company','about')");
  const content = Object.fromEntries(rows.map((r) => [r.content_key, JSON.parse(r.content_value || '{}')]));
  const company = Object.fromEntries(PUBLIC_COMPANY_FIELDS.map((k) => [k, content.company?.[k]]).filter(([, v]) => v));
  const activities = await pool.query('SELECT title, activity_date AS date FROM activities WHERE active=1 ORDER BY activity_date DESC, id DESC LIMIT ?', [RECENT_ACTIVITIES]);
  return {
    company,
    mission: content.about?.mission || '',
    values: content.about?.values || '',
    activities: activities.map((a) => `${a.title}${a.date ? ` (${String(a.date).slice(0, 10)})` : ''}`),
  };
}

function productDetails(catalog, { product_id: productId }) {
  const p = catalog.find((item) => item.id === Number(productId));
  if (!p) return { error: 'Không có sản phẩm với mã này' };
  return { ...forModel(p), description: p.description.slice(0, DETAIL_CHARS) };
}

const QUOTE_MAX_ITEMS = 10;
const QUOTE_MAX_QUANTITY = 1000000;
const QUOTE_NAME_CHARS = 100;
const QUOTE_NOTE_CHARS = 500;
const PHONE_DIGITS = /^\+?\d{9,12}$/;
const EMAIL_ADDRESS = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// A quote form the model filled in from the conversation, checked against the real catalogue. It only ever reaches
// the visitor as a draft: they review it and send it themselves through POST /quote-requests.
export function draftQuote(catalog, args) {
  const name = String(args.customer_name || '').trim().slice(0, QUOTE_NAME_CHARS);
  const phone = String(args.phone || '').trim();
  const email = String(args.email || '').trim();
  const missing = [];
  if (!name) missing.push('họ tên');
  if (!PHONE_DIGITS.test(phone.replace(/[\s.-]/g, ''))) missing.push('số điện thoại hợp lệ');
  const byId = new Map(catalog.map((p) => [p.id, p]));
  const items = [];
  for (const item of (Array.isArray(args.items) ? args.items : []).slice(0, QUOTE_MAX_ITEMS)) {
    const product = byId.get(Number(item?.product_id));
    const quantity = Number(item?.quantity);
    if (!product) return { result: { error: `Không có sản phẩm mã ${item?.product_id}; hãy tìm lại bằng search_products.` } };
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > QUOTE_MAX_QUANTITY) {
      return { result: { error: `Số lượng của ${product.name} phải là số nguyên từ 1; hỏi lại khách.` } };
    }
    const line = { productId: product.id, name: product.name, unit: product.unit, price: product.price, status: product.status, quantity };
    const index = items.findIndex((i) => i.productId === product.id);
    if (index >= 0) items[index] = line;
    else items.push(line);
  }
  if (!items.length) missing.push('sản phẩm và số lượng');
  if (missing.length) return { result: { error: `Chưa lên được phiếu, còn thiếu: ${missing.join(', ')}. Hỏi khách phần này.` } };
  return {
    result: { ok: true, status: 'Phiếu NHÁP đã hiện cho khách, CHƯA gửi. Nhắc khách xem lại và bấm "Gửi yêu cầu báo giá".' },
    draft: {
      customerName: name,
      phone,
      email: EMAIL_ADDRESS.test(email) ? email : '',
      companyName: String(args.company_name || '').trim().slice(0, QUOTE_NAME_CHARS),
      items,
      note: String(args.note || '').trim().slice(0, QUOTE_NOTE_CHARS),
    },
  };
}

// The phone and email the visitor typed, restated once next to the instructions: a small model misses a number buried
// in a long question several turns back and asks for it again. Only regex matches go in, so a visitor cannot put
// instructions into this note; the values were already in the visitor's own messages sent to the model.
function contactsGivenNote(history) {
  const said = history.filter((m) => m.role === 'user').map((m) => m.content).join('\n');
  const phone = (said.match(PHONE_IN_TEXT) || []).at(-1);
  const email = (said.match(EMAIL_IN_TEXT) || []).at(-1);
  const known = [phone && `số điện thoại ${phone.trim()}`, email && `email ${email}`].filter(Boolean);
  if (!known.length) return [];
  return [{
    role: 'system',
    content: `Trong cuộc trò chuyện này khách đã tự nêu: ${known.join('; ')}. Dùng đúng các giá trị này khi gọi draft_quote_request, không hỏi lại; vẫn không đọc lại chúng trong câu trả lời.`,
  }];
}

async function answer(pool, history, store) {
  const catalog = await loadCatalog(pool);
  const messages = [{ role: 'system', content: systemPrompt(catalog, store) }, ...contactsGivenNote(history), ...history];
  // Any active product can get a card (the reply may name one from an earlier turn); all of them are real data.
  const seen = new Map(catalog.map((p) => [p.id, p]));
  let fallback = { products: [], suggested: true };
  let quoteDraft = null;
  const searches = [];
  const usage = { prompt: 0, completion: 0 };
  const codes = productCodes(history.filter((m) => m.role === 'user').slice(-1)[0]?.content || '');
  let toolChoice = 'auto';
  let retried = false;
  for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
    const data = await callOpenAI(messages, toolChoice);
    toolChoice = 'auto';
    usage.prompt += data.usage?.prompt_tokens || 0;
    usage.completion += data.usage?.completion_tokens || 0;
    const message = data.choices?.[0]?.message;
    if (!message) throw new Error('OpenAI returned no message');
    const calls = message.tool_calls || [];
    // Small models sometimes answer "mình sẽ tìm, chờ chút" without searching; ask once more with a search required.
    if (!calls.length && !searches.length && !retried && ONLY_PROMISES.test(message.content || '')) {
      retried = true;
      toolChoice = 'required';
      continue;
    }
    if (!calls.length || round === MAX_TOOL_ROUNDS) {
      return { text: String(message.content || '').trim(), seen, fallback, searches, usage, quoteDraft };
    }
    messages.push({ role: 'assistant', content: message.content || null, tool_calls: calls });
    for (const call of calls) {
      let args = {};
      try { args = JSON.parse(call.function?.arguments || '{}'); } catch { args = {}; }
      const name = call.function?.name;
      if (name === 'draft_quote_request') {
        const { result, draft } = draftQuote(catalog, args);
        if (draft) quoteDraft = draft;
        searches.push({ quote: result.ok ? 'drafted' : result.error });
        messages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(result) });
        continue;
      }
      const { result, fallback: closest } = name === 'search_products' ? searchProducts(catalog, args, codes)
        : name === 'get_product_details' ? { result: productDetails(catalog, args), fallback }
          : { result: { error: 'Công cụ không tồn tại' }, fallback };
      fallback = closest;
      searches.push(args);
      messages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(result) });
    }
  }
  throw new Error('tool loop ended without an answer');
}

const NAME_WINDOW_CHARS = 90;

// one extra word may sit inside a name ("Giấy in A4 70gsm" for "Giấy A4 70gsm"); more lets a name borrow words
// from its neighbour ("Giấy Couche và Giấy loại 1")
const NAME_SLACK_WORDS = 1;
// Replies leave out bracketed tags such as "[Mẫu]", so names are compared without them.
const spokenName = (name) => String(name).replace(/\[[^\]]*\]/g, ' ').trim();

// Word positions where a product name is mentioned: all of its words within a short window, in any order
// ("Giấy dán tường chống ẩm ZZTEST" for "ZZTEST Giấy dán tường chống ẩm"). Words already used by a longer name
// are skipped, so "Giấy loại 1" does not also count as "Giấy 1".
function findName(words, used, nameWords) {
  const span = nameWords.length + NAME_SLACK_WORDS;
  for (let start = 0; start < words.length; start++) {
    if (used[start] || !nameWords.includes(words[start])) continue;
    const need = [...nameWords];
    const taken = [];
    for (let i = start; i < Math.min(words.length, start + span) && need.length; i++) {
      const k = need.indexOf(words[i]);
      if (k >= 0 && !used[i]) { need.splice(k, 1); taken.push(i); }
    }
    if (!need.length) return taken;
  }
  return null;
}

// Which products the reply talks about, in the order it mentions them. A product name in the text counts on its
// own (small models often skip the [#id] marker); a marker counts too, but the name written just before it wins
// over its id ("Giấy Kraft [#3]" when #3 is Giấy Couche), and with no known name in front its own id is used.
function mentionedProducts(text, seen) {
  const candidates = [...seen.values()].map((p) => ({ id: p.id, words: normalize(spokenName(p.name)).split(' ').filter(Boolean) }))
    .filter((c) => c.words.length).sort((a, b) => b.words.length - a.words.length);
  // markers are read separately below; left in, "[#1]" would read as the word "1"
  const words = normalize(text.replace(PRODUCT_MARKER, ' ')).split(' ').filter(Boolean);
  const used = new Array(words.length).fill(false);
  const found = [];
  for (const c of candidates) {
    const taken = findName(words, used, c.words);
    if (!taken) continue;
    taken.forEach((i) => { used[i] = true; });
    found.push({ id: c.id, at: Math.min(...taken) });
  }
  for (const m of text.matchAll(PRODUCT_MARKER)) {
    const markerId = Number(m[1]);
    const before = normalize(text.slice(Math.max(0, m.index - NAME_WINDOW_CHARS), m.index).replace(PRODUCT_MARKER, ' ')).split(' ').filter(Boolean);
    const named = candidates.find((c) => findName(before.slice(-(c.words.length + NAME_SLACK_WORDS)), [], c.words));
    const id = named ? named.id : (seen.has(markerId) ? markerId : null);
    const at = normalize(text.slice(0, m.index).replace(PRODUCT_MARKER, ' ')).split(' ').filter(Boolean).length;
    if (id && !found.some((f) => f.id === id)) found.push({ id, at });
  }
  return found.sort((a, b) => a.at - b.at).map((f) => f.id);
}

// Availability is the status label the website shows; the stock count stays internal.
const toCard = (p) => ({ id: p.id, name: p.name, category: p.category, price: p.price, unit: p.unit, status: p.status, inStock: p.status !== 'Hết hàng', image: p.image });

// When the reply names no product, the last search still decides the cards: its fitting products, or when nothing
// fitted, the closest/best ones flagged as suggestions, so the visitor always has something to look at.
// The model tends to call an incoming product "còn hàng"; in the sentence naming such a product say it is on its way.
function fixIncomingWording(text, products) {
  const incoming = products.filter((p) => p.status === 'Đang nhập').map((p) => normalize(spokenName(p.name)));
  if (!incoming.length) return text;
  return text.split(/(?<=[.!?\n])/).map((sentence) => {
    const flat = normalize(sentence);
    // most of the name is enough: replies drop prefixes such as "[Mẫu]"
    return incoming.some((name) => {
      const words = name.split(' ').filter((w) => w.length > 2);
      return words.filter((w) => flat.includes(w)).length >= Math.ceil(words.length * 0.8);
    })
      ? sentence.replace(/còn hàng(?: trong trạng thái)?/gi, 'hàng đang về') : sentence;
  }).join('');
}

export function toReply(text, seen, fallback = { products: [], suggested: true }) {
  const ids = mentionedProducts(text, seen);
  const reply = fixIncomingWording(text.replace(PRODUCT_MARKER, '').trim(), ids.map((id) => seen.get(id)));
  if (ids.length || !fallback.products.length) return { reply, products: ids.map((id) => toCard(seen.get(id))), suggested: false };
  return { reply, products: fallback.products.map(toCard), suggested: fallback.suggested };
}

// chat_logs keeps the conversation for the owner, not the visitor's contact details: phone numbers and email
// addresses are cut down to a few characters (the full ones live only in a quote request the visitor sent).
const PHONE_IN_TEXT = /(?<!\d)(?:\+?84[ .-]?|0)\d[\d .-]{6,12}\d(?!\d)/g;
const EMAIL_IN_TEXT = /([A-Za-z0-9._%+-])[A-Za-z0-9._%+-]*@([A-Za-z0-9.-]+\.[A-Za-z]{2,})/g;
export function maskContacts(text) {
  if (text == null) return text;
  return String(text)
    .replace(EMAIL_IN_TEXT, '$1…@$2')
    .replace(PHONE_IN_TEXT, (match) => {
      const digits = match.replace(/\D/g, '');
      return digits.length >= 9 ? `${digits.slice(0, 2)}…${digits.slice(-3)}` : match;
    });
}

const hashIp = (ip) => crypto.createHash('sha256').update(String(ip || '')).digest('hex').slice(0, 16);

export async function createChatTables(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS chat_logs (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      session_id VARCHAR(64) NOT NULL,
      question TEXT NOT NULL,
      answer TEXT DEFAULT NULL,
      product_ids VARCHAR(255) DEFAULT NULL,
      searches TEXT DEFAULT NULL,
      model VARCHAR(100) DEFAULT NULL,
      prompt_tokens INT NOT NULL DEFAULT 0,
      completion_tokens INT NOT NULL DEFAULT 0,
      error VARCHAR(500) DEFAULT NULL,
      ip_hash CHAR(16) DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_chat_created (created_at),
      INDEX idx_chat_session (session_id)
    )
  `);
}

export function registerChatRoutes(app, { pool, authMiddleware, adminOnly }) {
  app.post('/chat', async (req, res) => {
    if (!pool) return res.status(501).json({ error: 'Trợ lý AI cần MariaDB' });
    if (!OPENAI_API_KEY || !OPENAI_MODEL) return res.status(503).json({ error: 'Trợ lý AI chưa được cấu hình' });
    const parsed = parseConversation(req.body);
    if (parsed.error) return res.status(400).json({ error: parsed.error });
    const refusal = allowRequest(req.ip, parsed.sessionId);
    if (refusal) {
      console.warn(`Chat rate limited ip=${hashIp(req.ip)} session=${parsed.sessionId.slice(0, 8)}: ${refusal}`);
      return res.status(429).json({ error: refusal });
    }
    const question = parsed.history[parsed.history.length - 1].content;
    const log = { answer: null, productIds: null, searches: null, usage: { prompt: 0, completion: 0 }, error: null };
    // Sensitive questions never reach OpenAI: a fixed refusal, logged so the owner can see who probed what.
    const topic = screenConversation(parsed.history);
    if (topic) {
      console.warn(`Chat blocked (${topic}) ip=${hashIp(req.ip)} session=${parsed.sessionId.slice(0, 8)}`);
      Object.assign(log, { answer: REFUSAL, searches: JSON.stringify({ blocked: topic }) });
      res.json({ reply: REFUSAL, products: [], suggested: false });
    } else try {
      const store = await loadStore(pool);
      const result = await answer(pool, parsed.history, store);
      let reply = toReply(result.text || 'Xin lỗi, mình chưa tìm được câu trả lời phù hợp. Bạn mô tả rõ hơn nhu cầu nhé?', result.seen, result.fallback);
      // Repeating an address the visitor typed into this conversation (for their quote) reveals nothing; any other
      // address in a reply is still treated as a leak.
      const visitorEmails = parsed.history.filter((m) => m.role === 'user').flatMap((m) => m.content.match(EMAIL_IN_TEXT) || []);
      const leak = replyLeaks(reply.reply, [store.company.email, ...visitorEmails].filter(Boolean));
      if (leak) {
        console.warn(`Chat reply withheld (matched ${leak}) session=${parsed.sessionId.slice(0, 8)}`);
        reply = { reply: REFUSAL, products: [], suggested: false };
      }
      if (result.quoteDraft && !leak) reply = { ...reply, quoteDraft: result.quoteDraft };
      Object.assign(log, {
        answer: reply.reply,
        productIds: reply.products.map((p) => p.id).join(',') || null,
        searches: JSON.stringify(leak ? { blocked: 'reply_leak', searches: result.searches } : result.searches),
        usage: result.usage,
      });
      res.json(reply);
    } catch (err) {
      log.error = String(err.message || err).slice(0, 500);
      console.error('Chat error:', log.error);
      res.status(502).json({ error: 'Trợ lý đang bận, bạn thử lại sau ít phút nhé.' });
    }
    try {
      await pool.query(
        'INSERT INTO chat_logs (session_id,question,answer,product_ids,searches,model,prompt_tokens,completion_tokens,error,ip_hash) VALUES (?,?,?,?,?,?,?,?,?,?)',
        [parsed.sessionId, maskContacts(question), maskContacts(log.answer), log.productIds, maskContacts(log.searches), OPENAI_MODEL, log.usage.prompt, log.usage.completion, log.error, hashIp(req.ip)],
      );
    } catch (err) {
      console.error('Chat log error:', err.message);
    }
  });

  app.get('/chat-logs', authMiddleware, adminOnly, async (req, res) => {
    try {
      const rows = await pool.query('SELECT id,session_id,question,answer,product_ids,searches,model,prompt_tokens,completion_tokens,error,created_at FROM chat_logs ORDER BY created_at DESC, id DESC LIMIT 500');
      res.json(rows.map((r) => ({ ...r, id: Number(r.id), prompt_tokens: Number(r.prompt_tokens), completion_tokens: Number(r.completion_tokens) })));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
}
