import { useMemo } from 'react';
import {
    ShieldAlert, AlertTriangle, FileCheck, Banknote,
    MapPin, Building2, UserCheck, CalendarDays,
    ClipboardX, Siren, History
} from 'lucide-react';
import { saveFile, sliceCanvas } from '../lib/utils';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import KPICard from '../components/KPICard';
import { getGlobalStats, getGeoStats, getFlatBranchList } from '../data/geoDataComplete';

// Helper to simulate Audit Specific Data not in core model
const enrichWithAuditData = (branch: any, idx: number) => {
    // Deterministic Random based on name/idx
    const seed = idx * 137;
    const rand = (n: number) => ((seed * n) % 100) / 100;

    const isSurprise = rand(1) > 0.7; // 30% are surprise audits
    const auditScore = Math.floor(65 + rand(2) * 35); // 65-100
    const cashLimit = 50000; // 50k Limit
    const cashBalance = Math.floor(rand(3) * 80000); // 0-80k
    const cashException = cashBalance > cashLimit;

    // Findings Simulation
    const hasGRTDefect = rand(4) > 0.85;
    const hasGhostClient = rand(5) > 0.95;
    const hasLateMeeting = rand(6) > 0.8;

    return {
        ...branch,
        auditProfile: {
            lastAuditType: isSurprise ? 'Surprise' : 'Regular',
            lastAuditDate: new Date(2025, 11, Math.floor(rand(7) * 30)).toLocaleDateString(),
            score: auditScore,
            cashBalance,
            cashException,
            findings: {
                grt: hasGRTDefect,
                ghost: hasGhostClient,
                meetings: hasLateMeeting,
                luc: (branch.lucPending || 0) > 10 // Real data linkage
            }
        }
    };
};

const AuditDashboard = () => {
    // Derived Audit Data
    const auditData = useMemo(() => {
        const rawBranches = getFlatBranchList();
        const branches = rawBranches.map((b, i) => enrichWithAuditData(b, i));

        // 1. KPI Calculations
        const cashRisks = branches.filter(b => b.auditProfile.cashException);
        const criticalScores = branches.filter(b => b.auditProfile.score < 75);
        const surpriseVisits = branches.filter(b => b.auditProfile.lastAuditType === 'Surprise');
        const avgScore = Math.round(branches.reduce((s, b) => s + b.auditProfile.score, 0) / branches.length);

        // 2. Findings Aggregation (MFI Specific)
        const violationStats = [
            { name: 'Cash Rate Limit Breach', count: cashRisks.length, color: '#ef4444' },
            { name: 'Fake/Ghost Client Suspect', count: branches.filter(b => b.auditProfile.findings.ghost).length, color: '#f97316' },
            { name: 'GRT Process Deviation', count: branches.filter(b => b.auditProfile.findings.grt).length, color: '#f59e0b' },
            { name: 'LUC Unverified', count: branches.filter(b => b.auditProfile.findings.luc).length, color: '#8b5cf6' },
            { name: 'Centre Meeting Delay', count: branches.filter(b => b.auditProfile.findings.meetings).length, color: '#3b82f6' }
        ].sort((a, b) => b.count - a.count);

        return {
            sampledCount: branches.length,
            avgScore,
            cashRiskCount: cashRisks.length,
            surpriseVisitCount: surpriseVisits.length,
            criticalBranchCount: criticalScores.length,
            branches,
            violationStats,
            recentAudits: branches.sort((a, b) => b.auditProfile.score - a.auditProfile.score).slice(0, 5) // Just for stable list
        };
    }, []);

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex justify-between items-end">
                <div>
                    <h1 className="text-2xl font-bold text-secondary-900">Internal Audit Control</h1>
                    <p className="text-secondary-500">Field Discipline, Cash Security & Compliance</p>
                </div>
                <div className="flex gap-3">
                    <div className="bg-white px-3 py-1.5 rounded-lg border border-secondary-200 text-xs font-semibold shadow-sm flex items-center gap-2">
                        <Siren size={14} className="text-rose-500" />
                        Surprise Visit Cycle: <span className="text-secondary-900">Active</span>
                    </div>
                </div>
            </div>

            {/* MFI Specific Audit KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <KPICard
                    title="Network Compliance"
                    value={`${auditData.avgScore}%`}
                    subValue="Avg. Audit Score"
                    trend={auditData.avgScore > 80 ? 'up' : 'down'}
                    trendValue={auditData.avgScore > 80 ? 'Good Control' : 'Process Gaps'}
                    icon={FileCheck}
                    className="border-l-4 border-l-emerald-500"
                />
                <KPICard
                    title="Cash Limit Breaches"
                    value={auditData.cashRiskCount.toString()}
                    subValue="Overnight Cash > ₹50k"
                    trend={auditData.cashRiskCount === 0 ? 'neutral' : 'down'}
                    trendValue="Immediate Action"
                    icon={Banknote}
                    className={`border-l-4 ${auditData.cashRiskCount > 0 ? 'border-l-rose-500' : 'border-l-secondary-300'}`}
                />
                <KPICard
                    title="Surprise Visits"
                    value={`${((auditData.surpriseVisitCount / auditData.sampledCount) * 100).toFixed(0)}%`}
                    subValue="Coverage (Q3)"
                    trend="up"
                    trendValue={`${auditData.surpriseVisitCount} Branches Visited`}
                    icon={Siren}
                    className="border-l-4 border-l-purple-500"
                />
                <KPICard
                    title="Ghost Client Alerts"
                    value={auditData.violationStats.find(v => v.name.includes('Ghost'))?.count.toString() || '0'}
                    subValue="Identity Mismatches"
                    trend="up"
                    trendValue="Potential Fraud"
                    icon={UserCheck}
                    className="border-l-4 border-l-orange-500"
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Violation Analysis Chart */}
                <div className="lg:col-span-2 bg-white p-6 rounded-xl border border-secondary-200 shadow-sm">
                    <h3 className="text-lg font-bold text-secondary-900 mb-1">Top Audit Violations (MFI Risk)</h3>
                    <p className="text-xs text-secondary-500 mb-6">Process gaps identified during field audits and surprise checks</p>
                    <div className="h-[280px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={auditData.violationStats} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                                <XAxis type="number" hide />
                                <YAxis dataKey="name" type="category" width={140} tick={{ fontSize: 11, fill: '#64748b' }} />
                                <Tooltip cursor={{ fill: '#f1f5f9' }} />
                                <Bar isAnimationActive={false} dataKey="count" radius={[0, 4, 4, 0]} barSize={24}>
                                    {auditData.violationStats.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Audit Schedule Status (Donut) */}
                <div className="bg-white p-6 rounded-xl border border-secondary-200 shadow-sm">
                    <h3 className="text-lg font-bold text-secondary-900 mb-1">Audit Plan Status</h3>
                    <p className="text-xs text-secondary-500 mb-4">Completion vs Target</p>
                    <div className="h-[220px] w-full relative">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie isAnimationActive={false}
                                    data={[
                                        { name: 'Completed (Regular)', value: 18, color: '#10b981' },
                                        { name: 'Completed (Surprise)', value: 5, color: '#8b5cf6' },
                                        { name: 'Pending', value: 4, color: '#e2e8f0' }
                                    ]}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={50}
                                    outerRadius={70}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    <Cell fill="#10b981" />
                                    <Cell fill="#8b5cf6" />
                                    <Cell fill="#e2e8f0" />
                                </Pie>
                                <Tooltip />
                                <Legend verticalAlign="bottom" height={36} iconSize={8} />
                            </PieChart>
                        </ResponsiveContainer>
                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none pb-8">
                            <span className="text-2xl font-bold text-secondary-800">85%</span>
                            <span className="text-[10px] text-secondary-500 font-bold uppercase">Executed</span>
                        </div>
                    </div>
                    <div className="mt-2 text-center text-xs text-secondary-500">
                        <span className="font-semibold text-purple-600">Surprise Visits</span> exceeding target by 10%
                    </div>
                </div>
            </div>

            {/* Red Flag Branches Table */}
            <div className="bg-white p-6 rounded-xl border border-secondary-200 shadow-sm">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h3 className="text-lg font-bold text-secondary-900 flex items-center gap-2">
                            <AlertTriangle size={18} className="text-rose-500" />
                            Red Flag Branches (Action Required)
                        </h3>
                        <p className="text-sm text-secondary-500">Branches with Cash Mismatches, Low Audit Scores, or High PAR</p>
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-secondary-50 text-secondary-500 border-b border-secondary-200">
                            <tr>
                                <th className="py-3 px-4 font-semibold">Branch</th>
                                <th className="py-3 px-4 font-semibold">Audit Type</th>
                                <th className="py-3 px-4 text-center font-semibold">Audit Score</th>
                                <th className="py-3 px-4 text-center font-semibold">Cash Exception</th>
                                <th className="py-3 px-4 text-center font-semibold">GRT Process</th>
                                <th className="py-3 px-4 text-right font-semibold">PAR 30 (%)</th>
                                <th className="py-3 px-4 text-center font-semibold">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-secondary-100">
                            {auditData.branches
                                .filter(b => b.auditProfile.score < 75 || b.auditProfile.cashException || b.auditProfile.lastAuditType === 'Surprise')
                                .slice(0, 8)
                                .map((branch, idx) => (
                                    <tr key={idx} className="group hover:bg-secondary-50 transition-colors">
                                        <td className="py-3 px-4 font-medium text-secondary-900">
                                            {branch.name}
                                            <div className="text-[10px] text-secondary-400">{branch.district}</div>
                                        </td>
                                        <td className="py-3 px-4">
                                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${branch.auditProfile.lastAuditType === 'Surprise'
                                                ? 'bg-purple-50 text-purple-700 border-purple-100'
                                                : 'bg-secondary-100 text-secondary-600 border-secondary-200'
                                                }`}>
                                                {branch.auditProfile.lastAuditType}
                                            </span>
                                        </td>
                                        <td className="py-3 px-4 text-center">
                                            <div className="flex flex-col items-center">
                                                <span className={`font-bold ${branch.auditProfile.score < 70 ? 'text-rose-600' : 'text-secondary-700'}`}>
                                                    {branch.auditProfile.score}/100
                                                </span>
                                                {branch.auditProfile.score < 70 && <span className="text-[9px] text-rose-500">Critical</span>}
                                            </div>
                                        </td>
                                        <td className="py-3 px-4 text-center">
                                            {branch.auditProfile.cashException ? (
                                                <div className="inline-flex items-center gap-1 text-rose-600 font-bold bg-rose-50 px-2 py-1 rounded">
                                                    <Banknote size={12} />
                                                    Excess
                                                </div>
                                            ) : <span className="text-emerald-500 text-xs">Within Limit</span>}
                                        </td>
                                        <td className="py-3 px-4 text-center">
                                            {branch.auditProfile.findings.grt ? (
                                                <span className="text-rose-500 text-xs font-semibold">Failed</span>
                                            ) : <span className="text-secondary-400 text-xs">-</span>}
                                        </td>
                                        <td className="py-3 px-4 text-right font-mono">
                                            {(branch.par30 || 0).toFixed(2)}%
                                        </td>
                                        <td className="py-3 px-4 text-center">
                                            <button className="text-blue-600 hover:text-blue-800 text-xs font-bold underline">
                                                View Report
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default AuditDashboard;
