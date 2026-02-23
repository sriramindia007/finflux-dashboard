import { useNavigate, useLocation, Outlet, NavLink } from 'react-router-dom';
import { LayoutDashboard, Map, TrendingUp, Menu, Building2, Package, FileText, Users, ShieldAlert, Banknote, LogOut, Shield, Bell, X, Calendar } from 'lucide-react';
import { cn } from '../lib/utils';
import { useState, useRef, useEffect } from 'react';

const Layout = () => {
    // Default open on desktop, closed on mobile? 
    // We'll trust the user to toggle, but defaulting to true is fine for desktop.
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
    const [notificationsOpen, setNotificationsOpen] = useState(false);
    const navigate = useNavigate();
    const location = useLocation();

    // Handle Resize
    useEffect(() => { // Changed from useState to useEffect for side effect
        const handleResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []); // Empty dependency array to run once on mount

    // Scroll To Top Logic
    const scrollRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTo(0, 0);
        }
    }, [location.pathname]);

    const allNavItems = [
        { id: 'home', path: '/home', icon: LayoutDashboard, label: 'Executive Dashboard' },
        { id: 'trends', path: '/trends', icon: TrendingUp, label: 'Performance Trends' },
        { id: 'collections', path: '/collections', icon: Banknote, label: 'Collections & Recovery' },
        { id: 'portfolio', path: '/portfolio', icon: ShieldAlert, label: 'Risk & Portfolio' },
        { id: 'origination', path: '/origination', icon: FileText, label: 'Loans Origination' },
        { id: 'branch', path: '/branch', icon: Building2, label: 'Branch View' },
        { id: 'centre', path: '/centre', icon: Users, label: 'Centre & Workforce' },
        { id: 'products', path: '/products', icon: Package, label: 'Product Analytics' },
        { id: 'geo', path: '/geo', icon: Map, label: 'Geo Drill' },
        { id: 'scheduler', path: '/scheduler', icon: Calendar, label: 'Smart Scheduler' },
    ];

    const isSchedulerMode = import.meta.env.VITE_APP_MODE === 'scheduler' || window.location.hostname === 'finflux.vercel.app' || window.location.hostname.includes('maxp');

    const allowedIdsStr = sessionStorage.getItem('finflux_allowed_dashboards');
    const allowedIds: string[] | null = allowedIdsStr ? JSON.parse(allowedIdsStr) : null;

    let navItems = allowedIds
        ? allNavItems.filter(item => allowedIds.includes(item.id))
        : allNavItems;

    // Overwrite nav items completely if running in dedicated scheduler mode
    if (isSchedulerMode) {
        navItems = [{ id: 'scheduler', path: '/scheduler', icon: Calendar, label: 'Smart Scheduler' }];
    }

    const currentRole = sessionStorage.getItem('finflux_role');
    const isAdmin = currentRole === 'admin';

    const adminItems = isAdmin ? [
        { path: '/alerts', icon: Bell, label: 'Alerts Configuration' },
        { path: '/admin', icon: Shield, label: 'Admin Panel' },
    ] : [
        { path: '/alerts', icon: Bell, label: 'My Alerts' }
    ];

    return (
        <div className="flex h-screen bg-secondary-50 text-secondary-900 overflow-hidden relative">

            {/* Mobile Overlay */}
            {isMobile && sidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-30 transition-opacity"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            {/* Sidebar */}
            <aside
                className={cn(
                    "bg-white border-r border-secondary-200 transition-all duration-300 flex flex-col z-40",
                    isMobile ? "fixed inset-y-0 left-0 h-full shadow-xl" : "relative",
                    sidebarOpen ? "w-64" : (isMobile ? "w-0 -translate-x-full" : "w-20"), // On mobile: 0 width/translate if closed
                    isMobile && !sidebarOpen && "-translate-x-full" // Extra safety for mobile hide
                )}
            >
                <div className="p-4 border-b border-secondary-200 flex items-center justify-between h-16 shrink-0">
                    {sidebarOpen ? (
                        <div className="font-bold text-xl text-primary-600 tracking-tight">FINFLUX</div>
                    ) : (
                        <div className="text-xl font-bold text-primary-600 mx-auto">F</div>
                    )}

                    {/* Only show toggle on desktop or if open on mobile */}
                    <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-1 hover:bg-secondary-100 rounded-md text-secondary-500">
                        <Menu size={20} />
                    </button>
                </div>

                <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
                    {navItems.map((item) => (
                        <NavLink
                            key={item.path}
                            to={item.path}
                            onClick={() => isMobile && setSidebarOpen(false)}
                            className={({ isActive }) => cn(
                                "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group whitespace-nowrap",
                                isActive
                                    ? "bg-primary-50 text-primary-700 shadow-sm ring-1 ring-primary-200/50"
                                    : "text-secondary-600 hover:bg-secondary-100 hover:text-secondary-900"
                            )}
                        >
                            <item.icon size={22} className={cn("shrink-0 transition-colors", location.pathname === item.path ? "text-primary-600" : "text-secondary-400 group-hover:text-secondary-600")} />
                            {sidebarOpen && <span className="font-medium">{item.label}</span>}
                        </NavLink>
                    ))}

                    {/* Admin section separator */}
                    <div className={cn("pt-3 pb-1", sidebarOpen ? "border-t border-secondary-100 mt-2" : "")}>
                        {sidebarOpen && <div className="text-[10px] font-bold text-secondary-400 uppercase tracking-widest px-3 mb-1">{isAdmin ? 'Admin' : 'Monitoring'}</div>}
                        {adminItems.map((item) => (
                            <NavLink
                                key={item.path}
                                to={item.path}
                                onClick={() => isMobile && setSidebarOpen(false)}
                                className={({ isActive }) => cn(
                                    "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group whitespace-nowrap",
                                    isActive
                                        ? "bg-amber-50 text-amber-700 shadow-sm ring-1 ring-amber-200/50"
                                        : "text-secondary-600 hover:bg-secondary-100 hover:text-secondary-900"
                                )}
                            >
                                <item.icon size={20} className={cn("shrink-0 transition-colors", location.pathname === item.path ? "text-amber-500" : "text-secondary-400 group-hover:text-secondary-600")} />
                                {sidebarOpen && <span className="font-medium">{item.label}</span>}
                            </NavLink>
                        ))}
                    </div>
                </nav>

                {/* Logout Button */}
                <div className="p-4 border-t border-secondary-200 shrink-0">
                    <button
                        onClick={() => {
                            sessionStorage.clear();
                            navigate('/login');
                        }}
                        className={cn(
                            "flex items-center gap-3 px-3 py-2.5 rounded-lg w-full transition-all duration-200 text-secondary-500 hover:bg-rose-50 hover:text-rose-700",
                        )}
                    >
                        <LogOut size={18} className="shrink-0" />
                        {sidebarOpen && <span className="font-medium text-sm">Sign Out</span>}
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
                {/* Header */}
                <header className="h-16 bg-white border-b border-secondary-200 flex items-center justify-between px-4 sm:px-6 shrink-0 gap-4">
                    <div className="flex items-center gap-3">
                        {/* Mobile Menu Button (Visible only when sidebar closed on mobile) */}
                        {isMobile && !sidebarOpen && (
                            <button onClick={() => setSidebarOpen(true)} className="p-2 -ml-2 text-secondary-600 hover:bg-secondary-100 rounded-lg">
                                <Menu size={20} />
                            </button>
                        )}
                        <h1 className="text-lg font-semibold text-secondary-800 truncate">
                            {navItems.find(i => i.path === location.pathname)?.label || 'Dashboard'}
                        </h1>
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => navigate('/')}
                            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition-colors"
                        >
                            ← Personas
                        </button>
                        <button
                            onClick={() => {
                                sessionStorage.clear();
                                navigate('/login');
                            }}
                            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-rose-500 hover:bg-rose-600 rounded-lg shadow-sm transition-colors"
                        >
                            <LogOut size={12} /> Sign Out
                        </button>
                        <div className="text-sm text-right hidden md:block">
                            <div className="font-semibold text-secondary-800">FINFLUX Analytics</div>
                            <div className="text-xs text-secondary-500">FY 2025-26 · {new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
                        </div>
                        <div className="hidden sm:flex items-center gap-1 bg-primary-50 border border-primary-200 text-primary-700 text-xs font-bold px-2 py-1 rounded-full uppercase">
                            <span>{currentRole ? (currentRole === 'analyst' ? '📊' : '👤') : '📊'}</span> {currentRole || 'FY26 Report'}
                        </div>

                        {/* Notifications Bell */}
                        <div className="relative">
                            <button
                                onClick={() => setNotificationsOpen(!notificationsOpen)}
                                className="relative p-2 text-secondary-500 hover:bg-secondary-100 rounded-full transition-colors"
                            >
                                <Bell size={18} />
                                {/* Notification Badge */}
                                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full border-2 border-white"></span>
                            </button>

                            {/* Notifications Dropdown Panel */}
                            {notificationsOpen && (
                                <>
                                    <div className="fixed inset-0 z-40" onClick={() => setNotificationsOpen(false)} />
                                    <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-white border border-secondary-200 rounded-xl shadow-2xl z-50 overflow-hidden flex flex-col">
                                        <div className="p-4 border-b border-secondary-100 flex items-center justify-between bg-secondary-50">
                                            <div>
                                                <h3 className="font-bold text-secondary-900">Notifications</h3>
                                                <p className="text-xs text-secondary-500">2 unread alerts</p>
                                            </div>
                                            <button onClick={() => setNotificationsOpen(false)} className="text-secondary-400 hover:text-secondary-600">
                                                <X size={16} />
                                            </button>
                                        </div>
                                        <div className="overflow-y-auto max-h-[300px]">
                                            <div className="p-4 border-b border-secondary-100 bg-rose-50/50 hover:bg-rose-50 cursor-pointer transition-colors">
                                                <div className="flex justify-between items-start mb-1">
                                                    <span className="text-xs font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded-full border border-rose-200">Critical • Risk</span>
                                                    <span className="text-[10px] text-secondary-400">2h ago</span>
                                                </div>
                                                <div className="text-sm font-semibold text-secondary-800">PAR 30+ Threshold Exceeded</div>
                                                <div className="text-xs text-secondary-500 mt-1">Current value 1.97% exceeds 2.5% safe boundary. Recommended immediate review.</div>
                                            </div>
                                            <div className="p-4 border-b border-secondary-100 bg-orange-50/50 hover:bg-orange-50 cursor-pointer transition-colors">
                                                <div className="flex justify-between items-start mb-1">
                                                    <span className="text-xs font-bold text-orange-700 bg-orange-100 px-2 py-0.5 rounded-full border border-orange-200">High • Origination</span>
                                                    <span className="text-[10px] text-secondary-400">12h ago</span>
                                                </div>
                                                <div className="text-sm font-semibold text-secondary-800">Branch PAR 30+ Outlier Flagged</div>
                                                <div className="text-xs text-secondary-500 mt-1">Varanasi Cantonment Branch reporting 6.1%.</div>
                                            </div>
                                            <div className="p-4 border-b border-secondary-100 hover:bg-secondary-50 cursor-pointer transition-colors">
                                                <div className="flex justify-between items-start mb-1">
                                                    <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-200">Resolved • Finance</span>
                                                    <span className="text-[10px] text-secondary-400">1d ago</span>
                                                </div>
                                                <div className="text-sm font-semibold text-secondary-800">Collection Efficiency Target Met</div>
                                                <div className="text-xs text-secondary-500 mt-1">Recovered to 95.8%. Alert closed.</div>
                                            </div>
                                        </div>
                                        <div className="p-3 border-t border-secondary-100 bg-white text-center">
                                            <button onClick={() => { setNotificationsOpen(false); navigate('/alerts'); }} className="text-xs font-bold text-indigo-600 hover:text-indigo-800">
                                                View All Alerts in Dashboard
                                            </button>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>

                        <div className="w-8 h-8 sm:w-9 sm:h-9 bg-primary-600 text-white rounded-full flex items-center justify-center font-bold text-sm shadow-sm uppercase shrink-0">
                            {currentRole ? currentRole.substring(0, 2) : 'SR'}
                        </div>
                    </div>
                </header>

                {/* Content Scroll Area */}
                <div ref={scrollRef} className="flex-1 overflow-auto p-4 sm:p-6 scroll-smooth">
                    <Outlet />
                </div>
            </main>
        </div>
    );
};

export default Layout;
