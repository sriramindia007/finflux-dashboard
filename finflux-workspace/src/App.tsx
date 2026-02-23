import { Suspense, lazy, Component, ReactNode } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import LandingPage from './pages/LandingPage';
import Login from './pages/Login';


// Lazy load dashboard pages to reduce initial bundle size
const HomeDashboard = lazy(() => import('./pages/HomeDashboard'));
const GeoDashboard = lazy(() => import('./pages/GeoDashboard'));
const TrendsDashboard = lazy(() => import('./pages/TrendsDashboard'));    // Restored: longitudinal / YoY analysis
const BranchDashboard = lazy(() => import('./pages/BranchDashboard'));
const PortfolioDashboard = lazy(() => import('./pages/PortfolioDashboard')); // contains Audit tab
const ProductDashboard = lazy(() => import('./pages/ProductDashboard'));
const OriginationDashboard = lazy(() => import('./pages/OriginationDashboard'));
// AuditDashboard intentionally NOT imported — content embedded in PortfolioDashboard (Tab 2: Audit & Control)
const CentreDashboard = lazy(() => import('./pages/CentreDashboard'));
const CollectionsDashboard = lazy(() => import('./pages/CollectionsDashboard'));
const AdminPanel = lazy(() => import('./pages/AdminPanel'));
const AlertsDashboard = lazy(() => import('./pages/AlertsDashboard'));
const SmartSchedulerPage = lazy(() => import('./pages/SmartSchedulerPage'));
// FinancialDashboard removed — content distributed to Portfolio (Vintage/Regulatory tabs) & Executive Dashboard

// Simple Loading Component
const LoadingFallback = () => (
    <div className="flex items-center justify-center h-screen bg-slate-50">
        <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin"></div>
            <span className="text-secondary-500 font-medium">Loading Dashboard...</span>
        </div>
    </div>
);

// Error Boundary: catches any crash in a dashboard and shows a recovery UI
// without killing the entire app or leaving a blank page.
interface EBState { hasError: boolean; error?: Error }
class ErrorBoundary extends Component<{ children: ReactNode }, EBState> {
    constructor(props: { children: ReactNode }) {
        super(props);
        this.state = { hasError: false };
    }
    static getDerivedStateFromError(error: Error): EBState {
        return { hasError: true, error };
    }
    render() {
        if (this.state.hasError) {
            return (
                <div className="flex flex-col items-center justify-center h-[calc(100vh-100px)] gap-6 p-8">
                    <div className="text-5xl">⚠️</div>
                    <h2 className="text-xl font-bold text-secondary-800">Dashboard Error</h2>
                    <p className="text-secondary-500 text-sm max-w-sm text-center">
                        {this.state.error?.message || 'An unexpected error occurred while loading this dashboard.'}
                    </p>
                    <button
                        onClick={() => this.setState({ hasError: false })}
                        className="px-5 py-2 bg-primary-600 text-white rounded-lg text-sm font-semibold hover:bg-primary-700 transition-colors"
                    >
                        Retry
                    </button>
                </div>
            );
        }
        return this.props.children;
    }
}

// Route guard — redirects to /login if no active session
const ProtectedRoute = ({ children }: { children: ReactNode }) => {
    const isAuth = !!sessionStorage.getItem('finflux_role');
    return isAuth ? <>{children}</> : <Navigate to="/login" replace />;
};

function App() {
    return (
        <BrowserRouter>
            <ErrorBoundary>
                <Suspense fallback={<LoadingFallback />}>
                    <Routes>

                        {/* Login — public entry point */}
                        <Route path="/login" element={<Login />} />

                        {/* Persona Landing Page — protected, shown after login */}
                        <Route path="/" element={<ProtectedRoute><LandingPage /></ProtectedRoute>} />

                        {/* Dashboard routes — all protected */}
                        <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
                            <Route path="home" element={<HomeDashboard />} />
                            <Route path="trends" element={<TrendsDashboard />} />
                            <Route path="financial" element={<Navigate to="/portfolio" replace />} />
                            <Route path="financials" element={<Navigate to="/portfolio" replace />} />
                            <Route path="collections" element={<CollectionsDashboard />} />
                            <Route path="portfolio" element={<PortfolioDashboard />} />
                            <Route path="audit" element={<Navigate to="/portfolio" replace />} />
                            <Route path="origination" element={<OriginationDashboard />} />
                            <Route path="branch" element={<BranchDashboard />} />
                            <Route path="centre" element={<CentreDashboard />} />
                            <Route path="products" element={<ProductDashboard />} />
                            <Route path="geo" element={<GeoDashboard />} />
                            <Route path="admin" element={<AdminPanel />} />
                            <Route path="alerts" element={<AlertsDashboard />} />
                            <Route path="scheduler" element={<SmartSchedulerPage />} />
                        </Route>

                        {/* Catch-all → login */}
                        <Route path="*" element={<Navigate to="/login" replace />} />
                    </Routes>
                </Suspense>
            </ErrorBoundary>
        </BrowserRouter>
    );
}

export default App;
