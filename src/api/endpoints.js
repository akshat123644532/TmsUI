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
  client: (id) => `/api/clients/${id}`,
  drivers: "/api/drivers",
  driver: (id) => `/api/drivers/${id}`,
  helpers: "/api/helpers",
  helper: (id) => `/api/helpers/${id}`,

  vehicles: "/api/vehicles",
  vehicle: (id) => `/api/vehicles/${id}`,
  vehicleTypes: "/api/vehicle-types",
  vehicleType: (id) => `/api/vehicle-types/${id}`,
  vehicleAssignments: "/api/vehicle-assignments",
  vehicleAssignment: (id) => `/api/vehicle-assignments/${id}`,

  vehicleDocuments: "/api/vehicle-documents",
  vehicleDocument: (id) => `/api/vehicle-documents/${id}`,
  driverDocuments: "/api/driver-documents",
  driverDocument: (driverId) => `/api/driver-documents/${driverId}`,
  helperDocuments: "/api/helper-documents",
  helperDocument: (helperId) => `/api/helper-documents/${helperId}`,

  bilties: "/api/bilties",
  bilty: (id) => `/api/bilties/${id}`,
  biltyReserve: "/api/bilties/reserve",
  biltyReserveRange: "/api/bilties/reserve-range",
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

  auditLogs: "/api/audit-logs",

  modules: "/api/modules",
  userModuleAccess: "/api/user-module-access",
  userModuleAccessFor: (userId) => `/api/user-module-access/${userId}`,
  userModuleAccessRow: (id) => `/api/user-module-access/${id}`,
};
