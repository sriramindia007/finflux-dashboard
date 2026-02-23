import { useNavigate } from 'react-router-dom';
import {
    LayoutDashboard, TrendingUp, Banknote, ShieldAlert, FileText,
    Building2, Users, Package, Map, ArrowRight, ChevronRight, Bell, LogOut
} from 'lucide-react';

const DASH_ICONS: Record<string, React.ElementType> = {
    home: LayoutDashboard,
    trends: TrendingUp,
    collections: Banknote,
    portfolio: ShieldAlert,
    origination: FileText,
    branch: Building2,
    centre: Users,
    products: Package,
    geo: Map,
    admin: ShieldAlert,
    alerts: Bell,
};

interface Persona {
    id: string;
    title: string;
    subtitle: string;
    initial: string;
    color: string;
    ring: string;
    activeBg: string;
    tag: string;
    tagBg: string;
    dashboards: { id: string; label: string }[];
}

const PERSONAS: Persona[] = [
    {
        id: 'ceo', title: 'CEO / C-Suite', subtitle: 'Strategic overview & enterprise KPIs',
        initial: 'CE', color: 'text-violet-700', ring: 'ring-violet-200',
        activeBg: 'bg-violet-50', tag: 'Executive', tagBg: 'bg-violet-100 text-violet-700',
        dashboards: [
            { id: 'home', label: 'Executive Dashboard' },
            { id: 'trends', label: 'Performance Trends' },
            { id: 'portfolio', label: 'Risk & Portfolio' },
            { id: 'geo', label: 'Geo Drill' },
        ],
    },
    {
        id: 'cfo', title: 'CFO / Finance Head', subtitle: 'Financials, cash flow & yields',
        initial: 'CF', color: 'text-teal-700', ring: 'ring-teal-200',
        activeBg: 'bg-teal-50', tag: 'Finance', tagBg: 'bg-teal-100 text-teal-700',
        dashboards: [
            { id: 'home', label: 'Executive Dashboard' },
            { id: 'trends', label: 'Performance Trends' },
            { id: 'portfolio', label: 'Risk & Portfolio' },
            { id: 'collections', label: 'Collections & Recovery' },
            { id: 'products', label: 'Product Analytics' },
        ],
    },
    {
        id: 'ops', title: 'Operations & Sales Head', subtitle: 'Field targets, disbursements & recovery',
        initial: 'OP', color: 'text-amber-700', ring: 'ring-amber-200',
        activeBg: 'bg-amber-50', tag: 'Operations', tagBg: 'bg-amber-100 text-amber-700',
        dashboards: [
            { id: 'collections', label: 'Collections & Recovery' },
            { id: 'origination', label: 'Loans Origination' },
            { id: 'branch', label: 'Branch View' },
            { id: 'centre', label: 'Centre & Workforce' },
            { id: 'geo', label: 'Geo Drill' },
        ],
    },
    {
        id: 'risk', title: 'Chief Risk Officer', subtitle: 'Systemic risk, PAR & audit controls',
        initial: 'RO', color: 'text-rose-700', ring: 'ring-rose-200',
        activeBg: 'bg-rose-50', tag: 'Risk', tagBg: 'bg-rose-100 text-rose-700',
        dashboards: [
            { id: 'portfolio', label: 'Risk & Portfolio' },
            { id: 'trends', label: 'Performance Trends' },
            { id: 'collections', label: 'Collections & Recovery' },
            { id: 'geo', label: 'Geo Drill' },
        ],
    },
    {
        id: 'branch', title: 'Branch / Regional Manager', subtitle: 'Local targets & staff performance',
        initial: 'BM', color: 'text-blue-700', ring: 'ring-blue-200',
        activeBg: 'bg-blue-50', tag: 'Branch Ops', tagBg: 'bg-blue-100 text-blue-700',
        dashboards: [
            { id: 'branch', label: 'Branch View' },
            { id: 'centre', label: 'Centre & Workforce' },
            { id: 'collections', label: 'Collections & Recovery' },
            { id: 'origination', label: 'Loans Origination' },
            { id: 'geo', label: 'Geo Drill' },
            { id: 'alerts', label: 'Alerts & Notifications' },
        ],
    },
    {
        id: 'admin', title: 'System Administrator', subtitle: 'Manage users, roles & system alerts',
        initial: 'SA', color: 'text-indigo-700', ring: 'ring-indigo-200',
        activeBg: 'bg-indigo-50', tag: 'Admin', tagBg: 'bg-indigo-100 text-indigo-700',
        dashboards: [
            { id: 'admin', label: 'Admin Panel' },
            { id: 'alerts', label: 'Alerts Configuration' },
        ],
    },
];

/**
 * Controls which persona cards each role can see on the landing page.
 * - bm / area_manager → only the Branch persona (branch filter controls depth)
 * - admin             → all personas
 * - no entry / null   → show all (fallback for legacy persona-click sessions)
 */
const ROLE_TO_PERSONAS: Record<string, string[]> = {
    admin:        ['ceo', 'cfo', 'ops', 'risk', 'branch', 'admin'],
    bm:           ['branch'],
    area_manager: ['branch'],
    analyst:      ['ceo', 'cfo', 'ops', 'risk'],
};

export default function LandingPage() {
    const navigate = useNavigate();
    const today = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

    // Read logged-in user info from sessionStorage
    const userName = sessionStorage.getItem('finflux_user_name') || '';
    const userRole = sessionStorage.getItem('finflux_role') || '';
    const allowedDashboardsRaw = sessionStorage.getItem('finflux_allowed_dashboards');
    const allowedDashboards: string[] | null = allowedDashboardsRaw ? JSON.parse(allowedDashboardsRaw) : null;

    // Show only the personas explicitly mapped to this role.
    // Falls back to all personas when role has no explicit mapping (e.g. legacy persona-click).
    const allowedPersonaIds = ROLE_TO_PERSONAS[userRole] ?? null;
    const visiblePersonas = allowedPersonaIds
        ? PERSONAS.filter(p => allowedPersonaIds.includes(p.id))
        : PERSONAS;

    const handleLogout = () => {
        sessionStorage.clear();
        navigate('/login');
    };

    const initials = userName
        ? userName.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
        : userRole.substring(0, 2).toUpperCase();

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>

            {/* Top Bar */}
            <header className="bg-white border-b border-slate-200 px-8 py-4 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-black text-sm">F</div>
                    <div>
                        <span className="text-slate-900 font-bold text-base tracking-tight">FINFLUX</span>
                        <span className="text-slate-400 text-sm ml-2">Analytics Platform</span>
                    </div>
                </div>
                <div className="flex items-center gap-4 text-sm text-slate-500">
                    <span className="hidden sm:inline">FY 2025-26</span>
                    <span className="hidden sm:inline text-slate-300">|</span>
                    <span>{today}</span>
                    {userName && (
                        <span className="hidden sm:inline text-slate-700 font-medium">{userName}</span>
                    )}
                    <div className="w-8 h-8 bg-indigo-600 text-white rounded-full flex items-center justify-center font-bold text-xs">
                        {initials}
                    </div>
                    {/* Logout */}
                    <button
                        onClick={handleLogout}
                        className="flex items-center gap-1.5 text-slate-500 hover:text-rose-600 transition-colors text-xs font-medium"
                        title="Sign Out"
                    >
                        <LogOut size={15} />
                        <span className="hidden sm:inline">Sign Out</span>
                    </button>
                </div>
            </header>

            {/* Hero Section */}
            <div className="bg-white border-b border-slate-200 px-8 py-10 text-center">
                <div className="inline-flex items-center gap-2 bg-indigo-50 border border-indigo-100 text-indigo-600 text-xs font-semibold px-3 py-1.5 rounded-full mb-5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    Live · FY 2025-26 Reporting Period
                </div>
                <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight mb-3">
                    Welcome{userName ? `, ${userName.split(' ')[0]}` : ''} to FINFLUX Analytics
                </h1>
                <p className="text-slate-500 text-base max-w-lg mx-auto leading-relaxed">
                    Select your role below to access your personalised set of dashboards and insights.
                </p>
            </div>

            {/* Persona Grid */}
            <div className="flex-1 px-6 sm:px-10 py-8 max-w-7xl mx-auto w-full">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {visiblePersonas.map(p => (
                        <PersonaCard key={p.id} persona={p} onNavigate={navigate} allowedDashboards={allowedDashboards} />
                    ))}
                </div>
            </div>

            {/* Footer */}
            <footer className="bg-white border-t border-slate-200 px-8 py-4 flex items-center justify-between text-xs text-slate-400">
                <span>FINFLUX Analytics</span>
                <span>Confidential — For Internal Use Only</span>
            </footer>
        </div>
    );
}

function PersonaCard({
    persona: p,
    onNavigate,
    allowedDashboards,
}: {
    persona: Persona;
    onNavigate: (path: string) => void;
    allowedDashboards: string[] | null;
}) {
    // Filter this persona's dashboard list to only what the user is allowed to see
    const visibleDashboards = allowedDashboards
        ? p.dashboards.filter(d => allowedDashboards.includes(d.id))
        : p.dashboards;

    const primaryPath = `/${visibleDashboards[0]?.id ?? p.dashboards[0].id}`;
    const shown = visibleDashboards.slice(0, 4);
    const extra = visibleDashboards.length - shown.length;

    const handleNavigate = (e: React.MouseEvent, path: string) => {
        e.stopPropagation();
        // Update allowed dashboards in sessionStorage to reflect the chosen persona
        // (only restrict further if a branchFilter is active; otherwise use persona's dashboards)
        const hasBranchFilter = !!sessionStorage.getItem('finflux_branch_filter');
        if (!hasBranchFilter) {
            // Normal admin/full-access user — update allowed list to persona's dashboards
            sessionStorage.setItem('finflux_allowed_dashboards', JSON.stringify(p.dashboards.map(d => d.id)));
        }
        // If branchFilter is set, keep the already-restricted allowed dashboards
        onNavigate(path);
    };

    return (
        <div
            className="group bg-white rounded-xl border border-slate-200 hover:border-slate-300 hover:shadow-md transition-all duration-200 cursor-pointer overflow-hidden"
            onClick={(e) => handleNavigate(e, primaryPath)}
        >
            {/* Card Header */}
            <div className="p-5 border-b border-slate-100">
                <div className="flex items-start justify-between mb-3">
                    <div className={`w-10 h-10 rounded-xl ring-2 ${p.ring} ${p.activeBg} flex items-center justify-center font-bold text-sm ${p.color}`}>
                        {p.initial}
                    </div>
                    <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${p.tagBg}`}>{p.tag}</span>
                </div>
                <h2 className="text-slate-900 font-bold text-base leading-tight">{p.title}</h2>
                <p className="text-slate-400 text-xs mt-1">{p.subtitle}</p>
            </div>

            {/* Dashboard List */}
            <div className="p-4 space-y-1">
                {shown.map(d => {
                    const Icon = DASH_ICONS[d.id] ?? LayoutDashboard;
                    return (
                        <button
                            key={d.id}
                            onClick={e => handleNavigate(e, `/${d.id}`)}
                            className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-left hover:bg-slate-50 group/item transition-colors"
                        >
                            <div className="flex items-center gap-2">
                                <Icon size={13} className="text-slate-400 group-hover/item:text-slate-600 shrink-0" />
                                <span className="text-slate-600 text-xs font-medium group-hover/item:text-slate-900">{d.label}</span>
                            </div>
                            <ChevronRight size={12} className="text-slate-300 group-hover/item:text-slate-500 shrink-0" />
                        </button>
                    );
                })}
                {extra > 0 && (
                    <div className="text-[11px] text-slate-400 text-center pt-1">+{extra} more</div>
                )}
            </div>

            {/* CTA Footer */}
            <div className="mt-2 w-full px-5 py-3">
                <button
                    onClick={(e) => handleNavigate(e, primaryPath)}
                    className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-lg text-sm font-bold shadow-md hover:shadow-lg transition-all"
                >
                    Enter Dashboard <ArrowRight size={16} />
                </button>
            </div>
        </div>
    );
}
