import { useState } from 'react';
import {
    Bell, BellOff, Plus, Trash2, ToggleLeft, ToggleRight,
    CheckCircle, AlertTriangle, XCircle, Clock, Mail, MessageSquare, Monitor,
    TrendingUp, TrendingDown, Minus, Filter, Search, ChevronDown
} from 'lucide-react';
import { saveFile } from '../lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

type Operator = '>' | '<' | '>=' | '<=' | '=';
type Severity = 'Critical' | 'High' | 'Medium' | 'Low';
type Channel = 'Email' | 'SMS' | 'In-App';
type AlertStatus = 'New' | 'Acknowledged' | 'Resolved';
type Trend = 'up' | 'down' | 'flat';

interface AlertRule {
    id: number;
    metric: string;
    category: string;
    operator: Operator;
    threshold: number;
    unit: string;
    severity: Severity;
    channels: Channel[];
    frequency: string;
    active: boolean;
    assignedTo: string;
}

interface AlertEvent {
    id: number;
    ruleId: number;
    metric: string;
    triggered: string;
    value: number;
    threshold: number;
    unit: string;
    severity: Severity;
    status: AlertStatus;
    trend: Trend;
    note: string;
    acknowledgedBy?: string;
    targetRoles: string[];
}

// ─── Mock Data ────────────────────────────────────────────────────────────────

const INITIAL_RULES: AlertRule[] = [
    { id: 1, metric: 'PAR 30+', category: 'Risk', operator: '>', threshold: 2.5, unit: '%', severity: 'Critical', channels: ['Email', 'SMS', 'In-App'], frequency: 'Daily', active: true, assignedTo: 'Amit Sharma' },
    { id: 2, metric: 'PAR 90+ (GNPA)', category: 'Risk', operator: '>', threshold: 1.0, unit: '%', severity: 'Critical', channels: ['Email', 'SMS'], frequency: 'Daily', active: true, assignedTo: 'Amit Sharma' },
    { id: 3, metric: 'Collection Efficiency', category: 'Collections', operator: '<', threshold: 96.0, unit: '%', severity: 'High', channels: ['Email', 'In-App'], frequency: 'Daily', active: true, assignedTo: 'Priya Nair' },
    { id: 4, metric: 'Disbursement vs Target', category: 'Origination', operator: '<', threshold: 60.0, unit: '%', severity: 'High', channels: ['Email'], frequency: 'Weekly', active: true, assignedTo: 'Rajan Mehta' },
    { id: 5, metric: 'GLP Growth MoM', category: 'Portfolio', operator: '<', threshold: 2.0, unit: '%', severity: 'Medium', channels: ['In-App'], frequency: 'Monthly', active: true, assignedTo: 'Sunita Rao' },
    { id: 6, metric: 'Write-off Rate', category: 'Risk', operator: '>', threshold: 1.0, unit: '%', severity: 'High', channels: ['Email', 'In-App'], frequency: 'Weekly', active: false, assignedTo: 'Amit Sharma' },
    { id: 7, metric: 'New Borrowers MoM', category: 'Origination', operator: '<', threshold: 5000, unit: '', severity: 'Medium', channels: ['Email'], frequency: 'Monthly', active: true, assignedTo: 'Priya Nair' },
    { id: 8, metric: 'Branch PAR 30+ Outlier', category: 'Risk', operator: '>', threshold: 5.0, unit: '%', severity: 'High', channels: ['Email', 'SMS'], frequency: 'Weekly', active: true, assignedTo: 'Kavita Joshi' },
];

const INITIAL_EVENTS: AlertEvent[] = [
    { id: 1, ruleId: 3, metric: 'Collection Efficiency', triggered: '22 Feb 2026, 08:00 AM', value: 95.2, threshold: 96.0, unit: '%', severity: 'High', status: 'New', trend: 'down', note: 'Below target for 3 consecutive days.', targetRoles: ['ops', 'branch', 'cfo', 'risk'] },
    { id: 2, ruleId: 1, metric: 'PAR 30+', triggered: '22 Feb 2026, 06:00 AM', value: 1.97, threshold: 2.5, unit: '%', severity: 'Critical', status: 'Acknowledged', trend: 'up', note: 'Within range. Monitoring.', acknowledgedBy: 'Amit Sharma', targetRoles: ['ceo', 'risk', 'cfo'] },
    { id: 3, ruleId: 4, metric: 'Disbursement vs Target', triggered: '21 Feb 2026, 09:00 PM', value: 67.9, threshold: 60.0, unit: '%', severity: 'High', status: 'Resolved', trend: 'up', note: 'Target crossed after push. Closed.', acknowledgedBy: 'Rajan Mehta', targetRoles: ['ops', 'branch'] },
    { id: 4, ruleId: 8, metric: 'Branch PAR 30+ Outlier', triggered: '21 Feb 2026, 06:00 AM', value: 6.1, threshold: 5.0, unit: '%', severity: 'High', status: 'New', trend: 'up', note: 'Varanasi Cantonment Branch flagged.', targetRoles: ['branch', 'risk', 'ops'] },
    { id: 5, ruleId: 2, metric: 'PAR 90+ (GNPA)', triggered: '20 Feb 2026, 08:00 AM', value: 0.76, threshold: 1.0, unit: '%', severity: 'Critical', status: 'Resolved', trend: 'flat', note: 'Below threshold. No action needed.', acknowledgedBy: 'Amit Sharma', targetRoles: ['ceo', 'cfo', 'risk'] },
    { id: 6, ruleId: 7, metric: 'New Borrowers MoM', triggered: '19 Feb 2026, 09:00 AM', value: 4870, threshold: 5000, unit: '', severity: 'Medium', status: 'Acknowledged', trend: 'down', note: 'Target miss. Push through ops channel.', acknowledgedBy: 'Priya Nair', targetRoles: ['ops', 'branch'] },
    { id: 7, ruleId: 5, metric: 'GLP Growth MoM', triggered: '18 Feb 2026, 08:00 AM', value: 1.8, threshold: 2.0, unit: '%', severity: 'Medium', status: 'Resolved', trend: 'flat', note: 'Seasonal slowdown. Reviewed.', acknowledgedBy: 'Sunita Rao', targetRoles: ['ceo', 'cfo', 'risk'] },
    { id: 8, ruleId: 3, metric: 'Collection Efficiency', triggered: '17 Feb 2026, 08:00 AM', value: 95.8, threshold: 96.0, unit: '%', severity: 'High', status: 'Resolved', trend: 'down', note: 'Recovered next day. Closed.', acknowledgedBy: 'Priya Nair', targetRoles: ['ops', 'branch', 'cfo', 'risk'] },
];

const METRICS = ['PAR 30+', 'PAR 90+ (GNPA)', 'Collection Efficiency', 'Disbursement vs Target',
    'GLP Growth MoM', 'Write-off Rate', 'New Borrowers MoM', 'Branch PAR 30+ Outlier',
    'Portfolio Yield', 'Overdue Amount (Cr)'];
const CATEGORIES = ['Risk', 'Collections', 'Origination', 'Portfolio'];
const SEVERITIES: Severity[] = ['Critical', 'High', 'Medium', 'Low'];
const CHANNELS: Channel[] = ['Email', 'SMS', 'In-App'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const SEV: Record<Severity, string> = {
    Critical: 'bg-red-100 text-red-700 border-red-200',
    High: 'bg-orange-100 text-orange-700 border-orange-200',
    Medium: 'bg-amber-100 text-amber-700 border-amber-200',
    Low: 'bg-slate-100 text-slate-600 border-slate-200',
};
const STAT: Record<AlertStatus, { cls: string; Icon: React.ElementType }> = {
    New: { cls: 'bg-blue-50 text-blue-700 border-blue-200', Icon: Bell },
    Acknowledged: { cls: 'bg-amber-50 text-amber-700 border-amber-200', Icon: Clock },
    Resolved: { cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', Icon: CheckCircle },
};
const TREND_ICON: Record<Trend, React.ElementType> = { up: TrendingUp, down: TrendingDown, flat: Minus };
const TREND_COLOR: Record<Trend, string> = { up: 'text-rose-500', down: 'text-rose-500', flat: 'text-slate-400' };
const CH_ICON: Record<Channel, React.ElementType> = { Email: Mail, SMS: MessageSquare, 'In-App': Monitor };

// ─── Component ────────────────────────────────────────────────────────────────

export default function AlertsDashboard() {
    const [tab, setTab] = useState<'history' | 'config'>('history');
    const [rules, setRules] = useState<AlertRule[]>(INITIAL_RULES);
    const [events, setEvents] = useState<AlertEvent[]>(INITIAL_EVENTS);

    // Modal State
    const [showAddRule, setShowAddRule] = useState(false);
    const [newRule, setNewRule] = useState({
        metric: METRICS[0], category: CATEGORIES[0], operator: '>' as Operator,
        threshold: 0, unit: '%', severity: 'Medium' as Severity, frequency: 'Daily',
        assigneeType: 'User' as 'User' | 'Role', assignedTo: ''
    });

    const currentRole = sessionStorage.getItem('finflux_role') || 'admin';
    const isAdmin = currentRole === 'admin';
    const isAnalyst = currentRole === 'analyst';

    // Role-specific events filtering
    const roleEvents = (isAdmin || isAnalyst)
        ? events
        : events.filter(e => e.targetRoles.includes(currentRole));

    // history filters
    const [hSearch, setHSearch] = useState('');
    const [hSeverity, setHSeverity] = useState('All');
    const [hStatus, setHStatus] = useState('All');

    // config filters
    const [cSearch, setCSearch] = useState('');
    const [cCategory, setCCategory] = useState('All');

    const filteredEvents = roleEvents.filter(e =>
        (hSearch === '' || e.metric.toLowerCase().includes(hSearch.toLowerCase())) &&
        (hSeverity === 'All' || e.severity === hSeverity) &&
        (hStatus === 'All' || e.status === hStatus)
    );

    const filteredRules = rules.filter(r =>
        (cSearch === '' || r.metric.toLowerCase().includes(cSearch.toLowerCase())) &&
        (cCategory === 'All' || r.category === cCategory)
    );

    const toggleRule = (id: number) =>
        setRules(prev => prev.map(r => r.id === id ? { ...r, active: !r.active } : r));

    const deleteRule = (id: number) =>
        setRules(prev => prev.filter(r => r.id !== id));

    const handleAddRule = () => {
        const rule: AlertRule = {
            id: Date.now(),
            ...newRule,
            assignedTo: newRule.assigneeType === 'Role' ? `[Role] ${newRule.assignedTo}` : newRule.assignedTo,
            channels: ['In-App'],
            active: true
        };
        setRules([rule, ...rules]);
        setShowAddRule(false);
        setNewRule({
            metric: METRICS[0], category: CATEGORIES[0], operator: '>' as Operator,
            threshold: 0, unit: '%', severity: 'Medium' as Severity, frequency: 'Daily',
            assigneeType: 'User' as 'User' | 'Role', assignedTo: ''
        });
    };

    const acknowledge = (id: number) =>
        setEvents(prev => prev.map(e => e.id === id ? { ...e, status: 'Acknowledged', acknowledgedBy: 'SR (You)' } : e));

    const resolve = (id: number) =>
        setEvents(prev => prev.map(e => e.id === id ? { ...e, status: 'Resolved', acknowledgedBy: e.acknowledgedBy || 'SR (You)' } : e));

    // Summary counts (use roleEvents instead of all events)
    const newCount = roleEvents.filter(e => e.status === 'New').length;
    const ackCount = roleEvents.filter(e => e.status === 'Acknowledged').length;
    const resCount = roleEvents.filter(e => e.status === 'Resolved').length;
    const critCount = roleEvents.filter(e => e.severity === 'Critical' && e.status === 'New').length;

    return (
        <div className="flex flex-col gap-6">

            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                    <h2 className="text-2xl font-bold text-secondary-900 flex items-center gap-2">
                        <Bell className="text-amber-500" size={22} /> {isAdmin ? 'Alerts & Notifications' : 'My Alerts'}
                    </h2>
                    <p className="text-secondary-500 text-sm mt-0.5">
                        {isAdmin ? 'Configure thresholds and review triggered alert history' : 'Review and acknowledge alerts specifically assigned to your role'}
                    </p>
                </div>
                {(tab === 'config' && isAdmin) && (
                    <button className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-lg text-sm font-semibold hover:bg-amber-600 transition-colors shadow-sm">
                        <Plus size={15} /> New Alert Rule
                    </button>
                )}
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                    { label: 'New Alerts', value: newCount, color: 'text-blue-600', bg: 'bg-blue-50', Icon: Bell },
                    { label: 'Critical Open', value: critCount, color: 'text-red-600', bg: 'bg-red-50', Icon: XCircle },
                    { label: 'Acknowledged', value: ackCount, color: 'text-amber-600', bg: 'bg-amber-50', Icon: Clock },
                    { label: 'Resolved', value: resCount, color: 'text-emerald-600', bg: 'bg-emerald-50', Icon: CheckCircle },
                ].map(c => (
                    <div key={c.label} className={`${c.bg} rounded-xl p-4 flex items-center gap-4`}>
                        <c.Icon size={20} className={c.color} />
                        <div>
                            <div className={`text-2xl font-extrabold ${c.color}`}>{c.value}</div>
                            <div className="text-secondary-500 text-xs font-medium">{c.label}</div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Tabs (Only show config to admin) */}
            {isAdmin && (
                <div className="flex gap-1 bg-secondary-100 p-1 rounded-xl w-fit">
                    {(['history', 'config'] as const).map(t => (
                        <button key={t} onClick={() => setTab(t)}
                            className={`px-5 py-2 rounded-lg text-sm font-semibold capitalize transition-all ${tab === t ? 'bg-white text-amber-700 shadow-sm' : 'text-secondary-500 hover:text-secondary-700'}`}>
                            {t === 'history' ? '🔔 Alert History' : '⚙️ Alert Config'}
                        </button>
                    ))}
                </div>
            )}

            {/* ── HISTORY TAB ── */}
            {tab === 'history' && (
                <div className="bg-white rounded-xl border border-secondary-200 shadow-sm overflow-hidden">
                    {/* Filters */}
                    <div className="p-4 border-b border-secondary-100 flex items-center gap-3 flex-wrap">
                        <div className="relative flex-1 min-w-[200px]">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary-400" />
                            <input value={hSearch} onChange={e => setHSearch(e.target.value)}
                                placeholder="Search alerts..."
                                className="w-full pl-8 pr-3 py-2 text-sm border border-secondary-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-300" />
                        </div>
                        {[
                            { label: 'All Severities', value: hSeverity, set: setHSeverity, options: ['All', ...SEVERITIES] },
                            { label: 'All Statuses', value: hStatus, set: setHStatus, options: ['All', 'New', 'Acknowledged', 'Resolved'] },
                        ].map(f => (
                            <div key={f.label} className="relative">
                                <select value={f.value} onChange={e => f.set(e.target.value)}
                                    className="appearance-none pl-3 pr-7 py-2 text-sm border border-secondary-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-300 bg-white">
                                    {f.options.map(o => <option key={o} value={o}>{o === 'All' ? f.label : o}</option>)}
                                </select>
                                <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-secondary-400 pointer-events-none" />
                            </div>
                        ))}
                        <div className="flex items-center gap-1 text-xs text-secondary-400">
                            <Filter size={13} /> {filteredEvents.length} records
                        </div>
                    </div>

                    {/* Alert List */}
                    <div className="divide-y divide-secondary-100">
                        {filteredEvents.map(ev => {
                            const TrendIcon = TREND_ICON[ev.trend];
                            const StatIcon = STAT[ev.status].Icon;
                            return (
                                <div key={ev.id} className="p-4 hover:bg-secondary-50/50 transition-colors">
                                    <div className="flex items-start gap-4 flex-wrap">
                                        {/* Left */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap mb-1">
                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${SEV[ev.severity]}`}>{ev.severity}</span>
                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border flex items-center gap-1 ${STAT[ev.status].cls}`}>
                                                    <StatIcon size={10} /> {ev.status}
                                                </span>
                                                <span className="text-xs text-secondary-400">{ev.triggered}</span>
                                            </div>
                                            <div className="font-semibold text-secondary-900 text-sm">{ev.metric}</div>
                                            <div className="text-secondary-500 text-xs mt-0.5">{ev.note}</div>
                                            {ev.acknowledgedBy && (
                                                <div className="text-xs text-secondary-400 mt-1">Handled by: <span className="font-medium text-secondary-600">{ev.acknowledgedBy}</span></div>
                                            )}
                                        </div>
                                        {/* Right: Value */}
                                        <div className="flex items-center gap-6 shrink-0">
                                            <div className="text-right">
                                                <div className="flex items-center gap-1 justify-end">
                                                    <TrendIcon size={14} className={TREND_COLOR[ev.trend]} />
                                                    <span className="text-lg font-extrabold text-secondary-900">{ev.value}{ev.unit}</span>
                                                </div>
                                                <div className="text-xs text-secondary-400">Threshold: {ev.threshold}{ev.unit}</div>
                                            </div>
                                            {/* Actions */}
                                            {ev.status === 'New' && (
                                                <div className="flex gap-2">
                                                    <button onClick={() => acknowledge(ev.id)}
                                                        className="px-3 py-1.5 text-xs font-semibold border border-amber-300 text-amber-700 rounded-lg hover:bg-amber-50 transition-colors">Acknowledge</button>
                                                    <button onClick={() => resolve(ev.id)}
                                                        className="px-3 py-1.5 text-xs font-semibold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors">Resolve</button>
                                                </div>
                                            )}
                                            {ev.status === 'Acknowledged' && (
                                                <button onClick={() => resolve(ev.id)}
                                                    className="px-3 py-1.5 text-xs font-semibold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors">Resolve</button>
                                            )}
                                            {ev.status === 'Resolved' && (
                                                <div className="flex items-center gap-1 text-emerald-600 text-xs font-semibold">
                                                    <CheckCircle size={14} /> Closed
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* ── CONFIG TAB ── */}
            {tab === 'config' && (
                <div className="bg-white rounded-xl border border-secondary-200 shadow-sm overflow-hidden">
                    {/* Filters */}
                    <div className="p-4 border-b border-secondary-100 flex items-center gap-3 flex-wrap">
                        <div className="relative flex-1 min-w-[200px]">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary-400" />
                            <input value={cSearch} onChange={e => setCSearch(e.target.value)}
                                placeholder="Search rules..."
                                className="w-full pl-8 pr-3 py-2 text-sm border border-secondary-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-300" />
                        </div>
                        <div className="relative">
                            <select value={cCategory} onChange={e => setCCategory(e.target.value)}
                                className="appearance-none pl-3 pr-7 py-2 text-sm border border-secondary-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-300 bg-white">
                                <option value="All">All Categories</option>
                                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                            <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-secondary-400 pointer-events-none" />
                        </div>
                        <button
                            onClick={() => setShowAddRule(true)}
                            className="flex items-center gap-2 bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg text-sm font-semibold shadow-sm transition-colors">
                            <Plus size={16} /> Create Alert Rule
                        </button>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-secondary-50 border-b border-secondary-100">
                                    {['Metric', 'Category', 'Condition', 'Severity', 'Channels', 'Frequency', 'Assigned To', 'Active', ''].map(h => (
                                        <th key={h} className="text-left px-4 py-3 text-[11px] font-bold text-secondary-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-secondary-100">
                                {filteredRules.map(rule => (
                                    <tr key={rule.id} className="hover:bg-secondary-50/50 transition-colors">
                                        <td className="px-4 py-3">
                                            <div className="font-semibold text-secondary-900">{rule.metric}</div>
                                        </td>
                                        <td className="px-4 py-3 text-secondary-500 text-xs">{rule.category}</td>
                                        <td className="px-4 py-3">
                                            <span className="font-mono text-xs bg-secondary-100 px-2 py-1 rounded text-secondary-700">
                                                {rule.operator} {rule.threshold}{rule.unit}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${SEV[rule.severity]}`}>{rule.severity}</span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex gap-1">
                                                {rule.channels.map(ch => {
                                                    const ChIcon = CH_ICON[ch];
                                                    return <ChIcon key={ch} size={14} className="text-secondary-400" title={ch} />;
                                                })}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-xs text-secondary-500">{rule.frequency}</td>
                                        <td className="px-4 py-3 text-xs text-secondary-600 font-medium">{rule.assignedTo}</td>
                                        <td className="px-4 py-3">
                                            <button onClick={() => toggleRule(rule.id)} className={rule.active ? 'text-emerald-500' : 'text-secondary-300'}>
                                                {rule.active ? <ToggleRight size={24} /> : <ToggleLeft size={24} />}
                                            </button>
                                        </td>
                                        <td className="px-4 py-3">
                                            <button onClick={() => deleteRule(rule.id)}
                                                className="p-1.5 text-secondary-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors">
                                                <Trash2 size={14} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Create Alert Rule Modal */}
            {showAddRule && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-secondary-900/50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden">
                        <div className="flex items-center justify-between p-4 border-b border-secondary-100">
                            <h3 className="font-bold text-lg text-secondary-900 flex items-center gap-2">
                                <Bell size={18} className="text-amber-600" /> Create Alert Rule
                            </h3>
                            <button onClick={() => setShowAddRule(false)} className="text-secondary-400 hover:text-secondary-600"><XCircle size={18} /></button>
                        </div>
                        <div className="p-5 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-secondary-600 uppercase tracking-wider mb-1">Metric Focus</label>
                                    <select value={newRule.metric} onChange={e => setNewRule({ ...newRule, metric: e.target.value })} className="w-full px-3 py-2 text-sm border border-secondary-200 rounded-lg focus:ring-2 focus:ring-amber-300 focus:outline-none bg-white">
                                        {METRICS.map(m => <option key={m} value={m}>{m}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-secondary-600 uppercase tracking-wider mb-1">Category</label>
                                    <select value={newRule.category} onChange={e => setNewRule({ ...newRule, category: e.target.value })} className="w-full px-3 py-2 text-sm border border-secondary-200 rounded-lg focus:ring-2 focus:ring-amber-300 focus:outline-none bg-white">
                                        {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-secondary-600 uppercase tracking-wider mb-1">Condition</label>
                                    <select value={newRule.operator} onChange={e => setNewRule({ ...newRule, operator: e.target.value as Operator })} className="w-full px-3 py-2 text-sm border border-secondary-200 rounded-lg focus:ring-2 focus:ring-amber-300 focus:outline-none bg-white font-mono">
                                        <option value=">">&gt; (Greater)</option>
                                        <option value="<">&lt; (Less)</option>
                                        <option value="=">= (Equal)</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-secondary-600 uppercase tracking-wider mb-1">Threshold Value</label>
                                    <input type="number" value={newRule.threshold} onChange={e => setNewRule({ ...newRule, threshold: parseFloat(e.target.value) || 0 })} className="w-full px-3 py-2 text-sm border border-secondary-200 rounded-lg focus:ring-2 focus:ring-amber-300 focus:outline-none" placeholder="0" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-secondary-600 uppercase tracking-wider mb-1">Unit</label>
                                    <input value={newRule.unit} onChange={e => setNewRule({ ...newRule, unit: e.target.value })} className="w-full px-3 py-2 text-sm border border-secondary-200 rounded-lg focus:ring-2 focus:ring-amber-300 focus:outline-none" placeholder="%, Cr, etc." />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-secondary-600 uppercase tracking-wider mb-1">Severity / Priority</label>
                                    <select value={newRule.severity} onChange={e => setNewRule({ ...newRule, severity: e.target.value as Severity })} className="w-full px-3 py-2 text-sm border border-secondary-200 rounded-lg focus:ring-2 focus:ring-amber-300 focus:outline-none bg-white">
                                        {SEVERITIES.map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                </div>
                                <div className="space-y-1">
                                    <label className="block text-xs font-bold text-secondary-600 uppercase tracking-wider mb-1">Assignee</label>
                                    <div className="flex gap-2">
                                        <div className="flex bg-secondary-100 p-1 rounded-lg shrink-0 w-[120px]">
                                            <button onClick={() => setNewRule(prev => ({ ...prev, assigneeType: 'User', assignedTo: '' }))} className={`flex-1 py-1 text-xs font-semibold rounded transition-colors ${newRule.assigneeType === 'User' ? 'bg-white text-secondary-900 shadow-sm' : 'text-secondary-500 hover:text-secondary-700'}`}>User</button>
                                            <button onClick={() => setNewRule(prev => ({ ...prev, assigneeType: 'Role', assignedTo: '' }))} className={`flex-1 py-1 text-xs font-semibold rounded transition-colors ${newRule.assigneeType === 'Role' ? 'bg-white text-secondary-900 shadow-sm' : 'text-secondary-500 hover:text-secondary-700'}`}>Role</button>
                                        </div>
                                        <div className="flex-1">
                                            {newRule.assigneeType === 'User' ? (
                                                <input value={newRule.assignedTo} onChange={e => setNewRule({ ...newRule, assignedTo: e.target.value })} className="w-full px-3 py-2 text-sm border border-secondary-200 rounded-lg focus:ring-2 focus:ring-amber-300 focus:outline-none" placeholder="e.g. Amit Sharma" />
                                            ) : (
                                                <select value={newRule.assignedTo} onChange={e => setNewRule({ ...newRule, assignedTo: e.target.value })} className="w-full px-3 py-2 text-sm border border-secondary-200 rounded-lg focus:ring-2 focus:ring-amber-300 focus:outline-none bg-white">
                                                    <option value="" disabled>Select Role...</option>
                                                    <option value="CEO / C-Suite">CEO / C-Suite</option>
                                                    <option value="CFO / Finance Head">CFO / Finance Head</option>
                                                    <option value="Operations Head">Operations Head</option>
                                                    <option value="Risk Officer">Risk Officer</option>
                                                    <option value="Branch Manager">Branch Manager</option>
                                                </select>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="p-4 border-t border-secondary-100 bg-secondary-50 flex justify-end gap-3">
                            <button onClick={() => setShowAddRule(false)} className="px-4 py-2 text-sm font-semibold text-secondary-600 hover:text-secondary-800">Cancel</button>
                            <button onClick={handleAddRule} disabled={!newRule.assignedTo} className="px-4 py-2 text-sm font-semibold bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50">Automate Rule</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
