/**
 * TMS backend route map — keep in sync with TMS/backend/routes/index.js
 */
export const endpoints = {
  health: "/api",
  companies: "/api/companies",
  login: "/api/login",
  refresh: "/api/auth/refresh",
  logout: "/api/logout",
  register: "/api/auth/register",
  profile: "/api/profile",

  users: "/api/users",
  user: (id) => `/api/users/${id}`,

  clients: "/api/clients",
  drivers: "/api/drivers",
  helpers: "/api/helpers",

  vehicles: "/api/vehicles",
  vehicleTypes: "/api/vehicle-types",
  vehicleAssignments: "/api/vehicle-assignments",

  vehicleDocuments: "/api/vehicle-documents",
  driverDocuments: "/api/driver-documents",
  driverDocument: (driverId) => `/api/driver-documents/${driverId}`,
  helperDocuments: "/api/helper-documents",
  helperDocument: (helperId) => `/api/helper-documents/${helperId}`,

  bilties: "/api/bilties",
  trips: "/api/trips",

  tripExpenses: "/api/trip-expenses",
  tripExpense: (id) => `/api/trip-expenses/${id}`,
  tripExpenseStatus: (id) => `/api/trip-expenses/${id}/status`,

  tripAdvances: "/api/trip-advances",
  tripAdvance: (id) => `/api/trip-advances/${id}`,
  tripAdvanceStatus: (id) => `/api/trip-advances/${id}/status`,

  tripSettlements: "/api/trip-settlements",
  tripSettlement: (id) => `/api/trip-settlements/${id}`,
  tripSettlementStatus: (id) => `/api/trip-settlements/${id}/status`,

  tripFinalReports: "/api/trip-final-reports",
  tripFinalReport: (id) => `/api/trip-final-reports/${id}`,
  tripFinalReportStatus: (id) => `/api/trip-final-reports/${id}/status`,

  invoices: "/api/invoices",
  invoice: (id) => `/api/invoices/${id}`,
  invoiceStatus: (id) => `/api/invoices/${id}/status`,

  invoicePayments: "/api/invoice-payments",
  invoicePayment: (id) => `/api/invoice-payments/${id}`,
  invoicePaymentStatus: (id) => `/api/invoice-payments/${id}/status`,

  invoicePaymentDeductions: "/api/invoice-payment-deductions",
  invoicePaymentDeduction: (id) => `/api/invoice-payment-deductions/${id}`,

  modules: "/api/modules",
  userModuleAccess: "/api/user-module-access",
  userModuleAccessFor: (userId) => `/api/user-module-access/${userId}`,
};
