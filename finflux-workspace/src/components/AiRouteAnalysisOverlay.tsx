import React, { useMemo, useState, useEffect } from 'react';
import { X, MapPin } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { MeetingStop, timeToMins, calculateRouteMetrics, calculateOptimalRoute, minsToTime, roundToNextHalfHour } from '../lib/schedulerEngine';

// Add `onApplyRecommendation` to props
interface AiRouteAnalysisOverlayProps {
    onClose: () => void;
    onApplyRecommendation?: (slot: string) => void;
    targetCentre: { name: string; lat: number; lng: number };
    selectedSlot: string | null;
    recommendedSlot: string | null;
    schedule: MeetingStop[];
    duration: number;
}

const FO_BASE = { lat: 13.3300, lng: 77.0950, name: "Tumkur Branch Office" };

const AiRouteAnalysisOverlay: React.FC<AiRouteAnalysisOverlayProps> = ({ onClose, onApplyRecommendation, targetCentre, selectedSlot, recommendedSlot, schedule, duration }) => {
    // If we are looking at the Holistic recommendation slot natively, we only have one tab
    const isSameSlot = selectedSlot === recommendedSlot;
    const [activeRoiTab, setActiveRoiTab] = useState<'optimized' | 'holistic'>(isSameSlot ? 'optimized' : 'holistic');

    // Compute stats
    const { stopsPlanned, stopsOptimal, stopsAiRecommended, distPlanned, minsPlanned, distOptimal, minsOptimal, distAiRec, minsAiRec } = useMemo(() => {
        // Collect all stops
        const allStops = [{ lat: FO_BASE.lat, lng: FO_BASE.lng, name: FO_BASE.name, type: 'base', time: 0 }];

        schedule.forEach(b => {
            if (b.centre === targetCentre.name) return;
            allStops.push({ lat: b.lat, lng: b.lng, name: b.centre, type: 'busy', time: timeToMins(b.start) });
        });

        if (selectedSlot) {
            allStops.push({ lat: targetCentre.lat, lng: targetCentre.lng, name: targetCentre.name, type: 'target', time: timeToMins(selectedSlot) });
        }

        // Planned Route Metrics (sort by time)
        const stopsPlanned = [allStops[0], ...[...allStops.slice(1)].sort((a, b) => a.time - b.time)];
        const { km: distP, mins: minsP } = calculateRouteMetrics(stopsPlanned);

        // Optimal Route Metrics
        const selectedTargetTime = timeToMins(selectedSlot || "09:00");
        const { route: initialOptimalStops, km: distO, mins: minsO } = calculateOptimalRoute(stopsPlanned, 30, selectedTargetTime);

        // Calculate the actual chronological timeline for the optimal route
        let simulatedMins = 540; // 09:00 AM
        const stopsOptimal = initialOptimalStops.map((stop, index) => {
            if (index === 0) return stop; // Base

            const prevStop = initialOptimalStops[index - 1];

            // Add Transit
            const transitTime = Math.max(5, Math.floor((L.latLng(prevStop.lat, prevStop.lng).distanceTo(L.latLng(stop.lat, stop.lng)) / 1000 * 1.4 / 25) * 60));
            simulatedMins += transitTime;

            // Snap to valid meeting block
            simulatedMins = roundToNextHalfHour(simulatedMins);

            // Arrive at target early? Wait.
            if (stop.type === 'target' && simulatedMins < stop.time) {
                simulatedMins = stop.time;
            }

            const meetingStartTime = simulatedMins;
            simulatedMins += 30; // Meeting Duration

            return { ...stop, time: meetingStartTime };
        });

        // AI Recommended logic
        let stopsAiRecommended: any[] = [];
        let distAiRec = distO;
        let minsAiRec = minsO;

        if (!isSameSlot && recommendedSlot) {
            const allStopsAi = [{ lat: FO_BASE.lat, lng: FO_BASE.lng, name: FO_BASE.name, type: 'base', time: 0 }];

            schedule.forEach(b => {
                if (b.centre === targetCentre.name) return;
                allStopsAi.push({ lat: b.lat, lng: b.lng, name: b.centre, type: 'busy', time: timeToMins(b.start) });
            });

            const aiTargetTime = timeToMins(recommendedSlot);
            allStopsAi.push({ lat: targetCentre.lat, lng: targetCentre.lng, name: targetCentre.name, type: 'target', time: aiTargetTime });

            const stopsAiPlanned = [allStopsAi[0], ...[...allStopsAi.slice(1)].sort((a, b) => a.time - b.time)];

            // Pass the target time explicitly to force the penalty logic to evaluate the 16:30 lock
            const { route, km, mins, isValid } = calculateOptimalRoute(stopsAiPlanned, 30, aiTargetTime);

            if (isValid) {
                let simMinsAi = 540;
                stopsAiRecommended = route.map((stop, index) => {
                    if (index === 0) return stop;
                    const prevStop = route[index - 1];
                    const transitTime = Math.max(5, Math.floor((L.latLng(prevStop.lat, prevStop.lng).distanceTo(L.latLng(stop.lat, stop.lng)) / 1000 * 1.4 / 25) * 60));
                    simMinsAi += transitTime;
                    simMinsAi = roundToNextHalfHour(simMinsAi);

                    // Force the simulation to wait if it arrived before the 16:30 lock
                    if (stop.type === 'target' && simMinsAi < aiTargetTime) simMinsAi = aiTargetTime;

                    const meetingStartTime = simMinsAi;
                    simMinsAi += 30;
                    return { ...stop, time: meetingStartTime };
                });
                distAiRec = km;
                minsAiRec = mins;
            }
        }

        return {
            stopsPlanned,
            stopsOptimal,
            stopsAiRecommended,
            distPlanned: distP,
            minsPlanned: minsP,
            distOptimal: distO,
            minsOptimal: minsO,
            distAiRec,
            minsAiRec
        };
    }, [schedule, targetCentre, selectedSlot, recommendedSlot]);

    // OSRM Real Road Routing State
    const [osrmPlanned, setOsrmPlanned] = useState<{ geometry: [number, number][], distKm: number, durationMins: number } | null>(null);
    const [osrmOptimal, setOsrmOptimal] = useState<{ geometry: [number, number][], distKm: number, durationMins: number } | null>(null);
    const [osrmAiRecommended, setOsrmAiRecommended] = useState<{ geometry: [number, number][], distKm: number, durationMins: number } | null>(null);

    // Fetch real road data from OSRM on load
    useEffect(() => {
        const fetchOsrmRoute = async (stops: any[], setter: any) => {
            try {
                const points = [...stops, stops[0]]; // Close the loop
                const coordsString = points.map(s => `${s.lng},${s.lat}`).join(';');
                const url = `http://router.project-osrm.org/route/v1/driving/${coordsString}?overview=full&geometries=geojson`;

                const response = await fetch(url);
                const data = await response.json();

                if (data.code === 'Ok' && data.routes.length > 0) {
                    const route = data.routes[0];
                    const geometry = route.geometry.coordinates.map((coord: number[]) => [coord[1], coord[0]] as [number, number]);
                    const distKm = Number((route.distance / 1000).toFixed(1));
                    const durationMins = Math.floor(route.duration / 60);

                    setter({ geometry, distKm, durationMins });
                }
            } catch (err) {
                console.error("OSRM fetch failed", err);
            }
        };

        if (stopsPlanned.length > 0) fetchOsrmRoute(stopsPlanned, setOsrmPlanned);
        if (stopsOptimal.length > 0) fetchOsrmRoute(stopsOptimal, setOsrmOptimal);
        if (stopsAiRecommended.length > 0 && !isSameSlot) fetchOsrmRoute(stopsAiRecommended, setOsrmAiRecommended);
    }, [stopsPlanned, stopsOptimal, stopsAiRecommended, isSameSlot]);

    // Final Display Metrics (fallback to math if API is loading)
    const finalPlannedDist = osrmPlanned ? osrmPlanned.distKm : distPlanned;
    const finalPlannedMins = osrmPlanned ? osrmPlanned.durationMins : minsPlanned;
    const finalOptimalDist = osrmOptimal ? osrmOptimal.distKm : distOptimal;
    const finalOptimalMins = osrmOptimal ? osrmOptimal.durationMins : minsOptimal;

    // AI Rec Display stats
    const finalAiDist = osrmAiRecommended ? osrmAiRecommended.distKm : distAiRec;
    const finalAiMins = osrmAiRecommended ? osrmAiRecommended.durationMins : minsAiRec;

    // Use finalAiDist instead of finalOptimalDist if we are viewing the native 16:30 slot to ensure the "perfect overlap" checks the correct algorithm
    const comparisonDist = isSameSlot ? finalAiDist : finalOptimalDist;
    const baseEff = Math.min(100, Math.floor((comparisonDist / Math.max(1, finalPlannedDist)) * 100));

    // The savings vs the Geographic sequence
    const finalWasteKm = Number((finalPlannedDist - finalOptimalDist).toFixed(1));

    // Simulated business metrics based on slot (to show trade-off reality)
    const metricsForSlot = (slot: string) => {
        const hour = parseInt(slot.split(':')[0]);
        if (hour <= 10) return { attendance: 92, collection: 95 }; // Morning is great
        if (hour >= 16) return { attendance: 88, collection: 91 }; // Late afternoon good
        return { attendance: 78, collection: 72 }; // Average
    };

    const userMetrics = metricsForSlot(selectedSlot as string);
    const aiMetrics = typeof recommendedSlot === 'string' ? metricsForSlot(recommendedSlot) : userMetrics;
    const aiWasteKm = Number((finalPlannedDist - finalAiDist).toFixed(1));

    // The single number to highlight in the top right KPI card
    const topRightWasteDisplay = isSameSlot ? finalWasteKm : aiWasteKm;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl w-full max-w-5xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">

                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-white">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center">
                            <MapPin size={20} />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-slate-800">🗺️ AI Route Effectiveness Analysis</h2>
                            <p className="text-sm text-slate-500">Current chronological plan vs AI shortest path</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                        <X className="w-6 h-6 text-slate-500" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto bg-slate-50 flex-1">

                    {/* KPI Cards */}
                    <div className="flex flex-col md:flex-row gap-4 mb-6">
                        <div className="flex-1 bg-white p-4 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden">
                            {!osrmPlanned && <div className="absolute top-0 right-0 m-2 w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>}
                            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-1">🚗 Your Sequence ({selectedSlot})</div>
                            <div className="text-2xl font-bold text-slate-800 tracking-tight">
                                {finalPlannedDist} km <span className="text-sm text-slate-400 font-medium">/ {Math.floor(finalPlannedMins / 60)}h {finalPlannedMins % 60}m</span>
                            </div>
                        </div>
                        <div className="flex-1 bg-white p-4 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden">
                            {!osrmOptimal && <div className="absolute top-0 right-0 m-2 w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>}
                            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-1">🗺️ AI Path for {selectedSlot}</div>
                            <div className="text-2xl font-bold text-slate-800 tracking-tight">
                                {finalOptimalDist} km <span className="text-sm text-slate-400 font-medium">/ {Math.floor(finalOptimalMins / 60)}h {finalOptimalMins % 60}m</span>
                            </div>
                        </div>

                        {!isSameSlot && (
                            <div className="flex-1 bg-indigo-50 p-4 rounded-xl border border-indigo-200 shadow-sm relative overflow-hidden">
                                {!osrmAiRecommended && <div className="absolute top-0 right-0 m-2 w-2 h-2 bg-indigo-400 rounded-full animate-pulse"></div>}
                                <div className="text-[11px] font-bold text-indigo-700 uppercase tracking-widest mb-1">💼 AI Holistic Recommendation ({recommendedSlot})</div>
                                <div className="text-2xl font-bold text-indigo-900 tracking-tight">
                                    {finalAiDist} km <span className="text-sm text-indigo-600 font-medium">/ {Math.floor(finalAiMins / 60)}h {finalAiMins % 60}m</span>
                                </div>
                            </div>
                        )}

                        <div className="w-full md:w-[180px] p-4 rounded-xl border shadow-sm flex flex-col justify-center bg-slate-800 border-slate-900 text-white shrink-0">
                            <div className="text-[11px] font-bold uppercase tracking-widest mb-1 text-slate-400">Total Distance Saved</div>
                            <div className="text-2xl font-bold tracking-tight text-emerald-400">
                                {topRightWasteDisplay} km
                            </div>
                        </div>
                    </div>

                    {/* AI Insight */}
                    <div className={`mb-6 p-4 rounded-xl border ${baseEff < 90 || !isSameSlot ? 'bg-indigo-50 border-indigo-200 text-indigo-900' : 'bg-emerald-50 border-emerald-200 text-emerald-900'}`}>
                        <div className="flex items-start gap-3">
                            <div className="text-2xl mt-1">{isSameSlot && baseEff >= 90 ? '✅' : '💡'}</div>
                            <div className="flex-1">
                                <div className="font-bold mb-1 border-b border-black/5 pb-2">Route Validator & ROI Dashboard</div>
                                <p className="text-sm opacity-90 mt-2">
                                    {isSameSlot
                                        ? baseEff < 90
                                            ? `By geographically optimizing your ${selectedSlot} route, the AI saves you ${finalWasteKm} km. Instead of driving back-and-forth, your meetings are re-sequenced into a streamlined circular route.`
                                            : `System Validation: Your chronological ${selectedSlot} sequence perfectly overlaps with the mathematical shortest path! This confirms your schedule is highly efficient.`
                                        : `The AI optimizes your ${selectedSlot} selection to save ${finalWasteKm} km. However, the engine holistically recommends ${recommendedSlot} as it maximizes member attendance and collection rates, balancing business impact with travel distance.`
                                    }
                                </p>
                            </div>
                        </div>

                        <div className="flex flex-col lg:flex-row gap-6 mt-5 pt-5 border-t border-indigo-200/50">
                            {/* Route Sequence */}
                            <div className="flex-1 border-b lg:border-b-0 border-indigo-200/50 pb-5 lg:pb-0">
                                <div className="text-xs font-bold uppercase tracking-wider mb-3 text-indigo-800 opacity-80 flex items-center gap-2">
                                    <MapPin size={14} /> Holistic Recommendation Sequence {!isSameSlot ? `(${recommendedSlot})` : ''}
                                </div>
                                <div className="flex flex-col gap-2 text-sm font-medium relative">
                                    {/* Vertical connector line */}
                                    <div className="absolute left-2.5 top-3 bottom-3 w-[2px] bg-indigo-200/50 -z-10"></div>

                                    {(isSameSlot ? stopsOptimal : stopsAiRecommended).map((stop, i) => (
                                        <div key={i} className="flex items-center gap-3 bg-white/60 p-2 rounded-lg border border-white">
                                            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] shadow-sm z-10 ${i === 0 ? 'bg-red-100 text-red-700 border border-red-200' : stop.type === 'target' ? 'bg-indigo-500 text-white' : 'bg-slate-100 text-slate-700 border border-slate-200'}`}>
                                                {i === 0 ? '🏠' : i}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="truncate text-slate-700">{stop.name}</div>
                                            </div>
                                            <div className={`text-xs ml-auto font-bold px-2 py-1 rounded ${stop.type === 'target' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-500'}`}>
                                                {i === 0 ? '09:00 (Start)' : minsToTime(stop.time)}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Tangible ROI */}
                            <div className="w-full lg:w-[300px] shrink-0 flex flex-col">
                                <div className="text-xs font-bold uppercase tracking-wider mb-2 text-emerald-800 opacity-80 flex items-center justify-between">
                                    <div className="flex items-center gap-2">📈 Projected Financial ROI</div>
                                </div>

                                {/* ROI Toggle */}
                                {!isSameSlot && (
                                    <div className="flex bg-slate-200/60 rounded-lg p-1 mb-3">
                                        <button
                                            onClick={() => setActiveRoiTab('optimized')}
                                            className={`flex-1 text-[10px] font-bold py-1.5 rounded-md transition-all ${activeRoiTab === 'optimized' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                        >
                                            Geographic ({selectedSlot})
                                        </button>
                                        <button
                                            onClick={() => setActiveRoiTab('holistic')}
                                            className={`flex-1 text-[10px] font-bold py-1.5 rounded-md transition-all ${activeRoiTab === 'holistic' ? 'bg-white text-indigo-700 shadow-sm border border-indigo-100' : 'text-slate-500 hover:text-slate-700'}`}
                                        >
                                            Holistic ({recommendedSlot})
                                        </button>
                                    </div>
                                )}

                                <div className="space-y-2 text-sm flex-1">
                                    <div className="flex justify-between items-center bg-white/60 px-3 py-2.5 rounded-lg">
                                        <span className="text-slate-600">Distance Saved (Per Trip):</span>
                                        <span className={`font-bold ${activeRoiTab === 'holistic' ? 'text-indigo-800' : 'text-slate-800'}`}>
                                            {activeRoiTab === 'holistic' ? aiWasteKm : finalWasteKm} km
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center bg-white/60 px-3 py-2.5 rounded-lg border-b border-dashed border-slate-200">
                                        <span className="text-slate-600">Fuel Cost Reduction <span className="text-[10px] font-normal opacity-60">(assuming ₹2.5/km)</span>:</span>
                                        <span className="font-bold text-emerald-600">₹{((activeRoiTab === 'holistic' ? aiWasteKm : finalWasteKm) * 2.5).toFixed(1)}</span>
                                    </div>
                                    <div className={`flex justify-between items-center p-3 rounded-lg border shadow-sm mt-4 ${activeRoiTab === 'holistic' ? 'bg-indigo-50/80 border-indigo-200 text-indigo-900' : 'bg-emerald-100/50 border-emerald-200 text-emerald-900'}`}>
                                        <div>
                                            <span className="block font-bold">Scaled Annual Savings</span>
                                            <span className="text-[10px] opacity-80 font-medium">1 Officer • 250 Working Days</span>
                                        </div>
                                        <span className={`font-black text-xl tracking-tight ${activeRoiTab === 'holistic' ? 'text-indigo-700' : 'text-emerald-700'}`}>
                                            ₹{((activeRoiTab === 'holistic' ? aiWasteKm : finalWasteKm) * 2.5 * 250).toLocaleString('en-IN')}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Trade-off Comparison Table */}
                        <div className="mt-8 pt-6 border-t border-slate-200/60">
                            <div className="text-xs font-bold uppercase tracking-wider mb-4 text-slate-800 flex items-center gap-2">
                                ⚖️ Complete Scenario Analysis
                            </div>
                            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                                <table className="w-full text-sm text-left min-w-[600px]">
                                    <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500 font-bold">
                                        <tr>
                                            <th className="px-4 py-3 border-r border-slate-200 w-1/4">Metric</th>
                                            <th className="px-4 py-3 border-r border-slate-200 w-1/4">Your Sequence<br /><span className="lowercase font-normal">({selectedSlot})</span></th>
                                            <th className="px-4 py-3 border-r border-slate-200 w-1/4">AI Optimized<br /><span className="lowercase font-normal">({selectedSlot})</span></th>
                                            {!isSameSlot && <th className="px-4 py-3 w-1/4 bg-indigo-50/50 text-indigo-800">Holistic AI<br /><span className="lowercase font-normal">({recommendedSlot})</span></th>}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        <tr>
                                            <td className="px-4 py-3 font-medium text-slate-700 border-r border-slate-200">Total Driving Dist.</td>
                                            <td className="px-4 py-3 border-r border-slate-200">{finalPlannedDist} km</td>
                                            <td className={`px-4 py-3 border-r border-slate-200 font-bold ${finalOptimalDist <= finalAiDist ? 'bg-emerald-50' : ''}`}>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-slate-800">{finalOptimalDist} km</span>
                                                    {finalWasteKm > 0 && (
                                                        <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded shadow-sm font-bold flex gap-1">
                                                            <span>Save {finalWasteKm}km</span>
                                                            <span className="opacity-50">|</span>
                                                            <span>₹{(finalWasteKm * 2.5 * 250).toLocaleString('en-IN', { maximumFractionDigits: 1 })}</span>
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            {!isSameSlot && (
                                                <td className={`px-4 py-3 font-bold ${finalAiDist < finalOptimalDist ? 'bg-indigo-50' : ''}`}>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-slate-800">{finalAiDist} km</span>
                                                        {aiWasteKm > 0 && (
                                                            <span className="text-[10px] bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded shadow-sm font-bold flex gap-1">
                                                                <span>Save {aiWasteKm}km</span>
                                                                <span className="opacity-50">|</span>
                                                                <span>₹{(aiWasteKm * 2.5 * 250).toLocaleString('en-IN', { maximumFractionDigits: 1 })}</span>
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                            )}
                                        </tr>
                                        <tr>
                                            <td className="px-4 py-3 font-medium text-slate-700 border-r border-slate-200">Est. Attendance</td>
                                            <td className="px-4 py-3 border-r border-slate-200">{userMetrics.attendance}%</td>
                                            <td className="px-4 py-3 border-r border-slate-200">{userMetrics.attendance}%</td>
                                            {!isSameSlot && (
                                                <td className={`px-4 py-3 font-bold ${aiMetrics.attendance > userMetrics.attendance ? 'bg-emerald-50 text-emerald-700' : ''}`}>
                                                    {aiMetrics.attendance}%
                                                </td>
                                            )}
                                        </tr>
                                        <tr>
                                            <td className="px-4 py-3 font-medium text-slate-700 border-r border-slate-200">Est. Collection Ratio</td>
                                            <td className="px-4 py-3 border-r border-slate-200">{userMetrics.collection}%</td>
                                            <td className="px-4 py-3 border-r border-slate-200">{userMetrics.collection}%</td>
                                            {!isSameSlot && (
                                                <td className={`px-4 py-3 font-bold ${aiMetrics.collection > userMetrics.collection ? 'bg-emerald-50 text-emerald-700' : ''}`}>
                                                    {aiMetrics.collection}%
                                                </td>
                                            )}
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>

                    {/* Maps */}
                    <div className={`grid gap-6 grid-cols-1 md:grid-cols-2 ${!isSameSlot ? 'lg:grid-cols-3' : ''}`}>
                        {/* Planned Map */}
                        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex flex-col h-[400px]">
                            <h3 className="font-bold text-slate-700 mb-3 text-sm truncate" title={`Your Sequence (${selectedSlot})`}>Your Sequence ({selectedSlot})</h3>
                            <div className="flex-1 rounded-lg overflow-hidden border border-slate-200 relative z-0">
                                <RouteMap stops={stopsPlanned} lineColor="#64748b" customGeometry={osrmPlanned?.geometry} />
                            </div>
                        </div>

                        {/* Optimal Map */}
                        <div className="bg-white rounded-xl border border-blue-200 p-4 shadow-sm flex flex-col h-[400px]">
                            <h3 className="font-bold text-blue-700 mb-3 text-sm truncate" title={`Geographically Optimized (${selectedSlot})`}>Geographically Optimized ({selectedSlot})</h3>
                            <div className="flex-1 rounded-lg overflow-hidden border border-blue-200 relative z-0">
                                <RouteMap stops={stopsOptimal} lineColor="#3b82f6" customGeometry={osrmOptimal?.geometry} />
                            </div>
                        </div>

                        {/* AI Recommended Map */}
                        {!isSameSlot && (
                            <div className="bg-white rounded-xl border border-indigo-200 p-4 shadow-sm flex flex-col h-[400px] ring-2 ring-indigo-500/20 shadow-indigo-500/10">
                                <h3 className="font-bold text-indigo-700 mb-3 text-sm truncate flex justify-between items-center group">
                                    <span title={`AI Holistic Recommendation (${recommendedSlot})`}>AI Holistic Recommendation ({recommendedSlot})</span>
                                    <span className="text-[10px] bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-bold">Business Optimum</span>
                                </h3>
                                <div className="flex-1 rounded-lg overflow-hidden border border-indigo-200 relative z-0">
                                    <RouteMap stops={stopsAiRecommended} lineColor="#4f46e5" customGeometry={osrmAiRecommended?.geometry} />
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex justify-end gap-3 rounded-b-2xl">
                    <button onClick={onClose} className="px-6 py-2.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold rounded-xl transition shadow-sm">
                        Close Analysis
                    </button>
                    {!isSameSlot && recommendedSlot && onApplyRecommendation && (
                        <button
                            onClick={() => onApplyRecommendation(recommendedSlot)}
                            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition shadow-sm flex items-center gap-2"
                        >
                            <span>✨ Apply Holistic Recommendation ({recommendedSlot})</span>
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

// Internal Map Component for the overlays
const RouteMap = ({ stops, lineColor, customGeometry }: { stops: any[], lineColor: string, customGeometry?: [number, number][] }) => {
    // Generate icons dynamically so we can show numbers
    const getNumberedIcon = (num: number | string, isBase: boolean, isTarget: boolean, timeStr?: string) => {
        let color = '#64748b'; // slate
        if (isBase) color = '#ef4444'; // red
        else if (isTarget) color = '#3b82f6'; // blue

        const iconHtml = `<div style="background-color: ${color}; color: white; width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3); font-size: 12px; font-family: sans-serif;">${num}</div>`;
        const timeHtml = timeStr ? `<div style="margin-top: 2px; background: white; padding: 1px 4px; border-radius: 4px; font-size: 9px; font-weight: bold; color: ${color}; box-shadow: 0 1px 2px rgba(0,0,0,0.2); white-space: nowrap; font-family: sans-serif;">${timeStr}</div>` : '';

        const html = `<div style="display: flex; flex-direction: column; items-center;">${iconHtml}${timeHtml}</div>`;

        return L.divIcon({
            html,
            className: 'custom-div-icon',
            iconSize: [28, 40],
            iconAnchor: [14, 20]
        });
    };

    const polylinePositions = customGeometry || (() => {
        const positions = stops.map(s => [s.lat, s.lng] as [number, number]);
        if (positions.length > 0) positions.push(positions[0]); // close the loop back to base
        return positions;
    })();

    return (
        <MapContainer
            center={stops.length > 0 ? [stops[0].lat, stops[0].lng] : [13.33, 77.09]}
            zoom={12}
            scrollWheelZoom={true}
            className="h-full w-full"
        >
            <TileLayer url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" />

            {stops.map((stop, idx) => {
                const isBase = stop.type === 'base';
                const isTarget = stop.type === 'target';
                const num = isBase ? '🏠' : idx;

                const timeStr = isBase ? '' : minsToTime(stop.time);

                return (
                    <Marker key={idx} position={[stop.lat, stop.lng]} icon={getNumberedIcon(num, isBase, isTarget, timeStr)}>
                        <Popup>
                            <strong>{stop.name}</strong><br />
                            {isBase ? 'Field Officer Base' : `Meeting Location: ${timeStr}`}
                        </Popup>
                    </Marker>
                );
            })}

            <Polyline positions={polylinePositions} pathOptions={{ color: lineColor, weight: 3, dashArray: customGeometry ? undefined : '10, 10' }} />
        </MapContainer>
    );
};

export default AiRouteAnalysisOverlay;
