// Default site copy; every field can be overridden from Admin → Nội dung website (GET /site-content).
export const fallbackContent = {
  company: {
    name: "LalaFlow Paper",
    tagline: "Chất liệu tốt, khởi đầu bền vững",
    description: "Đối tác cung ứng giấy, bao bì và giải pháp in ấn đáng tin cậy cho doanh nghiệp Việt.",
    address: "123 Nguyễn Văn Linh, Quận 7, TP.HCM",
    phone: "0909 123 456",
    email: "contact@lalaflow.vn",
    zaloUrl: "https://zalo.me/0909123456",
    facebookUrl: "https://m.me/lalaflow",
    taxCode: "0312345678",
    foundedYear: "2018",
    workingHours: "Thứ 2 – Thứ 7, 08:00 – 17:30",
  },
  about: {
    title: "Từ những tờ giấy, tạo nên giá trị dài lâu",
    story: "Chúng tôi kết nối sản xuất, kho vận và tư vấn để mỗi đơn hàng được giao đúng chất lượng, đúng tiến độ.",
    mission: "Cung cấp giải pháp giấy và bao bì tối ưu, minh bạch.",
    vision: "Trở thành đối tác vật liệu giấy được tin chọn hàng đầu tại Việt Nam.",
    values: "Chất lượng thật|Cam kết đúng|Phục vụ tận tâm|Phát triển bền vững",
  },
  stats: { years: "8+", customers: "500+", products: "120+", delivery: "98%" },
  home: {
    heroBadge: "Giải pháp giấy bền vững",
    heroTitle: "Giấy tốt cho",
    heroHighlight: "ý tưởng lớn.",
    heroText: "Đối tác cung ứng giấy, bao bì và giải pháp in ấn đáng tin cậy cho doanh nghiệp Việt.",
    primaryButton: "Khám phá sản phẩm",
    secondaryButton: "Câu chuyện của chúng tôi",
    certificateTitle: "FSC®",
    certificateText: "Nguồn nguyên liệu có trách nhiệm",
    productsEyebrow: "SẢN PHẨM TIÊU BIỂU",
    productsTitle: "Chất liệu phù hợp cho mọi nhu cầu",
    storyLabel: "Vật liệu được chọn lọc cho tương lai tốt hơn",
    aboutEyebrow: "VỀ LALAFLOW",
    aboutFeatures: "Nguồn hàng ổn định|Tư vấn đúng nhu cầu|Giao hàng toàn quốc",
    aboutButton: "Tìm hiểu về chúng tôi",
    activitiesEyebrow: "HOẠT ĐỘNG MỚI",
    activitiesTitle: "Chuyện từ LalaFlow",
    viewAllButton: "Xem tất cả",
    ctaEyebrow: "BẮT ĐẦU HỢP TÁC",
  },
  pages: {
    aboutEyebrow: "VỀ CHÚNG TÔI",
    aboutHeroTitle: "Từ những tờ giấy, tạo nên giá trị dài lâu",
    aboutHeroText: "Hiểu vật liệu, hiểu doanh nghiệp và đồng hành trong từng giải pháp.",
    aboutJourneyLabel: "HÀNH TRÌNH LALAFLOW",
    aboutJourneyTitle: "Hiểu vật liệu. Hiểu doanh nghiệp.",
    infoEyebrow: "HỒ SƠ DOANH NGHIỆP",
    infoHeroTitle: "Thông tin minh bạch, kết nối thuận tiện",
    infoHeroText: "Những thông tin chính thức giúp khách hàng và đối tác dễ dàng liên hệ với LalaFlow.",
    activityEyebrow: "TIN TỨC & HOẠT ĐỘNG",
    activityHeroTitle: "Những chuyển động từ LalaFlow",
    activityHeroText: "Cập nhật hoạt động doanh nghiệp, kiến thức ngành giấy và các chương trình hướng đến cộng đồng.",
    productEyebrow: "DANH MỤC SẢN PHẨM",
    productHeroTitle: "Chọn đúng giấy, tạo đúng giá trị",
    productHeroText: "Khám phá danh mục giấy và bao bì đa dạng, được kiểm soát chất lượng cho từng mục đích sử dụng.",
  },
  contact: {
    heading: "Cần một giải pháp giấy phù hợp cho doanh nghiệp?",
    subheading: "Đội ngũ LalaFlow sẵn sàng tư vấn giải pháp phù hợp với nhu cầu của bạn.",
    buttonText: "Liên hệ tư vấn",
  },
};

export function mergeContent(remote) {
  const merged = {};
  for (const [section, defaults] of Object.entries(fallbackContent)) {
    merged[section] = { ...defaults, ...(remote?.[section] || {}) };
  }
  return merged;
}

export const PRODUCT_STATUS_TONE = { "Có sẵn": "ok", "Đang nhập": "wait", "Hết hàng": "out" };
