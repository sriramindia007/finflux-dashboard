import React, { useMemo } from 'react';
import { X, MapPin } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { MeetingStop, timeToMins, calculateRouteMetrics, calculateOptimalRoute } from '../lib/schedulerEngine';

interface AiRouteAnalysisOverlayProps {
    onClose: () => void;
    targetCentre: { name: string; lat: number; lng: number };
    selectedSlot: string | null;
    schedule: MeetingStop[];
    duration: number;
}

const FO_BASE = { lat: 13.3300, lng: 77.0950, name: "Tumkur Branch Office" };

const AiRouteAnalysisOverlay: React.FC<AiRouteAnalysisOverlayProps> = ({ onClose, targetCentre, selectedSlot, schedule, duration }) => {

    // Compute stats
    const { stopsPlanned, stopsOptimal, distPlanned, minsPlanned, distOptimal, minsOptimal, effectiveness } = useMemo(() => {
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
        const { route: stopsOptimal, km: distO, mins: minsO } = calculateOptimalRoute(stopsPlanned);

        const eff = Math.min(100, Math.floor((distO / Math.max(1, distP)) * 100));

        return { stopsPlanned, stopsOptimal, distPlanned: distP, minsPlanned: minsP, distOptimal: distO, minsOptimal: minsO, effectiveness: eff };
    }, [schedule, targetCentre, selectedSlot]);

    const wasteKm = Number((distPlanned - distOptimal).toFixed(1));

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
                    <div className="grid grid-cols-3 gap-4 mb-6">
                        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                            <div className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">🚗 Current Planned Route</div>
                            <div className="text-2xl font-bold text-slate-800">
                                {distPlanned} km <span className="text-base text-slate-400 font-medium">/ {Math.floor(minsPlanned / 60)}h {minsPlanned % 60}m</span>
                            </div>
                        </div>
                        <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-200 shadow-sm">
                            <div className="text-xs font-bold text-emerald-600 uppercase tracking-widest mb-1">✨ AI Optimal Route</div>
                            <div className="text-2xl font-bold text-emerald-900">
                                {distOptimal} km <span className="text-base text-emerald-600 font-medium">/ {Math.floor(minsOptimal / 60)}h {minsOptimal % 60}m</span>
                            </div>
                        </div>
                        <div className={`p-4 rounded-xl border shadow-sm ${effectiveness >= 90 ? 'bg-blue-50 border-blue-200' : 'bg-orange-50 border-orange-200'}`}>
                            <div className={`text-xs font-bold uppercase tracking-widest mb-1 ${effectiveness >= 90 ? 'text-blue-600' : 'text-orange-600'}`}>⚡ Effectiveness Score</div>
                            <div className={`text-2xl font-bold ${effectiveness >= 90 ? 'text-blue-900' : 'text-orange-900'}`}>
                                {effectiveness}%
                            </div>
                        </div>
                    </div>

                    {/* AI Insight */}
                    <div className={`mb-6 p-4 rounded-xl border flex items-start gap-3 ${effectiveness < 90 ? 'bg-blue-50 border-blue-200 text-blue-900' : 'bg-emerald-50 border-emerald-200 text-emerald-900'}`}>
                        <div className="text-2xl">💡</div>
                        <div>
                            <div className="font-bold mb-1">AI Insight</div>
                            <p className="text-sm opacity-90">
                                {effectiveness < 90
                                    ? `Your planned chronological route travels ${wasteKm} extra kilometres. If you rearrange your morning meetings based on the AI Optimal map below, you can save significant fuel and field time.`
                                    : `Your planned schedule is highly optimal! You are choosing an excellent travel path.`}
                            </p>
                        </div>
                    </div>

                    {/* Maps */}
                    <div className="grid grid-cols-2 gap-6">
                        {/* Planned Map */}
                        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex flex-col h-[400px]">
                            <h3 className="font-bold text-slate-700 mb-3">Your Planned Sequence (Chronological)</h3>
                            <div className="flex-1 rounded-lg overflow-hidden border border-slate-200 relative z-0">
                                <RouteMap stops={stopsPlanned} lineColor="#3b82f6" />
                            </div>
                        </div>

                        {/* Optimal Map */}
                        <div className="bg-white rounded-xl border border-emerald-200 p-4 shadow-sm flex flex-col h-[400px]">
                            <h3 className="font-bold text-emerald-700 mb-3">AI Optimal Sequence (Shortest Path)</h3>
                            <div className="flex-1 rounded-lg overflow-hidden border border-slate-200 relative z-0">
                                <RouteMap stops={stopsOptimal} lineColor="#10b981" />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-slate-200 bg-white flex justify-end">
                    <button onClick={onClose} className="px-6 py-2.5 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl transition">
                        Close AI Route Analysis
                    </button>
                </div>
            </div>
        </div>
    );
};

// Internal Map Component for the overlays
const RouteMap = ({ stops, lineColor }: { stops: any[], lineColor: string }) => {
    // Generate icons dynamically so we can show numbers
    const getNumberedIcon = (num: number | string, isBase: boolean, isTarget: boolean) => {
        let color = '#64748b'; // slate
        if (isBase) color = '#ef4444'; // red
        else if (isTarget) color = '#3b82f6'; // blue

        const html = `<div style="background-color: ${color}; color: white; width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3); font-size: 12px; font-family: sans-serif;">${num}</div>`;

        return L.divIcon({
            html,
            className: 'custom-div-icon',
            iconSize: [28, 28],
            iconAnchor: [14, 14]
        });
    };

    const polylinePositions = stops.map(s => [s.lat, s.lng] as [number, number]);
    if (polylinePositions.length > 0) {
        polylinePositions.push(polylinePositions[0]); // close the loop back to base
    }

    return (
        <MapContainer
            center={stops.length > 0 ? [stops[0].lat, stops[0].lng] : [13.33, 77.09]}
            zoom={11}
            scrollWheelZoom={true}
            className="h-full w-full"
        >
            <TileLayer url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" />

            {stops.map((stop, idx) => {
                const isBase = stop.type === 'base';
                const isTarget = stop.type === 'target';
                const num = isBase ? '🏠' : idx;

                return (
                    <Marker key={idx} position={[stop.lat, stop.lng]} icon={getNumberedIcon(num, isBase, isTarget)}>
                        <Popup>
                            <strong>{stop.name}</strong><br />
                            {isBase ? 'Field Officer Base' : 'Meeting Location'}
                        </Popup>
                    </Marker>
                );
            })}

            <Polyline positions={polylinePositions} pathOptions={{ color: lineColor, weight: 3, dashArray: '10, 10' }} />
        </MapContainer>
    );
};

export default AiRouteAnalysisOverlay;
