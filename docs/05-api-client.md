# API Client Reference

All API modules are in `src/api/`. Every module imports from `src/api/client.ts` (`apiClient`) and exports typed functions. No `any` types are used.

The base URL is `/api` (relative), which routes through the Vite proxy in development and a reverse proxy in production. All requests include `credentials: 'include'` so the session cookie is sent automatically.

---

## Shared Types (`src/api/types.ts`)

### CurrencyTotal

```ts
interface CurrencyTotal {
  currency: string;      // ISO 4217 currency code, e.g. "ZMW"
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
}
```

Used as elements of `totals` arrays on `PurchaseOrderDetail` and `SupplierBidDetail` / `SupplierBidSummary`. Multi-currency totals are never summed or converted — the frontend always renders them as a joined string via `formatMoneyVector`.

### PagedResult\<T\>

```ts
interface PagedResult<T> {
  items: T[];
  page: number;       // 1-based
  pageSize: number;
  totalCount: number;
}
```

Returned by all paginated list endpoints.

### PagedQuery

```ts
interface PagedQuery {
  page?: number;
  pageSize?: number;
}
```

Extended by per-resource list query interfaces.

### buildQueryString

```ts
function buildQueryString(params: object): string
```

Converts a flat object to a URL query string, omitting keys whose value is `undefined`, `null`, or `''`. Returns `""` for an empty object, `"?key=value&..."` otherwise.

---

## Error Handling (`src/api/apiError.ts`, `src/api/errorMessage.ts`)

### ProblemDetails

```ts
interface ProblemDetails {
  type?: string;
  title?: string;
  status?: number;
  detail?: string;
  instance?: string;
  [key: string]: unknown;   // RFC 7807 extension members
}
```

The backend returns this shape for all non-2xx responses.

### ApiError

```ts
class ApiError extends Error {
  status: number;            // HTTP status code
  detail?: string;           // ProblemDetails.detail
  problem?: ProblemDetails;  // full parsed response body
}
```

Thrown by `apiClient` for every non-2xx response.

### getErrorMessage

```ts
function getErrorMessage(error: unknown, fallback: string): string
```

Extracts a user-facing message: `ApiError.detail` → `ApiError.message` → `Error.message` → `fallback`.

---

## Auth (`src/api/authApi.ts`)

### CurrentUser

```ts
interface CurrentUser {
  id: number;
  fullName: string;
  email: string;
  companyId: number;
  roles: string[];    // role names (not ids)
}
```

### Functions

#### login(email, password)
```
POST /api/auth/login
Body: { email: string, password: string }
Returns: CurrentUser
```
Sets the session cookie. A 401 means invalid credentials.

#### logout()
```
POST /api/auth/logout
Returns: void
```
Clears the session cookie server-side.

#### getMe()
```
GET /api/auth/me
Returns: CurrentUser
```
Used by `AuthProvider` on mount to check for an existing session. Returns 401 when not authenticated.

---

## Purchase Orders (`src/api/purchaseOrdersApi.ts`)

### Types

#### PurchaseOrderStatus
```ts
type PurchaseOrderStatus = 'Draft' | 'Open' | 'Approved' | 'Rejected' | 'Cancelled'
```

#### PurchaseOrderSummary
Summary row returned by the list endpoint.
```ts
interface PurchaseOrderSummary {
  id: number;
  poNumber: string;
  companyId: number;
  companyName: string;
  targetCompanyId: number | null;
  targetCompanyName: string | null;
  issuerUserId: number;
  issuerUserName: string;
  currency: string;
  status: PurchaseOrderStatus;
  notes: string | null;
  totalAmount: number;           // single-currency only; not reliable for multi-currency POs
  paidAtUtc: string | null;      // UTC ISO 8601 timestamp
  deliveredAtUtc: string | null;
  createdAtUtc: string;
}
```

#### PurchaseOrderLineItem
```ts
interface PurchaseOrderLineItem {
  id: number;
  purchaseOrderId: number;
  sourceSupplierBidItemId: number | null;  // set when line was generated from a bid
  description: string;
  quantity: number;
  unitCost: number;
  currency: string;
  discountPercentage: number | null;
  discountAmount: number;
  taxPercentage: number | null;
  taxAmount: number;
  lineSubtotal: number;
  lineTotal: number;
  rowVersion: string;
}
```

#### PurchaseOrderAttachedBid
Junction-row metadata for a supplier bid attached to a PO.
```ts
interface PurchaseOrderAttachedBid {
  supplierBidId: number;
  isPrimary: boolean;     // true = this bid was selected as the primary (awarded)
  addedAtUtc: string;
}
```

#### PurchaseOrderDetail
Full PO returned by the detail endpoint.
```ts
interface PurchaseOrderDetail {
  id: number;
  poNumber: string;
  companyId: number;
  companyName: string;
  targetCompanyId: number | null;
  targetCompanyName: string | null;
  issuerUserId: number;
  issuerUserName: string;
  currency: string;
  status: PurchaseOrderStatus;
  notes: string | null;
  purchaseOrderTypeId: number | null;
  purchaseOrderTypeName: string | null;
  awardedSupplierBidId: number | null;
  awardedAtUtc: string | null;
  awardedByUserId: number | null;
  paidAtUtc: string | null;
  deliveredAtUtc: string | null;
  subtotal: number;            // reliable only when hasMultiCurrencyTotals is false
  taxAmount: number;
  totalAmount: number;
  hasMultiCurrencyTotals: boolean;   // when true, read from `totals` instead
  totals: CurrencyTotal[];
  createdAtUtc: string;
  lineItems: PurchaseOrderLineItem[];
  approvals: ApprovalDto[];
  supplierBids: SupplierBidSummary[];
  attachedSupplierBids: PurchaseOrderAttachedBid[];
  rowVersion: string;
}
```

#### PurchaseOrderListQuery
```ts
interface PurchaseOrderListQuery extends PagedQuery {
  status?: PurchaseOrderStatus;
  companyId?: number;
}
```

#### CreatePurchaseOrderRequest
```ts
interface CreatePurchaseOrderRequest {
  companyId: number;
  targetCompanyId?: number | null;
  currency?: string | null;              // defaults to "ZMW" server-side
  purchaseOrderTypeId?: number | null;
  notes?: string | null;
}
```

#### UpdatePurchaseOrderRequest
```ts
interface UpdatePurchaseOrderRequest {
  currency: string;
  targetCompanyId?: number | null;
  notes?: string | null;
  rowVersion?: string | null;
}
```

#### CreatePurchaseOrderLineItemRequest
```ts
interface CreatePurchaseOrderLineItemRequest {
  description: string;
  quantity: number;
  unitCost: number;
  discountPercentage?: number | null;
  taxPercentage?: number | null;
}
```

#### UpdatePurchaseOrderLineItemRequest
```ts
interface UpdatePurchaseOrderLineItemRequest {
  description: string;
  quantity: number;
  unitCost: number;
  discountPercentage?: number | null;
  taxPercentage?: number | null;
  rowVersion?: string | null;
}
```

#### CreateApprovalDefinitionRequest
```ts
interface CreateApprovalDefinitionRequest {
  requiredRoleId?: number | null;
  requiredUserId?: number | null;
  sequenceOrder: number;
}
```

### Functions

#### listPurchaseOrders(query)
```
GET /api/purchase-orders?page&pageSize&status?&companyId?
Returns: PagedResult<PurchaseOrderSummary>
```

#### getPurchaseOrder(id)
```
GET /api/purchase-orders/:id
Returns: PurchaseOrderDetail
```

#### createPurchaseOrder(request)
```
POST /api/purchase-orders
Body: CreatePurchaseOrderRequest
Returns: PurchaseOrderDetail
```

#### updatePurchaseOrder(id, request)
```
PUT /api/purchase-orders/:id
Body: UpdatePurchaseOrderRequest
Returns: PurchaseOrderDetail
```

#### addLineItem(id, request)
```
POST /api/purchase-orders/:id/line-items
Body: CreatePurchaseOrderLineItemRequest
Returns: PurchaseOrderLineItem
```

#### updateLineItem(id, lineItemId, request)
```
PUT /api/purchase-orders/:id/line-items/:lineItemId
Body: UpdatePurchaseOrderLineItemRequest
Returns: PurchaseOrderLineItem
```

#### deleteLineItem(id, lineItemId)
```
DELETE /api/purchase-orders/:id/line-items/:lineItemId
Returns: void
```

#### addApprovalDefinition(id, request)
```
POST /api/purchase-orders/:id/approvals
Body: CreateApprovalDefinitionRequest
Returns: ApprovalDto
```

#### deleteApprovalDefinition(id, approvalId)
```
DELETE /api/purchase-orders/:id/approvals/:approvalId
Returns: void
```

#### submitPurchaseOrder(id)
```
POST /api/purchase-orders/:id/submit
Returns: PurchaseOrderDetail
```

#### payPurchaseOrder(id)
```
POST /api/purchase-orders/:id/pay
Returns: PurchaseOrderDetail
```

#### deliverPurchaseOrder(id)
```
POST /api/purchase-orders/:id/deliver
Returns: PurchaseOrderDetail
```

#### cancelPurchaseOrder(id)
```
POST /api/purchase-orders/:id/cancel
Returns: PurchaseOrderDetail
```

#### attachSupplierBid(poId, supplierBidId, isPrimary)
```
POST /api/purchase-orders/:poId/supplier-bids
Body: { supplierBidId: number, isPrimary: boolean }
Returns: PurchaseOrderDetail
```

#### detachSupplierBid(poId, supplierBidId)
```
DELETE /api/purchase-orders/:poId/supplier-bids/:supplierBidId
Returns: void
```

#### setPrimarySupplierBid(poId, supplierBidId)
```
PATCH /api/purchase-orders/:poId/supplier-bids/:supplierBidId/set-primary
Returns: void
```
Once called, the attached bid list is locked and cannot be changed.

#### setAwardedBid(id, supplierBidId)
```
POST /api/purchase-orders/:id/awarded-bid
Body: { supplierBidId: number }
Returns: PurchaseOrderDetail
```

---

## Supplier Bids (`src/api/bidsApi.ts`)

### Types

#### SupplierBidSummary
```ts
interface SupplierBidSummary {
  id: number;
  purchaseOrderId: number | null;    // null = standalone/unattached
  supplierId: number;
  supplierName: string;
  notes: string | null;
  totals: CurrencyTotal[];
  itemCount: number;
  quotationCount: number;
  hasExpiredQuotation: boolean;
  earliestQuotationExpiryUtc: string | null;
}
```

#### SupplierBidItem
```ts
interface SupplierBidItem {
  id: number;
  supplierBidId: number;
  sourceQuotationLineItemId: number;   // required — all bid items source from a quotation line
  sourceQuotationId: number;
  sourceQuotationReference: string | null;
  description: string;
  quantity: number;
  unitCost: number;
  currency: string;
  discountPercentage: number | null;
  discountAmount: number;
  taxPercentage: number | null;
  taxAmount: number;
  lineSubtotal: number;
  lineTotal: number;
  rowVersion: string;
}
```

#### SupplierBidDetail
```ts
interface SupplierBidDetail {
  id: number;
  purchaseOrderId: number | null;
  supplierId: number;
  supplierName: string;
  notes: string | null;
  totals: CurrencyTotal[];
  itemCount: number;
  items: SupplierBidItem[];
  rowVersion: string;
}
```

#### CreateSupplierBidRequest
```ts
interface CreateSupplierBidRequest {
  supplierId: number;
  notes?: string | null;
}
```

#### CreateSupplierBidItemRequest
```ts
interface CreateSupplierBidItemRequest {
  description: string;
  quantity: number;
  unitCost: number;
  currency?: string | null;               // defaults from the source quotation's currency
  discountPercentage?: number | null;
  taxPercentage?: number | null;
  sourceQuotationLineItemId: number;      // required
}
```

#### UpdateSupplierBidItemRequest
```ts
interface UpdateSupplierBidItemRequest {
  description: string;
  quantity: number;
  unitCost: number;
  currency: string;
  discountPercentage?: number | null;
  taxPercentage?: number | null;
  rowVersion?: string | null;
}
```

#### SupplierBidListQuery
```ts
interface SupplierBidListQuery {
  supplierId?: number;
  purchaseOrderId?: number;
  unattachedOnly?: boolean;
}
```

### Functions

#### listBids(query)
```
GET /api/supplier-bids?supplierId?&purchaseOrderId?&unattachedOnly?
Returns: SupplierBidSummary[]
```
Not paginated.

#### listBidsForPurchaseOrder(purchaseOrderId)
```
GET /api/purchase-orders/:purchaseOrderId/bids
Returns: SupplierBidSummary[]
```

#### createStandaloneBid(request)
```
POST /api/supplier-bids
Body: CreateSupplierBidRequest
Returns: SupplierBidDetail
```
Creates a bid not yet attached to any PO.

#### createBid(purchaseOrderId, request)
```
POST /api/purchase-orders/:purchaseOrderId/bids
Body: CreateSupplierBidRequest
Returns: SupplierBidDetail
```
Creates a bid already attached to the given PO.

#### attachBidToPurchaseOrder(supplierBidId, purchaseOrderId)
```
POST /api/supplier-bids/:supplierBidId/attach
Body: { purchaseOrderId: number }
Returns: SupplierBidDetail
```

#### getBid(id)
```
GET /api/supplier-bids/:id
Returns: SupplierBidDetail
```

#### addBidItem(supplierBidId, request)
```
POST /api/supplier-bids/:supplierBidId/items
Body: CreateSupplierBidItemRequest
Returns: SupplierBidItem
```

#### updateBidItem(supplierBidId, itemId, request)
```
PUT /api/supplier-bids/:supplierBidId/items/:itemId
Body: UpdateSupplierBidItemRequest
Returns: SupplierBidItem
```

#### deleteBidItem(supplierBidId, itemId)
```
DELETE /api/supplier-bids/:supplierBidId/items/:itemId
Returns: void
```

#### seedBidItemsFromQuotation(supplierBidId, request)
```
POST /api/supplier-bids/:supplierBidId/items/seed-from-quotation
Body: { quotationId: number }
Returns: SupplierBidDetail
```
Bulk-populates bid items from all line items of the given quotation. Returns the refreshed bid detail.

---

## Quotations (`src/api/quotationsApi.ts`)

### Types

#### QuotationLineItem
```ts
interface QuotationLineItem {
  id: number;
  description: string;
  quantity: number;
  unitCost: number;
}
```

#### Quotation (full detail)
```ts
interface Quotation {
  id: number;
  supplierId: number;
  supplierName: string;
  file: UploadedFile;           // API-resolved file object
  description: string | null;
  quoteReference: string | null;
  quoteDate: string;            // UTC ISO 8601 date
  expiresAtUtc: string | null;
  isExpired: boolean;
  currency: string;
  notes: string | null;
  isUsed: boolean;              // true when at least one bid item sources from this quotation
  taxRate: number | null;
  discountRate: number | null;
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  grandTotal: number;
  lineItems: QuotationLineItem[];
}
```

#### QuotationSummary (list row)
```ts
interface QuotationSummary {
  id: number;
  supplierId: number;
  supplierName: string;
  fileId: number;
  fileUrl: string;              // API-resolved URL — use this directly, never construct it
  originalFileName: string | null;
  description: string | null;
  quoteReference: string | null;
  quoteDate: string;
  expiresAtUtc: string | null;
  isExpired: boolean;
  currency: string;
  notes: string | null;
  lineItemCount: number;
  isUsed: boolean;
  taxRate: number | null;
  discountRate: number | null;
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  grandTotal: number;
}
```

#### CreateQuotationRequest
```ts
interface CreateQuotationRequest {
  supplierId: number;
  fileId: number;               // from UploadedFile.id after a successful file upload
  description?: string | null;
  quoteReference?: string | null;
  quoteDate: string;            // UTC ISO 8601 timestamp
  expiresAtUtc?: string | null;
  currency: string;
  taxRate?: number | null;
  discountRate?: number | null;
  notes?: string | null;
  lineItems: CreateQuotationLineItemRequest[];
}

interface CreateQuotationLineItemRequest {
  description: string;
  quantity: number;
  unitCost: number;
}
```

#### QuotationListQuery
```ts
interface QuotationListQuery {
  supplierId?: number;
  isExpired?: boolean;
  isUsed?: boolean;
}
```

### Functions

#### listQuotations(query)
```
GET /api/quotations?supplierId?&isExpired?&isUsed?
Returns: QuotationSummary[]
```
Not paginated.

#### getQuotation(quotationId)
```
GET /api/quotations/:quotationId
Returns: Quotation
```

#### createQuotation(request)
```
POST /api/quotations
Body: CreateQuotationRequest
Returns: Quotation
```
A file must be uploaded first (see Files section) and its `id` passed as `fileId`.

---

## Suppliers (`src/api/suppliersApi.ts`)

### Types

#### Supplier
```ts
interface Supplier {
  id: number;
  supplierName: string;
  phone: string;
  email: string;
  address: string;
}
```

#### SupplierListQuery
```ts
interface SupplierListQuery extends PagedQuery {
  search?: string;    // optional case-insensitive filter on supplierName
}
```

#### CreateSupplierRequest / UpdateSupplierRequest
```ts
interface CreateSupplierRequest {
  supplierName: string;
  phone: string;
  email: string;
  address: string;
}
// UpdateSupplierRequest has the same fields
```

### Functions

#### listSuppliers(query)
```
GET /api/suppliers?page&pageSize&search?
Returns: PagedResult<Supplier>
```

#### getSupplier(id)
```
GET /api/suppliers/:id
Returns: Supplier
```

#### createSupplier(request)
```
POST /api/suppliers
Body: CreateSupplierRequest
Returns: Supplier
```

#### updateSupplier(id, request)
```
PUT /api/suppliers/:id
Body: UpdateSupplierRequest
Returns: Supplier
```

#### deleteSupplier(id)
```
DELETE /api/suppliers/:id
Returns: void
```
May return 409 if the supplier has existing quotations or bids.

---

## Companies (`src/api/companiesApi.ts`)

### Types

#### Company
```ts
interface Company {
  id: number;
  name: string;
  parentCompanyId: number | null;
  parentCompanyName: string | null;
}
```

#### CreateCompanyRequest / UpdateCompanyRequest
```ts
interface CreateCompanyRequest {
  name: string;
  parentCompanyId: number | null;
}
// UpdateCompanyRequest has the same fields
```

### Functions

#### listCompanies(query)
```
GET /api/companies?page&pageSize
Returns: PagedResult<Company>
```

#### listAllCompanies()
Utility that walks all pages (max 100 per request) and returns the full `Company[]`. Used wherever a complete list is needed for a picker. No query parameters.

#### getCompany(id)
```
GET /api/companies/:id
Returns: Company
```

#### createCompany(request)
```
POST /api/companies
Body: CreateCompanyRequest
Returns: Company
```
May return 422 if the parent assignment would create a cycle.

#### updateCompany(id, request)
```
PUT /api/companies/:id
Body: UpdateCompanyRequest
Returns: Company
```

#### deleteCompany(id)
```
DELETE /api/companies/:id
Returns: void
```
May return 409 if the company has child companies or associated users/POs.

---

## Approvals (`src/api/approvalsApi.ts`)

### Types

#### ApprovalStatus
```ts
type ApprovalStatus = 'Pending' | 'Approved' | 'Rejected' | 'Skipped'
```

#### ApprovalDto
Full approval record, embedded in `PurchaseOrderDetail.approvals`.
```ts
interface ApprovalDto {
  id: number;
  purchaseOrderId: number;
  requiredRoleId: number | null;
  requiredRoleName: string | null;
  requiredUserId: number | null;
  requiredUserName: string | null;
  sequenceOrder: number;
  status: ApprovalStatus;
  approvedByUserId: number | null;
  approvedByUserName: string | null;
  approvedAtUtc: string | null;
  comment: string | null;
  rowVersion: string;
}
```

#### MyApprovalDto
Inbox row for the current user's pending approvals.
```ts
interface MyApprovalDto {
  id: number;
  purchaseOrderId: number;
  poNumber: string;
  companyName: string;
  totalAmount: number;
  currency: string;
  requiredRoleId: number | null;
  requiredRoleName: string | null;
  requiredUserId: number | null;
  sequenceOrder: number;
  rowVersion: string;
}
```

#### ActOnApprovalRequest
```ts
interface ActOnApprovalRequest {
  comment?: string;
  rowVersion?: string;
}
```

### Functions

#### getMyApprovals()
```
GET /api/approvals/mine
Returns: MyApprovalDto[]
```
Returns only approvals the current user is eligible to act on at their current sequence position.

#### approveApproval(approvalId, request)
```
POST /api/approvals/:approvalId/approve
Body: ActOnApprovalRequest
Returns: ApprovalDto
```

#### rejectApproval(approvalId, request)
```
POST /api/approvals/:approvalId/reject
Body: ActOnApprovalRequest
Returns: ApprovalDto
```

---

## Currencies (`src/api/currenciesApi.ts`)

### Types

```ts
interface Currency {
  code: string;       // ISO 4217 code, used as the primary key
  name: string;
  isActive: boolean;
}

interface CreateCurrencyRequest {
  code: string;
  name: string;
  isActive: boolean;
}

interface UpdateCurrencyRequest {
  name: string;
  isActive: boolean;
}
```

### Functions

#### listCurrencies(options?)
```
GET /api/currencies?isActive?
Returns: Currency[]
```
Pass `{ isActive: true }` to get only active currencies (used in pickers). Pass nothing for all currencies (used in admin screen with "Show inactive" toggle).

#### getCurrency(code)
```
GET /api/currencies/:code
Returns: Currency
```

#### createCurrency(request)
```
POST /api/currencies
Body: CreateCurrencyRequest
Returns: Currency
```

#### updateCurrency(code, request)
```
PUT /api/currencies/:code
Body: UpdateCurrencyRequest
Returns: Currency
```
There is no delete endpoint — currencies are deactivated via `isActive: false`.

---

## Purchase Order Types (`src/api/purchaseOrderTypesApi.ts`)

### Types

```ts
interface PurchaseOrderTypeApprovalStepDto {
  id: number;
  requiredRoleId: number | null;
  requiredRoleName: string | null;
  requiredUserId: number | null;
  requiredUserName: string | null;
  sequenceOrder: number;
}

interface PurchaseOrderTypeDto {
  id: number;
  name: string;
  isActive: boolean;
  approvalSteps: PurchaseOrderTypeApprovalStepDto[];
  allowedCreatorRoleIds: number[];
  allowedCreatorRoleNames: string[];
}

interface CreatePurchaseOrderTypeRequest {
  name: string;
  isActive: boolean;
  approvalSteps: {
    requiredRoleId?: number;
    requiredUserId?: number;
    sequenceOrder: number;
  }[];
  allowedCreatorRoleIds: number[];    // empty = no restriction
}

// UpdatePurchaseOrderTypeRequest has the same fields as Create
```

### Functions

#### listPurchaseOrderTypes()
```
GET /api/purchase-order-types
Returns: PurchaseOrderTypeDto[]
```

#### getPurchaseOrderType(id)
```
GET /api/purchase-order-types/:id
Returns: PurchaseOrderTypeDto
```

#### createPurchaseOrderType(request)
```
POST /api/purchase-order-types
Body: CreatePurchaseOrderTypeRequest
Returns: PurchaseOrderTypeDto
```

#### updatePurchaseOrderType(id, request)
```
PUT /api/purchase-order-types/:id
Body: UpdatePurchaseOrderTypeRequest
Returns: PurchaseOrderTypeDto
```

#### deletePurchaseOrderType(id)
```
DELETE /api/purchase-order-types/:id
Returns: void
```

---

## Users (`src/api/usersApi.ts`)

### Types

```ts
interface UserRole {
  id: number;
  name: string;
}

interface User {
  id: number;
  fullName: string;
  email: string;
  isActive: boolean;
  companyId: number;
  companyName: string;
  roles: UserRole[];
}

interface UserListQuery extends PagedQuery {
  companyId?: number;
}

interface CreateUserRequest {
  fullName: string;
  email: string;
  companyId: number;
  isActive: boolean;
  password: string;
  roleIds: number[];
}

interface UpdateUserRequest {
  fullName: string;
  email: string;
  companyId: number;
  isActive: boolean;
  roleIds: number[];
}
```

### Functions

#### listUsers(query)
```
GET /api/users?page&pageSize&companyId?
Returns: PagedResult<User>
```

#### getUser(id)
```
GET /api/users/:id
Returns: User
```

#### createUser(request)
```
POST /api/users
Body: CreateUserRequest
Returns: User
```

#### updateUser(id, request)
```
PUT /api/users/:id
Body: UpdateUserRequest
Returns: User
```

#### deleteUser(id)
```
DELETE /api/users/:id
Returns: void
```

#### resetUserPassword(id, newPassword)
```
POST /api/users/:id/reset-password
Body: { newPassword: string }
Returns: void
```

---

## Roles (`src/api/rolesApi.ts`)

### Types

```ts
interface Role {
  id: number;
  name: string;
  parentRoleId: number | null;
  isSystemRole: boolean;     // system roles cannot be deleted
}

interface CreateRoleRequest {
  name: string;
  parentRoleId: number;      // required — every new role needs a parent
}

interface UpdateRoleRequest {
  name: string;              // rename only
}
```

The API returns a flat list; the frontend builds the tree client-side via `buildRoleTree` in `src/screens/admin/roleTree.ts`.

### Functions

#### listRoles()
```
GET /api/roles
Returns: Role[]
```

#### listAllowedParentRoles()
```
GET /api/roles/allowed-parents
Returns: Role[]
```
Returns the roles the current user may use as a parent when creating a new role (their seniority ceiling + descendants).

#### getRole(id)
```
GET /api/roles/:id
Returns: Role
```

#### createRole(request)
```
POST /api/roles
Body: CreateRoleRequest
Returns: Role
```

#### renameRole(id, request)
```
PUT /api/roles/:id
Body: UpdateRoleRequest
Returns: Role
```

#### deleteRole(id)
```
DELETE /api/roles/:id
Returns: void
```
Returns 409 if the role has children or assigned users. Returns an error for system roles.

---

## Files (`src/api/filesApi.ts`)

### Types

```ts
interface UploadedFile {
  id: number;
  url: string;              // API-resolved URL — use this directly in <a href> and <img src>
  originalFileName: string | null;
  contentType: string | null;
  fileSizeBytes: number | null;
}
```

### Functions

#### uploadFile(file)
```
POST /api/files
Body: FormData (field name "file")
Returns: UploadedFile
```

Uses `fetch` directly rather than `apiClient` because the browser must set the `Content-Type: multipart/form-data` boundary automatically. Setting `Content-Type` manually on a `FormData` body breaks the multipart boundary and the server cannot parse the request.

The returned `url` is the canonical API-resolved URL for the file. It must always be used directly — do not attempt to construct file URLs client-side.
