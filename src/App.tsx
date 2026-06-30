import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './auth/AuthProvider';
import { ProtectedRoute } from './routes/ProtectedRoute';
import { PublicOnlyRoute } from './routes/PublicOnlyRoute';
import { AppShell } from './shell/AppShell';
import { LoginScreen } from './screens/LoginScreen';
import { DashboardScreen } from './screens/DashboardScreen';
import { PurchaseOrdersScreen } from './screens/PurchaseOrdersScreen';
import { PurchaseOrderDetailScreen } from './screens/PurchaseOrderDetailScreen';
import { PurchaseOrderComposerScreen } from './screens/PurchaseOrderComposerScreen';
import { PurchaseOrderPrintScreen } from './screens/PurchaseOrderPrintScreen';
import { ApprovalsScreen } from './screens/ApprovalsScreen';
import { SuppliersScreen } from './screens/SuppliersScreen';
import { QuotationsScreen } from './screens/QuotationsScreen';
import { SupplierBidsScreen } from './screens/SupplierBidsScreen';
import { CompaniesScreen } from './screens/admin/CompaniesScreen';
import { UsersScreen } from './screens/admin/UsersScreen';
import { RolesScreen } from './screens/admin/RolesScreen';
import { CurrenciesScreen } from './screens/admin/CurrenciesScreen';
import { PoTypesScreen } from './screens/admin/PoTypesScreen';
import { ProfileScreen } from './screens/ProfileScreen';
import './App.css';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route element={<PublicOnlyRoute />}>
            <Route path="/login" element={<LoginScreen />} />
          </Route>

          <Route element={<ProtectedRoute />}>
            <Route element={<AppShell />}>
              <Route path="/" element={<DashboardScreen />} />
              <Route path="/purchase-orders" element={<PurchaseOrdersScreen />} />
              <Route path="/purchase-orders/new" element={<PurchaseOrderComposerScreen />} />
              <Route path="/purchase-orders/:id/edit" element={<PurchaseOrderComposerScreen />} />
              <Route path="/purchase-orders/:id/print" element={<PurchaseOrderPrintScreen />} />
              <Route path="/purchase-orders/:id" element={<PurchaseOrderDetailScreen />} />
              <Route path="/approvals" element={<ApprovalsScreen />} />
              <Route path="/suppliers" element={<SuppliersScreen />} />
              <Route path="/quotations" element={<QuotationsScreen />} />
              <Route path="/supplier-bids" element={<SupplierBidsScreen />} />
              <Route path="/admin/companies" element={<CompaniesScreen />} />
              <Route path="/admin/users" element={<UsersScreen />} />
              <Route path="/admin/roles" element={<RolesScreen />} />
              <Route path="/admin/currencies" element={<CurrenciesScreen />} />
              <Route path="/admin/po-types" element={<PoTypesScreen />} />
              <Route path="/profile" element={<ProfileScreen />} />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
