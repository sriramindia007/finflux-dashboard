// Ported from ai_scheduler_engine.py

export const SLOT_SIZE = 30; // minutes per slot bucket

// ---------------------------------------------------------------------------
// Duration & Distances
// ---------------------------------------------------------------------------
export function calculateDuration(totalMembers: number, baseMin = 10, minPerMember = 3, bufferMin = 10): number {
    return baseMin + (totalMembers * minPerMember) + bufferMin;
}

export function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371.0; // Earth radius in km
    const toRad = (value: number) => (value * Math.PI) / 180;

    const dlat = toRad(lat2 - lat1);
    const dlon = toRad(lon2 - lon1);
    const a =
        Math.pow(Math.sin(dlat / 2), 2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.pow(Math.sin(dlon / 2), 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

// ---------------------------------------------------------------------------
// Route Evaluation (Current vs Optimal)
// ---------------------------------------------------------------------------
export function calculateRouteMetrics(stops: { lat: number, lng: number }[]): { km: number, mins: number } {
    if (!stops || stops.length === 0) return { km: 0, mins: 0 };

    let totalKm = 0.0;
    for (let i = 0; i < stops.length - 1; i++) {
        totalKm += haversineDistance(stops[i].lat, stops[i].lng, stops[i + 1].lat, stops[i + 1].lng);
    }
    // Return to base
    totalKm += haversineDistance(stops[stops.length - 1].lat, stops[stops.length - 1].lng, stops[0].lat, stops[0].lng);

    const travelMins = Math.floor((totalKm / 30.0) * 60);
    return { km: Number(totalKm.toFixed(1)), mins: travelMins };
}

// Helper to get permutations for brute-force TSP
function getPermutations<T>(arr: T[]): T[][] {
    if (arr.length <= 1) return [arr];
    const perms: T[][] = [];
    for (let i = 0; i < arr.length; i++) {
        const current = arr[i];
        const remaining = arr.slice(0, i).concat(arr.slice(i + 1));
        const remainingPerms = getPermutations(remaining);
        for (const perm of remainingPerms) {
            perms.push([current].concat(perm));
        }
    }
    return perms;
}

export function roundToNextHalfHour(mins: number): number {
    const remainder = mins % 30;
    if (remainder === 0) return mins;
    return mins + (30 - remainder);
}

export function calculateOptimalRoute(
    stops: { name: string, lat: number, lng: number, time: number, type: string }[],
    durationMins = 30,
    targetTimeConstraint?: number
): { route: typeof stops, km: number, mins: number, isValid: boolean } {
    if (stops.length <= 2) {
        const metrics = calculateRouteMetrics(stops);
        return { route: stops, km: metrics.km, mins: metrics.mins, isValid: true };
    }

    const base = stops[0];
    const others = stops.slice(1);

    let bestRoute: typeof stops = [];
    let bestDist = Infinity;
    let foundValid = false;

    // Start of the day in minutes (e.g. 09:00 AM)
    const DAY_START_MINS = 540;

    const permutations = getPermutations(others);

    for (const perm of permutations) {
        const currentRoute = [base, ...perm];
        const metrics = calculateRouteMetrics(currentRoute);

        // Simulate a continuous chronological drive through this specific permutation
        let isValidChronology = true;
        let simulatedMins = DAY_START_MINS;
        let waitPenalty = 0;

        // Start from base (index 0) to first meeting (index 1)
        simulatedMins += Math.max(5, Math.floor((haversineDistance(base.lat, base.lng, currentRoute[1].lat, currentRoute[1].lng) * 1.4 / 25) * 60));

        for (let i = 1; i < currentRoute.length - 1; i++) {
            const currentMeeting = currentRoute[i];
            const nextMeeting = currentRoute[i + 1];

            // Snap to next logical meeting block
            simulatedMins = roundToNextHalfHour(simulatedMins);

            // If this is the Target meeting, we MUST enforce that we didn't arrive "too late" for its scheduled slot.
            // If the user picked 1:00 PM (780 mins), but the geographic drive puts us here at 2:00 PM, this whole route permutation is invalid.
            if (currentMeeting.type === 'target') {
                const constraint = targetTimeConstraint ?? currentMeeting.time;
                if (simulatedMins > constraint) {
                    isValidChronology = false;
                    break;
                }
                // If we arrived early, we wait until the scheduled time.
                if (simulatedMins < constraint) {
                    waitPenalty += (constraint - simulatedMins);
                    simulatedMins = constraint;
                }
            }

            // 1. Hold the meeting
            simulatedMins += durationMins;

            // 2. Drive to the next meeting
            const transitTime = Math.max(5, Math.floor((haversineDistance(currentMeeting.lat, currentMeeting.lng, nextMeeting.lat, nextMeeting.lng) * 1.4 / 25) * 60));
            simulatedMins += transitTime;

            // End of Day Boundary Guard: If any permutation pushes us past 7:00 PM (1140 mins), it's strictly invalid.
            if (simulatedMins > 1140) {
                isValidChronology = false;
                break;
            }
        }

        const penalty = isValidChronology ? 0 : 9999;
        // 1 km penalty per ~10 minutes of wait time to encourage logical day flow
        const totalCost = metrics.km + penalty + (waitPenalty * 0.1);

        if (totalCost < bestDist) {
            bestDist = totalCost;
            bestRoute = currentRoute;
            foundValid = isValidChronology;
        }
    }

    // Recalculate pure metrics without the penalty for the final return
    const bestMetrics = calculateRouteMetrics(bestRoute);
    return { route: bestRoute, km: bestMetrics.km, mins: bestMetrics.mins, isValid: foundValid };
}

// ---------------------------------------------------------------------------
// Chained travel: travel from the FO's last meeting to the target centre
// ---------------------------------------------------------------------------
export interface MeetingStop {
    centre: string;
    lat: number;
    lng: number;
    start: string; // HH:MM
    end: string;   // HH:MM
    color?: string;
    bg?: string;
}

export function calculateChainedTravel(
    foSchedule: MeetingStop[],
    targetLat: number,
    targetLng: number,
    foBaseLat: number,
    foBaseLng: number
): { mins: number, km: number } {
    if (!foSchedule || foSchedule.length === 0) {
        const dist = haversineDistance(foBaseLat, foBaseLng, targetLat, targetLng);
        const mins = Math.max(5, Math.floor((dist * 1.4 / 25) * 60));
        return { mins, km: Number((dist * 1.4).toFixed(1)) };
    }

    // Find the meeting that ends last
    const sortedMeetings = [...foSchedule].sort((a, b) => a.end.localeCompare(b.end));
    const last = sortedMeetings[sortedMeetings.length - 1];

    const dist = haversineDistance(last.lat, last.lng, targetLat, targetLng);
    const mins = Math.max(5, Math.floor((dist * 1.4 / 25) * 60));
    return { mins, km: Number((dist * 1.4).toFixed(1)) };
}

// ---------------------------------------------------------------------------
// Frequency / cadence validation
// ---------------------------------------------------------------------------
const DAY_NAMES = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

export function frequencyCheck(frequencyStr: string, meetingDate: Date): { isValid: boolean; message: string } {
    if (!frequencyStr || !meetingDate) {
        return { isValid: true, message: "Frequency not configured" };
    }

    const freqLower = frequencyStr.toLowerCase();

    // Get weekday name (e.g., 'monday')
    const options: Intl.DateTimeFormatOptions = { weekday: 'long' };
    const dateWeekday = meetingDate.toLocaleDateString('en-US', options).toLowerCase();
    const formattedDate = meetingDate.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

    let matchedDay: string | null = null;
    for (const day of DAY_NAMES) {
        if (freqLower.includes(day)) {
            matchedDay = day;
            break;
        }
    }

    if (!matchedDay) {
        return { isValid: true, message: "Flexible cadence — no specific day constraint" };
    }

    const capitalizedDay = matchedDay.charAt(0).toUpperCase() + matchedDay.slice(1);

    if (dateWeekday === matchedDay) {
        return {
            isValid: true,
            message: `✅ Centre meets on ${capitalizedDay}s — Today is a ${capitalizedDay} ✅`
        };
    } else {
        return {
            isValid: false,
            message: `⚠️ Date mismatch — Centre meets on ${capitalizedDay}s, but ${formattedDate} is a ${dateWeekday.charAt(0).toUpperCase() + dateWeekday.slice(1)}. Consider rescheduling.`
        };
    }
}

// ---------------------------------------------------------------------------
// Time Utils
// ---------------------------------------------------------------------------
export function timeToMins(hhmm: string): number {
    const [h, m] = hhmm.split(':').map(Number);
    return h * 60 + m;
}

export function minsToTime(mins: number): string {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function isSlotOccupied(startStr: string, durMins: number, schedule: MeetingStop[], ignoreCentre?: string): { occupied: boolean, centreName: string | null } {
    const s = timeToMins(startStr);
    const e = s + durMins;

    for (const b of schedule) {
        if (ignoreCentre && b.centre === ignoreCentre) continue;

        const bs = timeToMins(b.start);
        const be = timeToMins(b.end);

        // Overlap condition: max(s, bs) < min(e, be)
        if (Math.max(s, bs) < Math.min(e, be)) {
            return { occupied: true, centreName: b.centre };
        }
    }
    return { occupied: false, centreName: null };
}

// ---------------------------------------------------------------------------
// Slot generation
// ---------------------------------------------------------------------------
export function generateSlots(start = "09:00", end = "19:30"): string[] {
    const slots: string[] = [];
    let currentMins = timeToMins(start);
    const endMins = timeToMins(end);

    while (currentMins < endMins) {
        slots.push(minsToTime(currentMins));
        currentMins += SLOT_SIZE;
    }
    return slots;
}

export function slotsNeeded(duration: number): number {
    return Math.ceil(duration / SLOT_SIZE);
}

// ---------------------------------------------------------------------------
// Constraint: slot must fit inside at least one availability window
// ---------------------------------------------------------------------------
export function insideWindow(slotStart: string, nSlots: number, windows: [string, string][]): boolean {
    const startMins = timeToMins(slotStart);
    const endMins = startMins + (nSlots * SLOT_SIZE);

    for (const w of windows) {
        const wStart = timeToMins(w[0]);
        const wEnd = timeToMins(w[1]);
        if (startMins >= wStart && endMins <= wEnd) {
            return true;
        }
    }
    return false;
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------
export function timeOfDayPreference(slotStart: string): number {
    const [hStr, mStr] = slotStart.split(':');
    const hour = parseInt(hStr, 10) + parseInt(mStr, 10) / 60.0;

    if (hour >= 8.5 && hour <= 11.5) {
        return 1.0 - Math.abs(hour - 10.0) / 3.0;
    } else if (hour > 11.5 && hour <= 13.0) {
        return 0.4 - (hour - 11.5) * 0.2;
    } else if (hour > 13.0 && hour <= 14.5) {
        return 0.1;
    } else if (hour > 14.5 && hour <= 16.0) {
        return 0.3 + (hour - 14.5) * 0.1;
    } else {
        return Math.max(0.0, 0.45 - (hour - 16.0) * 0.2);
    }
}

export interface ScoreBreakdown {
    attendance_rate: number;
    collection_rate: number;
    travel_hours: number;
    travel_penalty: number;
    time_of_day_score: number;
    att_contribution: number;
    coll_contribution: number;
    travel_contribution: number;
    tod_contribution: number;
    total: number;
}

export function scoreSlot(slotStart: string, attendance: number, collection: number, travelHours: number, isNewCenter = false): { total: number, breakdown: ScoreBreakdown } {
    const tod = timeOfDayPreference(slotStart);
    const travelPenalty = Math.min(travelHours, 1.0);

    const attContrib = Number((attendance * 0.40).toFixed(4));
    const collContrib = Number((collection * 0.30).toFixed(4));
    const travelContrib = Number((travelPenalty * 0.15).toFixed(4));
    const todContrib = Number((tod * 0.15).toFixed(4));
    const total = Number((attContrib + collContrib - travelContrib + todContrib).toFixed(4));

    const breakdown: ScoreBreakdown = {
        attendance_rate: attendance,
        collection_rate: collection,
        travel_hours: travelHours,
        travel_penalty: travelPenalty,
        time_of_day_score: Number(tod.toFixed(4)),
        att_contribution: attContrib,
        coll_contribution: collContrib,
        travel_contribution: travelContrib,
        tod_contribution: todContrib,
        total: total,
    };
    return { total, breakdown };
}

export function explainSlot(slotStart: string, breakdown: ScoreBreakdown, durationMins: number, isNewCenter = false): string[] {
    const reasons: string[] = [];
    const hour = parseInt(slotStart.split(':')[0], 10);
    const { time_of_day_score: tod, attendance_rate: att, collection_rate: col, travel_hours: tHr } = breakdown;

    // Time-of-day insight
    if (tod >= 0.8) {
        reasons.push(`🌅 **Peak morning window** — MFI members show highest attendance before 11:30 AM. This slot aligns perfectly.`);
    } else if (tod >= 0.5) {
        reasons.push(`☀️ **Good morning slot** — Member availability is above average at ${slotStart}.`);
    } else if (hour >= 13 && hour <= 14) {
        reasons.push(`⚠️ **Post-lunch window** — Attendance tends to dip slightly after lunch, but this is within your availability.`);
    } else {
        reasons.push(`🕐 **Afternoon slot** — Secondary availability window; earlier slots had conflicts.`);
    }

    // Attendance insight
    if (isNewCenter) {
        reasons.push(`🌱 **New Centre Baseline** — No historical data available. Using a conservative ${Math.floor(att * 100)}% baseline attendance assumption.`);
    } else if (att >= 0.85) {
        reasons.push(`✅ **High attendance centre** — ${Math.floor(att * 100)}% historical attendance means most members reliably show up.`);
    } else if (att >= 0.70) {
        reasons.push(`📊 **Average attendance** — ${Math.floor(att * 100)}% attendance; scheduling at peak time maximises turnout.`);
    } else {
        reasons.push(`⚠️ **Low attendance centre** — ${Math.floor(att * 100)}% attendance; choosing the best time slot is especially critical.`);
    }

    // Collection insight
    if (isNewCenter) {
        reasons.push(`🌱 **New Target Collection** — Assuming a standard ${Math.floor(col * 100)}% collection target for new centre planning.`);
    } else if (col >= 0.90) {
        reasons.push(`💰 **Excellent collection rate** — ${Math.floor(col * 100)}% collection rate boosts this slot's priority score significantly.`);
    } else if (col >= 0.80) {
        reasons.push(`💳 **Good collection rate** — ${Math.floor(col * 100)}% collection reinforces the value of this meeting slot.`);
    }

    // Travel insight
    const travelMins = Math.round(tHr * 60);
    if (travelMins <= 15) {
        reasons.push(`🚗 **Short travel** — Only ${travelMins} min from last location, minimising field officer transit cost.`);
    } else if (travelMins <= 30) {
        reasons.push(`🚗 **Moderate travel** — ${travelMins} min drive is factored into the score.`);
    } else {
        reasons.push(`🚗 **Travel noted** — ${travelMins} min drive; slot still recommended because attendance & collection strength outweigh travel cost.`);
    }

    // Duration insight
    reasons.push(`⏱️ **Meeting duration** — ${durationMins} min estimated (${Math.floor(durationMins / 60)}h ${durationMins % 60}m) based on member count and standard 3 min/member protocol.`);

    // Convert **bold** to HTML since the UI renders it via dangerouslySetInnerHTML
    return reasons.map(r => r.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>'));
}

// ---------------------------------------------------------------------------
// Main recommendation function
// ---------------------------------------------------------------------------
export function recommendSlot(
    totalMembers: number,
    availabilityWindows: [string, string][],
    attendance: number,
    collection: number,
    travelTimeMins: number,
    isNewCenter = false
): { bestSlot: string | null, duration: number, allFeasible: { slot: string, score: number }[], topBreakdown: ScoreBreakdown | null } {
    const duration = calculateDuration(totalMembers);
    const needed = slotsNeeded(duration);
    const slots = generateSlots();
    const travelHours = travelTimeMins / 60.0;

    interface FeasibleSlot {
        slot: string;
        score: number;
    }
    const feasible: FeasibleSlot[] = [];

    for (const slot of slots) {
        if (insideWindow(slot, needed, availabilityWindows)) {
            const { total } = scoreSlot(slot, attendance, collection, travelHours, isNewCenter);
            feasible.push({ slot, score: total });
        }
    }

    feasible.sort((a, b) => b.score - a.score);

    if (feasible.length > 0) {
        const topSlot = feasible[0].slot;
        const { breakdown: topBreakdown } = scoreSlot(topSlot, attendance, collection, travelHours, isNewCenter);
        return { bestSlot: topSlot, duration, allFeasible: feasible, topBreakdown };
    } else {
        return { bestSlot: null, duration, allFeasible: [], topBreakdown: null };
    }
}
