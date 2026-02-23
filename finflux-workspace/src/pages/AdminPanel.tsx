import { useState } from 'react';
import { Shield, Users, CheckSquare, Square, ChevronDown, Search, MoreVertical, UserPlus, Lock, Unlock, Plus, X, MapPin } from 'lucide-react';
import { USERS as SYSTEM_USERS } from '../data/users';

const ALL_DASHBOARDS = [
    { id: 'home', label: 'Executive Dashboard' },
    { id: 'trends', label: 'Performance Trends' },
    { id: 'portfolio', label: 'Risk & Portfolio' },
    { id: 'collections', label: 'Collections & Recovery' },
    { id: 'origination', label: 'Loans Origination' },
    { id: 'products', label: 'Product Analytics' },
    { id: 'branch', label: 'Branch View' },
    { id: 'centre', label: 'Centre & Workforce' },
    { id: 'geo', label: 'Geo Drill' },
];

const ROLES = ['CEO / C-Suite', 'CFO / Finance Head', 'Operations Head', 'Risk Officer', 'Branch Manager', 'Area Manager', 'System Admin'];
const ROLE_COLORS: Record<string, string> = {
    'CEO / C-Suite':     'bg-indigo-100 text-indigo-700',
    'CFO / Finance Head':'bg-emerald-100 text-emerald-700',
    'Operations Head':   'bg-amber-100 text-amber-700',
    'Risk Officer':      'bg-rose-100 text-rose-700',
    'Branch Manager':    'bg-blue-100 text-blue-700',
    'Area Manager':      'bg-orange-100 text-orange-700',
    'System Admin':      'bg-violet-100 text-violet-700',
};

// Map system role keys to display labels
const ROLE_LABEL: Record<string, string> = {
    admin:        'System Admin',
    bm:           'Branch Manager',
    area_manager: 'Area Manager',
    analyst:      'Analyst',
};

const DEFAULT_ACCESS: Record<string, string[]> = {
    'CEO / C-Suite': ['home', 'trends', 'portfolio', 'collections', 'products', 'branch', 'geo'],
    'CFO / Finance Head': ['home', 'trends', 'portfolio', 'collections', 'origination', 'products'],
    'Operations Head': ['home', 'trends', 'collections', 'origination', 'branch', 'centre', 'geo'],
    'Risk Officer': ['portfolio', 'collections', 'trends', 'origination', 'branch', 'centre', 'geo'],
    'Branch Manager': ['branch', 'centre', 'origination', 'collections'],
};

interface BranchRestriction {
    state: string;
    district: string;
    branches: string[];
}

interface User {
    id: number;
    name: string;
    email: string;
    role: string;
    status: 'Active' | 'Inactive';
    lastLogin: string;
    access: string[];
    isSystem?: boolean;           // true = comes from users.ts (live RBAC)
    branchRestriction?: BranchRestriction;
}

// Seed from real users.ts — these are the live RBAC accounts
const SYSTEM_SEEDED: User[] = SYSTEM_USERS.map((u, i) => ({
    id: i + 1,
    name: u.name,
    email: u.email,
    role: ROLE_LABEL[u.role] || u.role,
    status: 'Active' as const,
    lastLogin: '23 Feb 2026, 10:00 AM',
    access: u.allowedDashboards,
    isSystem: true,
    branchRestriction: u.branchFilter
        ? { state: u.branchFilter.state, district: u.branchFilter.district, branches: u.branchFilter.branches }
        : undefined,
}));

const INITIAL_USERS: User[] = [
    ...SYSTEM_SEEDED,
    { id: 100, name: 'Sunita Rao', email: 'sunita.rao@finflux.com', role: 'CEO / C-Suite', status: 'Active', lastLogin: '22 Feb 2026, 9:04 AM', access: [...DEFAULT_ACCESS['CEO / C-Suite']] },
    { id: 101, name: 'Rajan Mehta', email: 'rajan.mehta@finflux.com', role: 'CFO / Finance Head', status: 'Active', lastLogin: '22 Feb 2026, 8:31 AM', access: [...DEFAULT_ACCESS['CFO / Finance Head']] },
    { id: 102, name: 'Priya Nair', email: 'priya.nair@finflux.com', role: 'Operations Head', status: 'Active', lastLogin: '21 Feb 2026, 4:15 PM', access: [...DEFAULT_ACCESS['Operations Head']] },
    { id: 103, name: 'Amit Sharma', email: 'amit.sharma@finflux.com', role: 'Risk Officer', status: 'Active', lastLogin: '22 Feb 2026, 10:00 AM', access: [...DEFAULT_ACCESS['Risk Officer']] },
    { id: 104, name: 'Kavita Joshi', email: 'kavita.joshi@finflux.com', role: 'Branch Manager', status: 'Active', lastLogin: '20 Feb 2026, 2:45 PM', access: [...DEFAULT_ACCESS['Branch Manager']] },
    { id: 105, name: 'Srinivas Reddy', email: 's.reddy@finflux.com', role: 'Operations Head', status: 'Active', lastLogin: '22 Feb 2026, 11:22 AM', access: [...DEFAULT_ACCESS['Operations Head']] },
    { id: 106, name: 'Deepa Verma', email: 'deepa.verma@finflux.com', role: 'Branch Manager', status: 'Inactive', lastLogin: '14 Feb 2026, 9:00 AM', access: [...DEFAULT_ACCESS['Branch Manager']] },
    { id: 107, name: 'Kiran Bhat', email: 'kiran.bhat@finflux.com', role: 'Risk Officer', status: 'Active', lastLogin: '22 Feb 2026, 7:50 AM', access: [...DEFAULT_ACCESS['Risk Officer']] },
];

export default function AdminPanel() {
    // Elevate Roles & Access to state so we can mutate them via UI
    const [rolesList, setRolesList] = useState<string[]>(ROLES);
    const [roleAccessMap, setRoleAccessMap] = useState<Record<string, string[]>>(DEFAULT_ACCESS);

    const [users, setUsers] = useState<User[]>(INITIAL_USERS);
    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterRole, setFilterRole] = useState('All');
    const [activeTab, setActiveTab] = useState<'users' | 'roles'>('users');

    // Modal State
    const [showAddUser, setShowAddUser] = useState(false);
    const [newUserState, setNewUserState] = useState({ name: '', email: '', role: rolesList[0] });
    const [showAddRole, setShowAddRole] = useState(false);
    const [newRoleName, setNewRoleName] = useState('');

    const filtered = users.filter(u => {
        const matchSearch = u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            u.email.toLowerCase().includes(searchQuery.toLowerCase());
        const matchRole = filterRole === 'All' || u.role === filterRole;
        return matchSearch && matchRole;
    });

    const toggleAccess = (userId: number, dashId: string) => {
        setUsers(prev => prev.map(u => {
            if (u.id !== userId) return u;
            const has = u.access.includes(dashId);
            return { ...u, access: has ? u.access.filter(a => a !== dashId) : [...u.access, dashId] };
        }));
        if (selectedUser?.id === userId) {
            setSelectedUser(prev => {
                if (!prev) return prev;
                const has = prev.access.includes(dashId);
                return { ...prev, access: has ? prev.access.filter(a => a !== dashId) : [...prev.access, dashId] };
            });
        }
    };

    const toggleStatus = (userId: number) => {
        setUsers(prev => prev.map(u =>
            u.id === userId ? { ...u, status: u.status === 'Active' ? 'Inactive' : 'Active' } : u
        ));
    };

    // Role Config Helpers
    const toggleRoleDefaultAccess = (role: string, dashId: string) => {
        setRoleAccessMap(prev => {
            const current = prev[role] || [];
            if (current.includes(dashId)) {
                return { ...prev, [role]: current.filter(id => id !== dashId) };
            } else {
                return { ...prev, [role]: [...current, dashId] };
            }
        });
    };

    const handleAddUser = () => {
        if (!newUserState.name || !newUserState.email) return;
        const newUser: User = {
            id: Date.now(),
            name: newUserState.name,
            email: Math.random() > 0.5 ? newUserState.email : newUserState.email.toLowerCase(),
            role: newUserState.role,
            status: 'Active',
            lastLogin: 'Never',
            access: roleAccessMap[newUserState.role] ? [...roleAccessMap[newUserState.role]] : []
        };
        setUsers([newUser, ...users]);
        setShowAddUser(false);
        setNewUserState({ name: '', email: '', role: rolesList[0] });
    };

    const handleCreateRole = () => {
        if (!newRoleName) return;
        const role = newRoleName;
        if (!rolesList.includes(role)) {
            setRolesList([...rolesList, role]);
            setRoleAccessMap(prev => ({ ...prev, [role]: [] }));
        }
        setShowAddRole(false);
        setNewRoleName('');
    };

    return (
        <div className="flex flex-col gap-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-secondary-900 flex items-center gap-2">
                        <Shield className="text-indigo-500" size={24} /> Admin Panel
                    </h2>
                    <p className="text-secondary-500 text-sm mt-0.5">Manage user roles and dashboard access permissions</p>
                </div>
                <button className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-colors shadow-sm">
                    <UserPlus size={15} /> Add User
                </button>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                    { label: 'Total Users', value: users.length, color: 'text-indigo-600', bg: 'bg-indigo-50' },
                    { label: 'Active', value: users.filter(u => u.status === 'Active').length, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                    { label: 'Inactive', value: users.filter(u => u.status === 'Inactive').length, color: 'text-rose-600', bg: 'bg-rose-50' },
                    { label: 'Roles', value: rolesList.length, color: 'text-amber-600', bg: 'bg-amber-50' },
                ].map(c => (
                    <div key={c.label} className={`${c.bg} rounded-xl p-4 border border-white`}>
                        <div className={`text-3xl font-extrabold ${c.color}`}>{c.value}</div>
                        <div className="text-secondary-500 text-sm font-medium mt-1">{c.label}</div>
                    </div>
                ))}
            </div>

            {/* Tabs */}
            <div className="flex gap-1 bg-secondary-100 p-1 rounded-xl w-fit">
                {(['users', 'roles'] as const).map(tab => (
                    <button key={tab} onClick={() => setActiveTab(tab)}
                        className={`px-5 py-2 rounded-lg text-sm font-semibold capitalize transition-all ${activeTab === tab ? 'bg-white text-indigo-700 shadow-sm' : 'text-secondary-500 hover:text-secondary-700'}`}>
                        {tab === 'users' ? 'User Management' : 'Role Templates'}
                    </button>
                ))}
            </div>

            {activeTab === 'users' && (
                <div className="flex flex-col lg:flex-row gap-6">
                    {/* User Table */}
                    <div className="flex-1 bg-white rounded-xl border border-secondary-200 shadow-sm overflow-hidden min-w-0">
                        {/* Filters */}
                        <div className="p-4 border-b border-secondary-100 flex items-center gap-3 flex-wrap">
                            <div className="relative flex-1 min-w-[200px]">
                                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary-400" />
                                <input
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    placeholder="Search users..."
                                    className="w-full pl-8 pr-3 py-2 text-sm border border-secondary-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300"
                                />
                            </div>
                            <div className="relative">
                                <select value={filterRole} onChange={e => setFilterRole(e.target.value)}
                                    className="appearance-none pl-3 pr-8 py-2 text-sm border border-secondary-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white">
                                    <option value="All">All Roles</option>
                                    {rolesList.map(r => <option key={r} value={r}>{r}</option>)}
                                </select>
                                <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-secondary-400 pointer-events-none" />
                            </div>
                            <button
                                onClick={() => setShowAddUser(true)}
                                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-semibold shadow-sm transition-colors">
                                <UserPlus size={16} /> Add User
                            </button>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-secondary-50 border-b border-secondary-100">
                                        <th className="text-left px-4 py-3 text-xs font-bold text-secondary-500 uppercase tracking-wider">User</th>
                                        <th className="text-left px-4 py-3 text-xs font-bold text-secondary-500 uppercase tracking-wider">Role</th>
                                        <th className="text-left px-4 py-3 text-xs font-bold text-secondary-500 uppercase tracking-wider">Access</th>
                                        <th className="text-left px-4 py-3 text-xs font-bold text-secondary-500 uppercase tracking-wider">Status</th>
                                        <th className="text-left px-4 py-3 text-xs font-bold text-secondary-500 uppercase tracking-wider">Last Login</th>
                                        <th className="px-4 py-3"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-secondary-100">
                                    {filtered.map(user => (
                                        <tr key={user.id}
                                            onClick={() => setSelectedUser(user)}
                                            className={`hover:bg-indigo-50/50 cursor-pointer transition-colors ${selectedUser?.id === user.id ? 'bg-indigo-50 ring-1 ring-inset ring-indigo-200' : ''}`}>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-8 h-8 rounded-full text-white flex items-center justify-center font-bold text-xs shrink-0 ${user.isSystem ? 'bg-gradient-to-br from-indigo-600 to-violet-600' : 'bg-gradient-to-br from-indigo-400 to-purple-600'}`}>
                                                        {user.name.split(' ').map(n => n[0]).join('')}
                                                    </div>
                                                    <div>
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="font-semibold text-secondary-900">{user.name}</span>
                                                            {user.isSystem && (
                                                                <span className="text-[9px] font-bold bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded-full uppercase tracking-wide">Live</span>
                                                            )}
                                                        </div>
                                                        <div className="text-xs text-secondary-400">{user.email}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${ROLE_COLORS[user.role] || 'bg-slate-100 text-slate-700'}`}>{user.role}</span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className="text-secondary-600 font-medium">{user.access.length} / {ALL_DASHBOARDS.length}</span>
                                                <div className="w-20 h-1.5 bg-secondary-100 rounded-full mt-1">
                                                    <div className="h-full bg-indigo-400 rounded-full" style={{ width: `${(user.access.length / ALL_DASHBOARDS.length) * 100}%` }}></div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <button onClick={e => { e.stopPropagation(); toggleStatus(user.id); }}
                                                    className={`flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full transition-colors ${user.status === 'Active' ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' : 'bg-rose-100 text-rose-700 hover:bg-rose-200'}`}>
                                                    {user.status === 'Active' ? <Unlock size={11} /> : <Lock size={11} />}
                                                    {user.status}
                                                </button>
                                            </td>
                                            <td className="px-4 py-3 text-xs text-secondary-400">{user.lastLogin}</td>
                                            <td className="px-4 py-3">
                                                <button className="p-1 hover:bg-secondary-100 rounded-md text-secondary-400">
                                                    <MoreVertical size={14} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Access Editor Panel */}
                    {selectedUser && (
                        <div className="w-full lg:w-80 shrink-0 bg-white rounded-xl border border-secondary-200 shadow-sm overflow-hidden">
                            <div className={`p-4 text-white ${selectedUser.isSystem ? 'bg-gradient-to-r from-indigo-600 to-violet-600' : 'bg-indigo-600'}`}>
                                <div className="flex items-center justify-between mb-1">
                                    <div className="flex items-center gap-2">
                                        <div className="font-bold text-sm">{selectedUser.name}</div>
                                        {selectedUser.isSystem && (
                                            <span className="text-[9px] font-bold bg-white/20 px-1.5 py-0.5 rounded-full uppercase tracking-wide">Live RBAC</span>
                                        )}
                                    </div>
                                    <button onClick={() => setSelectedUser(null)} className="text-white/60 hover:text-white text-lg leading-none">×</button>
                                </div>
                                <div className="text-indigo-200 text-xs">{selectedUser.email}</div>
                                <div className="text-indigo-200 text-xs mt-0.5">{selectedUser.role}</div>
                            </div>

                            <div className="p-4 space-y-4 overflow-y-auto max-h-[calc(100vh-280px)]">

                                {/* Branch Restriction — only shown for BM / Area Manager */}
                                {selectedUser.branchRestriction && (
                                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                                        <div className="flex items-center gap-1.5 mb-2">
                                            <MapPin size={13} className="text-amber-600 shrink-0" />
                                            <span className="text-xs font-bold text-amber-700 uppercase tracking-wider">Branch Restriction</span>
                                        </div>
                                        <div className="space-y-1 text-xs text-amber-800">
                                            <div className="flex justify-between">
                                                <span className="text-amber-600">State</span>
                                                <span className="font-semibold">{selectedUser.branchRestriction.state}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-amber-600">District</span>
                                                <span className="font-semibold">{selectedUser.branchRestriction.district}</span>
                                            </div>
                                            <div className="mt-2">
                                                <span className="text-amber-600 block mb-1">Allowed Branches ({selectedUser.branchRestriction.branches.length})</span>
                                                <div className="flex flex-wrap gap-1">
                                                    {selectedUser.branchRestriction.branches.map(b => (
                                                        <span key={b} className="bg-amber-100 border border-amber-300 text-amber-800 text-[10px] font-semibold px-2 py-0.5 rounded-full">{b}</span>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Dashboard Access */}
                                <div>
                                    <div className="text-xs font-bold text-secondary-500 uppercase tracking-wider mb-2">Dashboard Access</div>
                                    <div className="space-y-1.5">
                                        {ALL_DASHBOARDS.map(d => {
                                            const has = selectedUser.access.includes(d.id);
                                            return (
                                                <button key={d.id}
                                                    onClick={() => !selectedUser.isSystem && toggleAccess(selectedUser.id, d.id)}
                                                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg border transition-all text-sm
                                                        ${has ? 'bg-indigo-50 border-indigo-200 text-indigo-800' : 'bg-secondary-50 border-secondary-200 text-secondary-400'}
                                                        ${selectedUser.isSystem ? 'cursor-default' : 'cursor-pointer hover:opacity-80'}`}>
                                                    <span className="font-medium">{d.label}</span>
                                                    {has ? <CheckSquare size={16} className="text-indigo-500 shrink-0" /> : <Square size={16} className="shrink-0" />}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                {selectedUser.isSystem ? (
                                    <p className="text-[11px] text-secondary-400 text-center italic">
                                        Live RBAC user — edit permissions in <code className="bg-secondary-100 px-1 rounded">src/data/users.ts</code>
                                    </p>
                                ) : (
                                    <button className="w-full py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 transition-colors">
                                        Save Permissions
                                    </button>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'roles' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {/* Add Role Card */}
                    <div onClick={() => setShowAddRole(true)} className="bg-secondary-50 border-2 border-dashed border-secondary-200 rounded-xl hover:bg-secondary-100 hover:border-indigo-300 transition-colors flex flex-col items-center justify-center p-8 cursor-pointer text-secondary-500 hover:text-indigo-600 gap-2 min-h-[160px]">
                        <div className="w-10 h-10 bg-white border border-secondary-200 rounded-full flex items-center justify-center shadow-sm pointer-events-none">
                            <Plus size={20} />
                        </div>
                        <span className="font-semibold text-sm">Create New Role</span>
                    </div>
                    {/* Existing Roles */}
                    {rolesList.map(role => (
                        <div key={role} className="bg-white rounded-xl border border-secondary-200 shadow-sm p-5 flex flex-col">
                            <div className="flex items-center justify-between mb-4">
                                <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${ROLE_COLORS[role] || 'bg-slate-100 text-slate-700'}`}>{role}</span>
                                <span className="text-xs font-medium text-secondary-400">{(roleAccessMap[role] || []).length} dashboards</span>
                            </div>
                            <div className="space-y-1.5 flex-1">
                                <div className="text-[10px] text-secondary-400 uppercase tracking-wider font-bold mb-2">Default Dashboards Target</div>
                                {ALL_DASHBOARDS.map(d => {
                                    const has = (roleAccessMap[role] || []).includes(d.id);
                                    return (
                                        <div key={d.id}
                                            onClick={() => toggleRoleDefaultAccess(role, d.id)}
                                            className={`flex items-center gap-2 text-xs px-2 py-1.5 rounded cursor-pointer transition-colors ${has ? 'text-secondary-700 bg-secondary-50 hover:bg-secondary-100' : 'text-secondary-400 hover:bg-secondary-50'}`}>
                                            {has ? <CheckSquare size={13} className="text-emerald-500 shrink-0" /> : <Square size={13} className="shrink-0 text-secondary-300" />}
                                            {d.label}
                                        </div>
                                    );
                                })}
                            </div>
                            <div className="mt-4 text-xs font-medium text-secondary-500 border-t border-secondary-100 pt-3">
                                {users.filter(u => u.role === role).length} user(s) currently assigned
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* MODALS */}

            {/* Add User Modal */}
            {showAddUser && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-secondary-900/50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
                        <div className="flex items-center justify-between p-4 border-b border-secondary-100">
                            <h3 className="font-bold text-lg text-secondary-900 flex items-center gap-2">
                                <UserPlus size={18} className="text-indigo-600" /> Add New User
                            </h3>
                            <button onClick={() => setShowAddUser(false)} className="text-secondary-400 hover:text-secondary-600"><X size={18} /></button>
                        </div>
                        <div className="p-4 space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-secondary-600 uppercase tracking-wider mb-1">Full Name</label>
                                <input value={newUserState.name} onChange={e => setNewUserState({ ...newUserState, name: e.target.value })} className="w-full px-3 py-2 text-sm border border-secondary-200 rounded-lg focus:ring-2 focus:ring-indigo-300 focus:outline-none" placeholder="e.g. Rahul Patil" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-secondary-600 uppercase tracking-wider mb-1">Email Address</label>
                                <input value={newUserState.email} onChange={e => setNewUserState({ ...newUserState, email: e.target.value })} type="email" className="w-full px-3 py-2 text-sm border border-secondary-200 rounded-lg focus:ring-2 focus:ring-indigo-300 focus:outline-none" placeholder="rahul@finflux.com" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-secondary-600 uppercase tracking-wider mb-1">Role & Initial Access</label>
                                <select value={newUserState.role} onChange={e => setNewUserState({ ...newUserState, role: e.target.value })} className="w-full px-3 py-2 text-sm border border-secondary-200 rounded-lg focus:ring-2 focus:ring-indigo-300 focus:outline-none bg-white">
                                    {rolesList.map(r => <option key={r} value={r}>{r}</option>)}
                                </select>
                                <p className="text-[10px] text-secondary-400 mt-1">User will inherit the default dashboards allocated for this role.</p>
                            </div>
                        </div>
                        <div className="p-4 border-t border-secondary-100 bg-secondary-50 flex justify-end gap-3">
                            <button onClick={() => setShowAddUser(false)} className="px-4 py-2 text-sm font-semibold text-secondary-600 hover:text-secondary-800">Cancel</button>
                            <button onClick={handleAddUser} disabled={!newUserState.name || !newUserState.email} className="px-4 py-2 text-sm font-semibold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50">Create User</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Add Role Modal */}
            {showAddRole && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-secondary-900/50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden">
                        <div className="flex items-center justify-between p-4 border-b border-secondary-100">
                            <h3 className="font-bold text-lg text-secondary-900 flex items-center gap-2">
                                <Shield size={18} className="text-indigo-600" /> Create New Role
                            </h3>
                            <button onClick={() => setShowAddRole(false)} className="text-secondary-400 hover:text-secondary-600"><X size={18} /></button>
                        </div>
                        <div className="p-4 space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-secondary-600 uppercase tracking-wider mb-1">Role Title</label>
                                <input value={newRoleName} onChange={e => setNewRoleName(e.target.value)} className="w-full px-3 py-2 text-sm border border-secondary-200 rounded-lg focus:ring-2 focus:ring-indigo-300 focus:outline-none" placeholder="e.g. Audit Lead" />
                            </div>
                            <p className="text-xs text-secondary-500">Once created, you can customize this role's default dashboard permissions from the Role grid.</p>
                        </div>
                        <div className="p-4 border-t border-secondary-100 bg-secondary-50 flex justify-end gap-3">
                            <button onClick={() => setShowAddRole(false)} className="px-4 py-2 text-sm font-semibold text-secondary-600 hover:text-secondary-800">Cancel</button>
                            <button onClick={handleCreateRole} disabled={!newRoleName} className="px-4 py-2 text-sm font-semibold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50">Create Role</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
