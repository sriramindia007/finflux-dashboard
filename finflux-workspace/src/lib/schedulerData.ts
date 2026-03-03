// ============================================================
// SMART MFI SCHEDULER — Data Service Layer
// All Supabase queries for the Smart Scheduler in one place.
// Components import from here — never query Supabase directly.
// ============================================================

import { supabase } from './supabase';
import type {
    SchedulerContext,
    CentreRecentStats,
    FieldOfficer,
    Branch,
    FoDailyScheduleEntry,
    AvailabilityWindow,
    ScheduledMeeting,
} from './types/scheduler';

// ============================================================
// fetchSchedulerContext
// Single entry point for the SmartSchedulerModal.
// Given a centre ID and a target meeting date, returns ALL
// context needed to run the scheduling engine.
// ============================================================
export async function fetchSchedulerContext(
    centreId: string,
    meetingDate: Date
): Promise<SchedulerContext | null> {
    const dateStr = meetingDate.toISOString().split('T')[0]; // 'YYYY-MM-DD'

    // Run all queries in parallel
    const [centreResult, foScheduleResult, windowsResult] = await Promise.all([
        // 1. Centre stats (att/col from last 90 days, plus branch and FO info)
        supabase
            .from('centre_recent_stats')
            .select('*')
            .eq('centre_id', centreId)
            .single(),

        // 2. FO's OTHER planned meetings on the same date
        //    We exclude the current centre so they don't block themselves
        supabase
            .from('fo_schedule_with_details')
            .select('*')
            .eq('schedule_date', dateStr)
            .neq('centre_id', centreId)
            .in('status', ['planned', 'completed']),   // treat 'completed' as occupying the slot

        // 3. Branch availability windows (will be fetched after we know branch_id)
        //    Placeholder — resolved below once we have branch_id
        Promise.resolve({ data: null, error: null }),
    ]);

    if (centreResult.error || !centreResult.data) {
        console.error('fetchSchedulerContext: Could not load centre stats', centreResult.error);
        return null;
    }

    const centre = centreResult.data as CentreRecentStats;

    // Fetch availability windows for this branch
    const { data: windowsData, error: windowsError } = await supabase
        .from('availability_windows')
        .select('*')
        .eq('branch_id', centre.branch_id);

    if (windowsError) {
        console.error('fetchSchedulerContext: Could not load availability windows', windowsError);
    }

    // Fetch FO details
    const { data: foData, error: foError } = centre.fo_id
        ? await supabase
            .from('field_officers')
            .select('*')
            .eq('id', centre.fo_id)
            .single()
        : { data: null, error: null };

    if (foError) console.warn('fetchSchedulerContext: Could not load FO details', foError);

    // Fetch Branch details
    const { data: branchData, error: branchError } = await supabase
        .from('branches')
        .select('*')
        .eq('id', centre.branch_id)
        .single();

    if (branchError) console.warn('fetchSchedulerContext: Could not load branch', branchError);

    // Shape availability windows into [start, end] string tuples
    const windows: [string, string][] = windowsData
        ? (windowsData as AvailabilityWindow[]).map(w =>
            [w.window_start.slice(0, 5), w.window_end.slice(0, 5)] as [string, string]
        )
        : [['08:00', '13:00'], ['14:00', '19:00']]; // sensible default

    // Filter FO schedule to same FO as this centre
    const foScheduleToday = foScheduleResult.data
        ? (foScheduleResult.data as FoDailyScheduleEntry[]).filter(
            s => s.fo_id === centre.fo_id
        )
        : [];

    return {
        centre,
        fo: foData as FieldOfficer,
        branch: branchData as Branch,
        foScheduleToday,
        availabilityWindows: windows,
        meetingDate,
    };
}

// ============================================================
// fetchCentresByBranch
// Used by CentreDashboard to list all centres for a branch.
// ============================================================
export async function fetchCentresByBranch(branchId: string): Promise<CentreRecentStats[]> {
    const { data, error } = await supabase
        .from('centre_recent_stats')
        .select('*')
        .eq('branch_id', branchId)
        .order('centre_name');

    if (error) {
        console.error('fetchCentresByBranch:', error);
        return [];
    }
    return (data ?? []) as CentreRecentStats[];
}

// ============================================================
// fetchCentresByFO
// Used to show all centres assigned to a specific field officer.
// ============================================================
export async function fetchCentresByFO(foId: string): Promise<CentreRecentStats[]> {
    const { data, error } = await supabase
        .from('centre_recent_stats')
        .select('*')
        .eq('fo_id', foId)
        .order('centre_name');

    if (error) {
        console.error('fetchCentresByFO:', error);
        return [];
    }
    return (data ?? []) as CentreRecentStats[];
}

// ============================================================
// fetchFOSchedule
// Get an FO's full schedule for a given date.
// ============================================================
export async function fetchFOSchedule(
    foId: string,
    date: Date
): Promise<FoDailyScheduleEntry[]> {
    const dateStr = date.toISOString().split('T')[0];

    const { data, error } = await supabase
        .from('fo_schedule_with_details')
        .select('*')
        .eq('fo_id', foId)
        .eq('schedule_date', dateStr)
        .order('slot_start');

    if (error) {
        console.error('fetchFOSchedule:', error);
        return [];
    }
    return (data ?? []) as FoDailyScheduleEntry[];
}

// ============================================================
// confirmMeeting
// Saves a confirmed meeting slot to the database.
// Also adds it to fo_daily_schedule so future scheduler calls
// will see it as an occupied slot.
// ============================================================
export async function confirmMeeting(
    centreId: string,
    foId: string,
    meetingDate: Date,
    slotStart: string,
    slotEnd: string,
    scheduledBy: string,
    aiRecommendedSlot?: string,
    aiScore?: number
): Promise<{ success: boolean; error?: string }> {
    const dateStr = meetingDate.toISOString().split('T')[0];

    // Insert confirmed meeting
    const { error: smError } = await supabase.from('scheduled_meetings').insert({
        centre_id: centreId,
        fo_id: foId,
        meeting_date: dateStr,
        slot_start: slotStart,
        slot_end: slotEnd,
        status: 'confirmed',
        scheduled_by: scheduledBy,
        ai_recommended_slot: aiRecommendedSlot || null,
        ai_score: aiScore ?? null,
    });

    if (smError) {
        console.error('confirmMeeting: scheduled_meetings insert failed', smError);
        return { success: false, error: smError.message };
    }

    // Also add to fo_daily_schedule so it blocks future scheduling
    const { error: dsError } = await supabase.from('fo_daily_schedule').insert({
        fo_id: foId,
        centre_id: centreId,
        schedule_date: dateStr,
        slot_start: slotStart,
        slot_end: slotEnd,
        status: 'planned',
    });

    if (dsError) {
        // Non-fatal — may already exist if re-scheduling
        console.warn('confirmMeeting: fo_daily_schedule insert warning', dsError);
    }

    return { success: true };
}
