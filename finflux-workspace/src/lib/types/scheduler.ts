// ============================================================
// SMART MFI SCHEDULER — TypeScript Types
// These types map 1:1 to the Supabase database schema.
// ============================================================

export interface Branch {
    id: string;
    name: string;
    code: string;
    lat: number;
    lng: number;
    city: string;
    state: string;
    address?: string;
    phone?: string;
    active: boolean;
}

export interface FieldOfficer {
    id: string;
    name: string;
    employee_code: string;
    branch_id: string;
    phone?: string;
    email?: string;
    status: 'active' | 'inactive' | 'on_leave';
}

export interface Centre {
    id: string;
    name: string;
    code: string;
    branch_id: string;
    fo_id?: string;
    lat: number;
    lng: number;
    address?: string;
    village?: string;
    total_members: number;
    active_members: number;
    meeting_frequency: string;
    meeting_day?: string;
    meeting_week?: number;
    centre_type: 'new' | 'existing';
    status: 'active' | 'inactive' | 'dormant';
    established_date?: string;
}

export interface CentreMeetingHistory {
    id: string;
    centre_id: string;
    fo_id?: string;
    meeting_date: string;          // ISO date string 'YYYY-MM-DD'
    slot_start: string;            // 'HH:MM'
    slot_end: string;              // 'HH:MM'
    scheduled_members: number;
    attended_members: number;
    attendance_rate: number;       // computed 0.0000 – 1.0000
    target_collection: number;
    actual_collection: number;
    collection_rate: number;       // computed 0.0000 – 1.0000
    weather_condition?: 'clear' | 'rain' | 'cloudy' | 'festival_day';
    notes?: string;
}

export interface FoDailyScheduleEntry {
    id: string;
    fo_id: string;
    centre_id: string;
    schedule_date: string;         // 'YYYY-MM-DD'
    slot_start: string;            // 'HH:MM'
    slot_end: string;              // 'HH:MM'
    status: 'planned' | 'completed' | 'cancelled' | 'rescheduled';
    // Joined from view
    fo_name?: string;
    fo_code?: string;
    centre_name?: string;
    centre_lat?: number;
    centre_lng?: number;
}

export interface ScheduledMeeting {
    id: string;
    centre_id: string;
    fo_id: string;
    meeting_date: string;
    slot_start: string;
    slot_end: string;
    status: 'confirmed' | 'tentative' | 'cancelled';
    scheduled_by?: string;
    ai_recommended_slot?: string;
    ai_score?: number;
    notes?: string;
    created_at?: string;
}

export interface AvailabilityWindow {
    id: string;
    branch_id: string;
    label: string;
    window_start: string;   // 'HH:MM'
    window_end: string;     // 'HH:MM'
}

// ============================================================
// The main object returned by the scheduler data service.
// This is everything the SmartSchedulerModal needs to run.
// ============================================================
export interface SchedulerContext {
    centre: CentreRecentStats;
    fo: FieldOfficer;
    branch: Branch;
    foScheduleToday: FoDailyScheduleEntry[];    // FO's OTHER meetings on the target date
    availabilityWindows: [string, string][];     // [['08:00','13:00'], ['14:00','19:00']]
    meetingDate: Date;
}

// ============================================================
// View: centre_recent_stats (computed att/col from last 90 days)
// ============================================================
export interface CentreRecentStats {
    centre_id: string;
    centre_name: string;
    centre_code: string;
    branch_id: string;
    fo_id?: string;
    lat: number;
    lng: number;
    total_members: number;
    active_members: number;
    meeting_frequency: string;
    meeting_day?: string;
    centre_type: 'new' | 'existing';
    status: string;
    branch_lat: number;
    branch_lng: number;
    branch_name: string;
    fo_name?: string;
    fo_code?: string;
    // Computed over last 90 days
    avg_attendance_rate: number;    // e.g. 0.8200
    avg_collection_rate: number;    // e.g. 0.9100
    avg_actual_collection: number;  // avg INR collected per meeting
    meetings_in_period: number;
    last_meeting_date?: string;
}
