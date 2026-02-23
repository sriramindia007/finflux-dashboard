import React, { useState, useEffect } from 'react';
import { Calendar, Clock, MapPin, Users, ClipboardCheck, Banknote, CalendarCheck, AlertTriangle, ChevronDown, Check, Zap } from 'lucide-react';
import {
    calculateDuration,
    calculateChainedTravel,
    frequencyCheck,
    generateSlots,
    slotsNeeded,
    insideWindow,
    scoreSlot,
    explainSlot,
    recommendSlot,
    MeetingStop,
    timeToMins,
    minsToTime,
    isSlotOccupied
} from '../lib/schedulerEngine';

// System defaults for the mock
const FO_BASE = { lat: 13.3300, lng: 77.0950, name: "Tumkur Branch Office" };
const DEFAULT_WINDOWS: [string, string][] = [["08:00", "13:00"], ["14:00", "18:00"]];

// Initial mock schedule
const INITIAL_FO_SCHEDULE: MeetingStop[] = [
    { centre: "Tumkur North C2", lat: 13.3550, lng: 77.1150, start: "09:00", end: "10:20", color: "#C53434", bg: "#F9EBEB" },
    { centre: "Tumkur West C1", lat: 13.3300, lng: 77.0800, start: "11:30", end: "12:50", color: "#F4A246", bg: "#FEF6EC" },
    { centre: "Tumkur South C3", lat: 13.3100, lng: 77.1000, start: "15:00", end: "16:20", color: "#C53434", bg: "#F9EBEB" },
];

const CENTRE_DATA = {
    name: "Tumkur C1",
    clients: 20,
    attendance: 0.82,
    collection: 0.91,
    lat: 13.3392,
    lng: 77.1021,
    frequency: "Every 4 weeks, on Wednesday",
    isNew: false
};

const SmartSchedulerPage: React.FC = () => {
    const [schedule, setSchedule] = useState<MeetingStop[]>(INITIAL_FO_SCHEDULE);

    // Engine State
    const [recSlot, setRecSlot] = useState<string | null>(null);
    const [recScore, setRecScore] = useState<number | null>(null);
    const [allFeasible, setAllFeasible] = useState<{ slot: string, score: number }[]>([]);
    const [breakdown, setBreakdown] = useState<any>(null);
    const [insights, setInsights] = useState<string[]>([]);
    const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
    const [manualSlot, setManualSlot] = useState<string>("09:00");
    const [chainedTravel, setChainedTravel] = useState<{ mins: number, km: number }>({ mins: 0, km: 0 });
    const [freqValid, setFreqValid] = useState<boolean>(true);
    const [freqMsg, setFreqMsg] = useState<string>("");

    // UI State
    const [showBreakdown, setShowBreakdown] = useState(false);
    const [showAlternative, setShowAlternative] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isSaved, setIsSaved] = useState(false);

    // Mock meeting date for demo purposes (matching streamlit)
    const MEET_DATE = new Date(2026, 1, 24); // 24 Feb 2026

    const runRecommendation = () => {
        const attendance = CENTRE_DATA.isNew ? 0.78 : CENTRE_DATA.attendance;
        const collection = CENTRE_DATA.isNew ? 0.82 : CENTRE_DATA.collection;
        const dur = calculateDuration(CENTRE_DATA.clients);

        // Gap 1: Chained Travel
        const travel = calculateChainedTravel(schedule, CENTRE_DATA.lat, CENTRE_DATA.lng, FO_BASE.lat, FO_BASE.lng);
        setChainedTravel(travel);

        // Gap 2: Frequency Check
        const freqRes = frequencyCheck(CENTRE_DATA.frequency, MEET_DATE);
        setFreqValid(freqRes.isValid);
        setFreqMsg(freqRes.message);

        // Run engine
        const { duration, allFeasible: all } = recommendSlot(
            CENTRE_DATA.clients, DEFAULT_WINDOWS, attendance, collection, travel.mins
        );

        // Filter out occupied slots
        const available = [];
        for (const f of all) {
            const occ = isSlotOccupied(f.slot, duration, schedule);
            if (!occ.occupied) {
                available.push(f);
            }
        }

        if (available.length > 0) {
            const best = available[0].slot;
            setRecSlot(best);
            setRecScore(available[0].score);
            setSelectedSlot(best);
            const { breakdown: topBreakdown } = scoreSlot(best, attendance, collection, travel.mins / 60);
            setBreakdown(topBreakdown);

            if (topBreakdown) {
                setInsights(explainSlot(best, topBreakdown, duration));
            }
        } else {
            setRecSlot(null);
            setRecScore(null);
            setSelectedSlot(null);
            setBreakdown(null);
            setInsights([]);
        }

        setAllFeasible(available);
    };

    useEffect(() => {
        runRecommendation();
    }, []);

    const duration = calculateDuration(CENTRE_DATA.clients);
    const endTime = selectedSlot ? minsToTime(timeToMins(selectedSlot) + duration) : '—';

    // Banner colours based on validity
    const bannerBg = freqValid ? 'bg-emerald-50' : 'bg-amber-50';
    const bannerBorder = freqValid ? 'border-emerald-600' : 'border-amber-500';
    const bannerText = freqValid ? 'text-emerald-700' : 'text-amber-700';

    return (
        <div className="flex-1 flex flex-col h-full bg-slate-50 overflow-hidden">
            <div className="bg-white border-b border-secondary-200 px-8 py-5 flex items-center justify-between shadow-sm z-10">
                <div className="flex items-center gap-3">
                    <div className="bg-indigo-100 p-2 rounded-lg text-indigo-600">
                        <Calendar size={24} />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-secondary-900 leading-tight">Smart Meeting Scheduler</h1>
                        <p className="text-sm text-secondary-500 flex items-center gap-2">
                            <span className="font-medium text-slate-700">{CENTRE_DATA.name}</span>
                            <span>•</span>
                            <span>{MEET_DATE.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</span>
                            <span>•</span>
                            <span>FO: Vinay</span>
                        </p>
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-8">
                <div className="max-w-6xl mx-auto bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                    {/* Sub-Header: Frequency Banner (Gap 2) */}
                    {freqMsg && (
                        <div className={`mx-6 mt-6 px-4 py-3 border rounded-xl flex items-center gap-3 text-sm font-medium ${bannerBg} ${bannerBorder} ${bannerText}`}>
                            <span className="text-xl">{freqValid ? '✅' : '⚠️'}</span>
                            <span><strong>Product Frequency:</strong> {CENTRE_DATA.frequency || '—'} • {freqMsg}</span>
                        </div>
                    )}

                    {/* Quick Stats Strip */}
                    <div className="flex flex-wrap gap-3 mx-6 mt-4">
                        <StatChip icon={<Users size={14} />} label="Members" value={CENTRE_DATA.clients} />
                        <StatChip
                            icon={<ClipboardCheck size={14} />}
                            label="Attendance"
                            value={`${Math.floor((CENTRE_DATA.isNew ? 0.78 : CENTRE_DATA.attendance) * 100)}%`}
                            highlight={(!CENTRE_DATA.isNew && CENTRE_DATA.attendance >= 0.75) ? 'good' : 'warn'}
                        />
                        <StatChip
                            icon={<Banknote size={14} />}
                            label="Collection"
                            value={`${Math.floor((CENTRE_DATA.isNew ? 0.82 : CENTRE_DATA.collection) * 100)}%`}
                            highlight={(!CENTRE_DATA.isNew && CENTRE_DATA.collection >= 0.80) ? 'good' : 'warn'}
                        />
                        <StatChip icon={<Clock size={14} />} label="Duration" value={`${duration} min`} />
                        <div className="flex-1 min-w-[140px] bg-indigo-50 border border-indigo-100 rounded-lg px-4 py-3 flex flex-col justify-center">
                            <div className="text-[10px] text-indigo-500 font-bold uppercase tracking-wider flex items-center gap-1">
                                <MapPin size={10} /> Travel (Chained)
                            </div>
                            <div className="text-lg font-bold text-indigo-900 tracking-tight mt-0.5">
                                {chainedTravel.mins} min <span className="text-sm font-medium text-indigo-600">({chainedTravel.km} km)</span>
                            </div>
                        </div>
                    </div>

                    {/* Main Content Area: 2 Columns */}
                    <div className="flex flex-1 mt-6 border-t border-slate-100">
                        {/* LEFT COLUMN: ACTION ZONE */}
                        <div className="flex-1 overflow-y-auto px-8 py-8 border-r border-slate-200">
                            {isSaved ? (
                                <div className="h-full flex flex-col items-center justify-center text-center animate-in zoom-in-50 duration-300 py-12">
                                    <div className="w-24 h-24 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-6 shadow-sm">
                                        <Check className="w-12 h-12" />
                                    </div>
                                    <h3 className="text-3xl font-extrabold text-emerald-900 mb-3 tracking-tight">Meeting Scheduled!</h3>
                                    <p className="text-emerald-700 text-lg font-medium">
                                        {CENTRE_DATA.name} is booked for {selectedSlot} - {endTime}
                                    </p>
                                    <button
                                        onClick={() => setIsSaved(false)}
                                        className="mt-8 px-8 py-3 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200 transition"
                                    >
                                        Book Another
                                    </button>
                                </div>
                            ) : (
                                <>
                                    <div className="flex items-center justify-between mb-6">
                                        <h3 className="text-sm font-extrabold text-slate-500 uppercase tracking-widest">AI Optimized Schedule</h3>
                                    </div>

                                    {recSlot ? (
                                        <div className="bg-gradient-to-br from-indigo-50 to-blue-50 border border-indigo-100 rounded-2xl p-8 relative shadow-sm">
                                            <div className="absolute top-4 right-4 bg-indigo-100 text-indigo-700 text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1">
                                                <Zap size={12} /> AI Recommended
                                            </div>

                                            <div className="text-indigo-900/50 font-semibold mb-2">
                                                {MEET_DATE.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                                            </div>
                                            <div className="flex items-baseline gap-3 mb-8">
                                                <div className="text-6xl font-extrabold text-indigo-900 tracking-tighter cursor-pointer">
                                                    {recSlot}
                                                </div>
                                                <div className="text-3xl text-indigo-400 font-medium">to {minsToTime(timeToMins(recSlot) + duration)}</div>
                                            </div>

                                            <div className="flex gap-4">
                                                <button
                                                    onClick={() => {
                                                        setIsSaving(true);
                                                        setTimeout(() => setIsSaving(false), 300);
                                                        setIsSaved(true);
                                                    }}
                                                    className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 px-6 rounded-xl flex items-center justify-center gap-2 transition-all shadow-md hover:shadow-lg active:scale-[0.98] text-lg"
                                                >
                                                    {isSaving ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <CalendarCheck className="w-6 h-6" />}
                                                    Confirm This Slot
                                                </button>
                                                <button
                                                    onClick={() => setShowAlternative(!showAlternative)}
                                                    className="px-8 py-4 border-2 border-indigo-200 text-indigo-700 font-bold rounded-xl hover:bg-indigo-100 hover:border-indigo-300 transition-colors text-lg"
                                                >
                                                    Reschedule
                                                </button>
                                            </div>

                                            {/* Breakdowns */}
                                            <div className="mt-8 border-t border-indigo-100 pt-6">
                                                <button
                                                    onClick={() => setShowBreakdown(!showBreakdown)}
                                                    className="flex items-center justify-between w-full text-left font-bold text-indigo-900 hover:text-indigo-700"
                                                >
                                                    <span className="flex items-center gap-2">
                                                        <AlertTriangle size={18} className="text-indigo-500" />
                                                        Why did AI pick this time? ({recScore?.toFixed(2)} Score)
                                                    </span>
                                                    <ChevronDown size={20} className={`transition-transform duration-300 ${showBreakdown ? 'rotate-180' : ''}`} />
                                                </button>

                                                {showBreakdown && insights.length > 0 && (
                                                    <div className="mt-5 space-y-4 pl-7 border-l-4 border-indigo-200 ml-2 animate-in slide-in-from-top-2 duration-300">
                                                        {insights.map((insight, idx) => (
                                                            <p key={idx} className="text-slate-700 leading-relaxed text-[15px]"
                                                                dangerouslySetInnerHTML={{ __html: insight }} />
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-12 text-center">
                                            <div className="text-rose-600 mb-6 flex justify-center"><AlertTriangle size={64} className="opacity-80" /></div>
                                            <h3 className="text-2xl font-bold text-rose-900 mb-3">No Feasible Slots Available</h3>
                                            <p className="text-rose-700 text-lg">The field officer's schedule is fully booked or there are no slots that fit within the availability windows that do not conflict with existing meetings.</p>
                                        </div>
                                    )}

                                    {/* Alternative Selection */}
                                    {showAlternative && (
                                        <div className="mt-10 animate-in fade-in slide-in-from-top-4 duration-300">
                                            <h4 className="text-sm font-extrabold text-slate-500 uppercase tracking-widest mb-5 border-b pb-3">Alternative Slots</h4>
                                            <div className="grid grid-cols-3 gap-4">
                                                {allFeasible.slice(1, 10).map((f) => (
                                                    <button
                                                        key={f.slot}
                                                        onClick={() => {
                                                            const occ = isSlotOccupied(f.slot, duration, schedule);
                                                            if (!occ.occupied) {
                                                                setRecSlot(f.slot);
                                                                setSelectedSlot(f.slot);
                                                                setRecScore(f.score);
                                                                const { breakdown: newBrk } = scoreSlot(f.slot, attendance, collection, chainedTravel.mins / 60);
                                                                setBreakdown(newBrk);
                                                                if (newBrk) setInsights(explainSlot(f.slot, newBrk, duration));
                                                                setShowAlternative(false);
                                                            }
                                                        }}
                                                        className="px-6 py-4 border-2 border-slate-200 rounded-xl flex flex-col items-center hover:border-indigo-400 hover:bg-indigo-50 transition-colors group shadow-sm hover:shadow"
                                                    >
                                                        <span className="font-extrabold text-xl text-slate-800 group-hover:text-indigo-700">{f.slot}</span>
                                                        <span className="text-sm text-slate-500 font-semibold mt-1">Score: {f.score.toFixed(2)}</span>
                                                    </button>
                                                ))}
                                                <div className="col-span-3 mt-4 flex items-center justify-between bg-slate-100 p-5 rounded-xl border border-slate-200">
                                                    <span className="font-bold text-slate-700">Manual Override:</span>
                                                    <div className="flex gap-3">
                                                        <select
                                                            value={manualSlot}
                                                            onChange={(e) => setManualSlot(e.target.value)}
                                                            className="bg-white border-2 border-slate-300 rounded-lg px-4 py-2 font-bold focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                                                        >
                                                            {generateSlots().map(s => <option key={s} value={s}>{s}</option>)}
                                                        </select>
                                                        <button
                                                            onClick={() => {
                                                                const occ = isSlotOccupied(manualSlot, duration, schedule);
                                                                if (occ.occupied) {
                                                                    alert(`Slot conflicts with ${occ.centreName}`);
                                                                    return;
                                                                }
                                                                setRecSlot(manualSlot);
                                                                setSelectedSlot(manualSlot);
                                                                setRecScore(0);
                                                                const { breakdown: newBrk } = scoreSlot(manualSlot, attendance, collection, chainedTravel.mins / 60);
                                                                setBreakdown(newBrk);
                                                                if (newBrk) setInsights(explainSlot(manualSlot, newBrk, duration));
                                                                setShowAlternative(false);
                                                            }}
                                                            className="bg-slate-800 text-white px-6 py-2 rounded-lg font-bold hover:bg-slate-700 transition"
                                                        >
                                                            Select
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>

                        {/* RIGHT COLUMN: CONTEXT (Map Placeholder & Schedule) */}
                        <div className="w-[38%] bg-slate-50 p-8 flex flex-col border-l border-white shadow-[inset_1px_0_0_rgba(0,0,0,0.05)]">
                            <h3 className="text-sm font-extrabold text-slate-500 uppercase tracking-widest mb-5">Today's Operating Picture</h3>

                            <div className="flex-1 bg-white border border-slate-200 rounded-2xl flex flex-col overflow-hidden shadow-sm">
                                {/* Map Placeholder */}
                                <div className="h-48 bg-indigo-50 relative overflow-hidden flex items-center justify-center border-b border-slate-100 shrink-0">
                                    <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(#CBD5E1 1px, transparent 1px)', backgroundSize: '16px 16px', opacity: 0.6 }}></div>
                                    <div className="z-10 text-center bg-white/80 backdrop-blur px-6 py-3 rounded-2xl border border-white shadow-sm">
                                        <MapPin size={24} className="text-indigo-400 mx-auto mb-1" />
                                        <p className="text-xs font-bold text-indigo-900 uppercase tracking-widest">Routing Engine Preview</p>
                                    </div>
                                </div>

                                {/* Schedule Summary */}
                                <div className="p-6 overflow-y-auto flex-1 bg-white">
                                    <div className="space-y-4 relative before:absolute before:inset-0 before:ml-2.5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-200 before:to-transparent">
                                        {schedule.map((s, i) => (
                                            <div key={s.centre} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                                                {/* <div className="flex items-center justify-center w-5 h-5 rounded-full border-4 border-white bg-slate-300 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2"></div> */}
                                                <div className="w-[calc(100%-2.5rem)] md:w-[calc(50%-1.25rem)] p-3 rounded-xl border border-slate-100 bg-slate-50 shadow-sm">
                                                    <div className="font-bold text-slate-800 text-sm mb-1">{s.start} - {s.end}</div>
                                                    <div className="text-xs font-semibold text-slate-500">{s.centre}</div>
                                                </div>
                                            </div>
                                        ))}

                                        {selectedSlot && !isSaved && (
                                            <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active mt-6">
                                                <div className="w-[calc(100%-2.5rem)] md:w-[calc(50%-1.25rem)] p-4 rounded-xl border-2 border-indigo-400 bg-indigo-50 shadow-md transform -translate-y-1">
                                                    <div className="font-extrabold text-indigo-900 text-sm mb-1">{selectedSlot} - {endTime}</div>
                                                    <div className="text-xs font-bold text-indigo-600 flex items-center gap-1">
                                                        <Zap size={10} /> {CENTRE_DATA.name} (Pending)
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

// Helper component
const StatChip = ({ icon, label, value, highlight }: { icon: React.ReactNode, label: string, value: string | number, highlight?: 'good' | 'warn' }) => {
    let valColor = 'text-slate-800';
    if (highlight === 'good') valColor = 'text-emerald-700';
    if (highlight === 'warn') valColor = 'text-rose-600';

    return (
        <div className="flex-1 min-w-[120px] bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 flex flex-col justify-center">
            <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider flex items-center gap-1">
                {icon} {label}
            </div>
            <div className={`text-xl font-extrabold tracking-tight mt-0.5 ${valColor}`}>
                {value}
            </div>
        </div>
    );
};

export default SmartSchedulerPage;
