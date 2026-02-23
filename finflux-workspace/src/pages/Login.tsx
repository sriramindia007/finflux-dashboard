import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { Lock, Eye, EyeOff, AlertCircle, Zap } from 'lucide-react';
import { findUser, persistUser } from '../data/users';

const QUICK_FILL = [
    { label: 'Admin', role: 'Platform Admin', email: 'srinivas.rao@finflux.in', password: 'Finflux@2025', color: 'bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100' },
    { label: 'Area Mgr', role: 'Area Manager · Khordha', email: 'sunita.pattnaik@finflux.in', password: 'Sunita@2025', color: 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100' },
    { label: 'Branch Mgr', role: 'BM · Bagheitangi', email: 'rajesh.mohanty@finflux.in', password: 'Rajesh@2025', color: 'bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100' },
];

const Login = () => {
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleLogin = (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        setTimeout(() => {
            const user = findUser(email.trim(), password);
            if (!user) {
                setLoading(false);
                setError('Invalid email or password. Please try again.');
                return;
            }

            persistUser(user);
            setLoading(false);

            // Always go to persona selection page after login.
            // LandingPage will filter personas based on the user's role.
            navigate('/');
        }, 600);
    };

    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
            <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 border border-slate-200">

                {/* Header */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-indigo-100 text-indigo-600 rounded-2xl mb-4">
                        <Lock size={32} />
                    </div>
                    <div className="flex items-center justify-center gap-2 mb-2">
                        <div className="w-6 h-6 bg-indigo-600 rounded-md flex items-center justify-center text-white font-black text-xs">F</div>
                        <span className="text-slate-900 font-bold text-lg tracking-tight">FINFLUX Analytics</span>
                    </div>
                    <p className="text-slate-500 text-sm">Sign in to access your dashboard</p>
                </div>

                {/* Quick Fill — Demo shortcuts */}
                <div className="mb-6">
                    <div className="flex items-center gap-1.5 mb-2">
                        <Zap size={12} className="text-slate-400" />
                        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Quick Fill</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                        {QUICK_FILL.map(q => (
                            <button
                                key={q.email}
                                type="button"
                                onClick={() => { setEmail(q.email); setPassword(q.password); setError(''); }}
                                className={`border rounded-lg px-2 py-2 text-left transition-colors ${q.color}`}
                            >
                                <div className="text-xs font-bold leading-tight">{q.label}</div>
                                <div className="text-[10px] opacity-70 mt-0.5 leading-tight">{q.role}</div>
                            </button>
                        ))}
                    </div>
                </div>

                <form onSubmit={handleLogin} className="space-y-5">
                    {/* Error Banner */}
                    {error && (
                        <div className="flex items-center gap-2 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg px-4 py-3 text-sm">
                            <AlertCircle size={16} className="shrink-0" />
                            {error}
                        </div>
                    )}

                    {/* Email */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                            Email Address
                        </label>
                        <input
                            type="email"
                            required
                            autoFocus
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all text-sm"
                            placeholder="you@finflux.com"
                        />
                    </div>

                    {/* Password */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                            Password
                        </label>
                        <div className="relative">
                            <input
                                type={showPassword ? 'text' : 'password'}
                                required
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all text-sm pr-12"
                                placeholder="••••••••"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                            >
                                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>
                    </div>

                    {/* Submit */}
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed text-sm"
                    >
                        {loading
                            ? <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            : <>Sign In</>
                        }
                    </button>
                </form>

                <div className="mt-6 text-center text-xs text-slate-400">
                    Restricted Access • Authorized Personnel Only
                </div>
            </div>
        </div>
    );
};

export default Login;
