import React, { useState, useEffect } from 'react';
import { X, Calendar, Clock, MapPin, Users, ClipboardCheck, Banknote, CalendarCheck, AlertTriangle, ChevronDown, Check, Zap } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
});
L.Marker.prototype.options.icon = DefaultIcon;
import AiRouteAnalysisOverlay from './AiRouteAnalysisOverlay';
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
    isSlotOccupied,
    calculateRouteMetrics,
    calculateOptimalRoute
} from '../lib/schedulerEngine';

interface SmartSchedulerModalProps {
    isOpen: boolean;
    onClose: () => void;
    centreData: any; // Using any for ease, will depend on CentreDashboard data
    onConfirm?: (slotTime: string) => void;
}

// System defaults for the mock
const FO_BASE = { lat: 13.3300, lng: 77.0950, name: "Tumkur Branch Office" };
const DEFAULT_WINDOWS: [string, string][] = [["08:00", "13:00"], ["14:00", "19:00"]];

// Initial mock schedule
const INITIAL_FO_SCHEDULE: MeetingStop[] = [
    { centre: "Tumkur North C2", lat: 13.3550, lng: 77.1150, start: "09:00", end: "10:20", color: "#C53434", bg: "#F9EBEB" },
    { centre: "Tumkur South C3", lat: 13.3100, lng: 77.1000, start: "11:30", end: "12:50", color: "#C53434", bg: "#F9EBEB" },
    { centre: "Tumkur West C1", lat: 13.3300, lng: 77.0800, start: "15:00", end: "16:20", color: "#F4A246", bg: "#FEF6EC" },
];

const SmartSchedulerModal: React.FC<SmartSchedulerModalProps> = ({ isOpen, onClose, centreData, onConfirm }) => {
    // We will hardcode some static metadata for "Tumkur C1" to match the Streamlit demo
    const [schedule, setSchedule] = useState<MeetingStop[]>(INITIAL_FO_SCHEDULE);

    // Engine State
    const [aiBestSlot, setAiBestSlot] = useState<string | null>(null);
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
    const [showAiAnalysis, setShowAiAnalysis] = useState(false);
    const [showStats, setShowStats] = useState(false); // collapsed by default for mobile UX

    // Hardcode some data to match the Streamlit demo exactly if it's the target centre
    const isTargetCentre = centreData.name.includes("Tumkur C1");
    // If it's the target centre, use the mock data, else use the dashboard data
    const cLat = isTargetCentre ? 13.3392 : 13.3392;
    const cLng = isTargetCentre ? 77.1021 : 77.1021;
    const cFreq = isTargetCentre ? "Every 4 weeks, on Wednesday" : "Every 4 weeks";
    const cMembers = isTargetCentre ? 20 : centreData.clients;
    const cAtt = isTargetCentre ? 0.82 : (centreData.meetings?.avgAttendance / 100 || 0.85);
    const cCol = isTargetCentre ? 0.91 : (centreData.collection?.withinRange / 100 || 0.88);
    const isNew = centreData.name.includes("New");

    // Mock meeting date for demo purposes (matching streamlit)
    const MEET_DATE = new Date(2026, 1, 24); // 24 Feb 2026

    const attendance = isNew ? 0.78 : cAtt;
    const collection = isNew ? 0.82 : cCol;

    const runRecommendation = () => {
        const dur = calculateDuration(cMembers);

        // Gap 1: Chained Travel
        const travel = calculateChainedTravel(schedule, cLat, cLng, FO_BASE.lat, FO_BASE.lng);
        setChainedTravel(travel);

        // Gap 2: Frequency Check
        const freqRes = frequencyCheck(cFreq, MEET_DATE);
        setFreqValid(freqRes.isValid);
        setFreqMsg(freqRes.message);

        // Run engine
        const { duration, allFeasible: all } = recommendSlot(
            cMembers, DEFAULT_WINDOWS, attendance, collection, travel.mins, isNew
        );

        // Filter out occupied slots
        const available = [];
        for (const f of all) {
            const occ = isSlotOccupied(f.slot, duration, schedule, centreData.name);
            if (!occ.occupied) {
                available.push(f);
            }
        }

        if (available.length > 0) {
            const best = available[0].slot;
            setAiBestSlot(best);
            setRecSlot(best);
            setRecScore(available[0].score);
            setSelectedSlot(best);
            const { breakdown: topBreakdown } = scoreSlot(best, attendance, collection, travel.mins / 60, isNew);
            setBreakdown(topBreakdown);

            if (topBreakdown) {
                setInsights(explainSlot(best, topBreakdown, duration, isNew));
            }
        } else {
            setAiBestSlot(null);
            setRecSlot(null);
            setRecScore(null);
            setSelectedSlot(null);
            setBreakdown(null);
            setInsights([]);
        }

        setAllFeasible(available);
    };

    useEffect(() => {
        if (isOpen && !isSaved) {
            // Only run recommendation when first opening, not after save
            runRecommendation();
        }
    }, [isOpen, centreData]);

    if (!isOpen) return null;

    const duration = calculateDuration(cMembers);
    const endTime = selectedSlot ? minsToTime(timeToMins(selectedSlot) + duration) : '—';

    // Compute the score for whatever slot is currently selected (for honest delta comparison)
    const selectedScore = selectedSlot
        ? scoreSlot(selectedSlot, attendance, collection, chainedTravel.mins / 60, isNew).total
        : null;
    const scoreDelta = (recScore !== null && selectedScore !== null)
        ? Number((recScore - selectedScore).toFixed(3))
        : 0;
    // Only flag as meaningfully suboptimal if the gap is >0.08 (8 pts on a 0-1 scale)
    const isMeaningfullySuboptimal = selectedSlot !== aiBestSlot && scoreDelta > 0.08;

    // Banner colours based on validity
    const bannerBg = 'bg-slate-50';
    const bannerBorder = 'border-slate-200';
    const bannerText = 'text-slate-700';

    return (
        <div className="fixed inset-0 z-[100] flex items-start md:items-center justify-center bg-slate-900/60 backdrop-blur-sm px-2 md:px-4 pt-2 md:pt-0">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl h-[96vh] md:max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">

                {/* Header */}
                <div className="bg-slate-50 border-b border-slate-200 px-4 md:px-6 py-3 md:py-4 flex items-center justify-between shrink-0">
                    <div className="flex-1 min-w-0 pr-2">
                        <h2 className="text-base md:text-xl font-bold text-slate-800">Smart Meeting Scheduler</h2>
                        <p className="text-xs md:text-sm text-slate-500 mt-0.5 flex flex-wrap items-center gap-1 md:gap-2">
                            <span className="font-medium text-slate-700">{centreData.name}</span>
                            <span className="hidden md:inline">•</span>
                            <span className="hidden md:inline">{MEET_DATE.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</span>
                            <span className="hidden md:inline">•</span>
                            <span className="hidden md:inline">FO: Vinay</span>
                            <span className="hidden md:inline">•</span>
                            <span className="text-[11px]">{isNew ? '🆕 New — predicted data' : '✅ Existing — live data'}</span>
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors shrink-0">
                        <X className="w-5 h-5 text-slate-500" />
                    </button>
                </div>

                {/* Sub-Header: Frequency Banner (Gap 2) */}
                <div className={`mx-3 md:mx-6 mt-3 md:mt-4 px-3 md:px-4 py-2 border rounded-lg flex items-center gap-3 text-xs md:text-sm font-medium shrink-0 ${bannerBg} ${bannerBorder} ${bannerText}`}>
                    <span className="text-base md:text-lg">📅</span>
                    <span><strong>Frequency:</strong> {cFreq || '—'}</span>
                </div>

                {/* Quick Stats Strip — collapsed by default, tap to expand */}
                <div className="mx-3 md:mx-6 mt-2 md:mt-3 shrink-0">
                    {/* Collapsed summary bar — always visible */}
                    <button
                        onClick={() => setShowStats(s => !s)}
                        className="w-full flex items-center justify-between px-3 py-2 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-xl text-xs font-medium text-slate-600 transition-colors"
                    >
                        <div className="flex items-center gap-3 flex-wrap">
                            <span className="flex items-center gap-1">
                                <Users size={12} className="text-slate-400" />
                                <span className="font-bold text-slate-700">{cMembers}</span> members
                            </span>
                            <span className="text-slate-300">•</span>
                            <span>
                                Att: <span className={`font-bold ${(!isNew && cAtt >= 0.75) ? 'text-emerald-600' : 'text-rose-500'}`}>
                                    {Math.floor((isNew ? 0.78 : cAtt) * 100)}%
                                </span>
                            </span>
                            <span className="text-slate-300">•</span>
                            <span>
                                Col: <span className={`font-bold ${(!isNew && cCol >= 0.80) ? 'text-emerald-600' : 'text-rose-500'}`}>
                                    {Math.floor((isNew ? 0.82 : cCol) * 100)}%
                                </span>
                            </span>
                            <span className="text-slate-300">•</span>
                            <span><span className="font-bold text-slate-700">{duration}</span> min</span>
                            {chainedTravel.mins > 0 && (
                                <><span className="text-slate-300">•</span>
                                    <span className="flex items-center gap-1">
                                        <MapPin size={10} className="text-blue-400" />
                                        <span className="font-bold text-slate-700">{chainedTravel.km} km</span>
                                    </span></>
                            )}
                        </div>
                        <ChevronDown size={14} className={`text-slate-400 shrink-0 ml-2 transition-transform duration-200 ${showStats ? 'rotate-180' : ''}`} />
                    </button>

                    {/* Expanded stat chips */}
                    {showStats && (
                        <div className="flex flex-wrap gap-2 mt-2 animate-in slide-in-from-top-2 duration-200">
                            <StatChip icon={<Users size={14} />} label="Members" value={cMembers} />
                            <StatChip
                                icon={<ClipboardCheck size={14} />}
                                label="Attendance"
                                value={`${Math.floor((isNew ? 0.78 : cAtt) * 100)}%`}
                                highlight={(!isNew && cAtt >= 0.75) ? 'good' : 'warn'}
                            />
                            <StatChip
                                icon={<Banknote size={14} />}
                                label="Collection"
                                value={`${Math.floor((isNew ? 0.82 : cCol) * 100)}%`}
                                highlight={(!isNew && cCol >= 0.80) ? 'good' : 'warn'}
                            />
                            <StatChip icon={<Clock size={14} />} label="Duration" value={`${duration} min`} />
                            <div className="flex-1 min-w-[130px] bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 flex flex-col justify-center">
                                <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider flex items-center gap-1">
                                    <MapPin size={10} /> Travel (Chained)
                                </div>
                                <div className="text-sm font-bold text-slate-800 tracking-tight mt-0.5">
                                    {chainedTravel.mins} min • {chainedTravel.km} km
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Main Content Area: 2 Columns on desktop, single scrollable column on mobile */}
                <div className="flex flex-col md:flex-row flex-1 overflow-y-auto md:overflow-hidden mt-3 md:mt-4">

                    {/* LEFT COLUMN: ACTION ZONE */}
                    <div className="flex-1 md:border-r border-slate-200 overflow-y-auto px-3 md:px-6 pb-4 md:pb-6">
                        {isSaved ? (
                            <div className="h-full flex flex-col items-center justify-center p-8 text-center animate-in zoom-in-50 duration-300">
                                <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-6">
                                    <Check className="w-10 h-10" />
                                </div>
                                <h3 className="text-2xl font-bold text-emerald-900 mb-2">Meeting Scheduled!</h3>
                                <p className="text-emerald-700 text-lg">
                                    {centreData.name} is booked for {selectedSlot} - {endTime}
                                </p>
                                <button
                                    onClick={onClose}
                                    className="mt-8 px-8 py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition"
                                >
                                    Return to Overview
                                </button>
                            </div>
                        ) : (
                            <div className="flex flex-col-reverse md:flex-col">
                                <div className="mt-8 md:mt-0">
                                    <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4">AI Optimized Slot Schedule</h3>

                                    {recSlot ? (
                                        <div className="bg-gradient-to-br from-indigo-50 to-blue-50 border border-indigo-100 rounded-2xl p-6 relative shadow-sm">
                                            <div className="absolute top-4 right-4 bg-indigo-100 text-indigo-700 text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1">
                                                <Zap size={12} /> AI Recommended
                                            </div>

                                            <div className="text-slate-500 font-medium mb-1">
                                                {MEET_DATE.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                                            </div>
                                            <div className="flex items-baseline gap-3 mb-6">
                                                <div className="text-5xl font-extrabold text-slate-900 tracking-tighter cursor-pointer text-indigo-700">
                                                    {recSlot}
                                                </div>
                                                <div className="text-2xl text-slate-500 font-medium">to {minsToTime(timeToMins(recSlot) + duration)}</div>
                                            </div>

                                            <div className="flex gap-4">
                                                <button
                                                    onClick={() => {
                                                        setIsSaving(true);
                                                        setTimeout(() => {
                                                            setIsSaving(false);
                                                            setIsSaved(true);
                                                            // Append to schedule dynamically so map updates
                                                            if (selectedSlot) {
                                                                setSchedule(prev => {
                                                                    const filtered = prev.filter(p => p.centre !== centreData.name);
                                                                    return [...filtered, {
                                                                        centre: centreData.name,
                                                                        lat: centreData.lat || cLat,
                                                                        lng: centreData.lng || cLng,
                                                                        start: selectedSlot,
                                                                        end: endTime,
                                                                        color: "#3b82f6", // new slot color
                                                                        bg: "#eff6ff"
                                                                    }];
                                                                });
                                                            }
                                                        }, 500);
                                                    }}
                                                    className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 transition-all shadow-md active:scale-[0.98]"
                                                >
                                                    {isSaving ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <CalendarCheck className="w-5 h-5" />}
                                                    Confirm This Slot
                                                </button>
                                            </div>

                                            {/* Suboptimal Selection — only shown when diff is genuinely material */}
                                            {selectedSlot !== aiBestSlot && (
                                                isMeaningfullySuboptimal ? (
                                                    <div className="mt-4 bg-orange-50 border border-orange-200 rounded-xl p-4 flex items-start gap-3 animate-in slide-in-from-top-2">
                                                        <AlertTriangle className="text-orange-500 shrink-0 mt-0.5" size={18} />
                                                        <div className="text-orange-900 text-sm">
                                                            <strong>Lower-ranked slot selected.</strong> The AI pick ({aiBestSlot}) scores <span className="font-bold">{recScore?.toFixed(3)}</span> vs your choice ({selectedSlot}) at <span className="font-bold">{selectedScore?.toFixed(3)}</span> — a gap of <span className="font-bold">{scoreDelta.toFixed(3)}</span>.
                                                            <p className="mt-1 opacity-80 text-[12px]">This is driven by the time-of-day preference component ({aiBestSlot} is in a better attendance window for this demographic). Attendance and collection rates are unchanged.</p>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="mt-4 bg-blue-50 border border-blue-100 rounded-xl p-3 flex items-center gap-2 animate-in slide-in-from-top-2">
                                                        <span className="text-blue-500 text-sm">ℹ️</span>
                                                        <p className="text-blue-800 text-xs">
                                                            <strong>Minor preference difference.</strong> {selectedSlot} scores <strong>{selectedScore?.toFixed(3)}</strong> vs AI pick {aiBestSlot} at <strong>{recScore?.toFixed(3)}</strong> (gap: {scoreDelta.toFixed(3)}). Both slots are viable — the difference is a small time-of-day preference only.
                                                        </p>
                                                    </div>
                                                )
                                            )}

                                            {/* Breakdowns */}
                                            <div className="mt-6 border-t border-indigo-100/50 pt-4">
                                                <button
                                                    onClick={() => setShowBreakdown(!showBreakdown)}
                                                    className="flex items-center justify-between w-full text-left font-semibold text-indigo-900 hover:text-indigo-700"
                                                >
                                                    <span className="flex items-center gap-2">
                                                        <AlertTriangle size={16} className="text-indigo-500" />
                                                        Why did AI pick this time? ({recScore?.toFixed(2)} Score)
                                                    </span>
                                                    <ChevronDown size={18} className={`transition-transform ${showBreakdown ? 'rotate-180' : ''}`} />
                                                </button>

                                                {showBreakdown && insights.length > 0 && (
                                                    <div className="mt-4 space-y-3 pl-6 border-l-2 border-indigo-200 ml-2 animate-in slide-in-from-top-2 duration-200">
                                                        {insights.map((insight, idx) => (
                                                            <p key={idx} className="text-sm text-slate-700 leading-relaxed"
                                                                dangerouslySetInnerHTML={{ __html: insight }} />
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-8 text-center">
                                            <div className="text-rose-600 mb-4 flex justify-center"><AlertTriangle size={48} /></div>
                                            <h3 className="text-xl font-bold text-rose-900 mb-2">No Feasible Slots Available</h3>
                                            <p className="text-rose-700">The field officer's schedule is fully booked or there are no slots that fit within the availability windows that do not conflict with existing meetings.</p>
                                        </div>
                                    )}
                                </div>

                                {/* Alternative Selection Grid */}
                                <div className="mt-0 md:mt-8 mb-4 md:mb-0 animate-in fade-in duration-300">
                                    <div className="mb-4">
                                        <h4 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-2">Select a Time Slot</h4>
                                        <div className="text-[11px] md:text-xs text-slate-500 flex flex-col sm:flex-row sm:items-center gap-2 md:gap-3">
                                            <span className="flex items-center gap-1"><div className="w-2.5 h-2.5 rounded-full bg-rose-200 border border-rose-300"></div> Occupied</span>
                                            <span className="flex items-center gap-1"><div className="w-2.5 h-2.5 rounded-full bg-indigo-500"></div> AI Pick</span>
                                            <span className="flex items-center gap-1"><div className="w-2.5 h-2.5 rounded-full bg-white border border-slate-300"></div> Free</span>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                                        {generateSlots().map((slot) => {
                                            const occ = isSlotOccupied(slot, duration, schedule, centreData.name);
                                            const isRec = slot === recSlot;
                                            const isSel = slot === selectedSlot;

                                            if (occ.occupied) {
                                                return (
                                                    <div key={slot} className="flex flex-col items-center justify-center p-2 rounded-xl border-2 border-rose-100 bg-rose-50 text-rose-700 opacity-60 cursor-not-allowed h-16">
                                                        <span className="font-bold text-sm">{slot}</span>
                                                        <span className="text-[10px] truncate w-full text-center mt-0.5">{occ.centreName}</span>
                                                    </div>
                                                );
                                            }

                                            let btnClass = "flex flex-col items-center justify-center p-2 rounded-xl border-2 transition-all h-16 cursor-pointer hover:border-indigo-400 hover:bg-indigo-50";
                                            let textClass = "font-bold text-sm text-slate-700";
                                            let iconNode = null;

                                            if (slot === aiBestSlot) {
                                                btnClass = "flex flex-col items-center justify-center p-2 rounded-xl border-2 transition-all h-16 cursor-pointer bg-indigo-600 border-indigo-600 shadow-md";
                                                textClass = "font-bold text-sm text-white flex items-center gap-1";
                                                iconNode = "⭐";
                                            } else if (isSel) {
                                                btnClass = "flex flex-col items-center justify-center p-2 rounded-xl border-2 transition-all h-16 cursor-pointer bg-indigo-50 border-indigo-500";
                                                textClass = "font-bold text-sm text-indigo-700 flex items-center gap-1";
                                                iconNode = "✓";
                                            }

                                            return (
                                                <button
                                                    key={slot}
                                                    onClick={() => {
                                                        setRecSlot(slot);
                                                        setSelectedSlot(slot);

                                                        // Find if this is one of our explicitly scored feasible slots to show the score
                                                        const feasibleMatch = allFeasible.find(f => f.slot === slot);
                                                        setRecScore(feasibleMatch ? feasibleMatch.score : 0);

                                                        const { breakdown: newBrk } = scoreSlot(slot, attendance, collection, chainedTravel.mins / 60, isNew);
                                                        setBreakdown(newBrk);
                                                        if (newBrk) setInsights(explainSlot(slot, newBrk, duration, isNew));
                                                    }}
                                                    className={btnClass}
                                                >
                                                    <span className={textClass}>
                                                        {iconNode} {slot}
                                                    </span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* RIGHT COLUMN: CONTEXT MAP — stacks below on mobile, side panel on desktop */}
                    <div className="w-full md:w-[35%] bg-slate-50 p-3 md:p-6 flex flex-col border-t md:border-t-0 md:border-l border-slate-200">
                        <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3 md:mb-4">Route Context</h3>

                        {/* Expand Map Button — at TOP so it's always visible on mobile */}
                        <div className="mb-3">
                            <button
                                id="expand-map-ai-analysis-btn"
                                onClick={() => setShowAiAnalysis(true)}
                                className="w-full py-3 md:py-2.5 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 font-semibold rounded-xl text-sm flex items-center justify-center gap-2 transition active:scale-95"
                            >
                                <MapPin size={16} className="text-indigo-500" />
                                Expand Map &amp; AI Analysis
                            </button>
                        </div>

                        <div className="bg-white border border-slate-200 rounded-xl flex flex-col overflow-hidden">
                            {/* Interactive Route Map — fixed height, no flex-1/absolute to avoid clip issues */}
                            <div className="h-[220px] md:h-[260px] border-b border-slate-100 relative z-0">
                                <MapContainer
                                    center={[FO_BASE.lat, FO_BASE.lng]}
                                    zoom={11}
                                    scrollWheelZoom={false}
                                    className="h-full w-full font-sans"
                                >
                                    <TileLayer
                                        url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
                                    />
                                    {/* Base */}
                                    <Marker position={[FO_BASE.lat, FO_BASE.lng]}>
                                        <Popup><strong>{FO_BASE.name}</strong><br />Field Officer Base</Popup>
                                    </Marker>

                                    {/* Existing Schedule */}
                                    {schedule.map((s, idx) => (
                                        <Marker key={idx} position={[s.lat, s.lng]}>
                                            <Popup>
                                                <strong>{s.centre}</strong><br />
                                                Time: {s.start} - {s.end}
                                            </Popup>
                                        </Marker>
                                    ))}

                                    {/* Selected Slot Centre */}
                                    {selectedSlot && centreData.lat && (
                                        <Marker position={[centreData.lat, centreData.lng]}>
                                            <Popup>
                                                <strong>{centreData.name}</strong><br />
                                                {isSaved ? "Scheduled:" : "Proposed:"} {selectedSlot} - {endTime}
                                            </Popup>
                                        </Marker>
                                    )}
                                </MapContainer>
                            </div>

                            {/* Schedule Summary — only on larger screens */}
                            <div className="p-4 bg-white hidden lg:block h-[180px] overflow-y-auto">
                                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Today's Schedule</h4>
                                <div className="space-y-3">
                                    {schedule.map((s, i) => (
                                        <div key={`${s.centre}-${i}`} className="flex gap-3 text-sm items-center">
                                            <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: s.color }}></div>
                                            <div className="font-semibold text-slate-700 flex-1">{s.start} - {s.end}</div>
                                            <div className="text-slate-500 text-xs truncate max-w-[120px] font-medium" title={s.centre}>{s.centre}</div>
                                        </div>
                                    ))}
                                    {selectedSlot && !isSaved && (
                                        <div className="flex gap-3 text-sm items-center p-2 bg-indigo-50 rounded border border-indigo-100 mt-2">
                                            <div className="w-2 h-2 rounded-full bg-indigo-500"></div>
                                            <div className="font-bold text-indigo-700 flex-1">{selectedSlot} - {endTime}</div>
                                            <div className="text-indigo-600 text-xs truncate max-w-[100px] font-bold" title={centreData.name}>{centreData.name}</div>
                                        </div>
                                    )}
                                </div>
                            </div>


                        </div>
                    </div>
                </div>

            </div>

            {/* AI Route Analysis Overlay */}
            {showAiAnalysis && (
                <AiRouteAnalysisOverlay
                    onClose={() => setShowAiAnalysis(false)}
                    targetCentre={{ name: centreData.name, lat: cLat, lng: cLng }}
                    selectedSlot={selectedSlot}
                    recommendedSlot={aiBestSlot}
                    schedule={schedule}
                    duration={calculateDuration(cMembers)}
                    centreAttendanceRate={attendance}
                    centreCollectionRate={collection}
                    onApplyRecommendation={(slot) => {
                        setSelectedSlot(slot);
                        setShowAiAnalysis(false);
                    }}
                />
            )}
        </div>
    );
};

// Helper component for identical styled UI elements
const StatChip = ({ icon, label, value, highlight }: { icon: React.ReactNode, label: string, value: string | number, highlight?: 'good' | 'warn' }) => {
    let valColor = 'text-slate-800';
    if (highlight === 'good') valColor = 'text-emerald-700';
    if (highlight === 'warn') valColor = 'text-rose-600';

    return (
        <div className="flex-1 min-w-[120px] bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 flex flex-col justify-center">
            <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider flex items-center gap-1">
                {icon} {label}
            </div>
            <div className={`text-lg font-bold tracking-tight mt-0.5 ${valColor}`}>
                {value}
            </div>
        </div>
    );
};

export default SmartSchedulerModal;
