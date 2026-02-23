import { useState } from 'react';
import {
    Users, TrendingUp, AlertTriangle, Target,
    Calendar, MapPin, Briefcase, Award,
    CheckCircle2, Clock, UserCheck
} from 'lucide-react';
import { saveFile, sliceCanvas } from '../lib/utils';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';
import KPICard from '../components/KPICard';
import { ALL_STATES_DATA, getGlobalStats } from '../data/geoDataComplete';

// --- MOCK DATA GENERATOR ---
const generateStaffData = () => {
    const staffing = [];
    const names = [
        "Suresh Kumar", "Anita Raj", "Rahul Singh", "Priya Sharma", "Amit Vernekar",
        "Deepak Patel", "Sneha Gupta", "Vikram Malhotra", "Ramesh Pawar", "Geeta Rani"
    ];

    for (let i = 0; i < 10; i++) {
        staffing.push({
            id: `FO-${1000 + i}`,
            name: names[i],
            branch: `Branch-${Math.floor(i / 2) + 1}`,
            activeClients: 350 + Math.floor(Math.random() * 150),
            parClients: Math.floor(Math.random() * 15),
            disbursement: parseFloat((15 + Math.random() * 10).toFixed(2)), // Lakhs
            collectionLimit: parseFloat((10 + Math.random() * 5).toFixed(2)), // Lakhs
            incentive: Math.floor(2000 + Math.random() * 5000), // Rupees
            rating: (3.5 + Math.random() * 1.5).toFixed(1),
            attendance: 85 + Math.floor(Math.random() * 15)
        });
    }
    return staffing.sort((a, b) => b.activeClients - a.activeClients);
};

const STAFF_LIST = generateStaffData();

const StaffDashboard = () => {
    const globalStats = getGlobalStats();

    // Aggregated Metrics
    const totalStaff = globalStats.staffCount || 6500;
    const activeStaff = Math.floor(totalStaff * 0.92);
    const avgCaseload = 412; // Derived from Total Clients / Total Staff
    const leadsGenerated = globalStats.leadsGenerated || 12500;
    const productivityScore = 8.4; // Out of 10

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-secondary-900">Workforce Analytics</h1>
                <p className="text-secondary-500">Field Officer Performance & Productivity Insights</p>
            </div>

            {/* Top Level KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <KPICard
                    title="Total Field Workforce"
                    value={totalStaff.toLocaleString()}
                    subValue={`${activeStaff.toLocaleString()} Active`}
                    trend="up"
                    trendValue="1.2%"
                    icon={Users}
                    className="border-l-4 border-l-blue-500"
                />
                <KPICard
                    title="Avg. Caseload / Officer"
                    value={avgCaseload.toString()}
                    subValue="Target: 450 Max"
                    trend="neutral"
                    trendValue="Optimal"
                    icon={Briefcase}
                    className="border-l-4 border-l-emerald-500"
                />
                <KPICard
                    title="Leads Generated"
                    value={leadsGenerated.toLocaleString()}
                    subValue="New Prospect Clients"
                    trend="up"
                    trendValue="15% vs Last Month"
                    icon={Target}
                    className="border-l-4 border-l-purple-500"
                />
                <KPICard
                    title="Attrition Risk (High)"
                    value="14.2%"
                    subValue="28 Officers Watchlisted"
                    trend="down"
                    trendValue="0.8%"
                    icon={AlertTriangle}
                    className="border-l-4 border-l-rose-500"
                />
            </div>

            {/* Detailed Performance Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Chart 1: Productivity Distribution */}
                <div className="bg-white p-6 rounded-xl border border-secondary-200 shadow-sm lg:col-span-2">
                    <h3 className="text-lg font-bold text-secondary-800 mb-4">Field Officer Performance Matrix</h3>
                    <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={STAFF_LIST}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-15} textAnchor="end" />
                                <YAxis yAxisId="left" orientation="left" stroke="#6366f1" />
                                <YAxis yAxisId="right" orientation="right" stroke="#10b981" />
                                <Tooltip />
                                <Legend />
                                <Bar isAnimationActive={false} yAxisId="left" dataKey="disbursement" name="Disbursement (Lakhs)" fill="#6366f1" radius={[4, 4, 0, 0]} />
                                <Bar isAnimationActive={false} yAxisId="right" dataKey="activeClients" name="Active Clients" fill="#10b981" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Top Performers List */}
                <div className="bg-white p-6 rounded-xl border border-secondary-200 shadow-sm">
                    <h3 className="text-lg font-bold text-secondary-800 mb-4 flex items-center gap-2">
                        <Award className="text-amber-500" />
                        Top Performers
                    </h3>
                    <div className="space-y-4">
                        {STAFF_LIST.slice(0, 5).map((staff, idx) => (
                            <div key={staff.id} className="flex items-center justify-between p-3 bg-secondary-50 rounded-lg border border-secondary-100">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-bold text-xs">
                                        {staff.name.split(' ').map(n => n[0]).join('')}
                                    </div>
                                    <div>
                                        <div className="text-sm font-bold text-secondary-900">{staff.name}</div>
                                        <div className="text-xs text-secondary-500">{staff.branch}</div>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="text-sm font-bold text-emerald-600">₹{staff.incentive}</div>
                                    <div className="text-[10px] text-secondary-400">Incentive</div>
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="mt-4 pt-4 border-t border-secondary-100 text-center">
                        <button className="text-sm text-primary-600 font-semibold hover:text-primary-700">View All Leaderboard</button>
                    </div>
                </div>
            </div>

            {/* Operational Metrics */}
            <h3 className="text-lg font-bold text-secondary-800">Operational Compliance</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-5 rounded-xl border border-secondary-200 shadow-sm">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><UserCheck size={20} /></div>
                        <div>
                            <div className="text-sm font-semibold text-secondary-600">Client Retention</div>
                            <div className="text-2xl font-bold text-secondary-900">94.2%</div>
                        </div>
                    </div>
                    <div className="w-full bg-secondary-100 h-2 rounded-full overflow-hidden">
                        <div className="bg-blue-500 h-full" style={{ width: '94.2%' }}></div>
                    </div>
                </div>

                <div className="bg-white p-5 rounded-xl border border-secondary-200 shadow-sm">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg"><CheckCircle2 size={20} /></div>
                        <div>
                            <div className="text-sm font-semibold text-secondary-600">Meeting Attendance</div>
                            <div className="text-2xl font-bold text-secondary-900">88.5%</div>
                        </div>
                    </div>
                    <div className="w-full bg-secondary-100 h-2 rounded-full overflow-hidden">
                        <div className="bg-emerald-500 h-full" style={{ width: '88.5%' }}></div>
                    </div>
                </div>

                <div className="bg-white p-5 rounded-xl border border-secondary-200 shadow-sm">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-amber-50 text-amber-600 rounded-lg"><Clock size={20} /></div>
                        <div>
                            <div className="text-sm font-semibold text-secondary-600">On-Time Starts</div>
                            <div className="text-2xl font-bold text-secondary-900">91.0%</div>
                        </div>
                    </div>
                    <div className="w-full bg-secondary-100 h-2 rounded-full overflow-hidden">
                        <div className="bg-amber-500 h-full" style={{ width: '91%' }}></div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default StaffDashboard;
