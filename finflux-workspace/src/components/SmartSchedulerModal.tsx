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
const DEFAULT_WINDOWS: [string, string][] = [["08:00", "13:00"], ["14:00", "18:00"]];

// Initial mock schedule
const INITIAL_FO_SCHEDULE: MeetingStop[] = [
    { centre: "Tumkur North C2", lat: 13.3550, lng: 77.1150, start: "09:00", end: "10:20", color: "#C53434", bg: "#F9EBEB" },
    { centre: "Tumkur West C1", lat: 13.3300, lng: 77.0800, start: "11:30", end: "12:50", color: "#F4A246", bg: "#FEF6EC" },
    { centre: "Tumkur South C3", lat: 13.3100, lng: 77.1000, start: "15:00", end: "16:20", color: "#C53434", bg: "#F9EBEB" },
];

const SmartSchedulerModal: React.FC<SmartSchedulerModalProps> = ({ isOpen, onClose, centreData, onConfirm }) => {
    // We will hardcode some static metadata for "Tumkur C1" to match the Streamlit demo
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
    const [showAiAnalysis, setShowAiAnalysis] = useState(false);

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
            cMembers, DEFAULT_WINDOWS, attendance, collection, travel.mins
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
        if (isOpen) {
            // Reset state and run engine
            setIsSaved(false);
            runRecommendation();
        }
    }, [isOpen, centreData]);

    if (!isOpen) return null;

    const duration = calculateDuration(cMembers);
    const endTime = selectedSlot ? minsToTime(timeToMins(selectedSlot) + duration) : '—';

    // Banner colours based on validity
    const bannerBg = freqValid ? 'bg-emerald-50' : 'bg-amber-50';
    const bannerBorder = freqValid ? 'border-emerald-600' : 'border-amber-500';
    const bannerText = freqValid ? 'text-emerald-700' : 'text-amber-700';

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm px-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">

                {/* Header */}
                <div className="bg-slate-50 border-b border-slate-200 px-6 py-4 flex items-center justify-between">
                    <div>
                        <h2 className="text-xl font-bold text-slate-800">Smart Meeting Scheduler</h2>
                        <p className="text-sm text-slate-500 mt-1 flex items-center gap-2">
                            <span className="font-medium text-slate-700">{centreData.name}</span>
                            <span>•</span>
                            <span>{MEET_DATE.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</span>
                            <span>•</span>
                            <span>FO: Vinay</span>
                            <span>•</span>
                            <span>{isNew ? '🆕 New Centre — using predicted averages' : '✅ Existing Centre — system data loaded'}</span>
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                        <X className="w-5 h-5 text-slate-500" />
                    </button>
                </div>

                {/* Sub-Header: Frequency Banner (Gap 2) */}
                {freqMsg && (
                    <div className={`mx-6 mt-4 px-4 py-2 border rounded-lg flex items-center gap-3 text-sm font-medium ${bannerBg} ${bannerBorder} ${bannerText}`}>
                        <span className="text-lg">{freqValid ? '✅' : '⚠️'}</span>
                        <span><strong>Product Frequency:</strong> {cFreq || '—'} • {freqMsg}</span>
                    </div>
                )}

                {/* Quick Stats Strip */}
                <div className="flex flex-wrap gap-3 mx-6 mt-4">
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
                    <div className="flex-1 min-w-[140px] bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 flex flex-col justify-center">
                        <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider flex items-center gap-1">
                            <MapPin size={10} /> Travel (Chained)
                        </div>
                        <div className="text-sm font-bold text-slate-800 tracking-tight mt-0.5">
                            {chainedTravel.mins} min • {chainedTravel.km} km
                        </div>
                    </div>
                </div>

                {/* Main Content Area: 2 Columns */}
                <div className="flex flex-1 overflow-hidden mt-4">

                    {/* LEFT COLUMN: ACTION ZONE */}
                    <div className="flex-1 border-r border-slate-200 overflow-y-auto px-6 pb-6">
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
                            <>
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
                                                    setTimeout(() => setIsSaving(false), 200);
                                                    setIsSaved(true);
                                                }}
                                                className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 transition-all shadow-md active:scale-[0.98]"
                                            >
                                                {isSaving ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <CalendarCheck className="w-5 h-5" />}
                                                Confirm This Slot
                                            </button>
                                            <button
                                                onClick={() => setShowAlternative(!showAlternative)}
                                                className="px-6 py-3.5 border-2 border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-50 transition-colors"
                                            >
                                                Reschedule
                                            </button>
                                        </div>

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

                                {/* Alternative Selection */}
                                {showAlternative && (
                                    <div className="mt-8 animate-in fade-in duration-300">
                                        <h4 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4 border-b pb-2">Alternative Slots</h4>
                                        <div className="grid grid-cols-3 gap-3">
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
                                                    className="px-4 py-3 border border-slate-200 rounded-xl flex flex-col items-center hover:border-indigo-400 hover:bg-indigo-50 transition-colors group"
                                                >
                                                    <span className="font-bold text-lg text-slate-800 group-hover:text-indigo-700">{f.slot}</span>
                                                    <span className="text-xs text-slate-400 font-medium">Score: {f.score.toFixed(2)}</span>
                                                </button>
                                            ))}
                                            <div className="col-span-3 mt-4 flex items-center gap-3 bg-slate-50 p-4 border border-slate-200 rounded-xl">
                                                <span className="text-sm font-semibold text-slate-600">Manual Override:</span>
                                                <select
                                                    value={manualSlot}
                                                    onChange={(e) => setManualSlot(e.target.value)}
                                                    className="bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 font-medium outline-none"
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
                                                    className="bg-slate-800 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-slate-700 transition"
                                                >
                                                    Select
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </div>

                    {/* RIGHT COLUMN: CONTEXT (Map Placeholder) */}
                    <div className="w-[35%] bg-slate-50 p-6 flex flex-col">
                        <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4">Route Context</h3>

                        <div className="flex-1 bg-white border border-slate-200 rounded-xl flex flex-col overflow-hidden">
                            {/* Interactive Route Map */}
                            <div className="flex-1 border-b border-slate-100 min-h-[250px] relative z-0">
                                <MapContainer
                                    center={[FO_BASE.lat, FO_BASE.lng]}
                                    zoom={11}
                                    scrollWheelZoom={true}
                                    className="absolute inset-0 z-0 h-full w-full font-sans"
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

                            {/* Schedule Summary */}
                            <div className="p-4 bg-white hidden lg:block h-[200px] overflow-y-auto">
                                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Today's Schedule</h4>
                                <div className="space-y-3">
                                    {schedule.map(s => (
                                        <div key={s.centre} className="flex gap-3 text-sm items-center">
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

                            {/* Expand Map Button */}
                            <div className="p-4 border-t border-slate-100 bg-white">
                                <button
                                    onClick={() => setShowAiAnalysis(true)}
                                    className="w-full py-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 font-semibold rounded-xl text-sm flex items-center justify-center gap-2 transition"
                                >
                                    <MapPin size={16} className="text-slate-400" />
                                    Expand Map & AI Analysis
                                </button>
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
                    schedule={schedule}
                    duration={calculateDuration(cMembers)}
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
