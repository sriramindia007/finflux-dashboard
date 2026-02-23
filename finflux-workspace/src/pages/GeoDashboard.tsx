import { useState, useMemo, useEffect } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap, Circle } from 'react-leaflet';
import { ChevronRight, TrendingUp, MapPin, Users, AlertCircle, ArrowLeft, Home } from 'lucide-react';
import { saveFile } from '../lib/utils';
// import KPICard removed as we use inline compact cards
import { ALL_STATES_DATA, getStateData, getDistrictData, getBranchData, Centre, COORDINATES, getGeoStats, TOTAL_BRANCHES_COUNT } from '../data/geoDataComplete';
import { STATES_DATA } from '../data/mfiData';
import { getBranchFilter, type BranchFilter } from '../data/users';
// import { COORDINATES, getGeoStats } from '../data/geoData'; // Legacy removed

type DrillLevel = 'Country' | 'State' | 'District' | 'Branch' | 'Centre' | 'Customer';

interface ViewState {
    level: DrillLevel;
    label: string;
    stateName?: string;
    districtName?: string;
    branchName?: string;
}

interface MapConfig {
    center: [number, number];
    zoom: number;
    bounds?: [[number, number], [number, number]];
}

interface CustomerEntity {
    id: string;
    name: string;
    coord: [number, number];
    status: 'active' | 'overdue' | 'closed';
    compliance: 'within' | 'outside';
}

function MapUpdater({ config }: { config: MapConfig }) {
    const map = useMap();

    useEffect(() => {
        if (config.bounds) {
            map.fitBounds(config.bounds, { padding: [50, 50], maxZoom: 14 });
        } else {
            // Check if we are at Customer level (deep zoom)
            const isDeepZoom = config.zoom >= 17;
            map.flyTo(config.center, config.zoom, {
                duration: 1.5,
                easeLinearity: 0.25
            });
        }
    }, [config, map]);

    return null;
}

// Helper to calculate bounds from a list of coordinates
const getBounds = (coords: [number, number][]): [[number, number], [number, number]] | undefined => {
    if (coords.length === 0) return undefined;

    let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;

    coords.forEach(([lat, lng]) => {
        if (lat < minLat) minLat = lat;
        if (lat > maxLat) maxLat = lat;
        if (lng < minLng) minLng = lng;
        if (lng > maxLng) maxLng = lng;
    });

    // Add some buffer
    return [[minLat, minLng], [maxLat, maxLng]];
};

const GeoDashboard = () => {
    const branchFilter: BranchFilter | null = getBranchFilter();
    const isRestricted = branchFilter !== null;
    const initialViewStack: ViewState[] = isRestricted
        ? [
            { level: 'Country', label: 'India' },
            { level: 'State', label: branchFilter!.state, stateName: branchFilter!.state },
            { level: 'District', label: branchFilter!.district, stateName: branchFilter!.state, districtName: branchFilter!.district },
          ]
        : [{ level: 'Country', label: 'India' }];

    const [viewStack, setViewStack] = useState<ViewState[]>(initialViewStack);
    const minViewStackLength = isRestricted ? 3 : 1;

    const currentView = viewStack[viewStack.length - 1];

    // Procedural Customer Generation
    const customerData = useMemo(() => {
        if (currentView.level !== 'Customer') return [];

        const branch = getBranchData(currentView.stateName!, currentView.districtName!, currentView.branchName!);
        const centre = branch?.centres.find(c => c.name === currentView.label);

        if (!centre) return [];

        const count = 30; // 30 Customers per center
        const customers: CustomerEntity[] = [];
        const baseLat = centre.coord[0];
        const baseLng = centre.coord[1];

        // 400m in degrees (approx)
        const fenceRadiusDeg = 0.0036;

        for (let i = 0; i < count; i++) {
            // Golden Angle Distribution for organic look
            const goldenAngle = 2.39996;
            const r = fenceRadiusDeg * (0.1 + Math.random() * 1.2); // Some inside (0.1-1.0), some outside (1.0-1.3)
            const theta = i * goldenAngle;

            const lat = baseLat + r * Math.cos(theta);
            const lng = baseLng + r * Math.sin(theta);

            const isWithin = r <= fenceRadiusDeg;

            customers.push({
                id: `Cust-${i}`,
                name: `Customer ${i + 1}`,
                coord: [lat, lng],
                status: Math.random() > 0.9 ? 'overdue' : 'active',
                compliance: isWithin ? 'within' : 'outside'
            });
        }
        return customers;
    }, [currentView]);


    const mapConfig = useMemo((): MapConfig => {
        if (currentView.level === 'Country') {
            return { center: COORDINATES.INDIA, zoom: 5 };
        }

        if (currentView.level === 'State') {
            const state = getStateData(currentView.label);
            const districtCoords = state?.districts.map(d => d.coord) || [];
            const bounds = getBounds(districtCoords);

            return {
                center: state?.coord || COORDINATES.INDIA,
                zoom: 7,
                bounds
            };
        }

        if (currentView.level === 'District') {
            const district = getDistrictData(currentView.stateName!, currentView.label);
            const branchCoords = district?.branches.map(b => b.coord) || [];
            const bounds = getBounds(branchCoords);

            return {
                center: district?.coord || COORDINATES.INDIA,
                zoom: 9,
                bounds
            };
        }

        if (currentView.level === 'Branch') {
            const branch = getBranchData(currentView.stateName!, currentView.districtName!, currentView.label);
            const centreCoords = branch?.centres.map(c => c.coord) || [];
            const bounds = getBounds(centreCoords);

            return {
                center: branch?.coord || COORDINATES.INDIA,
                zoom: 12,
                bounds
            };
        }

        if (currentView.level === 'Centre') {
            const branch = getBranchData(currentView.stateName!, currentView.districtName!, currentView.branchName!);
            const centre = branch?.centres.find(c => c.name === currentView.label);
            return { center: centre?.coord || COORDINATES.INDIA, zoom: 15 };
        }

        if (currentView.level === 'Customer') {
            const branch = getBranchData(currentView.stateName!, currentView.districtName!, currentView.branchName!);
            const centre = branch?.centres.find(c => c.name === currentView.label); // Label is Centre name in Customer view context
            return { center: centre?.coord || COORDINATES.INDIA, zoom: 15 };
        }

        return { center: COORDINATES.INDIA, zoom: 5 };
    }, [currentView]);

    const drillDown = (nextLevel: DrillLevel, label: string, extras?: Partial<ViewState>) => {
        setViewStack(prev => [...prev, {
            level: nextLevel,
            label,
            stateName: extras?.stateName || currentView.stateName,
            districtName: extras?.districtName || currentView.districtName,
            branchName: extras?.branchName || currentView.branchName,
        }]);
    };

    const jumpToLevel = (index: number) => {
        setViewStack(prev => prev.slice(0, index + 1));
    };

    // Get current data based on level
    const currentData = useMemo(() => {
        if (currentView.level === 'Country') {
            return { states: ALL_STATES_DATA };
        }
        if (currentView.level === 'State') {
            const state = getStateData(currentView.label);
            return { districts: state?.districts || [] };
        }
        if (currentView.level === 'District') {
            const district = getDistrictData(currentView.stateName!, currentView.label);
            const allBranches = district?.branches || [];
            const branches = isRestricted && branchFilter
                ? allBranches.filter(b => branchFilter!.branches.includes(b.name))
                : allBranches;
            return { branches };
        }
        if (currentView.level === 'Branch') {
            const branch = getBranchData(currentView.stateName!, currentView.districtName!, currentView.label);
            return { centres: branch?.centres || [] };
        }
        if (currentView.level === 'Centre') {
            const branch = getBranchData(currentView.stateName!, currentView.districtName!, currentView.branchName!);
            const centre = branch?.centres.find(c => c.name === currentView.label);
            return { centre };
        }
        if (currentView.level === 'Customer') {
            const branch = getBranchData(currentView.stateName!, currentView.districtName!, currentView.branchName!);
            const centre = branch?.centres.find(c => c.name === currentView.label);
            return { centre, customers: customerData };
        }
        return {};
    }, [currentView, customerData]);

    // Calculate summary stats
    const summaryStats = useMemo(() => {
        if (currentView.level === 'Country') {
            const totalGLP = ALL_STATES_DATA.reduce((sum, s) => sum + s.glp, 0);
            const totalBranches = TOTAL_BRANCHES_COUNT; // Fixed 915
            const totalWriteOff = ALL_STATES_DATA.reduce((sum, s) => sum + (s.writeOff || 0), 0);
            // Calculate Country PAR Weighted
            const weightedParSum = ALL_STATES_DATA.reduce((sum, s) => sum + ((s.par30 || 0) * s.glp), 0);
            const avgPar = totalGLP > 0 ? (weightedParSum / totalGLP) : 3.2;

            return { glp: totalGLP, branches: totalBranches, par30: parseFloat(avgPar.toFixed(2)), digital: 65, writeOff: totalWriteOff };
        }
        if (currentView.level === 'State') {
            const state = getStateData(currentView.label);
            const branches = state?.districts.reduce((sum, d) => sum + (d.branchCount || d.branches.length), 0) || 0;
            return { glp: state?.glp || 0, branches, par30: state?.par30 || 2.9, digital: 62, writeOff: state?.writeOff || 0 };
        }
        if (currentView.level === 'District') {
            const district = getDistrictData(currentView.stateName!, currentView.label);
            return { glp: district?.glp || 0, branches: district?.branchCount || district?.branches.length || 0, par30: district?.par30 || 2.7, digital: 60, writeOff: district?.writeOff || 0 };
        }
        if (currentView.level === 'Branch') {
            const district = getDistrictData(currentView.stateName!, currentView.districtName!);
            const branch = getBranchData(currentView.stateName!, currentView.districtName!, currentView.label);
            // Scale branch GLP proportionally from district scaled GLP for consistency
            const rawDistrictGlp = district?.branches.reduce((s, b) => s + b.glp, 0) || 0;
            const branchGlpScaled = rawDistrictGlp > 0 && district
                ? (branch?.glp || 0) * (district.glp / rawDistrictGlp)
                : (branch?.glp || 0);
            const rawDistrictClients = district?.branches.reduce((s, b) => s + b.clients, 0) || 0;
            const branchClientsScaled = rawDistrictClients > 0 && district
                ? Math.floor((branch?.clients || 0) * ((district.clients || 0) / rawDistrictClients))
                : (branch?.clients || 0);
            return { glp: branchGlpScaled, clients: branchClientsScaled, centres: branch?.centres.length || 0, par30: branch?.par30 || 2.2, digital: 68, writeOff: branch?.writeOff || 0 };
        }
        if (currentView.level === 'Centre' || currentView.level === 'Customer') {
            const branch = getBranchData(currentView.stateName!, currentView.districtName!, currentView.branchName!);
            const centre = branch?.centres.find(c => c.name === currentView.label);
            return { glp: centre?.glp || 0, clients: centre?.clients || 0, activeLoans: centre?.activeLoans || 0, par30: centre?.par30 || 0, writeOff: centre?.writeOff || 0 };
        }
        return { glp: 0, branches: 0, par30: 0, digital: 0, writeOff: 0 };
    }, [currentView]);

    return (
        <div className="flex flex-col gap-4 h-[calc(100vh-140px)] min-h-[600px]">
            {/* Breadcrumbs & Navigation */}
            {/* Breadcrumbs & Navigation Bar - Fixed Visibility */}
            <div className="flex items-center gap-3 bg-white p-3 rounded-xl border border-secondary-200 shadow-lg text-sm shrink-0 z-50 sticky top-0 relative">
                {/* Back Button */}
                <button
                    onClick={() => {
                        if (viewStack.length > minViewStackLength) {
                            setViewStack(prev => prev.slice(0, -1));
                        }
                    }}
                    disabled={viewStack.length <= minViewStackLength}
                    className={`p-2 rounded-lg border transition-colors ${viewStack.length > minViewStackLength
                        ? "border-secondary-200 hover:bg-secondary-50 text-secondary-700 hover:text-primary-600"
                        : "border-transparent text-secondary-300 cursor-not-allowed"
                        }`}
                    title="Go Back"
                >
                    <ArrowLeft size={18} />
                </button>

                {/* Home Button */}
                <button
                    onClick={() => setViewStack(initialViewStack)}
                    disabled={viewStack.length <= minViewStackLength}
                    className={`p-2 rounded-lg border transition-colors ${viewStack.length > minViewStackLength
                        ? "border-secondary-200 hover:bg-secondary-50 text-secondary-700 hover:text-primary-600"
                        : "border-transparent text-secondary-300 cursor-not-allowed"
                        }`}
                    title={isRestricted ? "Reset to District View" : "Reset to Home"}
                >
                    <Home size={18} />
                </button>

                <div className="w-px h-6 bg-secondary-200 mx-1"></div>

                {/* Breadcrumb Pills */}
                <div className="flex items-center gap-2 overflow-x-auto no-scrollbar scroll-smooth">
                    {viewStack.map((step, idx) => (
                        <div
                            key={idx}
                            className={`flex items-center gap-2 shrink-0 transition-all ${
                                idx === viewStack.length - 1
                                    ? "opacity-100"
                                    : idx < minViewStackLength - 1
                                        ? "opacity-50 cursor-default"
                                        : "opacity-80 hover:opacity-100 cursor-pointer"
                            }`}
                            onClick={() => idx < viewStack.length - 1 && idx >= minViewStackLength - 1 && jumpToLevel(idx)}
                        >
                            {idx > 0 && <ChevronRight size={14} className="text-secondary-400" />}
                            <span className={`px-3 py-1.5 rounded-full text-xs font-bold border ${idx === viewStack.length - 1
                                ? "bg-primary-50 text-primary-700 border-primary-200 shadow-inner"
                                : "bg-white text-secondary-600 border-secondary-200 hover:border-primary-300 hover:text-primary-600 shadow-sm"
                                }`}>
                                {step.level === 'Customer' ? 'Customer Analysis' : step.label}
                            </span>
                        </div>
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-full min-h-0">
                {/* Map Column */}
                <div className="lg:col-span-2 bg-white rounded-xl border border-secondary-200 shadow-sm overflow-hidden relative z-0 h-full">
                    <MapContainer center={mapConfig.center} zoom={mapConfig.zoom} scrollWheelZoom={true} className="h-full w-full">
                        <TileLayer attribution='&copy; OSM' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                        <MapUpdater config={mapConfig} />

                        {/* Country Level - Show all states */}
                        {/* Country Level - Show all states */}
                        {currentView.level === 'Country' && currentData.states?.map((state, idx) => {
                            // Find matching data in centralized store
                            const stateKey = Object.keys(STATES_DATA).find(k => STATES_DATA[k].name === state.name);
                            const syncedGLP = stateKey ? STATES_DATA[stateKey].glp : state.glp;

                            const radius = 15 + (syncedGLP / 500);
                            return (
                                <CircleMarker
                                    key={idx}
                                    center={state.coord}
                                    radius={radius}
                                    pathOptions={{ color: state.color, fillColor: state.color, fillOpacity: 0.6 }}
                                    eventHandlers={{ click: () => drillDown('State', state.name, { stateName: state.name }) }}
                                >
                                    <Popup>
                                        <strong>{state.name}</strong><br />
                                        GLP: ₹{syncedGLP.toLocaleString()} Cr<br />
                                        Click to explore
                                    </Popup>
                                </CircleMarker>
                            );
                        })}

                        {/* State Level - Show districts */}
                        {currentView.level === 'State' && currentData.districts?.map((district, idx) => (
                            <CircleMarker
                                key={idx}
                                center={district.coord}
                                radius={14}
                                pathOptions={{ color: '#f59e0b', fillColor: '#f59e0b', fillOpacity: 0.6 }}
                                eventHandlers={{ click: () => drillDown('District', district.name, { districtName: district.name }) }}
                            >
                                <Popup>
                                    <strong>{district.name}</strong><br />
                                    GLP: ₹{district.glp.toLocaleString()} Cr<br />
                                    Branches: {district.branches.length}<br />
                                    Click to explore
                                </Popup>
                            </CircleMarker>
                        ))}

                        {/* District Level - Show branches */}
                        {currentView.level === 'District' && currentData.branches?.map((branch, idx) => (
                            <CircleMarker
                                key={idx}
                                center={branch.coord}
                                radius={12}
                                pathOptions={{ color: '#8b5cf6', fillColor: '#8b5cf6', fillOpacity: 0.6 }}
                                eventHandlers={{ click: () => drillDown('Branch', branch.name, { branchName: branch.name }) }}
                            >
                                <Popup>
                                    <strong>{branch.name} Branch</strong><br />
                                    GLP: ₹{branch.glp} Cr<br />
                                    Clients: {branch.clients.toLocaleString()}<br />
                                    Centres: {branch.centres.length}<br />
                                    PAR 30: {branch.par30}%<br />
                                    PAR 90: {branch.par90 || ((branch.par30 || 0) * 0.5).toFixed(2)}%<br />
                                    Click to explore
                                </Popup>
                            </CircleMarker>
                        ))}

                        {/* Branch Level - Show centres */}
                        {currentView.level === 'Branch' && currentData.centres?.map((centre, idx) => (
                            <CircleMarker
                                key={idx}
                                center={centre.coord}
                                radius={10}
                                pathOptions={{ color: '#10b981', fillColor: '#10b981', fillOpacity: 0.7 }}
                                eventHandlers={{ click: () => drillDown('Centre', centre.name) }}
                            >
                                <Popup>
                                    <strong>{centre.name}</strong><br />
                                    Clients: {centre.clients}<br />
                                    GLP: ₹{centre.glp} Lakhs<br />
                                    Active Loans: {centre.activeLoans}<br />
                                    PAR 30: {centre.par30}%<br />
                                    PAR 90: {centre.par90 || (centre.par30 * 0.5).toFixed(2)}%<br />
                                    Click for details
                                </Popup>
                            </CircleMarker>
                        ))}

                        {/* Centre Level - Show single centre */}
                        {currentView.level === 'Centre' && currentData.centre && (
                            <CircleMarker
                                center={currentData.centre.coord}
                                radius={15}
                                pathOptions={{ color: '#ef4444', fillColor: '#ef4444', fillOpacity: 0.8 }}
                                eventHandlers={{ click: () => drillDown('Customer', currentData.centre!.name) }}
                            >
                                <Popup>
                                    <strong>{currentData.centre.name}</strong><br />
                                    Clients: {currentData.centre.clients}<br />
                                    GLP: ₹{currentData.centre.glp} Lakhs<br />
                                    Active Loans: {currentData.centre.activeLoans}<br />
                                    PAR 30: {currentData.centre.par30}%<br />
                                    PAR 90: {currentData.centre.par90 || (currentData.centre.par30 * 0.5).toFixed(2)}%<br />
                                    <button
                                        className="mt-2 w-full bg-primary-100 text-primary-700 px-3 py-1.5 rounded-lg text-xs font-bold border border-primary-200 hover:bg-primary-200 transition-colors"
                                        onClick={(e) => {
                                            e.stopPropagation(); // Prevent popup quirks
                                            drillDown('Customer', currentData.centre!.name);
                                        }}
                                    >
                                        View Geo-Fence & Customers &gt;
                                    </button>
                                </Popup>
                            </CircleMarker>
                        )}

                        {/* Customer Level - Show Fence and Customers */}
                        {currentView.level === 'Customer' && currentData.centre && currentData.customers && (
                            <>
                                {/* Fence Circle (400m radius) - Frosted Glass Effect */}
                                <Circle
                                    center={currentData.centre.coord}
                                    radius={400} // 400 meters
                                    pathOptions={{
                                        className: 'backdrop-blur-[2px]', // Subtle blur to the map below
                                        color: '#3b82f6',
                                        weight: 2,
                                        dashArray: '10, 10',
                                        fillColor: '#60a5fa',
                                        fillOpacity: 0.15
                                    }}
                                />

                                {/* Centre Marker - Larger and Distinct */}
                                <CircleMarker
                                    center={currentData.centre.coord}
                                    radius={10}
                                    pathOptions={{
                                        color: 'white',
                                        weight: 3,
                                        fillColor: '#2563eb',
                                        fillOpacity: 1
                                    }}
                                >
                                    <Popup>
                                        <strong>{currentData.centre.name}</strong> (Centre Location)
                                    </Popup>
                                </CircleMarker>

                                {/* Customer Markers */}
                                {currentData.customers.map((cust, idx) => (
                                    <CircleMarker
                                        key={idx}
                                        center={cust.coord}
                                        radius={7}
                                        pathOptions={{
                                            color: 'white',
                                            weight: 2,
                                            fillColor: cust.compliance === 'within' ? '#10b981' : '#ef4444',
                                            fillOpacity: 1
                                        }}
                                    >
                                        <Popup>
                                            <strong>{cust.name}</strong><br />
                                            Status: {cust.status}<br />
                                            Compliance: <span className={cust.compliance === 'within' ? 'text-emerald-600 font-bold' : 'text-rose-600 font-bold'}>
                                                {cust.compliance === 'within' ? 'Within Range' : 'Outside Fence'}
                                            </span>
                                        </Popup>
                                    </CircleMarker>
                                ))}
                            </>
                        )}
                    </MapContainer>

                    {/* Map Legend for Customer Level */}
                    {currentView.level === 'Customer' && (
                        <div className="absolute bottom-4 right-4 bg-white/90 backdrop-blur p-2 rounded-lg border border-secondary-200 shadow-sm text-xs z-[1000]">
                            <div className="font-bold mb-1">Geo-Fence Status</div>
                            <div className="flex items-center gap-2 mb-1">
                                <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                                <span>Within Fence</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-rose-500"></div>
                                <span>Outside Fence</span>
                            </div>
                        </div>
                    )}
                </div>

                {/* Sidebar Column - Stats & Info */}
                <div className="lg:col-span-1 flex flex-col gap-3 h-full overflow-y-auto pr-1 custom-scrollbar">
                    {/* Stats KPIs - Compact Grid */}
                    <div className="grid grid-cols-2 gap-2 shrink-0">
                        <div className="bg-white p-3 rounded-lg border border-secondary-200 shadow-sm">
                            <div className="flex justify-between items-start mb-1">
                                <span className="text-xs text-secondary-500 font-medium">{currentView.level === 'Centre' || currentView.level === 'Customer' ? 'GLP (L)' : 'GLP (Cr)'}</span>
                                <TrendingUp size={14} className="text-primary-500" />
                            </div>
                            <div className="text-lg font-bold text-secondary-900">
                                {currentView.level === 'Centre' || currentView.level === 'Customer'
                                    ? `₹${summaryStats.glp} L`
                                    : `₹${summaryStats.glp.toLocaleString()}`}
                            </div>
                            <div className="text-[10px] text-success font-medium flex items-center gap-0.5">
                                <span>↑</span> 12% vs last mth
                            </div>
                        </div>

                        <div className="bg-white p-3 rounded-lg border border-secondary-200 shadow-sm">
                            <div className="flex justify-between items-start mb-1">
                                <span className="text-xs text-secondary-500 font-medium">
                                    {currentView.level === 'Branch' || currentView.level === 'Centre' || currentView.level === 'Customer' ? 'Clients' : 'Branches'}
                                </span>
                                <Users size={14} className="text-blue-500" />
                            </div>
                            <div className="text-lg font-bold text-secondary-900">
                                {currentView.level === 'Branch' || currentView.level === 'Centre' || currentView.level === 'Customer'
                                    ? summaryStats.clients?.toLocaleString() || '-'
                                    : summaryStats.branches?.toLocaleString() || '-'}
                            </div>
                            {currentView.level === 'Branch' && (
                                <div className="text-[10px] text-secondary-400">
                                    {summaryStats.centres} Centres
                                </div>
                            )}
                        </div>

                        <div className="bg-white p-3 rounded-lg border border-secondary-200 shadow-sm">
                            <div className="flex justify-between items-start mb-1">
                                <span className="text-xs text-secondary-500 font-medium">PAR {'>'} 30</span>
                            </div>
                            <div className="text-lg font-bold text-secondary-900">{summaryStats.par30}%</div>
                            <div className={`text-[10px] font-medium flex items-center gap-0.5 ${summaryStats.par30 < 3 ? 'text-success' : 'text-danger'}`}>
                                <span>{summaryStats.par30 < 3 ? '↓' : '↑'}</span> 0.1% vs last mth
                            </div>
                        </div>

                        <div className="bg-white p-3 rounded-lg border border-secondary-200 shadow-sm">
                            <div className="flex justify-between items-start mb-1">
                                <span className="text-xs text-secondary-500 font-medium">
                                    {currentView.level === 'Centre' || currentView.level === 'Customer' ? 'Active Lns' : 'Digital'}
                                </span>
                            </div>
                            <div className="text-lg font-bold text-secondary-900">
                                {currentView.level === 'Centre' || currentView.level === 'Customer'
                                    ? summaryStats.activeLoans?.toLocaleString() || '-'
                                    : `${summaryStats.digital}%`}
                            </div>
                            <div className="text-[10px] text-success font-medium flex items-center gap-0.5">
                                <span>↑</span> 2% vs last mth
                            </div>
                        </div>

                        <div className="bg-white p-3 rounded-lg border border-secondary-200 shadow-sm col-span-2 sm:col-span-1">
                            <div className="flex justify-between items-start mb-1">
                                <span className="text-xs text-secondary-500 font-medium">
                                    {currentView.level === 'Centre' || currentView.level === 'Customer' ? 'Write Off (L)' : 'Write Off (Cr)'}
                                </span>
                                <AlertCircle size={14} className="text-rose-500" />
                            </div>
                            <div className="text-lg font-bold text-secondary-900">
                                ₹{summaryStats.writeOff?.toLocaleString() || '0'}
                            </div>
                            <div className="text-[10px] text-secondary-400">
                                YTD Cumulative
                            </div>
                        </div>
                    </div>

                    {/* Risk Radar - Dynamic Top Risky Entities */}
                    {(currentView.level !== 'Centre' && currentView.level !== 'Customer') && (
                        <div className="bg-white p-3 rounded-lg border border-secondary-200 shadow-sm shrink-0">
                            <h4 className="font-bold text-secondary-800 text-xs mb-2 flex items-center justify-between">
                                <span className="flex items-center gap-1.5">
                                    <AlertCircle size={14} className="text-rose-500" />
                                    Risk Radar
                                </span>
                                <span className="text-[10px] bg-rose-50 text-rose-600 px-1.5 py-0.5 rounded border border-rose-100">Top 3 by PAR</span>
                            </h4>
                            <div className="space-y-2">
                                {(currentView.level === 'Country' ? ALL_STATES_DATA :
                                    currentView.level === 'State' ? currentData.districts :
                                        currentView.level === 'District' ? currentData.branches :
                                            currentView.level === 'Branch' ? currentData.centres : [])
                                    ?.slice()
                                    .sort((a: any, b: any) => (b.par30 || 0) - (a.par30 || 0))
                                    .slice(0, 3)
                                    .map((item: any, idx: number) => (
                                        <div key={idx} className="flex justify-between items-center text-xs p-1.5 bg-rose-50/50 rounded hover:bg-rose-50 transition-colors cursor-pointer border border-transparent hover:border-rose-100"
                                            onClick={() => drillDown(
                                                currentView.level === 'Country' ? 'State' :
                                                    currentView.level === 'State' ? 'District' :
                                                        currentView.level === 'District' ? 'Branch' : 'Centre',
                                                item.name,
                                                currentView.level === 'Country' ? { stateName: item.name } :
                                                    currentView.level === 'State' ? { districtName: item.name } :
                                                        currentView.level === 'District' ? { branchName: item.name } : {}
                                            )}
                                        >
                                            <span className="font-medium text-secondary-700 truncate max-w-[140px]">{item.name}</span>
                                            <span className="font-bold text-rose-600 bg-white px-1.5 py-0.5 rounded text-[10px] border border-rose-100 shadow-sm">
                                                {(item.par30 || 0).toFixed(2)}%
                                            </span>
                                        </div>
                                    ))}
                            </div>
                        </div>
                    )}

                    {/* Info Card - Compact */}
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 shrink-0">
                        <div className="flex items-start gap-2">
                            <MapPin className="text-blue-600 shrink-0 mt-0.5" size={16} />
                            <div className="text-xs">
                                <p className="font-bold text-blue-900 mb-0.5">
                                    {currentView.level} Level
                                </p>
                                <p className="text-blue-700 leading-snug">
                                    {currentView.level === 'Country' && `${ALL_STATES_DATA.length} states | ${summaryStats.branches} branches`}
                                    {currentView.level === 'State' && `${currentData.districts?.length || 0} districts in ${currentView.label}`}
                                    {currentView.level === 'District' && `${currentData.branches?.length || 0} branches in ${currentView.label}`}
                                    {currentView.level === 'Branch' && `${currentData.centres?.length || 0} centres | ${summaryStats.clients} clients`}
                                    {currentView.level === 'Centre' && `${summaryStats.clients} clients | ₹${summaryStats.glp} Lakhs GLP`}
                                    {currentView.level === 'Customer' && `Viewing active customers for ${currentView.label}`}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Customer Stats Panel */}
                    {currentView.level === 'Customer' && currentData.customers && (
                        <div className="bg-white p-3 rounded-lg border border-secondary-200 shadow-sm">
                            <h4 className="font-bold text-secondary-800 text-xs mb-3 flex items-center gap-2">
                                <AlertCircle size={14} className="text-primary-500" />
                                Geo-Fence Compliance
                            </h4>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="bg-emerald-50 p-2 rounded border border-emerald-100 text-center">
                                    <div className="text-xl font-bold text-emerald-600">
                                        {currentData.customers.filter(c => c.compliance === 'within').length}
                                    </div>
                                    <div className="text-[10px] text-emerald-800 font-medium">Within Fence</div>
                                </div>
                                <div className="bg-rose-50 p-2 rounded border border-rose-100 text-center">
                                    <div className="text-xl font-bold text-rose-600">
                                        {currentData.customers.filter(c => c.compliance === 'outside').length}
                                    </div>
                                    <div className="text-[10px] text-rose-800 font-medium">Outside Fence</div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Centre Details Table - Compact */}
                    {(currentView.level === 'Centre' || currentView.level === 'Customer') && currentData.centre && (
                        <div className="bg-white rounded-lg border border-secondary-200 shadow-sm p-3 text-xs overflow-y-auto">
                            <h3 className="font-bold text-secondary-900 mb-2">Metrics Breakdown</h3>
                            <div className="space-y-2">
                                <div className="flex justify-between p-1.5 bg-blue-50 rounded border border-blue-100">
                                    <span className="text-blue-700">Clients</span>
                                    <span className="font-bold text-blue-900">{currentData.centre.clients}</span>
                                </div>
                                <div className="flex justify-between p-1.5 bg-green-50 rounded border border-green-100">
                                    <span className="text-green-700">Loans</span>
                                    <span className="font-bold text-green-900">{currentData.centre.activeLoans}</span>
                                </div>
                                <div className="flex justify-between p-1.5 bg-purple-50 rounded border border-purple-100">
                                    <span className="text-purple-700">GLP</span>
                                    <span className="font-bold text-purple-900">₹{currentData.centre.glp}L</span>
                                </div>
                                <div className="flex justify-between p-1.5 bg-orange-50 rounded border border-orange-100">
                                    <span className="text-orange-700">PAR</span>
                                    <span className="font-bold text-orange-900">{currentData.centre.par30}%</span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default GeoDashboard;
