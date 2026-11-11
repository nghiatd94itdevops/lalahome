import { createElement } from "react";
import Home from "./Home.jsx";
import Content from "./Content.jsx";
import SpokenWords from "./SpokenWords.jsx";
import { ActivitiesCreate, ActivitiesList } from "./Activities.jsx";
import { CategoriesCreate, CategoriesList } from "./Categories.jsx";
import { ProductsCreate, ProductsList } from "./Products.jsx";
import { Corrections, InventoryHistory, InventoryTransaction } from "./Inventory.jsx";
import { PurchaseCreate, PurchaseList, Suppliers } from "./Purchasing.jsx";
import { DiscountCodes, OrderCreate, OrdersList, OrdersPayment, OrdersStatus } from "./Orders.jsx";
import { Customers, Dashboard, QuotationCreate, QuotationList, QuoteRequests } from "./Sales.jsx";
import Reports from "./Reports.jsx";
import { ChatLogs } from "./ChatLogs.jsx";
import { AuditLogs, EmployeeGroups, Employees, Groups } from "./System.jsx";

export const SCREENS = {
  home: Home,
  content: Content,
  activities_create: ActivitiesCreate,
  activities_list: ActivitiesList,
  spoken_words: SpokenWords,
  categories_create: CategoriesCreate,
  categories_list: CategoriesList,
  products_create: ProductsCreate,
  products_list: ProductsList,
  inventory_transaction: InventoryTransaction,
  inventory_history: InventoryHistory,
  inventory_corrections: () => createElement(Corrections, { recordType: "inventory" }),
  orders_corrections: () => createElement(Corrections, { recordType: "order" }),
  suppliers_manage: Suppliers,
  purchases_create: PurchaseCreate,
  purchases_list: PurchaseList,
  orders_create: OrderCreate,
  orders_list: OrdersList,
  orders_payment: OrdersPayment,
  orders_status: OrdersStatus,
  orders_discounts: DiscountCodes,
  dashboard: Dashboard,
  customers_manage: Customers,
  quotations_create: QuotationCreate,
  quotations_list: QuotationList,
  quote_requests: QuoteRequests,
  chat_logs: ChatLogs,
  reports: Reports,
  employees_manage: Employees,
  employees_groups: EmployeeGroups,
  groups_manage: Groups,
  audit_logs: AuditLogs,
};
