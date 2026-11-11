// Sidebar structure. `perm` is any-of; `needs` lists view permissions the screen must also have, all of them, because
// it loads that data first (e.g. taking a payment lists the orders); `adminOnly` means role admin.
export const MENU = [
  { tab: "home", label: "Trang chủ", title: "LalaFlow Home" },
  {
    group: "Nội dung website",
    items: [
      { tab: "content", label: "Thông tin công ty", title: "Nội dung công ty", perm: "content.manage" },
      { tab: "activities_create", label: "Đăng hoạt động", title: "Đăng hoạt động", perm: "content.activities_create" },
      { tab: "activities_list", label: "Danh sách hoạt động", title: "Danh sách hoạt động", perm: ["content.activities_edit", "content.activities_status"] },
    ],
  },
  {
    group: "Sản phẩm",
    items: [
      { tab: "categories_create", label: "Thêm loại sản phẩm", title: "Thêm loại sản phẩm", perm: "products.categories_create" },
      { tab: "categories_list", label: "Danh sách loại", title: "Danh sách loại sản phẩm", perm: ["products.categories_edit", "products.categories_status"] },
      { tab: "products_create", label: "Thêm sản phẩm", title: "Thêm sản phẩm", perm: "products.create" },
      { tab: "products_list", label: "Danh sách sản phẩm", title: "Danh sách sản phẩm", perm: ["products.create", "products.edit", "products.change_status"] },
    ],
  },
  {
    group: "Kho hàng",
    items: [
      { tab: "inventory_transaction", label: "Ghi nhận nhập / xuất", title: "Ghi nhận nhập / xuất kho", perm: "inventory.transactions" },
      { tab: "inventory_history", label: "Lịch sử kho", title: "Lịch sử nhập / xuất kho", perm: "inventory.view" },
      { tab: "inventory_corrections", label: "Báo sai sót kho", title: "Sai sót chứng từ kho", perm: "inventory.view" },
    ],
  },
  {
    group: "Mua hàng",
    items: [
      { tab: "suppliers_manage", label: "Nhà cung cấp", title: "Nhà cung cấp", perm: "suppliers.view" },
      { tab: "purchases_create", label: "Tạo đơn mua", title: "Tạo đơn mua hàng", perm: "purchases.manage", needs: ["suppliers.view"] },
      { tab: "purchases_list", label: "Danh sách đơn mua", title: "Danh sách đơn mua", perm: "purchases.view" },
    ],
  },
  {
    group: "Đơn hàng",
    items: [
      { tab: "orders_create", label: "Tạo đơn hàng", title: "Tạo đơn hàng", perm: "orders.create" },
      { tab: "orders_list", label: "Danh sách đơn hàng", title: "Danh sách đơn hàng", perm: "orders.view" },
      { tab: "orders_payment", label: "Thu tiền công nợ", title: "Thu tiền công nợ", perm: "orders.payments", needs: ["orders.view"] },
      { tab: "orders_status", label: "Cập nhật trạng thái", title: "Cập nhật trạng thái đơn", perm: "orders.change_status", needs: ["orders.view"] },
      { tab: "orders_discounts", label: "Mã chiết khấu", title: "Mã chiết khấu", perm: "orders.discounts_manage", needs: ["orders.view"] },
      { tab: "orders_corrections", label: "Báo sai sót đơn", title: "Sai sót đơn hàng", perm: "orders.view" },
    ],
  },
  {
    group: "Kinh doanh & CRM",
    items: [
      { tab: "dashboard", label: "Dashboard", title: "Dashboard điều hành", perm: "reports.view" },
      { tab: "customers_manage", label: "Khách hàng CRM", title: "CRM khách hàng", perm: "customers.view" },
      { tab: "quotations_create", label: "Tạo báo giá", title: "Tạo báo giá", perm: "quotations.manage", needs: ["customers.view"] },
      { tab: "quotations_list", label: "Danh sách báo giá", title: "Danh sách báo giá", perm: "quotations.view", needs: ["customers.view"] },
      { tab: "quote_requests", label: "Yêu cầu từ website", title: "Yêu cầu báo giá", perm: "quote_requests.manage" },
      { tab: "chat_logs", label: "Hội thoại AI", title: "Hội thoại với trợ lý AI", adminOnly: true },
    ],
  },
  {
    group: "Báo cáo",
    items: [{ tab: "reports", label: "Báo cáo quản trị", title: "Tổng quan báo cáo", perm: "reports.view" }],
  },
  {
    group: "Hệ thống & bảo mật",
    items: [
      { tab: "employees_manage", label: "Nhân viên", title: "Quản lý nhân viên", adminOnly: true },
      { tab: "employees_groups", label: "Gán nhóm nhân viên", title: "Gán nhóm nhân viên", adminOnly: true },
      { tab: "groups_manage", label: "Nhóm & phân quyền", title: "Nhóm & phân quyền", adminOnly: true },
      { tab: "audit_logs", label: "Nhật ký hoạt động", title: "Nhật ký hoạt động", adminOnly: true },
    ],
  },
];

export const ALL_ITEMS = MENU.flatMap((entry) => (entry.items ? entry.items : [entry]));

export function visibleMenu(allowed) {
  return MENU.map((entry) => {
    if (!entry.items) return entry;
    const items = entry.items.filter(allowed);
    return items.length ? { ...entry, items } : null;
  }).filter(Boolean);
}
