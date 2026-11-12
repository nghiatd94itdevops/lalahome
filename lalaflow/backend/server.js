import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import mariadb from 'mariadb';
import nodemailer from 'nodemailer';
import PDFDocument from 'pdfkit';
import { createChatTables, registerChatRoutes } from './chat.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
// Behind a reverse proxy (nginx, Cloudflare) req.ip is the proxy unless it is trusted; TRUST_PROXY takes Express's
// values: a hop count ("1"), "loopback, uniquelocal", or a list of addresses.
if (process.env.TRUST_PROXY) app.set('trust proxy', /^\d+$/.test(process.env.TRUST_PROXY) ? Number(process.env.TRUST_PROXY) : process.env.TRUST_PROXY);
app.use(cors());
app.use(express.json());
app.use((req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  next();
});
// nosniff: browsers must trust the image Content-Type and never render an upload as a page.
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), { setHeaders: (res) => res.set('X-Content-Type-Options', 'nosniff') }));

// The stored extension comes from the accepted image type, never from the client's file name: "x.html" sent as
// image/png is saved as .png, so it is served as an image and cannot run as HTML from this origin.
const IMAGE_EXTENSIONS = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif' };
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, 'uploads');
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${IMAGE_EXTENSIONS[file.mimetype]}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024, files: 5 },
  fileFilter: (req, file, cb) => {
    if (!IMAGE_EXTENSIONS[file.mimetype]) return cb(new Error('Chỉ chấp nhận ảnh JPG, PNG, WEBP hoặc GIF'));
    cb(null, true);
  },
});

function discardUploads(files = []) {
  for (const file of files) {
    fs.unlink(file.path, (err) => {
      if (err && err.code !== 'ENOENT') console.error(`Could not delete rejected upload ${file.path}: ${err.message}`);
    });
  }
}

// Anyone who knows the signing secret can mint an admin token, so a missing, short or published default secret stops
// the server instead of quietly running with it.
const PUBLISHED_JWT_SECRETS = ['lalaflow-secret', 'lalaflow-dev-secret-change-me', 'change-me-to-a-long-random-string'];
const MIN_JWT_SECRET_LENGTH = 32;
const JWT_SECRET = process.env.JWT_SECRET || '';
if (JWT_SECRET.length < MIN_JWT_SECRET_LENGTH || PUBLISHED_JWT_SECRETS.includes(JWT_SECRET)) {
  console.error(`JWT_SECRET must be a random string of at least ${MIN_JWT_SECRET_LENGTH} characters (set it in lalaflow/.env); refusing to start.`);
  process.exit(1);
}
const DATA_FILE = path.join(__dirname, 'data.json');
const useDatabase = Boolean(process.env.DB_HOST && process.env.DB_HOST !== 'localhost');
const regularFont = '/usr/share/fonts/noto/NotoSans-Regular.ttf';
const boldFont = '/usr/share/fonts/noto/NotoSans-Bold.ttf';

const pool = useDatabase
  ? mariadb.createPool({
      host: process.env.DB_HOST || 'db',
      port: Number(process.env.DB_PORT || 3306),
      user: process.env.DB_USER || 'lalaflow',
      password: process.env.DB_PASSWORD || 'lalaflowpass',
      database: process.env.DB_NAME || 'lalaflow',
      connectionLimit: 10,
    })
  : null;

const normalizePhone = (value = '') => String(value).replace(/\D/g, '');
const normalizeEmail = (value = '') => String(value).trim().toLowerCase();
const formatMoney = (value) => `${Number(value || 0).toLocaleString('vi-VN')} VNĐ`;

async function getCompanyInfo() {
  const fallback = seedState().siteContent?.company || {};
  if (!pool) return fallback;
  const rows = await pool.query('SELECT content_value FROM site_content WHERE content_key="company" LIMIT 1');
  if (!rows[0]) return fallback;
  try { return { ...fallback, ...JSON.parse(rows[0].content_value) }; } catch { return fallback; }
}

async function getQuotation(id) {
  const rows = await pool.query('SELECT q.*,c.email AS customer_email,c.phone AS customer_phone,c.address AS customer_address,c.tax_code AS customer_tax_code FROM quotations q LEFT JOIN customers c ON c.id=q.customer_id WHERE q.id=? LIMIT 1', [id]);
  if (!rows[0]) return null;
  const items = await pool.query('SELECT * FROM quotation_items WHERE quotation_id=? ORDER BY id', [id]);
  return { ...rows[0], items };
}

async function makeQuotationPdf(quotation) {
  const company = await getCompanyInfo();
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 48, info: { Title: `Báo giá ${quotation.id}` } });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    doc.registerFont('Regular', regularFont);
    doc.registerFont('Bold', boldFont);
    doc.font('Bold').fontSize(20).fillColor('#123C31').text(company.name || 'LalaFlow', { align: 'center' });
    doc.font('Regular').fontSize(9).fillColor('#555').text(`${company.address || ''} | ${company.phone || ''} | ${company.email || ''}`, { align: 'center' });
    doc.moveDown(1.3).font('Bold').fontSize(18).fillColor('#123C31').text('BÁO GIÁ', { align: 'center' });
    doc.font('Regular').fontSize(10).fillColor('#333').text(`Mã báo giá: ${quotation.id}`, { align: 'center' });
    doc.moveDown().font('Bold').text(`Kính gửi: ${quotation.customer_name}`);
    doc.font('Regular').text(`Điện thoại: ${quotation.customer_phone || '—'}    Email: ${quotation.customer_email || '—'}`);
    if (quotation.customer_address) doc.text(`Địa chỉ: ${quotation.customer_address}`);
    doc.moveDown();
    const widths = [245, 55, 100, 105];
    const drawRow = (cells, bold = false) => {
      const y = doc.y;
      doc.font(bold ? 'Bold' : 'Regular').fontSize(9);
      cells.forEach((cell, index) => doc.text(String(cell), 48 + widths.slice(0, index).reduce((sum, width) => sum + width, 0), y, { width: widths[index] - 8, align: index > 0 ? 'right' : 'left' }));
      doc.y = Math.max(...cells.map((cell, index) => doc.heightOfString(String(cell), { width: widths[index] - 8 }))) + y + 10;
      doc.moveTo(48, doc.y - 5).lineTo(553, doc.y - 5).strokeColor('#D8C7A6').stroke();
    };
    drawRow(['Sản phẩm', 'SL', 'Đơn giá', 'Thành tiền'], true);
    quotation.items.forEach((item) => drawRow([item.product_name, item.quantity, formatMoney(item.unit_price), formatMoney(item.line_total)]));
    doc.moveDown().font('Regular').fontSize(10).text(`Tiền hàng: ${formatMoney(quotation.subtotal)}`, { align: 'right' });
    doc.text(`Chiết khấu (${Number(quotation.discount_percent)}%): -${formatMoney(quotation.discount_amount)}`, { align: 'right' });
    doc.font('Bold').fontSize(13).fillColor('#123C31').text(`TỔNG CỘNG: ${formatMoney(quotation.total)}`, { align: 'right' });
    doc.moveDown().font('Regular').fontSize(9).fillColor('#333');
    if (quotation.valid_until) doc.text(`Báo giá có hiệu lực đến: ${new Date(quotation.valid_until).toLocaleDateString('vi-VN')}`);
    if (quotation.notes) doc.text(`Điều khoản / ghi chú: ${quotation.notes}`);
    doc.moveDown(2).text('Trân trọng cảm ơn Quý khách!', { align: 'center' });
    doc.end();
  });
}

function createMailTransport() {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) return null;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: String(process.env.SMTP_SECURE || 'false') === 'true',
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
}

function readState() {
  if (!fs.existsSync(DATA_FILE)) {
    return { users: [], products: [], inventoryMovements: [], orders: [], siteContent: {}, activities: [] };
  }
  const current = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  return { users: [], products: [], inventoryMovements: [], orders: [], siteContent: {}, activities: [], ...current };
}

function writeState(state) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(state, null, 2));
}

function seedState() {
  const state = readState();
  const defaultContent = {
    company: {
      name: 'LalaFlow Paper', tagline: 'Chất liệu tốt, khởi đầu bền vững',
      description: 'Đối tác cung ứng giấy, bao bì và giải pháp in ấn đáng tin cậy cho doanh nghiệp Việt.',
      address: '123 Nguyễn Văn Linh, Quận 7, TP.HCM', phone: '0909 123 456',
      email: 'contact@lalaflow.vn', zaloUrl: 'https://zalo.me/0909123456',
      facebookUrl: 'https://m.me/lalaflow', taxCode: '0312345678',
      foundedYear: '2018', workingHours: 'Thứ 2 – Thứ 7, 08:00 – 17:30'
    },
    about: {
      title: 'Từ những tờ giấy, tạo nên giá trị dài lâu',
      story: 'LalaFlow bắt đầu từ mong muốn giúp doanh nghiệp tiếp cận nguồn giấy ổn định, đúng chuẩn và thân thiện hơn với môi trường. Chúng tôi kết nối sản xuất, kho vận và tư vấn để mỗi đơn hàng được giao đúng chất lượng, đúng tiến độ.',
      mission: 'Cung cấp giải pháp giấy và bao bì tối ưu, minh bạch, góp phần nâng cao hiệu quả vận hành cho khách hàng.',
      vision: 'Trở thành đối tác vật liệu giấy được tin chọn hàng đầu tại Việt Nam.',
      values: 'Chất lượng thật|Cam kết đúng|Phục vụ tận tâm|Phát triển bền vững'
    },
    stats: { years: '8+', customers: '500+', products: '120+', delivery: '98%' },
    home: {
      heroBadge: 'Giải pháp giấy bền vững',
      heroTitle: 'Giấy tốt cho',
      heroHighlight: 'ý tưởng lớn.',
      heroText: 'Đối tác cung ứng giấy, bao bì và giải pháp in ấn đáng tin cậy cho doanh nghiệp Việt.',
      primaryButton: 'Khám phá sản phẩm',
      secondaryButton: 'Câu chuyện của chúng tôi',
      certificateTitle: 'FSC®',
      certificateText: 'Nguồn nguyên liệu có trách nhiệm',
      productsEyebrow: 'SẢN PHẨM TIÊU BIỂU',
      productsTitle: 'Chất liệu phù hợp cho mọi nhu cầu',
      storyLabel: 'Vật liệu được chọn lọc cho tương lai tốt hơn',
      aboutEyebrow: 'VỀ LALAFLOW',
      aboutFeatures: 'Nguồn hàng ổn định|Tư vấn đúng nhu cầu|Giao hàng toàn quốc',
      aboutButton: 'Tìm hiểu về chúng tôi',
      activitiesEyebrow: 'HOẠT ĐỘNG MỚI',
      activitiesTitle: 'Chuyện từ LalaFlow',
      viewAllButton: 'Xem tất cả',
      ctaEyebrow: 'BẮT ĐẦU HỢP TÁC'
    },
    pages: {
      aboutEyebrow: 'VỀ CHÚNG TÔI', aboutHeroTitle: 'Từ những tờ giấy, tạo nên giá trị dài lâu',
      aboutHeroText: 'Hiểu vật liệu, hiểu doanh nghiệp và đồng hành trong từng giải pháp.',
      aboutJourneyLabel: 'HÀNH TRÌNH LALAFLOW', aboutJourneyTitle: 'Hiểu vật liệu. Hiểu doanh nghiệp.',
      infoEyebrow: 'HỒ SƠ DOANH NGHIỆP', infoHeroTitle: 'Thông tin minh bạch, kết nối thuận tiện',
      infoHeroText: 'Những thông tin chính thức giúp khách hàng và đối tác dễ dàng liên hệ với LalaFlow.',
      activityEyebrow: 'TIN TỨC & HOẠT ĐỘNG', activityHeroTitle: 'Những chuyển động từ LalaFlow',
      activityHeroText: 'Cập nhật hoạt động doanh nghiệp, kiến thức ngành giấy và các chương trình hướng đến cộng đồng.',
      productEyebrow: 'DANH MỤC SẢN PHẨM', productHeroTitle: 'Chọn đúng giấy, tạo đúng giá trị',
      productHeroText: 'Khám phá danh mục giấy và bao bì đa dạng, được kiểm soát chất lượng cho từng mục đích sử dụng.'
    },
    contact: {
      heading: 'Cần một giải pháp giấy phù hợp cho doanh nghiệp?',
      subheading: 'Đội ngũ LalaFlow sẵn sàng tư vấn giải pháp phù hợp với nhu cầu của bạn.',
      buttonText: 'Liên hệ tư vấn'
    }
  };
  if (!state.siteContent || Object.keys(state.siteContent).length === 0) state.siteContent = defaultContent;
  if (!state.activities || state.activities.length === 0) {
    state.activities = [
      { id: 1, title: 'Đồng hành cùng doanh nghiệp xanh', date: '2026-06-12', category: 'Cộng đồng', summary: 'Chương trình thu gom và tái chế giấy văn phòng cùng các doanh nghiệp đối tác.', image: '' },
      { id: 2, title: 'Mở rộng kho phân phối phía Nam', date: '2026-04-25', category: 'Doanh nghiệp', summary: 'Nâng cao năng lực lưu kho và rút ngắn thời gian giao hàng tại TP.HCM và các tỉnh lân cận.', image: '' },
      { id: 3, title: 'Workshop lựa chọn giấy in hiệu quả', date: '2026-02-18', category: 'Kiến thức', summary: 'Chia sẻ cách lựa chọn định lượng, bề mặt và khổ giấy phù hợp cho từng nhu cầu in ấn.', image: '' }
    ];
  }
  if (state.users.length === 0) {
    state.users = [{ id: 1, name: 'Administrator', email: 'admin@lalaflow.vn', password: bcrypt.hashSync('Admin123!', 10), role: 'admin' }];
  }
  if (state.products.length === 0) {
    state.products = [
      { id: 1, name: 'Giấy A4 70gsm', category: 'Giấy in', stock: 150, price: 180000, status: 'Có sẵn', image: '/uploads/a4.jpg', description: 'Giấy in văn phòng chất lượng cao' },
      { id: 2, name: 'Giấy Kraft', category: 'Bao bì', stock: 80, price: 260000, status: 'Đang nhập', image: '/uploads/kraft.jpg', description: 'Giấy kraft cho bao bì' },
      { id: 3, name: 'Giấy Couche', category: 'Giấy bìa', stock: 45, price: 320000, status: 'Có sẵn', image: '/uploads/couche.jpg', description: 'Giấy bìa cao cấp' }
    ];
  }
  if (state.orders.length === 0) {
    state.orders = [
      { id: 'DH001', customer: 'Công ty Minh Phúc', total: 1250000, status: 'Đã xử lý' },
      { id: 'DH002', customer: 'Nhà sách Hồng Hà', total: 890000, status: 'Đang giao' }
    ];
  }
  writeState(state);
  return state;
}

let state = seedState();

function signToken(user) {
  let permissions = user.role === 'admin' ? ['*'] : (user.group_permissions || user.permissions || []);
  if (typeof permissions === 'string') {
    try { permissions = JSON.parse(permissions); } catch { permissions = []; }
  }
  return jwt.sign({ id: user.id, role: user.role, email: user.email, name: user.name, permissions }, JWT_SECRET, { expiresIn: '8h' });
}

async function waitForDb(retries = 30) {
  if (!pool) return;
  for (let i = 0; i < retries; i += 1) {
    try {
      await pool.query('SELECT 1');
      return;
    } catch (err) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }
  throw new Error('Database connection failed after retries');
}

async function initDb() {
  if (!pool) return;
  let conn;
  try {
    conn = await pool.getConnection();
    await conn.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL DEFAULT 'staff'
      )
    `);
    await conn.query(`
      CREATE TABLE IF NOT EXISTS products (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        category VARCHAR(255) NOT NULL,
        stock INT NOT NULL DEFAULT 0,
        price INT NOT NULL DEFAULT 0,
        status VARCHAR(100) NOT NULL DEFAULT 'Có sẵn',
        image VARCHAR(500) DEFAULT NULL,
        description TEXT DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await conn.query(`
      CREATE TABLE IF NOT EXISTS inventory_movements (
        id INT AUTO_INCREMENT PRIMARY KEY,
        type VARCHAR(20) NOT NULL,
        product_id INT NOT NULL,
        quantity INT NOT NULL,
        note TEXT DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await conn.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id VARCHAR(100) PRIMARY KEY,
        customer VARCHAR(255) NOT NULL,
        total INT NOT NULL,
        status VARCHAR(100) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await conn.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(50) DEFAULT NULL`);
    await conn.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS permissions LONGTEXT DEFAULT NULL`);
    await conn.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS active TINYINT(1) NOT NULL DEFAULT 1`);
    await conn.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`);
    await conn.query(`
      CREATE TABLE IF NOT EXISTS permission_groups (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) UNIQUE NOT NULL,
        description TEXT DEFAULT NULL,
        permissions LONGTEXT NOT NULL,
        is_system TINYINT(1) NOT NULL DEFAULT 0,
        active TINYINT(1) NOT NULL DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await conn.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS group_id INT DEFAULT NULL`);
    await conn.query(`ALTER TABLE inventory_movements ADD COLUMN IF NOT EXISTS user_name VARCHAR(255) DEFAULT NULL`);
    await conn.query(`ALTER TABLE inventory_movements ADD COLUMN IF NOT EXISTS active TINYINT(1) NOT NULL DEFAULT 1`);
    await conn.query(`ALTER TABLE inventory_movements ADD COLUMN IF NOT EXISTS corrected_by VARCHAR(255) DEFAULT NULL`);
    await conn.query(`ALTER TABLE inventory_movements ADD COLUMN IF NOT EXISTS corrected_at TIMESTAMP NULL DEFAULT NULL`);
    await conn.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_phone VARCHAR(50) DEFAULT NULL`);
    await conn.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_email VARCHAR(255) DEFAULT NULL`);
    await conn.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS tax_code VARCHAR(100) DEFAULT NULL`);
    await conn.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS invoice_name VARCHAR(255) DEFAULT NULL`);
    await conn.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS invoice_address TEXT DEFAULT NULL`);
    await conn.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS employee_name VARCHAR(255) DEFAULT NULL`);
    await conn.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS paid_amount BIGINT NOT NULL DEFAULT 0`);
    await conn.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS debt_amount BIGINT NOT NULL DEFAULT 0`);
    await conn.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS active TINYINT(1) NOT NULL DEFAULT 1`);
    await conn.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS subtotal BIGINT NOT NULL DEFAULT 0`);
    await conn.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_code VARCHAR(100) DEFAULT NULL`);
    await conn.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_type VARCHAR(20) DEFAULT NULL`);
    await conn.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_value DECIMAL(12,2) NOT NULL DEFAULT 0`);
    await conn.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_amount BIGINT NOT NULL DEFAULT 0`);
    await conn.query(`UPDATE orders SET subtotal=total WHERE subtotal=0 AND total>0`);
    await conn.query(`
      UPDATE orders
      SET debt_amount = GREATEST(total - paid_amount, 0)
      WHERE total > 0 AND paid_amount = 0 AND debt_amount = 0
    `);
    await conn.query(`
      CREATE TABLE IF NOT EXISTS order_items (
        id INT AUTO_INCREMENT PRIMARY KEY,
        order_id VARCHAR(100) NOT NULL,
        product_id INT NOT NULL,
        product_name VARCHAR(255) NOT NULL,
        quantity INT NOT NULL,
        unit_price BIGINT NOT NULL,
        line_total BIGINT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_order_items_order (order_id)
      )
    `);
    await conn.query(`
      CREATE TABLE IF NOT EXISTS order_payments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        order_id VARCHAR(100) NOT NULL,
        amount BIGINT NOT NULL,
        method VARCHAR(100) DEFAULT 'Chuyển khoản',
        note TEXT DEFAULT NULL,
        user_name VARCHAR(255) DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_payments_order (order_id)
      )
    `);
    await conn.query(`
      CREATE TABLE IF NOT EXISTS discount_codes (
        id INT AUTO_INCREMENT PRIMARY KEY,
        code VARCHAR(100) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        discount_type VARCHAR(20) NOT NULL DEFAULT 'percent',
        discount_value DECIMAL(12,2) NOT NULL,
        min_order_amount BIGINT NOT NULL DEFAULT 0,
        max_discount_amount BIGINT DEFAULT NULL,
        usage_limit INT DEFAULT NULL,
        used_count INT NOT NULL DEFAULT 0,
        starts_at DATE DEFAULT NULL,
        expires_at DATE DEFAULT NULL,
        active TINYINT(1) NOT NULL DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await conn.query(`
      CREATE TABLE IF NOT EXISTS customers (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        phone VARCHAR(50) DEFAULT NULL,
        email VARCHAR(255) DEFAULT NULL,
        tax_code VARCHAR(100) DEFAULT NULL,
        address TEXT DEFAULT NULL,
        customer_type VARCHAR(50) NOT NULL DEFAULT 'Khách hàng',
        credit_limit BIGINT NOT NULL DEFAULT 0,
        payment_term_days INT NOT NULL DEFAULT 0,
        assigned_employee VARCHAR(255) DEFAULT NULL,
        notes TEXT DEFAULT NULL,
        active TINYINT(1) NOT NULL DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await conn.query(`
      CREATE TABLE IF NOT EXISTS quotations (
        id VARCHAR(100) PRIMARY KEY,
        customer_id INT DEFAULT NULL,
        customer_name VARCHAR(255) NOT NULL,
        employee_name VARCHAR(255) DEFAULT NULL,
        subtotal BIGINT NOT NULL DEFAULT 0,
        discount_percent DECIMAL(8,2) NOT NULL DEFAULT 0,
        discount_amount BIGINT NOT NULL DEFAULT 0,
        total BIGINT NOT NULL DEFAULT 0,
        status VARCHAR(50) NOT NULL DEFAULT 'Nháp',
        valid_until DATE DEFAULT NULL,
        notes TEXT DEFAULT NULL,
        active TINYINT(1) NOT NULL DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await conn.query(`
      CREATE TABLE IF NOT EXISTS quotation_items (
        id INT AUTO_INCREMENT PRIMARY KEY,
        quotation_id VARCHAR(100) NOT NULL,
        product_id INT DEFAULT NULL,
        product_name VARCHAR(255) NOT NULL,
        quantity INT NOT NULL,
        unit_price BIGINT NOT NULL,
        line_total BIGINT NOT NULL,
        INDEX idx_quotation_items_quote (quotation_id)
      )
    `);
    await conn.query(`
      CREATE TABLE IF NOT EXISTS quote_requests (
        id INT AUTO_INCREMENT PRIMARY KEY,
        customer_name VARCHAR(255) NOT NULL,
        phone VARCHAR(50) NOT NULL,
        email VARCHAR(255) DEFAULT NULL,
        company_name VARCHAR(255) DEFAULT NULL,
        product_id INT DEFAULT NULL,
        product_name VARCHAR(255) DEFAULT NULL,
        quantity INT NOT NULL DEFAULT 1,
        message TEXT DEFAULT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'Mới',
        assigned_employee VARCHAR(255) DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await conn.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        user_email VARCHAR(255) DEFAULT NULL,
        action VARCHAR(100) NOT NULL,
        entity_type VARCHAR(100) NOT NULL,
        entity_id VARCHAR(100) DEFAULT NULL,
        details TEXT DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_audit_created (created_at)
      )
    `);
    await conn.query(`ALTER TABLE quote_requests ADD COLUMN IF NOT EXISTS customer_id INT DEFAULT NULL`);
    await conn.query(`ALTER TABLE quote_requests ADD COLUMN IF NOT EXISTS quotation_id VARCHAR(100) DEFAULT NULL`);
    await conn.query(`ALTER TABLE quote_requests ADD COLUMN IF NOT EXISTS responded_at TIMESTAMP NULL DEFAULT NULL`);
    await conn.query(`ALTER TABLE quote_requests ADD COLUMN IF NOT EXISTS response_email VARCHAR(255) DEFAULT NULL`);
    await conn.query(`ALTER TABLE quote_requests ADD COLUMN IF NOT EXISTS items TEXT DEFAULT NULL`);
    await conn.query(`ALTER TABLE quote_requests ADD COLUMN IF NOT EXISTS source VARCHAR(20) NOT NULL DEFAULT 'form'`);
    await conn.query(`
      CREATE TABLE IF NOT EXISTS correction_requests (
        id INT AUTO_INCREMENT PRIMARY KEY,
        record_type VARCHAR(30) NOT NULL,
        record_id VARCHAR(100) NOT NULL,
        reason TEXT NOT NULL,
        requested_by VARCHAR(255) NOT NULL,
        status VARCHAR(30) NOT NULL DEFAULT 'pending',
        admin_note TEXT DEFAULT NULL,
        resolved_by VARCHAR(255) DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        resolved_at TIMESTAMP NULL DEFAULT NULL
      )
    `);
    await conn.query(`
      CREATE TABLE IF NOT EXISTS product_categories (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL,
        description TEXT DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await conn.query(`ALTER TABLE product_categories ADD COLUMN IF NOT EXISTS active TINYINT(1) NOT NULL DEFAULT 1`);
    await conn.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS active TINYINT(1) NOT NULL DEFAULT 1`);
    await conn.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS unit VARCHAR(50) NOT NULL DEFAULT 'đơn vị'`);
    await conn.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS cost_price BIGINT NOT NULL DEFAULT 0`);
    await conn.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS min_stock INT NOT NULL DEFAULT 10`);
    await conn.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS roll_width_cm DECIMAL(6,1) DEFAULT NULL`);
    await conn.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS roll_length_m DECIMAL(6,2) DEFAULT NULL`);
    await conn.query(`
      CREATE TABLE IF NOT EXISTS suppliers (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        contact_name VARCHAR(255) DEFAULT NULL,
        phone VARCHAR(50) DEFAULT NULL,
        email VARCHAR(255) DEFAULT NULL,
        tax_code VARCHAR(100) DEFAULT NULL,
        address TEXT DEFAULT NULL,
        payment_term_days INT NOT NULL DEFAULT 0,
        notes TEXT DEFAULT NULL,
        active TINYINT(1) NOT NULL DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await conn.query(`
      CREATE TABLE IF NOT EXISTS purchase_orders (
        id VARCHAR(100) PRIMARY KEY,
        supplier_id INT NOT NULL,
        supplier_name VARCHAR(255) NOT NULL,
        employee_name VARCHAR(255) DEFAULT NULL,
        expected_date DATE DEFAULT NULL,
        total BIGINT NOT NULL DEFAULT 0,
        status VARCHAR(50) NOT NULL DEFAULT 'Nháp',
        notes TEXT DEFAULT NULL,
        received_at TIMESTAMP NULL DEFAULT NULL,
        active TINYINT(1) NOT NULL DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await conn.query(`
      CREATE TABLE IF NOT EXISTS purchase_order_items (
        id INT AUTO_INCREMENT PRIMARY KEY,
        purchase_order_id VARCHAR(100) NOT NULL,
        product_id INT NOT NULL,
        product_name VARCHAR(255) NOT NULL,
        quantity INT NOT NULL,
        unit_cost BIGINT NOT NULL,
        line_total BIGINT NOT NULL,
        INDEX idx_purchase_items_order (purchase_order_id)
      )
    `);
    await conn.query(`
      CREATE TABLE IF NOT EXISTS product_images (
        id INT AUTO_INCREMENT PRIMARY KEY,
        product_id INT NOT NULL,
        image_path VARCHAR(500) NOT NULL,
        sort_order INT NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_product_images_product (product_id)
      )
    `);
    // Only 'approved' reviews are public. is_sample marks generated test reviews so they can be purged before go-live.
    await conn.query(`
      CREATE TABLE IF NOT EXISTS product_reviews (
        id INT AUTO_INCREMENT PRIMARY KEY,
        product_id INT NOT NULL,
        reviewer_name VARCHAR(120) NOT NULL,
        rating TINYINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
        comment TEXT,
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        is_sample TINYINT(1) NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_product_reviews_product (product_id, status)
      )
    `);
    await conn.query(`
      CREATE TABLE IF NOT EXISTS site_content (
        content_key VARCHAR(100) PRIMARY KEY,
        content_value LONGTEXT NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    await conn.query(`
      CREATE TABLE IF NOT EXISTS activities (
        id INT AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        activity_date DATE NOT NULL,
        category VARCHAR(100) NOT NULL,
        summary TEXT,
        image VARCHAR(500),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await conn.query(`ALTER TABLE activities ADD COLUMN IF NOT EXISTS active TINYINT(1) NOT NULL DEFAULT 1`);
    const adminHash = await bcrypt.hash('Admin123!', 10);
    await conn.query(`
      INSERT INTO permission_groups (name, description, permissions, is_system, active)
      VALUES ('Administrator', 'Nhóm quản trị hệ thống toàn quyền', '["*"]', 1, 1)
      ON DUPLICATE KEY UPDATE permissions='["*"]', is_system=1, active=1
    `);
    await conn.query(`
      INSERT IGNORE INTO permission_groups (name, description, permissions, active) VALUES
      ('Sales', 'Nhóm nhân viên kinh doanh', '["orders.view","orders.create","orders.change_status","orders.payments","inventory.view"]', 1),
      ('Kho', 'Nhóm vận hành kho', '["inventory.view","inventory.transactions","products.edit"]', 1),
      ('Kế toán', 'Nhóm kế toán và công nợ', '["orders.view","orders.payments","inventory.view","reports.view"]', 1),
      ('Nội dung', 'Nhóm quản lý website', '["content.manage","content.activities_create","content.activities_edit","content.activities_status","products.create","products.edit","products.categories_create","products.categories_edit"]', 1)
    `);
    await conn.query(`
      INSERT IGNORE INTO users (name, email, password, role, permissions)
      VALUES ('Administrator', 'admin@lalaflow.vn', ?, 'admin', '["*"]')
    `, [adminHash]);
    await conn.query(`UPDATE users SET group_id=(SELECT id FROM permission_groups WHERE name='Administrator' LIMIT 1) WHERE role='admin'`);
    const existingProducts = await conn.query('SELECT COUNT(*) AS count FROM products');
    if (Number(existingProducts[0].count) === 0) {
      await conn.query(`
        INSERT INTO products (name, category, stock, price, status, image, description)
        VALUES
          ('Giấy A4 70gsm', 'Giấy in', 150, 180000, 'Có sẵn', '/uploads/a4.jpg', 'Giấy in văn phòng chất lượng cao'),
          ('Giấy Kraft', 'Bao bì', 80, 260000, 'Đang nhập', '/uploads/kraft.jpg', 'Giấy kraft cho bao bì'),
          ('Giấy Couche', 'Giấy bìa', 45, 320000, 'Có sẵn', '/uploads/couche.jpg', 'Giấy bìa cao cấp')
      `);
    }
    const existingOrders = await conn.query('SELECT COUNT(*) AS count FROM orders');
    if (Number(existingOrders[0].count) === 0) {
      await conn.query(`
        INSERT INTO orders (id, customer, total, status)
        VALUES
          ('DH001', 'Công ty Minh Phúc', 1250000, 'Đã xử lý'),
          ('DH002', 'Nhà sách Hồng Hà', 890000, 'Đang giao')
      `);
    }
    await conn.query(`
      INSERT IGNORE INTO product_categories (name, description)
      SELECT DISTINCT category, CONCAT('Nhóm sản phẩm ', category) FROM products WHERE category <> ''
    `);
    const defaults = seedState().siteContent;
    for (const [key, value] of Object.entries(defaults)) {
      await conn.query('INSERT IGNORE INTO site_content (content_key, content_value) VALUES (?, ?)', [key, JSON.stringify(value)]);
    }
    const existingActivities = await conn.query('SELECT COUNT(*) AS count FROM activities');
    if (Number(existingActivities[0].count) === 0) {
      await conn.query(`
        INSERT INTO activities (title, activity_date, category, summary, image) VALUES
        ('Đồng hành cùng doanh nghiệp xanh', '2026-06-12', 'Cộng đồng', 'Chương trình thu gom và tái chế giấy văn phòng cùng các doanh nghiệp đối tác.', NULL),
        ('Mở rộng kho phân phối phía Nam', '2026-04-25', 'Doanh nghiệp', 'Nâng cao năng lực lưu kho và rút ngắn thời gian giao hàng tại TP.HCM và các tỉnh lân cận.', NULL),
        ('Workshop lựa chọn giấy in hiệu quả', '2026-02-18', 'Kiến thức', 'Chia sẻ cách lựa chọn định lượng, bề mặt và khổ giấy phù hợp cho từng nhu cầu in ấn.', NULL)
      `);
    }
  } catch (err) {
    console.error(err);
  } finally {
    if (conn) conn.release();
  }
}

// The token only proves who the caller is. Role, permissions and whether the account or its group is still active are
// read from the database on every request, so locking an employee or changing a group takes effect immediately.
async function authMiddleware(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  let payload;
  try {
    payload = jwt.verify(token, JWT_SECRET);
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
  if (!pool) {
    req.user = payload;
    return next();
  }
  try {
    const rows = await pool.query('SELECT u.id, u.name, u.email, u.role, u.permissions, u.active, g.permissions AS group_permissions, g.active AS group_active FROM users u LEFT JOIN permission_groups g ON g.id=u.group_id WHERE u.id = ?', [payload.id]);
    const user = rows[0];
    if (!user || !user.active) return res.status(401).json({ error: 'Tài khoản không còn hoạt động, vui lòng đăng nhập lại' });
    if (user.group_active === 0) return res.status(401).json({ error: 'Nhóm quyền đã ngừng hoạt động, vui lòng đăng nhập lại' });
    const { id, name, email, role, permissions } = publicUser(user);
    req.user = { id, name, email, role, permissions };
    return next();
  } catch (err) {
    console.error(`Auth lookup failed for user ${payload.id}: ${err.message}`);
    return res.status(503).json({ error: 'Không kiểm tra được phiên đăng nhập, vui lòng thử lại' });
  }
}

function adminOnly(req, res, next) {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  next();
}

function hasPermission(user, permission) {
  const permissions = user?.permissions || [];
  return user?.role === 'admin' || permissions.includes('*') || permissions.includes(permission);
}

const requirePermission = (permission) => (req, res, next) => {
  if (hasPermission(req.user, permission)) return next();
  return res.status(403).json({ error: 'Bạn không có quyền thực hiện chức năng này' });
};

function parsePermissions(value) {
  if (Array.isArray(value)) return value;
  try { return JSON.parse(value || '[]'); } catch { return []; }
}

function publicUser(user) {
  const permissions = user.role === 'admin' ? ['*'] : parsePermissions(user.group_permissions ?? user.permissions);
  return { id: user.id, name: user.name, email: user.email, phone: user.phone || '', role: user.role, active: Boolean(user.active), groupId: user.group_id || null, groupName: user.group_name || '', permissions };
}

async function writeAudit(user, action, entityType, entityId, details = '') {
  if (!pool) return;
  try {
    await pool.query(
      'INSERT INTO audit_logs (user_email,action,entity_type,entity_id,details) VALUES (?,?,?,?,?)',
      [user?.email || null, action, entityType, entityId == null ? null : String(entityId), details || null],
    );
  } catch (err) {
    console.error('Audit log error:', err.message);
  }
}

const auditActionByMethod = { POST: 'CREATE', PUT: 'UPDATE', PATCH: 'UPDATE' };
const auditEntityLabels = {
  'permission-groups': 'permission_group',
  employees: 'employee',
  categories: 'product_category',
  'site-content': 'site_content',
  activities: 'activity',
  products: 'product',
  inventory: 'inventory',
  'discount-codes': 'discount_code',
  orders: 'order',
  'correction-requests': 'correction_request',
  customers: 'customer',
  quotations: 'quotation',
  'quote-requests': 'quote_request',
  suppliers: 'supplier',
  'purchase-orders': 'purchase_order',
};

app.use((req, res, next) => {
  if (!auditActionByMethod[req.method]) return next();
  let responseBody;
  const originalJson = res.json.bind(res);
  res.json = (body) => {
    responseBody = body;
    return originalJson(body);
  };
  res.on('finish', () => {
    if (!req.user || res.statusCode >= 400) return;
    const segments = req.path.split('/').filter(Boolean);
    const root = segments[0];
    if (!auditEntityLabels[root]) return;
    let entityType = auditEntityLabels[root];
    if (root === 'orders' && segments[2] === 'payments') entityType = 'order_payment';
    if (root === 'products' && segments[2] === 'images') entityType = 'product_images';
    if (root === 'inventory' && req.method === 'POST') entityType = 'inventory_movement';
    const entityId = segments[1] || responseBody?.id || responseBody?.orderId || null;
    let action = auditActionByMethod[req.method];
    if (segments.at(-1) === 'status' || segments.at(-1) === 'active' || segments.at(-1) === 'group') action = 'STATUS';
    if (segments.at(-1) === 'payments') action = 'PAYMENT';
    if (segments.at(-1) === 'images') action = 'UPLOAD';
    if (segments.at(-1) === 'send-email') action = 'SEND_EMAIL';
    const detailParts = [
      req.body?.name,
      req.body?.title,
      req.body?.code,
      req.body?.customerName,
      req.body?.customer,
      req.body?.status,
      req.body?.type,
      req.body?.amount != null ? `Số tiền: ${Number(req.body.amount).toLocaleString('vi-VN')}` : '',
      req.files?.length ? `${req.files.length} hình ảnh` : '',
    ].filter(Boolean);
    writeAudit(req.user, action, entityType, entityId, detailParts.join(' · '));
  });
  next();
});

app.get('/health', (req, res) => res.json({ ok: true }));

const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_FAILURES_PER_ACCOUNT = 5;
// Many staff can share one address (office NAT, the Docker gateway), so the per-address cap is wider.
const LOGIN_MAX_FAILURES_PER_IP = 30;
// In memory, per process: a restart clears them.
const loginFailuresByAccount = new Map();
const loginFailuresByIp = new Map();
const recentFailures = (map, key, now) => (map.get(key) || []).filter((at) => now - at < LOGIN_WINDOW_MS);

function loginRefusal(account, ip, now) {
  if (recentFailures(loginFailuresByAccount, account, now).length >= LOGIN_MAX_FAILURES_PER_ACCOUNT) return 'Tài khoản tạm khóa do nhập sai nhiều lần, vui lòng thử lại sau 15 phút.';
  if (recentFailures(loginFailuresByIp, ip, now).length >= LOGIN_MAX_FAILURES_PER_IP) return 'Có quá nhiều lần đăng nhập sai từ mạng của bạn, vui lòng thử lại sau 15 phút.';
  return '';
}

function rememberLoginFailure(account, ip, now) {
  loginFailuresByAccount.set(account, [...recentFailures(loginFailuresByAccount, account, now), now]);
  loginFailuresByIp.set(ip, [...recentFailures(loginFailuresByIp, ip, now), now]);
}

app.post('/auth/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (typeof email !== 'string' || typeof password !== 'string' || !email.trim() || !password) {
    return res.status(400).json({ error: 'Vui lòng nhập email và mật khẩu' });
  }
  const account = email.trim().toLowerCase();
  const now = Date.now();
  const refusal = loginRefusal(account, req.ip, now);
  if (refusal) {
    console.warn(`Login refused for ${account} from ${req.ip}: too many failures`);
    return res.status(429).json({ error: refusal });
  }
  const failed = (status, error) => {
    rememberLoginFailure(account, req.ip, now);
    return res.status(status).json({ error });
  };
  try {
    if (pool) {
      const rows = await pool.query('SELECT u.*, g.name AS group_name, g.permissions AS group_permissions, g.active AS group_active FROM users u LEFT JOIN permission_groups g ON g.id=u.group_id WHERE u.email = ?', [email]);
      const user = rows[0];
      if (!user) return failed(401, 'Invalid credentials');
      const valid = await bcrypt.compare(password, user.password);
      if (!valid) return failed(401, 'Invalid credentials');
      if (!user.active) return res.status(403).json({ error: 'Tài khoản đã bị khóa' });
      if (user.group_id && !user.group_active) return res.status(403).json({ error: 'Nhóm quyền đã ngừng hoạt động' });
      loginFailuresByAccount.delete(account);
      return res.json({ token: signToken(user), user: publicUser(user) });
    }
    const user = state.users.find((row) => row.email === email);
    if (!user) return failed(401, 'Invalid credentials');
    const valid = bcrypt.compareSync(password, user.password);
    if (!valid) return failed(401, 'Invalid credentials');
    loginFailuresByAccount.delete(account);
    return res.json({ token: signToken(user), user: publicUser(user) });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

const NO_RATING = { average: 0, count: 0 };
const PUBLIC_REVIEW_LIMIT = 50;

async function ratingSummaries(productId) {
  const rows = await pool.query(
    `SELECT product_id, AVG(rating) AS average, COUNT(*) AS count FROM product_reviews
     WHERE status = 'approved' AND (? IS NULL OR product_id = ?) GROUP BY product_id`,
    [productId ?? null, productId ?? null],
  );
  return Object.fromEntries(rows.map((row) => [row.product_id, {
    average: Math.round(Number(row.average) * 10) / 10,
    count: Number(row.count),
  }]));
}

app.get('/products/:id/reviews', async (req, res) => {
  try {
    if (!pool) return res.json([]);
    const rows = await pool.query(
      `SELECT id, reviewer_name, rating, comment, is_sample, created_at FROM product_reviews
       WHERE product_id = ? AND status = 'approved' ORDER BY created_at DESC, id DESC LIMIT ?`,
      [req.params.id, PUBLIC_REVIEW_LIMIT],
    );
    return res.json(rows.map((row) => ({
      id: row.id,
      reviewerName: row.reviewer_name,
      rating: Number(row.rating),
      comment: row.comment,
      isSample: Boolean(row.is_sample),
      createdAt: row.created_at,
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const REVIEW_NAME_MIN = 2;
const REVIEW_NAME_MAX = 60;
const REVIEW_COMMENT_MAX = 1000;
const REVIEW_WINDOW_MS = 60 * 60 * 1000;
const REVIEW_MAX_PER_REVIEWER = 5;
// Many visitors can share one address (office NAT, the Docker gateway, a proxy), so the per-address cap is wider.
const REVIEW_MAX_PER_IP = 30;
const REVIEW_SAME_PRODUCT_WINDOW_MS = 24 * 60 * 60 * 1000;
const REVIEWER_KEY = /^[A-Za-z0-9-]{8,64}$/;
// Reviews go live immediately (owner's choice), so these limits are the spam guard. In memory: a restart resets them.
const recentReviewsByReviewer = new Map();
const recentReviewsByIp = new Map();

const recentEntries = (map, key, now) => (map.get(key) || []).filter((entry) => now - entry.at < REVIEW_SAME_PRODUCT_WINDOW_MS);

function reviewLimitRefusal({ reviewerKey, ip, productId, now }) {
  const byReviewer = recentEntries(recentReviewsByReviewer, reviewerKey, now);
  if (byReviewer.some((entry) => entry.productId === productId)) return 'Bạn đã đánh giá sản phẩm này hôm nay, cảm ơn bạn!';
  if (byReviewer.filter((entry) => now - entry.at < REVIEW_WINDOW_MS).length >= REVIEW_MAX_PER_REVIEWER) {
    return 'Bạn đã gửi khá nhiều đánh giá, vui lòng thử lại sau ít phút.';
  }
  if (recentEntries(recentReviewsByIp, ip, now).filter((entry) => now - entry.at < REVIEW_WINDOW_MS).length >= REVIEW_MAX_PER_IP) {
    return 'Có nhiều đánh giá gửi từ cùng mạng của bạn, vui lòng thử lại sau ít phút.';
  }
  return '';
}

function rememberReview({ reviewerKey, ip, productId, now }) {
  recentReviewsByReviewer.set(reviewerKey, [...recentEntries(recentReviewsByReviewer, reviewerKey, now), { productId, at: now }]);
  recentReviewsByIp.set(ip, [...recentEntries(recentReviewsByIp, ip, now), { productId, at: now }]);
}

function parseReview(body) {
  const reviewerKey = String(body?.reviewerKey ?? '');
  if (!REVIEWER_KEY.test(reviewerKey)) return { error: 'Phiên đánh giá không hợp lệ, vui lòng tải lại trang' };
  const reviewerName = String(body?.reviewerName ?? '').replace(/\s+/g, ' ').trim();
  const comment = String(body?.comment ?? '').trim();
  const rating = Number(body?.rating);
  if (reviewerName.length < REVIEW_NAME_MIN || reviewerName.length > REVIEW_NAME_MAX) {
    return { error: `Tên cần từ ${REVIEW_NAME_MIN} đến ${REVIEW_NAME_MAX} ký tự` };
  }
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return { error: 'Vui lòng chọn số sao từ 1 đến 5' };
  if (comment.length > REVIEW_COMMENT_MAX) return { error: `Nhận xét tối đa ${REVIEW_COMMENT_MAX} ký tự` };
  return { reviewerKey, review: { reviewerName, rating, comment: comment || null } };
}

app.post('/products/:id/reviews', async (req, res) => {
  try {
    if (!pool) return res.status(503).json({ error: 'Chưa kết nối cơ sở dữ liệu' });
    const productId = Number(req.params.id);
    if (!Number.isInteger(productId)) return res.status(400).json({ error: 'Mã sản phẩm không hợp lệ' });
    const parsed = parseReview(req.body);
    if (parsed.error) return res.status(400).json({ error: parsed.error });
    const products = await pool.query('SELECT id FROM products WHERE id = ? AND active = 1', [productId]);
    if (!products[0]) return res.status(404).json({ error: 'Sản phẩm không tồn tại' });

    const attempt = { reviewerKey: parsed.reviewerKey, ip: req.ip, productId, now: Date.now() };
    const refusal = reviewLimitRefusal(attempt);
    if (refusal) return res.status(429).json({ error: refusal });

    const { reviewerName, rating, comment } = parsed.review;
    const result = await pool.query(
      `INSERT INTO product_reviews (product_id, reviewer_name, rating, comment, status, is_sample) VALUES (?, ?, ?, ?, 'approved', 0)`,
      [productId, reviewerName, rating, comment],
    );
    rememberReview(attempt);
    const summary = (await ratingSummaries(productId))[productId] || NO_RATING;
    return res.status(201).json({
      review: { id: Number(result.insertId), reviewerName, rating, comment, isSample: false, createdAt: new Date(attempt.now).toISOString() },
      rating: summary,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Columns the storefront must never receive: cost price and reorder level are internal.
const PRIVATE_PRODUCT_FIELDS = ['cost_price', 'min_stock'];
const publicProduct = (product) => Object.fromEntries(Object.entries(product).filter(([key]) => !PRIVATE_PRODUCT_FIELDS.includes(key)));

// ?all=1 is the admin view (inactive products, categories and activities; product cost price), so it needs a signed-in
// user; without it, the public list.
const staffForFullCatalogue = (req, res, next) => (req.query.all === '1' ? authMiddleware(req, res, next) : next());

app.get('/products', staffForFullCatalogue, async (req, res) => {
  const isStaffView = req.query.all === '1';
  const shape = isStaffView ? (product) => product : publicProduct;
  try {
    if (pool) {
      const rows = await pool.query('SELECT * FROM products WHERE (?=1 OR active=1) ORDER BY id DESC', [isStaffView ? 1 : 0]);
      const imageRows = await pool.query('SELECT id, product_id, image_path, sort_order FROM product_images ORDER BY sort_order, id');
      const imagesByProduct = imageRows.reduce((result, image) => {
        (result[image.product_id] ||= []).push({ id: image.id, path: image.image_path, sortOrder: image.sort_order });
        return result;
      }, {});
      const ratingByProduct = await ratingSummaries();
      return res.json(rows.map((product) => shape({
        ...product,
        price: Number(product.price || 0),
        cost_price: Number(product.cost_price || 0),
        stock: Number(product.stock || 0),
        min_stock: Number(product.min_stock || 0),
        active: Boolean(product.active),
        images: imagesByProduct[product.id] || (product.image ? [{ id: `primary-${product.id}`, path: product.image, sortOrder: 0 }] : []),
        rating: ratingByProduct[product.id] || NO_RATING,
      })));
    }
    res.json(state.products.map((product) => shape({ ...product, images: product.images || (product.image ? [{ id: `primary-${product.id}`, path: product.image, sortOrder: 0 }] : []) })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/auth/me', authMiddleware, async (req, res) => {
  try {
    if (pool) {
      const rows = await pool.query('SELECT u.id, u.name, u.email, u.phone, u.role, u.permissions, u.active, u.group_id, g.name AS group_name, g.permissions AS group_permissions FROM users u LEFT JOIN permission_groups g ON g.id=u.group_id WHERE u.id = ?', [req.user.id]);
      return rows[0] && rows[0].active ? res.json(publicUser(rows[0])) : res.status(404).json({ error: 'User not found' });
    }
    const user = state.users.find((row) => row.id === req.user.id);
    return user ? res.json({ id: user.id, name: user.name, email: user.email, role: user.role }) : res.status(404).json({ error: 'User not found' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/permission-groups', authMiddleware, adminOnly, async (req, res) => {
  try {
    const rows = await pool.query('SELECT g.*, COUNT(u.id) AS member_count FROM permission_groups g LEFT JOIN users u ON u.group_id=g.id GROUP BY g.id ORDER BY g.is_system DESC, g.name');
    return res.json(rows.map((group) => ({ ...group, permissions: parsePermissions(group.permissions), member_count: Number(group.member_count), active: Boolean(group.active), is_system: Boolean(group.is_system) })));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/permission-groups', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { name, description, permissions = [], active = true } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Tên nhóm là bắt buộc' });
    const result = await pool.query('INSERT INTO permission_groups (name, description, permissions, active) VALUES (?, ?, ?, ?)', [name.trim(), description || null, JSON.stringify(permissions), active ? 1 : 0]);
    return res.status(201).json({ id: Number(result.insertId) });
  } catch (err) { res.status(err.code === 'ER_DUP_ENTRY' ? 409 : 500).json({ error: err.code === 'ER_DUP_ENTRY' ? 'Tên nhóm đã tồn tại' : err.message }); }
});

app.put('/permission-groups/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    const rows = await pool.query('SELECT is_system FROM permission_groups WHERE id=?', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Không tìm thấy nhóm' });
    if (rows[0].is_system) return res.status(400).json({ error: 'Không thể sửa nhóm Administrator hệ thống' });
    await pool.query('UPDATE permission_groups SET name=?, description=?, permissions=?, active=? WHERE id=?', [req.body.name, req.body.description || null, JSON.stringify(req.body.permissions || []), req.body.active ? 1 : 0, req.params.id]);
    return res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/employees', authMiddleware, adminOnly, async (req, res) => {
  try {
    const rows = await pool.query('SELECT u.id, u.name, u.email, u.phone, u.role, u.permissions, u.active, u.created_at, u.group_id, g.name AS group_name, g.permissions AS group_permissions FROM users u LEFT JOIN permission_groups g ON g.id=u.group_id ORDER BY u.created_at DESC');
    return res.json(rows.map(publicUser));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/employees', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { name, email, phone, password, role = 'staff', groupId, active = true } = req.body;
    if (!name || !email || !password || password.length < 6) return res.status(400).json({ error: 'Tên, email và mật khẩu tối thiểu 6 ký tự là bắt buộc' });
    const hash = await bcrypt.hash(password, 10);
    const roleGroup = { sales: 'Sales', warehouse: 'Kho', accounting: 'Kế toán', content: 'Nội dung', admin: 'Administrator' }[role];
    let resolvedGroupId = groupId || null;
    if (!resolvedGroupId && roleGroup) {
      const groups = await pool.query('SELECT id FROM permission_groups WHERE name=?', [roleGroup]);
      resolvedGroupId = groups[0]?.id || null;
    }
    const result = await pool.query('INSERT INTO users (name, email, phone, password, role, group_id, permissions, active) VALUES (?, ?, ?, ?, ?, ?, "[]", ?)', [name, email, phone || null, hash, role, resolvedGroupId, active ? 1 : 0]);
    return res.status(201).json({ id: Number(result.insertId) });
  } catch (err) {
    res.status(err.code === 'ER_DUP_ENTRY' ? 409 : 500).json({ error: err.code === 'ER_DUP_ENTRY' ? 'Email đã tồn tại' : err.message });
  }
});

app.put('/employees/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { name, email, phone, password, role = 'staff', groupId, active = true } = req.body;
    if (String(req.params.id) === String(req.user.id) && !active) return res.status(400).json({ error: 'Không thể tự khóa tài khoản đang đăng nhập' });
    if (password) {
      const hash = await bcrypt.hash(password, 10);
      await pool.query('UPDATE users SET name=?, email=?, phone=?, password=?, role=?, group_id=?, active=? WHERE id=?', [name, email, phone || null, hash, role, groupId || null, active ? 1 : 0, req.params.id]);
    } else {
      await pool.query('UPDATE users SET name=?, email=?, phone=?, role=?, group_id=?, active=? WHERE id=?', [name, email, phone || null, role, groupId || null, active ? 1 : 0, req.params.id]);
    }
    return res.json({ ok: true });
  } catch (err) {
    res.status(err.code === 'ER_DUP_ENTRY' ? 409 : 500).json({ error: err.code === 'ER_DUP_ENTRY' ? 'Email đã tồn tại' : err.message });
  }
});

app.delete('/employees/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    if (String(req.params.id) === String(req.user.id)) return res.status(400).json({ error: 'Không thể xóa tài khoản đang đăng nhập' });
    await pool.query('UPDATE users SET active=0 WHERE id = ?', [req.params.id]);
    return res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/employees/:id/group', authMiddleware, adminOnly, async (req, res) => {
  try {
    const groups = await pool.query('SELECT id, name, is_system, active FROM permission_groups WHERE id=?', [req.body.groupId]);
    if (!groups[0] || !groups[0].active) return res.status(400).json({ error: 'Nhóm quyền không hợp lệ hoặc đã inactive' });
    if (groups[0].is_system && String(req.params.id) !== String(req.user.id)) return res.status(400).json({ error: 'Không gán nhóm Administrator cho tài khoản khác tại đây' });
    await pool.query('UPDATE users SET group_id=? WHERE id=?', [req.body.groupId, req.params.id]);
    return res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/categories', staffForFullCatalogue, async (req, res) => {
  try {
    if (pool) {
      const rows = await pool.query(`
        SELECT c.id, c.name, c.description, c.active, COUNT(p.id) AS product_count
        FROM product_categories c LEFT JOIN products p ON p.category = c.name
        WHERE (?=1 OR c.active=1)
        GROUP BY c.id, c.name, c.description, c.active ORDER BY c.name
      `, [req.query.all === '1' ? 1 : 0]);
      return res.json(rows.map((row) => ({ ...row, product_count: Number(row.product_count) })));
    }
    const names = [...new Set(state.products.map((product) => product.category))];
    return res.json((state.categories || names.map((name, index) => ({ id: index + 1, name, description: '' }))).map((category) => ({
      ...category, product_count: state.products.filter((product) => product.category === category.name).length
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/categories', authMiddleware, requirePermission('products.categories_create'), async (req, res) => {
  try {
    const name = String(req.body.name || '').trim();
    if (!name) return res.status(400).json({ error: 'Tên loại sản phẩm là bắt buộc' });
    if (pool) {
      const result = await pool.query('INSERT INTO product_categories (name, description) VALUES (?, ?)', [name, req.body.description || null]);
      return res.status(201).json({ id: Number(result.insertId) });
    }
    state.categories ||= [];
    if (state.categories.some((item) => item.name.toLowerCase() === name.toLowerCase())) return res.status(409).json({ error: 'Loại sản phẩm đã tồn tại' });
    const category = { id: Date.now(), name, description: req.body.description || '' };
    state.categories.push(category); writeState(state);
    return res.status(201).json(category);
  } catch (err) {
    res.status(err.code === 'ER_DUP_ENTRY' ? 409 : 500).json({ error: err.code === 'ER_DUP_ENTRY' ? 'Loại sản phẩm đã tồn tại' : err.message });
  }
});

app.put('/categories/:id', authMiddleware, requirePermission('products.categories_edit'), async (req, res) => {
  try {
    const name = String(req.body.name || '').trim();
    if (!name) return res.status(400).json({ error: 'Tên loại sản phẩm là bắt buộc' });
    if (pool) {
      const rows = await pool.query('SELECT name FROM product_categories WHERE id = ?', [req.params.id]);
      if (!rows[0]) return res.status(404).json({ error: 'Không tìm thấy loại sản phẩm' });
      await pool.query('UPDATE products SET category = ? WHERE category = ?', [name, rows[0].name]);
      await pool.query('UPDATE product_categories SET name = ?, description = ? WHERE id = ?', [name, req.body.description || null, req.params.id]);
    } else {
      state.categories ||= [];
      const current = state.categories.find((item) => item.id === Number(req.params.id));
      if (!current) return res.status(404).json({ error: 'Không tìm thấy loại sản phẩm' });
      state.products = state.products.map((product) => product.category === current.name ? { ...product, category: name } : product);
      Object.assign(current, { name, description: req.body.description || '' }); writeState(state);
    }
    return res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/categories/:id', authMiddleware, requirePermission('products.categories_status'), async (req, res) => {
  try {
    if (pool) {
      const rows = await pool.query(`
        SELECT c.name, COUNT(p.id) AS product_count FROM product_categories c
        LEFT JOIN products p ON p.category = c.name WHERE c.id = ? GROUP BY c.id, c.name
      `, [req.params.id]);
      if (!rows[0]) return res.status(404).json({ error: 'Không tìm thấy loại sản phẩm' });
      await pool.query('UPDATE product_categories SET active=0 WHERE id = ?', [req.params.id]);
    } else {
      state.categories ||= [];
      const current = state.categories.find((item) => item.id === Number(req.params.id));
      if (state.products.some((product) => product.category === current?.name)) return res.status(409).json({ error: 'Không thể xóa loại đang có sản phẩm' });
      state.categories = state.categories.filter((item) => item.id !== Number(req.params.id)); writeState(state);
    }
    return res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/categories/:id/status', authMiddleware, requirePermission('products.categories_status'), async (req, res) => {
  try {
    await pool.query('UPDATE product_categories SET active=? WHERE id=?', [req.body.active ? 1 : 0, req.params.id]);
    return res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/products/:id', async (req, res) => {
  try {
    if (pool) {
      const rows = await pool.query('SELECT * FROM products WHERE id = ? AND active = 1', [req.params.id]);
      if (!rows[0]) return res.status(404).json({ error: 'Product not found' });
      const images = await pool.query('SELECT id, image_path AS path, sort_order AS sortOrder FROM product_images WHERE product_id = ? ORDER BY sort_order, id', [req.params.id]);
      const rating = (await ratingSummaries(rows[0].id))[rows[0].id] || NO_RATING;
      return res.json(publicProduct({
        ...rows[0],
        rating,
        price: Number(rows[0].price || 0),
        cost_price: Number(rows[0].cost_price || 0),
        stock: Number(rows[0].stock || 0),
        min_stock: Number(rows[0].min_stock || 0),
        active: Boolean(rows[0].active),
        images: images.length ? images : (rows[0].image ? [{ id: `primary-${rows[0].id}`, path: rows[0].image, sortOrder: 0 }] : []),
      }));
    }
    const product = state.products.find((item) => item.id === Number(req.params.id) && item.active !== false);
    return product ? res.json(publicProduct(product)) : res.status(404).json({ error: 'Product not found' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/site-content', async (req, res) => {
  try {
    if (pool) {
      const rows = await pool.query('SELECT content_key, content_value FROM site_content');
      const content = Object.fromEntries(rows.map((row) => [row.content_key, JSON.parse(row.content_value)]));
      return res.json(content);
    }
    return res.json(state.siteContent);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/site-content/:key', authMiddleware, requirePermission('content.manage'), async (req, res) => {
  try {
    if (pool) {
      await pool.query(
        'INSERT INTO site_content (content_key, content_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE content_value=VALUES(content_value)',
        [req.params.key, JSON.stringify(req.body)]
      );
    } else {
      state.siteContent[req.params.key] = req.body;
      writeState(state);
    }
    return res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/activities', staffForFullCatalogue, async (req, res) => {
  try {
    if (pool) {
      const rows = await pool.query('SELECT id, title, activity_date AS date, category, summary, image, active FROM activities WHERE (?=1 OR active=1) ORDER BY activity_date DESC', [req.query.all === '1' ? 1 : 0]);
      return res.json(rows);
    }
    return res.json([...state.activities].sort((a, b) => b.date.localeCompare(a.date)));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/activities', authMiddleware, requirePermission('content.activities_create'), async (req, res) => {
  try {
    const { title, date, category, summary, image } = req.body;
    if (pool) {
      const result = await pool.query('INSERT INTO activities (title, activity_date, category, summary, image) VALUES (?, ?, ?, ?, ?)', [title, date, category, summary, image || null]);
      return res.status(201).json({ id: Number(result.insertId) });
    }
    const activity = { id: Date.now(), title, date, category, summary, image: image || '' };
    state.activities.unshift(activity);
    writeState(state);
    return res.status(201).json(activity);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/activities/:id', authMiddleware, requirePermission('content.activities_edit'), async (req, res) => {
  try {
    const { title, date, category, summary, image } = req.body;
    if (pool) {
      await pool.query('UPDATE activities SET title=?, activity_date=?, category=?, summary=?, image=? WHERE id=?', [title, date, category, summary, image || null, req.params.id]);
    } else {
      state.activities = state.activities.map((item) => item.id === Number(req.params.id) ? { ...item, title, date, category, summary, image: image || '' } : item);
      writeState(state);
    }
    return res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/activities/:id', authMiddleware, requirePermission('content.activities_status'), async (req, res) => {
  try {
    if (pool) await pool.query('UPDATE activities SET active=0 WHERE id = ?', [req.params.id]);
    else {
      state.activities = state.activities.filter((item) => item.id !== Number(req.params.id));
      writeState(state);
    }
    return res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/activities/:id/status', authMiddleware, requirePermission('content.activities_status'), async (req, res) => {
  try {
    await pool.query('UPDATE activities SET active=? WHERE id=?', [req.body.active ? 1 : 0, req.params.id]);
    return res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/products', authMiddleware, requirePermission('products.create'), async (req, res) => {
  try {
    const { name, category, stock, price, costPrice = 0, minStock = 10, unit = 'đơn vị', status, image, description } = req.body;
    if (!name?.trim() || !category) return res.status(400).json({ error: 'Tên và loại sản phẩm là bắt buộc' });
    if (!Number.isInteger(Number(stock)) || Number(stock) < 0) return res.status(400).json({ error: 'Tồn kho phải là số nguyên không âm' });
    if (!Number.isFinite(Number(price)) || Number(price) < 0) return res.status(400).json({ error: 'Giá bán phải là số không âm' });
    if (Number(costPrice) < 0 || !Number.isInteger(Number(minStock)) || Number(minStock) < 0) return res.status(400).json({ error: 'Giá vốn hoặc ngưỡng tồn tối thiểu không hợp lệ' });
    if (pool) {
      const result = await pool.query('INSERT INTO products (name, category, stock, price, cost_price, min_stock, unit, status, image, description) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [name, category, Number(stock), Number(price), Number(costPrice), Number(minStock), unit || 'đơn vị', status, image || null, description || null]);
      return res.status(201).json({ id: Number(result.insertId) });
    }
    const product = { id: Date.now(), name, category, stock: Number(stock), price: Number(price), status, image: image || null, description: description || null };
    state.products.unshift(product);
    writeState(state);
    return res.status(201).json({ id: product.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/products/:id', authMiddleware, requirePermission('products.edit'), async (req, res) => {
  try {
    const { name, category, stock, price, costPrice = 0, minStock = 10, unit = 'đơn vị', status, image, description } = req.body;
    if (!name?.trim() || !category) return res.status(400).json({ error: 'Tên và loại sản phẩm là bắt buộc' });
    if (!Number.isInteger(Number(stock)) || Number(stock) < 0) return res.status(400).json({ error: 'Tồn kho phải là số nguyên không âm' });
    if (!Number.isFinite(Number(price)) || Number(price) < 0) return res.status(400).json({ error: 'Giá bán phải là số không âm' });
    if (Number(costPrice) < 0 || !Number.isInteger(Number(minStock)) || Number(minStock) < 0) return res.status(400).json({ error: 'Giá vốn hoặc ngưỡng tồn tối thiểu không hợp lệ' });
    if (pool) {
      await pool.query('UPDATE products SET name=?, category=?, stock=?, price=?, cost_price=?, min_stock=?, unit=?, status=?, image=?, description=? WHERE id=?', [name, category, Number(stock), Number(price), Number(costPrice), Number(minStock), unit || 'đơn vị', status, image || null, description || null, req.params.id]);
      return res.json({ ok: true });
    }
    state.products = state.products.map((product) => (product.id === Number(req.params.id) ? { ...product, name, category, stock: Number(stock), price: Number(price), status, image: image || product.image, description: description || product.description } : product));
    writeState(state);
    return res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/products/:id', authMiddleware, requirePermission('products.change_status'), async (req, res) => {
  try {
    if (pool) {
      await pool.query('UPDATE products SET active=0 WHERE id=?', [req.params.id]);
      return res.json({ ok: true });
    }
    state.products = state.products.filter((product) => product.id !== Number(req.params.id));
    writeState(state);
    return res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/products/:id/images', authMiddleware, requirePermission('products.edit'), upload.array('images', 5), async (req, res) => {
  try {
    if (!req.files?.length) return res.status(400).json({ error: 'Vui lòng chọn ít nhất một file ảnh' });
    const imagePaths = req.files.map((file) => `/uploads/${file.filename}`);
    const reject = (status, error) => {
      discardUploads(req.files);
      return res.status(status).json({ error });
    };
    if (pool) {
      const product = await pool.query('SELECT id FROM products WHERE id = ?', [req.params.id]);
      if (!product[0]) return reject(404, 'Sản phẩm không tồn tại');
      const current = await pool.query('SELECT COUNT(*) AS count FROM product_images WHERE product_id = ?', [req.params.id]);
      const currentCount = Number(current[0].count);
      if (currentCount + imagePaths.length > 5) return reject(400, 'Mỗi sản phẩm chỉ được tối đa 5 hình ảnh');
      for (let index = 0; index < imagePaths.length; index += 1) {
        await pool.query('INSERT INTO product_images (product_id, image_path, sort_order) VALUES (?, ?, ?)', [req.params.id, imagePaths[index], currentCount + index]);
      }
      if (currentCount === 0) await pool.query('UPDATE products SET image=? WHERE id=?', [imagePaths[0], req.params.id]);
      const images = await pool.query('SELECT id, image_path AS path, sort_order AS sortOrder FROM product_images WHERE product_id = ? ORDER BY sort_order, id', [req.params.id]);
      return res.json({ images });
    }
    const currentProduct = state.products.find((product) => product.id === Number(req.params.id));
    if (!currentProduct) return reject(404, 'Sản phẩm không tồn tại');
    const existing = currentProduct.images || [];
    if (existing.length + imagePaths.length > 5) return reject(400, 'Mỗi sản phẩm chỉ được tối đa 5 hình ảnh');
    const newImages = imagePaths.map((pathValue, index) => ({ id: Date.now() + index, path: pathValue, sortOrder: existing.length + index }));
    currentProduct.images = [...existing, ...newImages];
    currentProduct.image ||= imagePaths[0];
    writeState(state);
    return res.json({ images: currentProduct.images });
  } catch (err) {
    discardUploads(req.files);
    res.status(500).json({ error: err.message });
  }
});

app.patch('/products/:id/status', authMiddleware, requirePermission('products.change_status'), async (req, res) => {
  try {
    await pool.query('UPDATE products SET active=? WHERE id=?', [req.body.active ? 1 : 0, req.params.id]);
    return res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/products/:productId/images/:imageId', authMiddleware, requirePermission('products.edit'), async (req, res) => {
  try {
    if (pool) {
      await pool.query('DELETE FROM product_images WHERE id = ? AND product_id = ?', [req.params.imageId, req.params.productId]);
      const remaining = await pool.query('SELECT image_path FROM product_images WHERE product_id = ? ORDER BY sort_order, id LIMIT 1', [req.params.productId]);
      await pool.query('UPDATE products SET image = ? WHERE id = ?', [remaining[0]?.image_path || null, req.params.productId]);
    } else {
      const product = state.products.find((item) => item.id === Number(req.params.productId));
      if (product) {
        product.images = (product.images || []).filter((image) => String(image.id) !== req.params.imageId);
        product.image = product.images[0]?.path || null;
        writeState(state);
      }
    }
    return res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const INVENTORY_TYPES = ['import', 'export'];
// Note prefixes of movements written automatically by orders, cancellations and purchase orders.
const DOCUMENT_MOVEMENT_NOTES = ['Bán hàng ', 'Hoàn kho hủy đơn ', 'Nhập từ đơn mua '];

// Stock is checked and changed with the product row locked, and the movement is written in the same transaction, so two
// exports at once cannot both pass the check, and a failed update cannot leave a movement with no stock change.
app.post('/inventory', authMiddleware, requirePermission('inventory.transactions'), async (req, res) => {
  let conn;
  try {
    const { type, productId, quantity, note } = req.body;
    const amount = Number(quantity);
    if (!INVENTORY_TYPES.includes(type) || !isWholeQuantity(amount)) return res.status(400).json({ error: 'Dữ liệu nhập/xuất kho không hợp lệ (số lượng phải là số nguyên từ 1)' });
    if (pool) {
      conn = await pool.getConnection();
      await conn.beginTransaction();
      const productRows = await conn.query('SELECT stock FROM products WHERE id = ? FOR UPDATE', [productId]);
      if (!productRows[0]) throw httpError(404, 'Không tìm thấy sản phẩm');
      if (type === 'export' && Number(productRows[0].stock) < amount) throw httpError(400, 'Tồn kho không đủ để xuất');
      await conn.query('INSERT INTO inventory_movements (type, product_id, quantity, note, user_name) VALUES (?, ?, ?, ?, ?)', [type, Number(productId), amount, note, req.user.email]);
      await conn.query(type === 'import' ? 'UPDATE products SET stock = stock + ? WHERE id = ?' : 'UPDATE products SET stock = stock - ? WHERE id = ?', [amount, Number(productId)]);
      await conn.commit();
      return res.status(201).json({ ok: true });
    }
    state.inventoryMovements.unshift({ id: Date.now(), type, product_id: Number(productId), quantity: Number(quantity), note, created_at: new Date().toISOString() });
    state.products = state.products.map((product) => (product.id === Number(productId) ? { ...product, stock: type === 'import' ? product.stock + Number(quantity) : Math.max(0, product.stock - Number(quantity)) } : product));
    writeState(state);
    return res.status(201).json({ ok: true });
  } catch (err) {
    if (conn) await conn.rollback();
    res.status(err.status || 500).json({ error: err.message });
  } finally {
    if (conn) conn.release();
  }
});

app.get('/inventory', authMiddleware, requirePermission('inventory.view'), async (req, res) => {
  try {
    if (pool) {
      const rows = await pool.query('SELECT m.*, p.name AS product_name FROM inventory_movements m LEFT JOIN products p ON p.id=m.product_id ORDER BY m.created_at DESC');
      return res.json(rows);
    }
    res.json(state.inventoryMovements);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/orders', authMiddleware, requirePermission('orders.view'), async (req, res) => {
  try {
    if (pool) {
      const rows = await pool.query('SELECT * FROM orders ORDER BY created_at DESC');
      const items = await pool.query('SELECT * FROM order_items ORDER BY id');
      const payments = await pool.query('SELECT * FROM order_payments ORDER BY created_at DESC');
      return res.json(rows.map((order) => ({ ...order, subtotal: Number(order.subtotal), discount_value: Number(order.discount_value), discount_amount: Number(order.discount_amount), total: Number(order.total), paid_amount: Number(order.paid_amount), debt_amount: Number(order.debt_amount), items: items.filter((item) => item.order_id === order.id).map((item) => ({ ...item, unit_price: Number(item.unit_price), line_total: Number(item.line_total) })), payments: payments.filter((payment) => payment.order_id === order.id).map((payment) => ({ ...payment, amount: Number(payment.amount) })) })));
    }
    res.json(state.orders);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/discount-codes', authMiddleware, requirePermission('orders.view'), async (req, res) => {
  try {
    const rows = await pool.query('SELECT * FROM discount_codes ORDER BY created_at DESC');
    return res.json(rows.map((row) => ({ ...row, discount_value: Number(row.discount_value), min_order_amount: Number(row.min_order_amount), max_discount_amount: row.max_discount_amount == null ? null : Number(row.max_discount_amount), active: Boolean(row.active) })));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/discount-codes', authMiddleware, requirePermission('orders.discounts_manage'), async (req, res) => {
  try {
    const { code, name, discountType = 'percent', discountValue, minOrderAmount = 0, maxDiscountAmount, usageLimit, startsAt, expiresAt, active = true } = req.body;
    const normalizedCode = String(code || '').trim().toUpperCase();
    const value = Number(discountValue);
    if (!normalizedCode || !name?.trim()) return res.status(400).json({ error: 'Mã và tên chương trình chiết khấu là bắt buộc' });
    if (!['percent', 'fixed'].includes(discountType) || value <= 0) return res.status(400).json({ error: 'Mức chiết khấu không hợp lệ' });
    if (discountType === 'percent' && value > 100) return res.status(400).json({ error: 'Chiết khấu phần trăm không được vượt quá 100%' });
    const result = await pool.query('INSERT INTO discount_codes (code,name,discount_type,discount_value,min_order_amount,max_discount_amount,usage_limit,starts_at,expires_at,active) VALUES (?,?,?,?,?,?,?,?,?,?)', [normalizedCode, name.trim(), discountType, value, Number(minOrderAmount)||0, maxDiscountAmount ? Number(maxDiscountAmount) : null, usageLimit ? Number(usageLimit) : null, startsAt || null, expiresAt || null, active ? 1 : 0]);
    return res.status(201).json({ id: Number(result.insertId) });
  } catch (err) { res.status(err.code === 'ER_DUP_ENTRY' ? 409 : 500).json({ error: err.code === 'ER_DUP_ENTRY' ? 'Mã chiết khấu đã tồn tại' : err.message }); }
});

app.put('/discount-codes/:id', authMiddleware, requirePermission('orders.discounts_manage'), async (req, res) => {
  try {
    const { code, name, discountType, discountValue, minOrderAmount = 0, maxDiscountAmount, usageLimit, startsAt, expiresAt, active = true } = req.body;
    const value = Number(discountValue);
    if (!code?.trim() || !name?.trim() || !['percent', 'fixed'].includes(discountType) || value <= 0 || (discountType === 'percent' && value > 100)) return res.status(400).json({ error: 'Thông tin mã chiết khấu không hợp lệ' });
    await pool.query('UPDATE discount_codes SET code=?,name=?,discount_type=?,discount_value=?,min_order_amount=?,max_discount_amount=?,usage_limit=?,starts_at=?,expires_at=?,active=? WHERE id=?', [code.trim().toUpperCase(), name.trim(), discountType, value, Number(minOrderAmount)||0, maxDiscountAmount ? Number(maxDiscountAmount) : null, usageLimit ? Number(usageLimit) : null, startsAt || null, expiresAt || null, active ? 1 : 0, req.params.id]);
    return res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/inventory/:id', authMiddleware, adminOnly, async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();
    await conn.beginTransaction();
    const newType = req.body.type;
    const newQuantity = Number(req.body.quantity);
    const isActive = Boolean(req.body.active);
    if (!INVENTORY_TYPES.includes(newType) || !isWholeQuantity(newQuantity)) throw new Error('Loại phiếu hoặc số lượng không hợp lệ (số lượng phải là số nguyên từ 1)');
    const rows = await conn.query('SELECT * FROM inventory_movements WHERE id=? FOR UPDATE', [req.params.id]);
    const old = rows[0];
    if (!old) throw new Error('Không tìm thấy chứng từ kho');
    // Movements written by orders and purchase orders must keep matching those documents; fix the document instead.
    if (DOCUMENT_MOVEMENT_NOTES.some((prefix) => String(old.note || '').startsWith(prefix))) throw new Error('Phiếu kho sinh từ đơn hàng hoặc đơn mua, hãy điều chỉnh trên chứng từ gốc');
    const productRows = await conn.query('SELECT stock FROM products WHERE id=? FOR UPDATE', [old.product_id]);
    // A voided movement no longer counts: undo the old effect only if it was still active, apply the new one only if it stays active.
    const effect = (type, quantity, active) => (active ? (type === 'import' ? quantity : -quantity) : 0);
    const stock = Number(productRows[0].stock) - effect(old.type, Number(old.quantity), Boolean(old.active)) + effect(newType, newQuantity, isActive);
    if (stock < 0) throw new Error('Điều chỉnh làm tồn kho âm');
    await conn.query('UPDATE products SET stock=? WHERE id=?', [stock, old.product_id]);
    await conn.query('UPDATE inventory_movements SET type=?, quantity=?, note=?, active=?, corrected_by=?, corrected_at=NOW() WHERE id=?', [newType, newQuantity, req.body.note || null, isActive ? 1 : 0, req.user.email, req.params.id]);
    await conn.commit();
    return res.json({ ok: true });
  } catch (err) {
    if (conn) await conn.rollback();
    res.status(400).json({ error: err.message });
  } finally { if (conn) conn.release(); }
});

const ORDER_STATUSES = ['Đơn mới', 'Đã xác nhận', 'Đang chuẩn bị', 'Đang giao', 'Hoàn thành', 'Đã hủy', 'Đã xử lý', 'Đã thanh toán'];
const CANCELLED = 'Đã hủy';
const PAID = 'Đã thanh toán';
const SHOP_TIME_ZONE = 'Asia/Ho_Chi_Minh';

// "YYYY-MM-DD" for today in the shop's time zone; toISOString() is UTC, which is still yesterday before 07:00 here.
const shopToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: SHOP_TIME_ZONE }).format(new Date());

// The driver returns DATE columns as Date objects at local midnight; String(date) starts with the weekday ("Thu Oct 15"),
// so it cannot be compared with "YYYY-MM-DD". The local fields hold the stored day.
function dateOnly(value) {
  if (!(value instanceof Date)) return String(value).slice(0, 10);
  const pad = (n) => String(n).padStart(2, '0');
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
}

const isWholeQuantity = (value) => Number.isInteger(value) && value >= 1;
const isMoneyAmount = (value) => Number.isFinite(value) && value >= 0;

// Cancelling puts the goods back on the shelf. A cancelled order is final: reopening it would have to take stock out
// again, which may no longer be there, so a new order is the way to sell it again.
async function changeOrderStatus(conn, orderId, status, user) {
  const rows = await conn.query('SELECT status FROM orders WHERE id=? FOR UPDATE', [orderId]);
  if (!rows[0]) throw httpError(404, 'Không tìm thấy đơn hàng');
  const current = rows[0].status;
  if (current === status) return { restocked: 0 };
  if (current === CANCELLED) throw httpError(400, 'Đơn đã hủy không thể đổi trạng thái; hãy tạo đơn mới');
  await conn.query('UPDATE orders SET status=? WHERE id=?', [status, orderId]);
  if (status !== CANCELLED) return { restocked: 0 };
  const items = await conn.query('SELECT product_id, quantity FROM order_items WHERE order_id=? AND product_id IS NOT NULL', [orderId]);
  for (const item of items) {
    await conn.query('UPDATE products SET stock=stock+? WHERE id=?', [item.quantity, item.product_id]);
    await conn.query('INSERT INTO inventory_movements (type, product_id, quantity, note, user_name) VALUES ("import", ?, ?, ?, ?)', [item.product_id, item.quantity, `Hoàn kho hủy đơn ${orderId}`, user.email]);
  }
  return { restocked: items.length };
}

function httpError(status, message) {
  return Object.assign(new Error(message), { status });
}

// Debt the customer still owes on live orders; matched by name, the same way the CRM list links orders.
async function customerDebt(conn, customerName) {
  const rows = await conn.query('SELECT COALESCE(SUM(debt_amount),0) AS debt FROM orders WHERE customer=? AND active=1 AND status<>?', [customerName, CANCELLED]);
  return Number(rows[0].debt);
}

app.post('/orders', authMiddleware, requirePermission('orders.create'), async (req, res) => {
  let conn;
  try {
    const { customer, customerPhone, customerEmail, taxCode, invoiceName, invoiceAddress, employeeName, paidAmount = 0, status = 'Đơn mới', items = [], discountCode, discountPercent = 0, creditOverrideReason = '' } = req.body;
    if (!customer || !items.length) return res.status(400).json({ error: 'Khách hàng và sản phẩm là bắt buộc' });
    // A new order cannot start cancelled: its stock would leave the shelf and, a cancelled order being final, never return.
    if (!ORDER_STATUSES.includes(status) || status === CANCELLED) return res.status(400).json({ error: 'Trạng thái đơn hàng mới không hợp lệ' });
    if (!pool) return res.status(501).json({ error: 'Chức năng đơn hàng cần MariaDB' });
    conn = await pool.getConnection();
    await conn.beginTransaction();
    let subtotal = 0;
    const normalizedItems = [];
    // The same product can appear on several lines; each line must fit in what the earlier lines left on the shelf.
    const takenByProduct = new Map();
    for (const item of items) {
      const rows = await conn.query('SELECT id, name, stock, price FROM products WHERE id=? FOR UPDATE', [item.productId]);
      const product = rows[0];
      const quantity = Number(item.quantity);
      if (!product || !isWholeQuantity(quantity)) throw new Error('Sản phẩm trong đơn không hợp lệ (số lượng phải là số nguyên từ 1)');
      const taken = (takenByProduct.get(product.id) || 0) + quantity;
      if (Number(product.stock) < taken) throw new Error(`Tồn kho ${product.name} không đủ (còn ${product.stock}, đơn cần ${taken})`);
      takenByProduct.set(product.id, taken);
      // An explicit 0 is a free line; only a missing price falls back to the list price.
      const hasPrice = item.unitPrice !== undefined && item.unitPrice !== null && item.unitPrice !== '';
      const unitPrice = hasPrice ? Number(item.unitPrice) : Number(product.price);
      if (!isMoneyAmount(unitPrice)) throw new Error(`Đơn giá của ${product.name} không hợp lệ`);
      const lineTotal = unitPrice * quantity;
      subtotal += lineTotal;
      normalizedItems.push({ ...product, quantity, unitPrice, lineTotal });
    }
    let discountType = null;
    let discountValue = 0;
    let discountAmount = 0;
    let appliedCode = null;
    let codeRow = null;
    if (discountCode) {
      const codes = await conn.query('SELECT * FROM discount_codes WHERE code=? AND active=1 FOR UPDATE', [String(discountCode).trim().toUpperCase()]);
      codeRow = codes[0];
      const today = shopToday();
      if (!codeRow) throw new Error('Mã chiết khấu không tồn tại hoặc đã inactive');
      if (codeRow.starts_at && dateOnly(codeRow.starts_at) > today) throw new Error('Mã chiết khấu chưa đến ngày sử dụng');
      if (codeRow.expires_at && dateOnly(codeRow.expires_at) < today) throw new Error('Mã chiết khấu đã hết hạn');
      if (codeRow.usage_limit && Number(codeRow.used_count) >= Number(codeRow.usage_limit)) throw new Error('Mã chiết khấu đã hết lượt sử dụng');
      if (subtotal < Number(codeRow.min_order_amount)) throw new Error(`Đơn hàng chưa đạt giá trị tối thiểu ${Number(codeRow.min_order_amount).toLocaleString('vi-VN')}đ`);
      discountType = codeRow.discount_type;
      discountValue = Number(codeRow.discount_value);
      appliedCode = codeRow.code;
    } else if (Number(discountPercent) > 0) {
      if (Number(discountPercent) > 100) throw new Error('Chiết khấu không được vượt quá 100%');
      discountType = 'percent';
      discountValue = Number(discountPercent);
    }
    if (discountType === 'percent') discountAmount = Math.round(subtotal * discountValue / 100);
    if (discountType === 'fixed') discountAmount = Math.round(discountValue);
    if (codeRow?.max_discount_amount) discountAmount = Math.min(discountAmount, Number(codeRow.max_discount_amount));
    discountAmount = Math.min(discountAmount, subtotal);
    const total = subtotal - discountAmount;
    if (Number(discountPercent) < 0) throw new Error('Chiết khấu không được là số âm');
    if (Number(paidAmount) < 0 || Number(paidAmount) > total) throw new Error('Số tiền thanh toán không hợp lệ với doanh thu sau chiết khấu');
    const paid = Number(paidAmount);
    const debt = total - paid;
    if (status === PAID && debt > 0) throw new Error('Đơn còn nợ không thể tạo ở trạng thái "Đã thanh toán"');
    const overrideReason = String(creditOverrideReason).trim();
    let creditOverride = null;
    // Locking the customer row makes two simultaneous orders for one customer check the credit limit one after the other.
    const crm = await conn.query('SELECT credit_limit FROM customers WHERE name=? AND active=1 LIMIT 1 FOR UPDATE', [customer]);
    const creditLimit = Number(crm[0]?.credit_limit || 0);
    if (creditLimit > 0 && debt > 0) {
      const owed = await customerDebt(conn, customer);
      if (owed + debt > creditLimit) {
        const fmt = (n) => `${n.toLocaleString('vi-VN')}đ`;
        const detail = `nợ hiện tại ${fmt(owed)} + đơn này ${fmt(debt)} = ${fmt(owed + debt)}, hạn mức ${fmt(creditLimit)}`;
        if (req.user.role !== 'admin') throw httpError(400, `Vượt hạn mức công nợ của ${customer}: ${detail}. Cần khách thanh toán thêm hoặc admin duyệt.`);
        if (!overrideReason) throw Object.assign(httpError(400, `Vượt hạn mức công nợ của ${customer}: ${detail}. Nhập lý do để tạo đơn vượt hạn mức.`), { code: 'CREDIT_LIMIT' });
        creditOverride = `Vượt hạn mức (${detail}). Lý do: ${overrideReason}`;
      }
    }
    const orderId = `DH${Date.now()}`;
    await conn.query('INSERT INTO orders (id, customer, customer_phone, customer_email, tax_code, invoice_name, invoice_address, employee_name, subtotal, discount_code, discount_type, discount_value, discount_amount, total, paid_amount, debt_amount, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [orderId, customer, customerPhone || null, customerEmail || null, taxCode || null, invoiceName || null, invoiceAddress || null, employeeName || req.user.name || req.user.email, subtotal, appliedCode, discountType, discountValue, discountAmount, total, paid, debt, status]);
    if (codeRow) await conn.query('UPDATE discount_codes SET used_count=used_count+1 WHERE id=?', [codeRow.id]);
    for (const item of normalizedItems) {
      await conn.query('INSERT INTO order_items (order_id, product_id, product_name, quantity, unit_price, line_total) VALUES (?, ?, ?, ?, ?, ?)', [orderId, item.id, item.name, item.quantity, item.unitPrice, item.lineTotal]);
      await conn.query('UPDATE products SET stock=stock-? WHERE id=?', [item.quantity, item.id]);
      await conn.query('INSERT INTO inventory_movements (type, product_id, quantity, note, user_name) VALUES ("export", ?, ?, ?, ?)', [item.id, item.quantity, `Bán hàng ${orderId}`, req.user.email]);
    }
    if (paid > 0) await conn.query('INSERT INTO order_payments (order_id, amount, method, note, user_name) VALUES (?, ?, ?, ?, ?)', [orderId, paid, 'Thanh toán ban đầu', 'Ghi nhận khi tạo đơn', req.user.email]);
    await conn.commit();
    if (creditOverride) await writeAudit(req.user, 'CREDIT_OVERRIDE', 'order', orderId, creditOverride);
    return res.status(201).json({ id: orderId, subtotal, discountAmount, total, paidAmount: paid, debtAmount: debt });
  } catch (err) {
    if (conn) await conn.rollback();
    res.status(400).json({ error: err.message, ...(err.code === 'CREDIT_LIMIT' ? { code: err.code } : {}) });
  } finally {
    if (conn) conn.release();
  }
});

// The order row is locked while the debt is checked and reduced, so two payments sent at once cannot both pass the
// check and overpay, and a payment cannot slip in while the order is being cancelled.
app.post('/orders/:id/payments', authMiddleware, requirePermission('orders.payments'), async (req, res) => {
  const amount = Number(req.body.amount);
  if (!Number.isFinite(amount) || amount < 1) return res.status(400).json({ error: 'Số tiền thanh toán không hợp lệ' });
  let conn;
  try {
    conn = await pool.getConnection();
    await conn.beginTransaction();
    const rows = await conn.query('SELECT debt_amount, status FROM orders WHERE id=? FOR UPDATE', [req.params.id]);
    if (!rows[0]) throw httpError(404, 'Không tìm thấy đơn hàng');
    if (rows[0].status === CANCELLED) throw httpError(400, 'Đơn đã hủy không nhận thanh toán');
    if (amount > Number(rows[0].debt_amount)) throw httpError(400, `Số tiền thanh toán vượt công nợ còn lại (${Number(rows[0].debt_amount).toLocaleString('vi-VN')}đ)`);
    await conn.query('INSERT INTO order_payments (order_id, amount, method, note, user_name) VALUES (?, ?, ?, ?, ?)', [req.params.id, amount, req.body.method || 'Chuyển khoản', req.body.note || null, req.user.email]);
    // status is assigned first: MariaDB applies SET assignments left to right, so it must compare against the debt before it is reduced.
    await conn.query('UPDATE orders SET status=IF(debt_amount=?, ?, status), paid_amount=paid_amount+?, debt_amount=debt_amount-? WHERE id=?', [amount, PAID, amount, amount, req.params.id]);
    await conn.commit();
    return res.json({ ok: true });
  } catch (err) {
    if (conn) await conn.rollback();
    res.status(err.status || 500).json({ error: err.message });
  } finally {
    if (conn) conn.release();
  }
});

app.patch('/orders/:id/status', authMiddleware, requirePermission('orders.change_status'), async (req, res) => {
  if (!ORDER_STATUSES.includes(req.body.status)) return res.status(400).json({ error: 'Trạng thái đơn hàng không hợp lệ' });
  let conn;
  try {
    conn = await pool.getConnection();
    await conn.beginTransaction();
    const result = await changeOrderStatus(conn, req.params.id, req.body.status, req.user);
    await conn.commit();
    return res.json({ ok: true, ...result });
  } catch (err) {
    if (conn) await conn.rollback();
    res.status(err.status || 500).json({ error: err.message });
  } finally { if (conn) conn.release(); }
});

app.patch('/orders/:id/invoice', authMiddleware, requirePermission('orders.change_status'), async (req, res) => {
  let conn;
  try {
    const { invoiceName = '', taxCode = '', invoiceAddress = '', customerEmail = '', status } = req.body;
    if (status && !ORDER_STATUSES.includes(status)) {
      return res.status(400).json({ error: 'Trạng thái đơn hàng không hợp lệ' });
    }
    if (taxCode && !/^[0-9-]{8,20}$/.test(String(taxCode).trim())) {
      return res.status(400).json({ error: 'Mã số thuế chỉ được gồm 8-20 chữ số hoặc dấu gạch ngang' });
    }
    if (customerEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(customerEmail).trim())) {
      return res.status(400).json({ error: 'Email nhận hóa đơn không hợp lệ' });
    }
    conn = await pool.getConnection();
    await conn.beginTransaction();
    const result = await conn.query(
      'UPDATE orders SET invoice_name=?, tax_code=?, invoice_address=?, customer_email=? WHERE id=?',
      [String(invoiceName).trim() || null, String(taxCode).trim() || null, String(invoiceAddress).trim() || null, String(customerEmail).trim() || null, req.params.id],
    );
    if (!result.affectedRows) throw httpError(404, 'Không tìm thấy đơn hàng');
    const changed = status ? await changeOrderStatus(conn, req.params.id, status, req.user) : { restocked: 0 };
    await conn.commit();
    return res.json({ ok: true, ...changed });
  } catch (err) {
    if (conn) await conn.rollback();
    res.status(err.status || 500).json({ error: err.message });
  } finally { if (conn) conn.release(); }
});

app.patch('/orders/:id/active', authMiddleware, adminOnly, async (req, res) => {
  try {
    await pool.query('UPDATE orders SET active=? WHERE id=?', [req.body.active ? 1 : 0, req.params.id]);
    return res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/correction-requests', authMiddleware, async (req, res) => {
  try {
    const { recordType, recordId, reason } = req.body;
    if (!['order', 'inventory'].includes(recordType) || !recordId || !reason?.trim()) return res.status(400).json({ error: 'Thông tin yêu cầu điều chỉnh không hợp lệ' });
    const result = await pool.query('INSERT INTO correction_requests (record_type, record_id, reason, requested_by) VALUES (?, ?, ?, ?)', [recordType, String(recordId), reason.trim(), req.user.email]);
    return res.status(201).json({ id: Number(result.insertId) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/correction-requests', authMiddleware, adminOnly, async (req, res) => {
  try {
    const rows = await pool.query('SELECT * FROM correction_requests ORDER BY status="pending" DESC, created_at DESC');
    return res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.patch('/correction-requests/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    if (!['approved', 'rejected'].includes(req.body.status)) return res.status(400).json({ error: 'Trạng thái xử lý không hợp lệ' });
    await pool.query('UPDATE correction_requests SET status=?, admin_note=?, resolved_by=?, resolved_at=NOW() WHERE id=?', [req.body.status, req.body.adminNote || null, req.user.email, req.params.id]);
    return res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/suppliers', authMiddleware, requirePermission('suppliers.view'), async (req, res) => {
  try {
    const rows = await pool.query(`SELECT s.*,
      COALESCE((SELECT COUNT(*) FROM purchase_orders p WHERE p.supplier_id=s.id AND p.active=1),0) purchase_order_count,
      COALESCE((SELECT SUM(p.total) FROM purchase_orders p WHERE p.supplier_id=s.id AND p.active=1),0) purchase_total
      FROM suppliers s ORDER BY s.active DESC,s.created_at DESC`);
    res.json(rows.map((row) => ({ ...row, id: Number(row.id), payment_term_days: Number(row.payment_term_days), purchase_order_count: Number(row.purchase_order_count), purchase_total: Number(row.purchase_total), active: Boolean(row.active) })));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/suppliers', authMiddleware, requirePermission('suppliers.manage'), async (req, res) => {
  try {
    const { name, contactName, phone, email, taxCode, address, paymentTermDays = 0, notes, active = true } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Tên nhà cung cấp là bắt buộc' });
    if (Number(paymentTermDays) < 0) return res.status(400).json({ error: 'Số ngày thanh toán không hợp lệ' });
    const result = await pool.query('INSERT INTO suppliers (name,contact_name,phone,email,tax_code,address,payment_term_days,notes,active) VALUES (?,?,?,?,?,?,?,?,?)', [name.trim(), contactName || null, phone || null, email || null, taxCode || null, address || null, Number(paymentTermDays), notes || null, active ? 1 : 0]);
    res.status(201).json({ id: Number(result.insertId) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/suppliers/:id', authMiddleware, requirePermission('suppliers.manage'), async (req, res) => {
  try {
    const { name, contactName, phone, email, taxCode, address, paymentTermDays = 0, notes, active = true } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Tên nhà cung cấp là bắt buộc' });
    await pool.query('UPDATE suppliers SET name=?,contact_name=?,phone=?,email=?,tax_code=?,address=?,payment_term_days=?,notes=?,active=? WHERE id=?', [name.trim(), contactName || null, phone || null, email || null, taxCode || null, address || null, Number(paymentTermDays), notes || null, active ? 1 : 0, req.params.id]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/purchase-orders', authMiddleware, requirePermission('purchases.view'), async (req, res) => {
  try {
    const rows = await pool.query('SELECT * FROM purchase_orders ORDER BY created_at DESC');
    const items = await pool.query('SELECT * FROM purchase_order_items ORDER BY id');
    res.json(rows.map((row) => ({ ...row, total: Number(row.total), active: Boolean(row.active), items: items.filter((item) => item.purchase_order_id === row.id).map((item) => ({ ...item, quantity: Number(item.quantity), unit_cost: Number(item.unit_cost), line_total: Number(item.line_total) })) })));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/purchase-orders', authMiddleware, requirePermission('purchases.manage'), async (req, res) => {
  let conn;
  try {
    const { supplierId, expectedDate, employeeName, notes, items = [] } = req.body;
    if (!supplierId || !items.length) return res.status(400).json({ error: 'Nhà cung cấp và sản phẩm mua là bắt buộc' });
    conn = await pool.getConnection();
    await conn.beginTransaction();
    const suppliers = await conn.query('SELECT id,name FROM suppliers WHERE id=? AND active=1', [supplierId]);
    if (!suppliers[0]) throw new Error('Nhà cung cấp không tồn tại hoặc đã inactive');
    const normalized = [];
    let total = 0;
    for (const item of items) {
      const products = await conn.query('SELECT id,name,cost_price FROM products WHERE id=? AND active=1', [item.productId]);
      const product = products[0];
      const quantity = Number(item.quantity);
      const unitCost = Number(item.unitCost ?? product?.cost_price);
      if (!product || !Number.isInteger(quantity) || quantity < 1 || unitCost < 0) throw new Error('Dòng sản phẩm mua không hợp lệ');
      const lineTotal = quantity * unitCost;
      total += lineTotal;
      normalized.push({ product, quantity, unitCost, lineTotal });
    }
    const id = `MH${Date.now()}`;
    await conn.query('INSERT INTO purchase_orders (id,supplier_id,supplier_name,employee_name,expected_date,total,notes) VALUES (?,?,?,?,?,?,?)', [id, supplierId, suppliers[0].name, employeeName || req.user.name || req.user.email, expectedDate || null, total, notes || null]);
    for (const item of normalized) await conn.query('INSERT INTO purchase_order_items (purchase_order_id,product_id,product_name,quantity,unit_cost,line_total) VALUES (?,?,?,?,?,?)', [id, item.product.id, item.product.name, item.quantity, item.unitCost, item.lineTotal]);
    await conn.commit();
    res.status(201).json({ id, total });
  } catch (err) {
    if (conn) await conn.rollback();
    res.status(400).json({ error: err.message });
  } finally { if (conn) conn.release(); }
});

app.patch('/purchase-orders/:id/status', authMiddleware, requirePermission('purchases.manage'), async (req, res) => {
  let conn;
  try {
    const allowed = ['Nháp', 'Đã duyệt', 'Đã nhập kho', 'Đã hủy'];
    if (!allowed.includes(req.body.status)) return res.status(400).json({ error: 'Trạng thái đơn mua không hợp lệ' });
    conn = await pool.getConnection();
    await conn.beginTransaction();
    const rows = await conn.query('SELECT * FROM purchase_orders WHERE id=? FOR UPDATE', [req.params.id]);
    const purchase = rows[0];
    if (!purchase) throw new Error('Không tìm thấy đơn mua hàng');
    if (purchase.status === 'Đã nhập kho' && req.body.status !== 'Đã nhập kho') throw new Error('Đơn đã nhập kho không thể đổi ngược trạng thái');
    // Like sales orders, a cancelled purchase order is final; receiving it would add goods that were never bought.
    if (purchase.status === 'Đã hủy' && req.body.status !== 'Đã hủy') throw new Error('Đơn mua đã hủy không thể đổi trạng thái; hãy tạo đơn mua mới');
    if (req.body.status === 'Đã nhập kho' && purchase.status !== 'Đã nhập kho') {
      const items = await conn.query('SELECT * FROM purchase_order_items WHERE purchase_order_id=?', [purchase.id]);
      for (const item of items) {
        await conn.query('UPDATE products SET stock=stock+?,cost_price=? WHERE id=?', [item.quantity, item.unit_cost, item.product_id]);
        await conn.query('INSERT INTO inventory_movements (type,product_id,quantity,note,user_name) VALUES ("import",?,?,?,?)', [item.product_id, item.quantity, `Nhập từ đơn mua ${purchase.id}`, req.user.email]);
      }
      await conn.query('UPDATE purchase_orders SET status=?,received_at=NOW() WHERE id=?', [req.body.status, purchase.id]);
    } else {
      await conn.query('UPDATE purchase_orders SET status=? WHERE id=?', [req.body.status, purchase.id]);
    }
    await conn.commit();
    res.json({ ok: true });
  } catch (err) {
    if (conn) await conn.rollback();
    res.status(400).json({ error: err.message });
  } finally { if (conn) conn.release(); }
});

app.get('/customers', authMiddleware, requirePermission('customers.view'), async (req, res) => {
  try {
    const rows = await pool.query(`
      SELECT c.*,
        COALESCE((SELECT COUNT(*) FROM orders o WHERE o.customer=c.name AND o.active=1),0) AS order_count,
        COALESCE((SELECT SUM(o.total) FROM orders o WHERE o.customer=c.name AND o.active=1),0) AS revenue,
        COALESCE((SELECT SUM(o.debt_amount) FROM orders o WHERE o.customer=c.name AND o.active=1 AND o.status<>'Đã hủy'),0) AS debt
      FROM customers c ORDER BY c.active DESC,c.created_at DESC
    `);
    res.json(rows.map((row) => ({ ...row, credit_limit: Number(row.credit_limit), order_count: Number(row.order_count), revenue: Number(row.revenue), debt: Number(row.debt), active: Boolean(row.active) })));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/customers', authMiddleware, requirePermission('customers.manage'), async (req, res) => {
  try {
    const { name, phone, email, taxCode, address, customerType = 'Khách hàng', creditLimit = 0, paymentTermDays = 0, assignedEmployee, notes, active = true } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Tên khách hàng là bắt buộc' });
    if (Number(creditLimit) < 0 || Number(paymentTermDays) < 0) return res.status(400).json({ error: 'Hạn mức và thời hạn thanh toán không hợp lệ' });
    const result = await pool.query('INSERT INTO customers (name,phone,email,tax_code,address,customer_type,credit_limit,payment_term_days,assigned_employee,notes,active) VALUES (?,?,?,?,?,?,?,?,?,?,?)', [name.trim(), phone || null, email || null, taxCode || null, address || null, customerType, Number(creditLimit), Number(paymentTermDays), assignedEmployee || null, notes || null, active ? 1 : 0]);
    res.status(201).json({ id: Number(result.insertId) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/customers/:id', authMiddleware, requirePermission('customers.manage'), async (req, res) => {
  try {
    const { name, phone, email, taxCode, address, customerType = 'Khách hàng', creditLimit = 0, paymentTermDays = 0, assignedEmployee, notes, active = true } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Tên khách hàng là bắt buộc' });
    await pool.query('UPDATE customers SET name=?,phone=?,email=?,tax_code=?,address=?,customer_type=?,credit_limit=?,payment_term_days=?,assigned_employee=?,notes=?,active=? WHERE id=?', [name.trim(), phone || null, email || null, taxCode || null, address || null, customerType, Number(creditLimit), Number(paymentTermDays), assignedEmployee || null, notes || null, active ? 1 : 0, req.params.id]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/quotations', authMiddleware, requirePermission('quotations.view'), async (req, res) => {
  try {
    const rows = await pool.query('SELECT * FROM quotations ORDER BY created_at DESC');
    const items = await pool.query('SELECT * FROM quotation_items ORDER BY id');
    res.json(rows.map((row) => ({ ...row, subtotal: Number(row.subtotal), discount_percent: Number(row.discount_percent), discount_amount: Number(row.discount_amount), total: Number(row.total), active: Boolean(row.active), items: items.filter((item) => item.quotation_id === row.id).map((item) => ({ ...item, unit_price: Number(item.unit_price), line_total: Number(item.line_total) })) })));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/quotations', authMiddleware, requirePermission('quotations.manage'), async (req, res) => {
  let conn;
  try {
    const { customerId, customerName, employeeName, discountPercent = 0, validUntil, notes, items = [], quoteRequestId } = req.body;
    if (!customerName?.trim() || !items.length) return res.status(400).json({ error: 'Khách hàng và sản phẩm báo giá là bắt buộc' });
    const discount = Number(discountPercent);
    if (discount < 0 || discount > 100) return res.status(400).json({ error: 'Chiết khấu phải nằm trong khoảng 0-100%' });
    conn = await pool.getConnection();
    await conn.beginTransaction();
    let subtotal = 0;
    const normalized = [];
    for (const item of items) {
      const productRows = await conn.query('SELECT id,name,price FROM products WHERE id=?', [item.productId]);
      const product = productRows[0];
      const quantity = Number(item.quantity);
      const unitPrice = Number(item.unitPrice || product?.price);
      if (!product || !Number.isInteger(quantity) || quantity < 1 || unitPrice < 0) throw new Error('Dòng sản phẩm báo giá không hợp lệ');
      const lineTotal = quantity * unitPrice;
      subtotal += lineTotal;
      normalized.push({ product, quantity, unitPrice, lineTotal });
    }
    const discountAmount = Math.round(subtotal * discount / 100);
    const total = subtotal - discountAmount;
    const id = `BG${Date.now()}`;
    await conn.query('INSERT INTO quotations (id,customer_id,customer_name,employee_name,subtotal,discount_percent,discount_amount,total,valid_until,notes) VALUES (?,?,?,?,?,?,?,?,?,?)', [id, customerId || null, customerName.trim(), employeeName || req.user.name || req.user.email, subtotal, discount, discountAmount, total, validUntil || null, notes || null]);
    for (const item of normalized) await conn.query('INSERT INTO quotation_items (quotation_id,product_id,product_name,quantity,unit_price,line_total) VALUES (?,?,?,?,?,?)', [id, item.product.id, item.product.name, item.quantity, item.unitPrice, item.lineTotal]);
    if (quoteRequestId) await conn.query('UPDATE quote_requests SET quotation_id=?,customer_id=COALESCE(customer_id,?),status=? WHERE id=?', [id, customerId || null, 'Đã báo giá', quoteRequestId]);
    await conn.commit();
    res.status(201).json({ id, subtotal, discountAmount, total });
  } catch (err) {
    if (conn) await conn.rollback();
    res.status(400).json({ error: err.message });
  } finally { if (conn) conn.release(); }
});

app.patch('/quotations/:id/status', authMiddleware, requirePermission('quotations.manage'), async (req, res) => {
  try {
    const allowed = ['Nháp', 'Đã gửi', 'Đã chấp nhận', 'Từ chối', 'Hết hạn'];
    if (!allowed.includes(req.body.status)) return res.status(400).json({ error: 'Trạng thái báo giá không hợp lệ' });
    await pool.query('UPDATE quotations SET status=? WHERE id=?', [req.body.status, req.params.id]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/quotations/:id/pdf', authMiddleware, requirePermission('quotations.view'), async (req, res) => {
  try {
    const quotation = await getQuotation(req.params.id);
    if (!quotation) return res.status(404).json({ error: 'Không tìm thấy báo giá' });
    const pdf = await makeQuotationPdf(quotation);
    res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename="${quotation.id}.pdf"` });
    res.send(pdf);
  } catch (err) { res.status(500).json({ error: `Không thể tạo PDF: ${err.message}` }); }
});

app.post('/quotations/:id/send-email', authMiddleware, requirePermission('quotations.manage'), async (req, res) => {
  try {
    const quotation = await getQuotation(req.params.id);
    if (!quotation) return res.status(404).json({ error: 'Không tìm thấy báo giá' });
    const requestRows = req.body.quoteRequestId ? await pool.query('SELECT * FROM quote_requests WHERE id=? LIMIT 1', [req.body.quoteRequestId]) : [];
    const recipient = normalizeEmail(req.body.email || requestRows[0]?.email || quotation.customer_email);
    if (!recipient || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) return res.status(400).json({ error: 'Khách hàng chưa có địa chỉ email hợp lệ' });
    const transport = createMailTransport();
    if (!transport) return res.status(503).json({ error: 'Chưa cấu hình SMTP. Hãy thiết lập SMTP_HOST, SMTP_PORT, SMTP_USER và SMTP_PASS trong Docker.' });
    const company = await getCompanyInfo();
    const pdf = await makeQuotationPdf(quotation);
    await transport.sendMail({
      from: process.env.SMTP_FROM || `${company.name || 'LalaFlow'} <${process.env.SMTP_USER}>`,
      to: recipient,
      subject: req.body.subject || `Báo giá ${quotation.id} từ ${company.name || 'LalaFlow'}`,
      text: req.body.message || `Kính gửi ${quotation.customer_name},\n\n${company.name || 'LalaFlow'} gửi Quý khách báo giá ${quotation.id} trong file đính kèm.\n\nTrân trọng.`,
      attachments: [{ filename: `${quotation.id}.pdf`, content: pdf, contentType: 'application/pdf' }],
    });
    await pool.query('UPDATE quotations SET status=? WHERE id=?', ['Đã gửi', quotation.id]);
    if (req.body.quoteRequestId) await pool.query('UPDATE quote_requests SET status=?,quotation_id=?,response_email=?,responded_at=NOW() WHERE id=?', ['Đã báo giá', quotation.id, recipient, req.body.quoteRequestId]);
    res.json({ ok: true, recipient });
  } catch (err) { res.status(500).json({ error: `Gửi email thất bại: ${err.message}` }); }
});

const QUOTE_SOURCES = new Set(['form', 'chat']);
const QUOTE_MAX_ITEMS = 10;
const QUOTE_MAX_QUANTITY = 1000000;

// The product lines of a request drafted by the assistant. Names and units are read from the catalogue, so a
// request can only name products that are on sale, whatever the browser sent.
async function quoteItems(items) {
  if (!Array.isArray(items) || !items.length || items.length > QUOTE_MAX_ITEMS) return { error: `Yêu cầu cần từ 1 đến ${QUOTE_MAX_ITEMS} sản phẩm` };
  const wanted = items.map((item) => ({ productId: Number(item?.productId), quantity: Number(item?.quantity) }));
  if (wanted.some((item) => !Number.isInteger(item.productId) || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > QUOTE_MAX_QUANTITY)) {
    return { error: 'Sản phẩm hoặc số lượng yêu cầu không hợp lệ' };
  }
  if (new Set(wanted.map((item) => item.productId)).size !== wanted.length) return { error: 'Mỗi sản phẩm chỉ ghi một lần' };
  const rows = await pool.query(`SELECT id,name,unit FROM products WHERE active=1 AND id IN (${wanted.map(() => '?').join(',')})`, wanted.map((item) => item.productId));
  const byId = new Map(rows.map((row) => [Number(row.id), row]));
  const unknown = wanted.find((item) => !byId.has(item.productId));
  if (unknown) return { error: `Sản phẩm mã ${unknown.productId} không còn bán` };
  return { lines: wanted.map((item) => ({ ...item, name: byId.get(item.productId).name, unit: byId.get(item.productId).unit || '' })) };
}

app.post('/quote-requests', async (req, res) => {
  try {
    const { customerName, phone, email, companyName, productId, productName, quantity = 1, message, items, source = 'form' } = req.body;
    if (!customerName?.trim() || !phone?.trim()) return res.status(400).json({ error: 'Họ tên và số điện thoại là bắt buộc' });
    if (!QUOTE_SOURCES.has(source)) return res.status(400).json({ error: 'Nguồn yêu cầu không hợp lệ' });
    let lines = null;
    if (items !== undefined) {
      const checked = await quoteItems(items);
      if (checked.error) return res.status(400).json({ error: checked.error });
      lines = checked.lines;
    } else if (!Number.isInteger(Number(quantity)) || Number(quantity) < 1) {
      return res.status(400).json({ error: 'Số lượng yêu cầu không hợp lệ' });
    }
    // The first line also fills the single-product columns, which the admin list, dashboard and exports read.
    const first = lines ? lines[0] : { productId: productId || null, name: productName || null, quantity: Number(quantity) };
    const result = await pool.query('INSERT INTO quote_requests (customer_name,phone,email,company_name,product_id,product_name,quantity,message,items,source) VALUES (?,?,?,?,?,?,?,?,?,?)', [customerName.trim(), phone.trim(), email || null, companyName || null, first.productId, first.name, first.quantity, message || null, lines ? JSON.stringify(lines) : null, source]);
    res.status(201).json({ id: Number(result.insertId) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/quote-requests', authMiddleware, requirePermission('quote_requests.manage'), async (req, res) => {
  try {
    const rows = await pool.query(`SELECT qr.*,c.name AS crm_customer_name
      FROM quote_requests qr LEFT JOIN customers c ON c.id=qr.customer_id
      ORDER BY qr.status="Mới" DESC,qr.created_at DESC`);
    const customers = await pool.query('SELECT id,name,phone,email FROM customers WHERE active=1');
    res.json(rows.map((row) => {
      const phone = normalizePhone(row.phone);
      const email = normalizeEmail(row.email);
      const matches = customers.filter((customer) =>
        (phone && normalizePhone(customer.phone) === phone) ||
        (email && normalizeEmail(customer.email) === email)
      );
      return { ...row, items: row.items ? JSON.parse(row.items) : [], customer_matches: matches };
    }));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/quote-requests/:id/customer', authMiddleware, requirePermission('customers.manage'), async (req, res) => {
  try {
    const rows = await pool.query('SELECT * FROM quote_requests WHERE id=? LIMIT 1', [req.params.id]);
    const request = rows[0];
    if (!request) return res.status(404).json({ error: 'Không tìm thấy yêu cầu báo giá' });
    if (request.customer_id) return res.json({ id: Number(request.customer_id), existing: true });
    const phone = normalizePhone(request.phone);
    const email = normalizeEmail(request.email);
    const customers = await pool.query('SELECT id,phone,email FROM customers WHERE active=1');
    const match = customers.find((customer) =>
      (phone && normalizePhone(customer.phone) === phone) ||
      (email && normalizeEmail(customer.email) === email)
    );
    let customerId = match?.id;
    const existing = Boolean(customerId);
    if (!customerId) {
      const result = await pool.query(
        'INSERT INTO customers (name,phone,email,customer_type,assigned_employee,notes,active) VALUES (?,?,?,?,?,?,1)',
        [request.customer_name, request.phone, request.email || null, request.company_name ? 'Đối tác' : 'Khách hàng', req.user.name || req.user.email, `Tạo từ yêu cầu báo giá website #${request.id}`],
      );
      customerId = Number(result.insertId);
    }
    await pool.query('UPDATE quote_requests SET customer_id=? WHERE id=?', [customerId, request.id]);
    res.status(existing ? 200 : 201).json({ id: Number(customerId), existing });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.patch('/quote-requests/:id', authMiddleware, requirePermission('quote_requests.manage'), async (req, res) => {
  try {
    const allowed = ['Mới', 'Đang tư vấn', 'Đã báo giá', 'Hoàn tất', 'Từ chối'];
    if (!allowed.includes(req.body.status)) return res.status(400).json({ error: 'Trạng thái yêu cầu không hợp lệ' });
    await pool.query('UPDATE quote_requests SET status=?,assigned_employee=? WHERE id=?', [req.body.status, req.body.assignedEmployee || req.user.name || req.user.email, req.params.id]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/audit-logs', authMiddleware, adminOnly, async (req, res) => {
  try {
    const rows = await pool.query('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 300');
    res.json(rows.map((row) => ({ ...row, id: Number(row.id) })));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/dashboard', authMiddleware, requirePermission('reports.view'), async (req, res) => {
  try {
    // Debt counts live orders only, as the CRM debt column does; cancelling an order does not zero its debt_amount.
    const [orders] = await pool.query('SELECT COUNT(*) AS count,COALESCE(SUM(total),0) AS revenue,COALESCE(SUM(IF(status<>?, debt_amount, 0)),0) AS debt FROM orders WHERE active=1', [CANCELLED]);
    const [lowStock] = await pool.query('SELECT COUNT(*) AS count FROM products WHERE active=1 AND stock<=min_stock');
    const [requests] = await pool.query('SELECT COUNT(*) AS count FROM quote_requests WHERE status="Mới"');
    // The requests carry customers' names, phones and emails: only for staff who may handle them, not for every report reader.
    const recentRequests = hasPermission(req.user, 'quote_requests.manage')
      ? await pool.query('SELECT * FROM quote_requests ORDER BY created_at DESC LIMIT 5')
      : undefined;
    res.json({ orderCount: Number(orders.count), revenue: Number(orders.revenue), debt: Number(orders.debt), lowStock: Number(lowStock.count), newQuoteRequests: Number(requests.count), recentRequests });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/reports', authMiddleware, requirePermission('reports.view'), async (req, res) => {
  try {
    if (pool) {
      const products = await pool.query('SELECT * FROM products');
      const movements = await pool.query('SELECT * FROM inventory_movements');
      const orderSummary = await pool.query('SELECT COUNT(*) AS order_count, COALESCE(SUM(subtotal),0) AS gross_revenue, COALESCE(SUM(discount_amount),0) AS discounts, COALESCE(SUM(total),0) AS revenue, COALESCE(SUM(paid_amount),0) AS collected, COALESCE(SUM(debt_amount),0) AS debt FROM orders WHERE active=1');
      const soldSummary = await pool.query('SELECT COALESCE(SUM(i.quantity),0) AS sold_quantity FROM order_items i JOIN orders o ON o.id=i.order_id WHERE o.active=1');
      const salesByEmployee = await pool.query('SELECT COALESCE(employee_name,"Chưa phân công") AS employee, COUNT(*) AS order_count, COALESCE(SUM(total),0) AS revenue, COALESCE(SUM(paid_amount),0) AS collected, COALESCE(SUM(debt_amount),0) AS debt FROM orders WHERE active=1 GROUP BY employee_name ORDER BY revenue DESC');
      const salesByProduct = await pool.query('SELECT i.product_id, i.product_name, SUM(i.quantity) AS quantity, SUM(i.line_total) AS revenue FROM order_items i JOIN orders o ON o.id=i.order_id WHERE o.active=1 GROUP BY i.product_id, i.product_name ORDER BY quantity DESC');
      const [profitSummary] = await pool.query('SELECT COALESCE(SUM(i.quantity*p.cost_price),0) AS estimated_cost,COALESCE(SUM(i.line_total-i.quantity*p.cost_price),0) AS estimated_profit FROM order_items i JOIN orders o ON o.id=i.order_id JOIN products p ON p.id=i.product_id WHERE o.active=1');
      const totalStock = products.reduce((sum, item) => sum + Number(item.stock), 0);
      const normalizedProducts = products.map((item) => ({
        ...item,
        price: Number(item.price || 0),
        cost_price: Number(item.cost_price || 0),
        stock: Number(item.stock || 0),
        min_stock: Number(item.min_stock || 0),
        active: Boolean(item.active),
      }));
      const inventoryValue = normalizedProducts.reduce((sum, item) => sum + item.stock * (item.cost_price || item.price), 0);
      const summary = orderSummary[0];
      return res.json({ totalStock, inventoryValue, soldQuantity: Number(soldSummary[0].sold_quantity), orderCount: Number(summary.order_count), grossRevenue: Number(summary.gross_revenue), discountAmount: Number(summary.discounts), revenue: Number(summary.revenue), collected: Number(summary.collected), debt: Number(summary.debt), estimatedCost: Number(profitSummary.estimated_cost), estimatedProfit: Number(profitSummary.estimated_profit), products: normalizedProducts, movements, salesByEmployee: salesByEmployee.map((row) => ({ ...row, order_count: Number(row.order_count), revenue: Number(row.revenue), collected: Number(row.collected), debt: Number(row.debt) })), salesByProduct: salesByProduct.map((row) => ({ ...row, quantity: Number(row.quantity), revenue: Number(row.revenue) })) });
    }
    const totalStock = state.products.reduce((sum, item) => sum + Number(item.stock), 0);
    const inventoryValue = state.products.reduce((sum, item) => sum + Number(item.stock) * Number(item.price), 0);
    return res.json({ totalStock, inventoryValue, products: state.products, movements: state.inventoryMovements });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    const message = err.code === 'LIMIT_FILE_SIZE' ? 'Mỗi hình ảnh không được vượt quá 5MB' : err.code === 'LIMIT_FILE_COUNT' ? 'Mỗi sản phẩm chỉ được tối đa 5 hình ảnh' : err.message;
    return res.status(400).json({ error: message });
  }
  if (err) return res.status(400).json({ error: err.message || 'Dữ liệu không hợp lệ' });
  next();
});

registerChatRoutes(app, { pool, authMiddleware, adminOnly });

app.listen(process.env.PORT || 4000, async () => {
  console.log('Backend running on port 4000');
  try {
    await waitForDb();
    await initDb();
    if (pool) await createChatTables(pool);
  } catch (err) {
    console.error(err);
  }
});
