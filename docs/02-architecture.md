# Project Architecture

## Directory Structure

```
src/
  api/            Typed API client modules, one file per resource
  auth/           AuthContext, AuthProvider, useAuth hook, role helpers
  components/     Reusable UI components shared across screens
  routes/         Route guard components (ProtectedRoute, PublicOnlyRoute)
  screens/        One file per screen; admin sub-screens under screens/admin/
  shell/          App shell (AppShell, Sidebar, UserMenu, nav items, shell.css)
  theme/          Three-way theming system (ThemeProvider, useTheme, ThemeToggle)
  utils/          Pure utility functions (format.ts, search.ts)
  App.tsx         Route tree definition
  main.tsx        Entry point; mounts ThemeProvider then App
  index.css       Global CSS variables (design tokens) and base styles
```

## Routing

Routes are defined in `src/App.tsx` using React Router v7. The full route tree:

| Path | Component | Notes |
|---|---|---|
| `/login` | `LoginScreen` | Public only — authenticated users redirect to `/` |
| `/` | `DashboardScreen` | Protected |
| `/purchase-orders` | `PurchaseOrdersScreen` | Protected |
| `/purchase-orders/new` | `PurchaseOrderComposerScreen` | Protected |
| `/purchase-orders/:id/edit` | `PurchaseOrderComposerScreen` | Protected; same component as new, different branch |
| `/purchase-orders/:id/print` | `PurchaseOrderPrintScreen` | Protected |
| `/purchase-orders/:id` | `PurchaseOrderDetailScreen` | Protected |
| `/approvals` | `ApprovalsScreen` | Protected |
| `/suppliers` | `SuppliersScreen` | Protected |
| `/quotations` | `QuotationsScreen` | Protected |
| `/supplier-bids` | `SupplierBidsScreen` | Protected |
| `/supplier-bids/new` | `SupplierBidComposerScreen` | Protected |
| `/admin/companies` | `CompaniesScreen` | Protected |
| `/admin/users` | `UsersScreen` | Protected |
| `/admin/roles` | `RolesScreen` | Protected |
| `/admin/currencies` | `CurrenciesScreen` | Protected |
| `/admin/po-types` | `PoTypesScreen` | Protected |
| `/profile` | `ProfileScreen` | Protected |
| `*` | — | Redirects to `/` |

All protected routes are wrapped in `ProtectedRoute`, which renders `null` during the initial session check and redirects unauthenticated users to `/login` with the intended path preserved in router state.

`PublicOnlyRoute` wraps `/login` and redirects already-authenticated users to `/`.

## Authentication and Auth Context

**Files:** `src/auth/auth-context.ts`, `src/auth/AuthProvider.tsx`, `src/auth/useAuth.ts`, `src/auth/roles.ts`

Auth is cookie-session based. The backend issues an httpOnly session cookie on login; every subsequent request includes it automatically via `credentials: 'include'` in the API client.

### AuthContextValue

```ts
interface AuthContextValue {
  user: CurrentUser | null;    // null when not authenticated
  isLoading: boolean;          // true during the initial getMe() session check
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}
```

### CurrentUser (from authApi.ts)

```ts
interface CurrentUser {
  id: number;
  fullName: string;
  email: string;
  companyId: number;
  roles: string[];             // role names, not ids
}
```

### Initialization sequence

On mount, `AuthProvider` calls `GET /api/auth/me`. A 401 response is treated as "not logged in" (not an error). Any other error is logged to the console. `isLoading` is true until this resolves. Route guards render `null` while `isLoading` is true, which prevents a flash of the login page for authenticated users.

### useAuth hook

```ts
import { useAuth } from '../auth/useAuth';
const { user, isAuthenticated, login, logout } = useAuth();
```

Throws if used outside `AuthProvider`.

### Role helper

```ts
import { isAdminTier } from '../auth/roles';
isAdminTier(user.roles); // true for 'super admin' or 'admin' (case-insensitive)
```

Used in the sidebar to conditionally show the Administration nav group.

## API Client Layer

**Files:** `src/api/client.ts`, `src/api/apiError.ts`, `src/api/errorMessage.ts`, `src/api/types.ts`, plus one module per resource.

### apiClient

`src/api/client.ts` exports a thin wrapper around `fetch`:

```ts
export const apiClient = {
  get:    <TResponse>(path, options?) => Promise<TResponse>,
  post:   <TResponse>(path, body?, options?) => Promise<TResponse>,
  put:    <TResponse>(path, body?, options?) => Promise<TResponse>,
  patch:  <TResponse>(path, body?, options?) => Promise<TResponse>,
  delete: <TResponse>(path, options?) => Promise<TResponse>,
};
```

Every request:
- Uses a relative base path `/api` (works with the Vite proxy in dev and a reverse proxy in production).
- Sends `credentials: 'include'` so the session cookie is attached.
- Sets `Accept: application/json` and `Content-Type: application/json` for non-`GET` requests.
- Throws `ApiError` for any non-2xx response.
- Returns `undefined` for 204 responses or non-JSON content types.

File uploads are handled separately in `src/api/filesApi.ts` using `fetch` directly (not `apiClient`) because the browser must set the `Content-Type` boundary for `multipart/form-data` itself.

### ApiError

```ts
class ApiError extends Error {
  status: number;            // HTTP status code
  detail?: string;           // RFC 7807 ProblemDetails.detail
  problem?: ProblemDetails;  // full parsed problem response
}
```

### getErrorMessage

```ts
import { getErrorMessage } from '../api/errorMessage';
const msg = getErrorMessage(error, 'Fallback message');
```

Extracts the most useful user-facing message from an `ApiError` (prefers `detail`, then `message`) or from a plain `Error`. Use this in every `catch` block that sets an error string.

### Shared types

Defined in `src/api/types.ts`:

```ts
interface CurrencyTotal {
  currency: string;
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
}

interface PagedResult<T> {
  items: T[];
  page: number;       // 1-based
  pageSize: number;
  totalCount: number;
}

interface PagedQuery {
  page?: number;
  pageSize?: number;
}

function buildQueryString(params: object): string  // builds ?key=value omitting undefined/null/''
```

### API module pattern

Each resource module (e.g. `purchaseOrdersApi.ts`) follows this structure:
1. Define TypeScript interfaces mirroring the backend DTOs (with a `// Mirrors ...` comment naming the C# class).
2. Export typed functions that call `apiClient` methods.

No module uses `any`. All function parameters and return types are explicit.

## CSS Conventions

The project uses **plain CSS** — no CSS Modules, no Tailwind, no CSS-in-JS.

### Design tokens

`src/index.css` defines CSS custom properties on `:root` and `[data-theme='light']` (light defaults) and overrides them on `[data-theme='dark']`. The resolved theme is applied as a `data-theme` attribute on `<html>`.

Key variables:

| Variable | Purpose |
|---|---|
| `--color-bg` | Page background |
| `--color-surface` | Card / panel background |
| `--color-surface-muted` | Table header background, hover states |
| `--color-border` | All borders |
| `--color-text` | Body text |
| `--color-text-muted` | Labels, secondary text |
| `--color-primary` | Links, primary buttons, info badges |
| `--color-primary-contrast` | Text on primary backgrounds |
| `--color-danger` | Danger buttons, error states, rejected badges |
| `--color-success` | Success badges, awarded bid borders |
| `--radius` | 8px — standard border radius |
| `--radius-lg` | 14px — modal / large card radius |
| `--shadow` | Standard card shadow |
| `--shadow-lg` | Modal shadow |
| `--transition-fast` | 0.12s — hover transitions |
| `--transition-base` | 0.18s — theme switch |
| `--font-sans` | Inter Variable, then system fallbacks |

### Shared stylesheet: admin.css

`src/screens/admin/admin.css` is the most-used stylesheet, imported by nearly every screen and by `BidComparisonPanel` and `PurchaseOrderCard`. Key classes:

**Layout:**
- `.admin-screen` — column flex, `max-width: 1080px`; `.admin-screen--wide` — removes the max-width
- `.admin-header` — flex row, space-between, wraps; holds the screen title and action buttons
- `.admin-filters` — flex row with gap, used for filter controls
- `.admin-panel` — card with surface background, border, radius, shadow

**Table:**
- `.admin-table` — full-width collapsed table with padded cells, uppercase muted headers
- `.row-actions` — right-justified flex container for per-row Edit/Delete buttons

**State:**
- `.admin-loading` — centered muted text, `padding: 2rem`
- `.admin-empty` — same as loading
- `.admin-error` — danger-coloured background with `role="alert"` text

**Badges:**
- `.badge` — pill shape, 0.75rem
- `.badge-success`, `.badge-danger`, `.badge-warning`, `.badge-info`, `.badge-muted`, `.badge-system` — colour modifiers

**Purchase order document classes:**
- `.po-detail` — column flex container for the detail and composer screens
- `.po-meta` — auto-fit grid of meta items
- `.po-meta-item` — column flex: label above value
- `.po-meta-label` — tiny uppercase muted label
- `.po-chips` — flex row of pill chips
- `.po-chip` / `.po-chip-set` — muted / success pill (for Paid/Delivered milestones)
- `.po-totals` — flex row of total items
- `.po-total-item` / `.po-total-grand` — column flex; grand total gets bold larger text
- `.po-total-value` — tabular-nums font
- `.po-document` — document-style card wrapper (used in `PurchaseOrderCard`)
- `.po-bid-cards` — bid card selector row
- `.po-bid-card` / `.po-bid-card--selected` / `.po-bid-card--awarded` — bid selector card states
- `.po-bid-preview-row` — two-column flex: line items left, source quotations right

**Bid cards:**
- `.bid-card-grid` — `auto-fill` grid, min 240px columns
- `.bid-card` — bordered card with column flex
- `.bid-card-clickable` — adds hover/active cursor and is rendered as a `<button>`
- `.bid-card-awarded` — success-coloured border
- `.bid-card-name`, `.bid-card-total`, `.bid-card-meta`, `.bid-card-badges` — inner layout

**Buttons:**
- `.btn` — base button style
- `.btn-primary`, `.btn-secondary`, `.btn-danger` — colour variants
- `.btn-small` — reduced padding/font
- `.btn-link` — borderless link-style button

**Modal:**
- `.modal-overlay` — full-screen fixed backdrop
- `.modal-card` — centred card within the overlay
- `.modal-actions` — right-justified button row

## Theming

**Files:** `src/theme/theme.ts`, `src/theme/ThemeProvider.tsx`, `src/theme/theme-context.ts`, `src/theme/useTheme.ts`

Three-way preference: `'system'` (default) / `'light'` / `'dark'`. The preference is stored in `localStorage` under the key `pom-theme`. `ThemeProvider` reads the stored preference on mount, resolves it to `'light'` or `'dark'`, and writes it as `data-theme` on `<html>`. When the preference is `'system'`, a `matchMedia` listener updates the theme live when the OS preference changes.

The no-flash requirement is met by `ThemeProvider` reading `localStorage` synchronously during state initialisation and applying the attribute before the first render. (No inline script in `index.html` is present; instead the provider runs synchronously on mount which happens before the browser has painted.)

`ThemeToggle` renders three `aria-pressed` buttons (System / Light / Dark) and calls `useTheme().setPreference()`.

## State Management

There is no external state library. Each screen manages its own state with `useState`, `useCallback`, and `useEffect`. The standard pattern is:

```ts
const [data, setData] = useState<T[]>([]);
const [isLoading, setIsLoading] = useState(true);
const [loadError, setLoadError] = useState<string | null>(null);

const load = useCallback(async () => {
  setIsLoading(true);
  setLoadError(null);
  try {
    setData(await someApi.list());
  } catch (err) {
    setLoadError(getErrorMessage(err, 'Fallback message.'));
  } finally {
    setIsLoading(false);
  }
}, [/* deps */]);

useEffect(() => { void load(); }, [load]);
```

Global state is limited to `AuthContext` (current user) and `ThemeContext` (theme preference). All other state is local to the screen or component that owns it.

Toast state (`ToastMessage | null`) is kept local to each screen. Only one toast is shown at a time; it is dismissed manually or replaced by the next action's result.

## Search Utilities

**File:** `src/utils/search.ts`

```ts
function scoreMatch(query: string, fields: (string | null | undefined)[]): number
```

Client-side relevance scoring for live search. The query is normalised (punctuation stripped, lowercased) and split into words. Scoring:

- Returns `-1` when the query is empty — the caller treats `-1` as "no filter; return the full list".
- Returns `0` when no field contains any word from the query — the caller hides this row.
- Returns a positive score: `2 × full-phrase hits + word hits`. Higher is more relevant.

Usage pattern (from `QuotationsScreen`):

```ts
const filtered = useMemo(() => {
  const scored = quotations.map((q) => ({
    item: q,
    score: scoreMatch(searchText, [q.supplierName, q.description, q.quoteReference]),
  }));
  if (scored[0]?.score === -1) return quotations; // empty query
  return scored.filter((x) => x.score > 0).sort((a, b) => b.score - a.score).map((x) => x.item);
}, [quotations, searchText]);
```

The search is always client-side (filters already-fetched data). Server-side search is only used for the Suppliers screen, which sends a `search` query parameter to the API.

## Format Utilities

**File:** `src/utils/format.ts`

| Function | Input | Output | Notes |
|---|---|---|---|
| `formatMoney(amount, currency)` | `number, string` | `string` | Uses `Intl.NumberFormat` with `style: 'currency'`. Falls back to `"ZMW 1234.50"` if the runtime doesn't recognise the currency code. |
| `formatMoneyVector(totals)` | `{ currency: string; totalAmount: number }[]` | `string` | Formats each total and joins with ` + `. Returns `"—"` for an empty array. Used to display multi-currency bid and PO totals. |
| `formatDate(iso)` | `string \| null \| undefined` | `string` | Locale date only (no time). Returns `"—"` for null/undefined/invalid. |
| `formatDateTime(iso)` | `string \| null \| undefined` | `string` | Locale date + time. Returns `"—"` for null/undefined/invalid. |

All monetary amounts come from the backend already rounded; no client-side rounding is performed.

## Pagination

**File:** `src/components/Pagination.tsx`

```ts
interface PaginationProps {
  page: number;
  pageSize: number;
  totalCount: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  pageSizeOptions?: number[];    // defaults to [10, 25, 50, 100]
}
```

Renders a "Showing X–Y of Z" summary, Previous/Next buttons, a page counter, and a rows-per-page `<select>`. When the user changes the page size, the component calls `onPageSizeChange` with the new size and then calls `onPageChange(1)` to reset to the first page.

Not all screens use this component. The `QuotationsScreen` and `SupplierBidsScreen` perform client-side pagination: they fetch all items from the API and slice the array locally.
