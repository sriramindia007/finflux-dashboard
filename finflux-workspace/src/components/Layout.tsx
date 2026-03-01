import { useNavigate, useLocation, Outlet, NavLink } from 'react-router-dom';
import { LayoutDashboard, Map, TrendingUp, Menu, Building2, Package, FileText, Users, ShieldAlert, Banknote, LogOut, Shield, Bell, X, Calendar, MoreHorizontal } from 'lucide-react';
import { cn } from '../lib/utils';
import { useState, useRef, useEffect } from 'react';

const Layout = () => {
    const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth >= 768);
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
    const [notificationsOpen, setNotificationsOpen] = useState(false);
    const navigate = useNavigate();
    const location = useLocation();

    useEffect(() => {
        const handleResize = () => {
            const mobile = window.innerWidth < 768;
            setIsMobile(mobile);
            if (!mobile) setSidebarOpen(true);
            else setSidebarOpen(false);
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Close sidebar on mobile when route changes
    useEffect(() => {
        if (isMobile) setSidebarOpen(false);
    }, [location.pathname]);

    const scrollRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (scrollRef.current) scrollRef.current.scrollTo(0, 0);
    }, [location.pathname]);

    const allNavItems = [
        { id: 'home', path: '/home', icon: LayoutDashboard, label: 'Executive Dashboard', shortLabel: 'Home' },
        { id: 'trends', path: '/trends', icon: TrendingUp, label: 'Performance Trends', shortLabel: 'Trends' },
        { id: 'collections', path: '/collections', icon: Banknote, label: 'Collections & Recovery', shortLabel: 'Collections' },
        { id: 'portfolio', path: '/portfolio', icon: ShieldAlert, label: 'Risk & Portfolio', shortLabel: 'Portfolio' },
        { id: 'origination', path: '/origination', icon: FileText, label: 'Loans Origination', shortLabel: 'Origination' },
        { id: 'branch', path: '/branch', icon: Building2, label: 'Branch View', shortLabel: 'Branch' },
        { id: 'centre', path: '/centre', icon: Users, label: 'Centre & Workforce', shortLabel: 'Centre' },
        { id: 'products', path: '/products', icon: Package, label: 'Product Analytics', shortLabel: 'Products' },
        { id: 'geo', path: '/geo', icon: Map, label: 'Geo Drill', shortLabel: 'Geo' },
        { id: 'scheduler', path: '/scheduler', icon: Calendar, label: 'Smart Scheduler', shortLabel: 'Scheduler' },
    ];

    const isSchedulerMode = import.meta.env.VITE_APP_MODE === 'scheduler' || window.location.hostname === 'finflux.vercel.app' || window.location.hostname.includes('maxp');

    const allowedIdsStr = sessionStorage.getItem('finflux_allowed_dashboards');
    const allowedIds: string[] | null = allowedIdsStr ? JSON.parse(allowedIdsStr) : null;

    let navItems = allowedIds
        ? allNavItems.filter(item => allowedIds.includes(item.id))
        : allNavItems;

    if (isSchedulerMode) {
        navItems = [{ id: 'scheduler', path: '/scheduler', icon: Calendar, label: 'Smart Scheduler', shortLabel: 'Scheduler' }];
    }

    const currentRole = sessionStorage.getItem('finflux_role');
    const isAdmin = currentRole === 'admin';

    const adminItems = isAdmin ? [
        { path: '/alerts', icon: Bell, label: 'Alerts Configuration', shortLabel: 'Alerts' },
        { path: '/admin', icon: Shield, label: 'Admin Panel', shortLabel: 'Admin' },
    ] : [
        { path: '/alerts', icon: Bell, label: 'My Alerts', shortLabel: 'Alerts' }
    ];

    const allBottomItems = [...navItems, ...adminItems];
    // Show 4 items + "More" button on mobile bottom nav
    const BOTTOM_NAV_MAX = 4;
    const bottomNavItems = allBottomItems.slice(0, BOTTOM_NAV_MAX);
    const hasMore = allBottomItems.length > BOTTOM_NAV_MAX;

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
                    sidebarOpen ? "w-64" : (isMobile ? "w-0 -translate-x-full" : "w-20"),
                    isMobile && !sidebarOpen && "-translate-x-full"
                )}
            >
                <div className="p-4 border-b border-secondary-200 flex items-center justify-between h-16 shrink-0">
                    {sidebarOpen ? (
                        <div className="font-bold text-xl text-primary-600 tracking-tight">FINFLUX</div>
                    ) : (
                        <div className="text-xl font-bold text-primary-600 mx-auto">F</div>
                    )}
                    <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-1 hover:bg-secondary-100 rounded-md text-secondary-500">
                        <Menu size={20} />
                    </button>
                </div>

                <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
                    {navItems.map((item) => (
                        <NavLink
                            key={item.path}
                            to={item.path}
                            className={({ isActive }) => cn(
                                "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group whitespace-nowrap",
                                isActive
                                    ? "bg-primary-50 text-primary-700 shadow-sm ring-1 ring-primary-200/50"
                                    : "text-secondary-600 hover:bg-secondary-100 hover:text-secondary-900"
                            )}
                        >
                            <item.icon size={20} className={cn("shrink-0 transition-colors", location.pathname === item.path ? "text-primary-600" : "text-secondary-400 group-hover:text-secondary-600")} />
                            {sidebarOpen && <span className="font-medium text-sm">{item.label}</span>}
                        </NavLink>
                    ))}

                    <div className={cn("pt-3 pb-1", sidebarOpen ? "border-t border-secondary-100 mt-2" : "")}>
                        {sidebarOpen && <div className="text-[10px] font-bold text-secondary-400 uppercase tracking-widest px-3 mb-1">{isAdmin ? 'Admin' : 'Monitoring'}</div>}
                        {adminItems.map((item) => (
                            <NavLink
                                key={item.path}
                                to={item.path}
                                className={({ isActive }) => cn(
                                    "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group whitespace-nowrap",
                                    isActive
                                        ? "bg-amber-50 text-amber-700 shadow-sm ring-1 ring-amber-200/50"
                                        : "text-secondary-600 hover:bg-secondary-100 hover:text-secondary-900"
                                )}
                            >
                                <item.icon size={20} className={cn("shrink-0 transition-colors", location.pathname === item.path ? "text-amber-500" : "text-secondary-400 group-hover:text-secondary-600")} />
                                {sidebarOpen && <span className="font-medium text-sm">{item.label}</span>}
                            </NavLink>
                        ))}
                    </div>
                </nav>

                <div className="p-4 border-t border-secondary-200 shrink-0">
                    <button
                        onClick={() => { sessionStorage.clear(); window.location.href = '/login'; }}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-lg w-full transition-all duration-200 text-secondary-500 hover:bg-rose-50 hover:text-rose-700"
                    >
                        <LogOut size={18} className="shrink-0" />
                        {sidebarOpen && <span className="font-medium text-sm">Sign Out</span>}
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
                {/* Header */}
                <header className="h-14 md:h-16 bg-white border-b border-secondary-200 flex items-center justify-between px-3 sm:px-6 shrink-0 gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                        {isMobile && (
                            <button onClick={() => setSidebarOpen(true)} className="p-2 -ml-1 text-secondary-600 hover:bg-secondary-100 rounded-lg shrink-0">
                                <Menu size={20} />
                            </button>
                        )}
                        {!isMobile && !sidebarOpen && (
                            <button onClick={() => setSidebarOpen(true)} className="p-2 -ml-1 text-secondary-600 hover:bg-secondary-100 rounded-lg shrink-0">
                                <Menu size={20} />
                            </button>
                        )}
                        <h1 className="text-sm sm:text-base md:text-lg font-semibold text-secondary-800 truncate">
                            {[...navItems, ...adminItems].find(i => i.path === location.pathname)?.label || 'Dashboard'}
                        </h1>
                    </div>

                    <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
                        <button
                            onClick={() => navigate('/')}
                            className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition-colors"
                        >
                            ← Personas
                        </button>
                        <button
                            onClick={() => { sessionStorage.clear(); window.location.href = '/login'; }}
                            className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-bold text-white bg-rose-500 hover:bg-rose-600 rounded-lg shadow-sm transition-colors"
                        >
                            <LogOut size={12} /> Sign Out
                        </button>
                        <div className="text-xs text-right hidden lg:block">
                            <div className="font-semibold text-secondary-800">FINFLUX Analytics</div>
                            <div className="text-[10px] text-secondary-500">FY 2025-26 · {new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
                        </div>
                        <div className="hidden sm:flex items-center gap-1 bg-primary-50 border border-primary-200 text-primary-700 text-[11px] font-bold px-2 py-1 rounded-full uppercase">
                            <span>{currentRole ? (currentRole === 'analyst' ? '📊' : '👤') : '📊'}</span>
                            <span className="hidden md:inline">{currentRole || 'FY26'}</span>
                        </div>

                        {/* Notifications Bell */}
                        <div className="relative">
                            <button
                                onClick={() => setNotificationsOpen(!notificationsOpen)}
                                className="relative p-2 text-secondary-500 hover:bg-secondary-100 rounded-full transition-colors"
                            >
                                <Bell size={18} />
                                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full border-2 border-white"></span>
                            </button>

                            {notificationsOpen && (
                                <>
                                    <div className="fixed inset-0 z-40" onClick={() => setNotificationsOpen(false)} />
                                    <div className="absolute right-0 top-full mt-2 w-72 sm:w-96 bg-white border border-secondary-200 rounded-xl shadow-2xl z-50 overflow-hidden flex flex-col">
                                        <div className="p-3 sm:p-4 border-b border-secondary-100 flex items-center justify-between bg-secondary-50">
                                            <div>
                                                <h3 className="font-bold text-secondary-900 text-sm sm:text-base">Notifications</h3>
                                                <p className="text-xs text-secondary-500">2 unread alerts</p>
                                            </div>
                                            <button onClick={() => setNotificationsOpen(false)} className="text-secondary-400 hover:text-secondary-600 p-1">
                                                <X size={16} />
                                            </button>
                                        </div>
                                        <div className="overflow-y-auto max-h-[60vh]">
                                            <div className="p-3 border-b border-secondary-100 bg-rose-50/50 hover:bg-rose-50 cursor-pointer transition-colors">
                                                <div className="flex justify-between items-start mb-1">
                                                    <span className="text-xs font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded-full border border-rose-200">Critical • Risk</span>
                                                    <span className="text-[10px] text-secondary-400">2h ago</span>
                                                </div>
                                                <div className="text-sm font-semibold text-secondary-800">PAR 30+ Threshold Exceeded</div>
                                                <div className="text-xs text-secondary-500 mt-1">Current value 1.97% exceeds 2.5% safe boundary. Recommended immediate review.</div>
                                            </div>
                                            <div className="p-3 border-b border-secondary-100 bg-orange-50/50 hover:bg-orange-50 cursor-pointer transition-colors">
                                                <div className="flex justify-between items-start mb-1">
                                                    <span className="text-xs font-bold text-orange-700 bg-orange-100 px-2 py-0.5 rounded-full border border-orange-200">High • Origination</span>
                                                    <span className="text-[10px] text-secondary-400">12h ago</span>
                                                </div>
                                                <div className="text-sm font-semibold text-secondary-800">Branch PAR 30+ Outlier Flagged</div>
                                                <div className="text-xs text-secondary-500 mt-1">Varanasi Cantonment Branch reporting 6.1%.</div>
                                            </div>
                                            <div className="p-3 border-b border-secondary-100 hover:bg-secondary-50 cursor-pointer transition-colors">
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

                        <div className="w-8 h-8 bg-primary-600 text-white rounded-full flex items-center justify-center font-bold text-sm shadow-sm uppercase shrink-0">
                            {currentRole ? currentRole.substring(0, 2) : 'SR'}
                        </div>
                    </div>
                </header>

                {/* Content Scroll Area — extra bottom padding on mobile for bottom nav */}
                <div ref={scrollRef} className="flex-1 overflow-auto p-3 sm:p-4 md:p-6 pb-20 md:pb-6 scroll-smooth">
                    <Outlet />
                </div>
            </main>

            {/* ── Mobile Bottom Navigation Bar ── */}
            {isMobile && (
                <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-secondary-200 shadow-[0_-2px_12px_rgba(0,0,0,0.08)] flex items-stretch"
                    style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
                    {bottomNavItems.map((item) => {
                        const isActive = location.pathname === item.path;
                        return (
                            <NavLink
                                key={item.path}
                                to={item.path}
                                className={cn(
                                    "flex-1 flex flex-col items-center justify-center gap-0.5 py-2 px-0.5 min-h-[56px] transition-all",
                                    isActive
                                        ? "text-primary-600"
                                        : "text-secondary-400"
                                )}
                            >
                                <div className={cn(
                                    "rounded-xl px-3 py-1 transition-all",
                                    isActive ? "bg-primary-100" : ""
                                )}>
                                    <item.icon size={20} />
                                </div>
                                <span className="text-[9px] font-semibold leading-none text-center">
                                    {(item as any).shortLabel || item.label.split(' ')[0]}
                                </span>
                            </NavLink>
                        );
                    })}
                    {hasMore && (
                        <button
                            onClick={() => setSidebarOpen(true)}
                            className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2 px-0.5 min-h-[56px] text-secondary-400"
                        >
                            <div className="rounded-xl px-3 py-1">
                                <MoreHorizontal size={20} />
                            </div>
                            <span className="text-[9px] font-semibold leading-none">More</span>
                        </button>
                    )}
                </nav>
            )}
        </div>
    );
};

export default Layout;
