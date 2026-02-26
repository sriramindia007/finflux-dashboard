import React, { useState } from 'react';
import { Map, Home, ChevronRight, X } from 'lucide-react';
import SmartSchedulerModal from '../components/SmartSchedulerModal';

// Hardcoded DB to match the Streamlit Python app exactly
const CENTRE_DB = {
    "Tumkur C1": {
        lat: 13.3392, lng: 77.1021,
        members: 20, attendance: 0.82, collection: 0.91,
        is_new: false,
        city: "Tumkur", district: "Tumakuru", state: "Karnataka",
        pincode: "572101", staff: "Vinay",
        centre_id: "109302", ext_id: "103873",
        activation: "23 Jan 2019", submission: "11 Dec 2022",
        next_meeting: "21 Jan 2024", frequency: "Every 4 weeks, on Wednesday",
        leader: "Lakshmi Devi", leader_id: "00920123", rating: 3.5,
    },
    "Tumkur C2 (New)": {
        lat: 13.3500, lng: 77.1100,
        members: 15, attendance: null, collection: null,
        is_new: true,
        city: "Tumkur", district: "Tumakuru", state: "Karnataka",
        pincode: "572102", staff: "Vinay",
        centre_id: "NEW-8291", ext_id: "PENDING",
        activation: "Pending", submission: "22 Feb 2026",
        next_meeting: "Unscheduled", frequency: "Every 4 weeks",
        leader: "Pending", leader_id: "-", rating: 0.0,
    }
};

const SmartSchedulerPage: React.FC = () => {
    const [currentCentreName, setCurrentCentreName] = useState("Tumkur C1");
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [meetingTime, setMeetingTime] = useState("10:00 AM");

    const c = CENTRE_DB[currentCentreName as keyof typeof CENTRE_DB];

    const handleSwitchCentre = () => {
        if (currentCentreName === "Tumkur C1") {
            setCurrentCentreName("Tumkur C2 (New)");
            setMeetingTime("Unscheduled");
        } else {
            setCurrentCentreName("Tumkur C1");
            setMeetingTime("10:00 AM");
        }
    };

    const handleConfirmSlot = (slotTime: string) => {
        // Convert 24h to 12h AM/PM for display
        const [hStr, mStr] = slotTime.split(':');
        const h = parseInt(hStr, 10);
        const ampm = h >= 12 ? 'PM' : 'AM';
        const h12 = h % 12 || 12;
        setMeetingTime(`${h12}:${mStr} ${ampm}`);
        setIsModalOpen(false);
    };

    const renderStars = (rating: number) => {
        const full = Math.floor(rating);
        const hasHalf = rating - full >= 0.5;
        const empty = 5 - full - (hasHalf ? 1 : 0);
        return (
            <span className="text-[#F4A246] text-xl tracking-widest">
                {'★'.repeat(full)}
                {hasHalf ? '½' : ''}
                {'☆'.repeat(empty)}
            </span>
        );
    };

    // --- Modal Overlay ---
    if (isModalOpen) {
        return (
            <div className="fixed inset-0 bg-slate-100 z-50 overflow-y-auto w-full h-full flex items-center justify-center py-6">
                <div className="max-w-[1200px] w-full px-4 relative mt-[10vh]">
                    <button
                        onClick={() => setIsModalOpen(false)}
                        className="absolute -top-4 -right-2 bg-white text-slate-500 hover:text-slate-800 p-2 rounded-full shadow-lg border border-slate-200 z-50 transition-colors"
                    >
                        <X size={24} />
                    </button>
                    {/* The Modal Component itself renders the full content */}
                    <SmartSchedulerModal
                        isOpen={isModalOpen}
                        onClose={() => setIsModalOpen(false)}
                        centreData={{ name: currentCentreName, clients: c.members, lat: c.lat, lng: c.lng }}
                        onConfirm={handleConfirmSlot}
                    />
                </div>
            </div>
        );
    }

    // --- Main Layout ---
    return (
        <div className="min-h-screen bg-slate-50 font-['Inter',sans-serif] text-[#003366] overflow-x-hidden">
            {/* Page Bar */}
            <div className="bg-white border-b border-[#E2E5E8] px-3 sm:px-6 py-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm sticky top-0 z-40">
                <h1 className="text-lg sm:text-xl font-bold text-[#003366] truncate w-full sm:w-auto">Centre Profile</h1>
                <button
                    onClick={handleSwitchCentre}
                    className="h-9 px-4 shrink-0 rounded-full border border-slate-300 text-slate-700 font-semibold text-[13px] hover:bg-slate-50 transition-colors bg-white shadow-sm w-full sm:w-auto text-center"
                >
                    {currentCentreName === "Tumkur C1" ? "Switch to New Centre" : "Switch to Tumkur C1"}
                </button>
            </div>

            {/* Content Area */}
            <div className="max-w-[1000px] mx-auto p-4 flex flex-col md:flex-row gap-4">

                {/* LEFT COLUMN: Profile Info */}
                <div className="w-full md:w-[45%] flex flex-col gap-4">

                    {/* Overview Card */}
                    <div className="bg-white rounded-xl shadow-[0_2px_8px_rgba(27,36,44,0.08)] p-5 relative overflow-hidden">
                        {/* Streamlit style top accent bar */}
                        <div className="absolute top-0 left-0 right-0 h-1 bg-[#2196F3]"></div>
                        <div className="text-center mb-4 mt-2">
                            <div className="flex justify-center gap-2 mb-3">
                                <div className="w-16 h-12 bg-[#ECEEF0] rounded flex items-center justify-center text-3xl">
                                    <Home size={24} className="text-[#6684A3]" />
                                </div>
                                <div className="w-16 h-12 bg-[#ECEEF0] rounded flex items-center justify-center text-3xl">
                                    <Map size={24} className="text-[#6684A3]" />
                                </div>
                            </div>
                            <h2 className="font-bold text-[18px] text-[#003366] mb-1">{currentCentreName}</h2>
                            <div className="inline-flex items-center gap-1.5 bg-[#E8F5E5] border border-[#D1ECCC] text-[#1A9F00] px-3 py-0.5 rounded-full text-[11px] font-bold">
                                <div className="w-1.5 h-1.5 bg-[#1A9F00] rounded-full"></div>
                                ACTIVE
                            </div>
                        </div>

                        <div className="flex flex-col gap-3.5 text-[13.5px] mt-6">
                            <div className="flex justify-between border-b border-slate-100 pb-2"><span className="font-semibold text-[#6684A3]">Staff Assigned</span><span className="text-[#2196F3] font-bold cursor-pointer">{c.staff}</span></div>
                            <div className="flex justify-between border-b border-slate-100 pb-2"><span className="font-semibold text-[#6684A3]">Center ID</span><span className="text-[#003366] font-medium">{c.centre_id}</span></div>
                            <div className="flex justify-between border-b border-slate-100 pb-2"><span className="font-semibold text-[#6684A3]">External ID</span><span className="text-[#003366] font-medium">{c.ext_id}</span></div>
                            <div className="flex justify-between border-b border-slate-100 pb-2"><span className="font-semibold text-[#6684A3]">Activation Date</span><span className="text-[#003366] font-medium">{c.activation}</span></div>
                            <div className="flex justify-between border-b border-slate-100 pb-2"><span className="font-semibold text-[#6684A3]">Submission Date</span><span className="text-[#003366] font-medium">{c.submission}</span></div>
                            <div className="flex justify-between border-b border-slate-100 pb-2"><span className="font-semibold text-[#6684A3]">City</span><span className="text-[#003366] font-medium">{c.city}</span></div>
                            <div className="flex justify-between border-b border-slate-100 pb-2"><span className="font-semibold text-[#6684A3]">District</span><span className="text-[#003366] font-medium">{c.district}</span></div>
                            <div className="flex justify-between border-b border-slate-100 pb-2"><span className="font-semibold text-[#6684A3]">State</span><span className="text-[#003366] font-medium">{c.state}</span></div>
                            <div className="flex justify-between"><span className="font-semibold text-[#6684A3]">Pincode</span><span className="text-[#003366] font-medium">{c.pincode}</span></div>
                        </div>
                    </div>

                    {/* Meeting Details Card */}
                    <div className="bg-white rounded-xl shadow-[0_2px_8px_rgba(27,36,44,0.08)] p-5 relative overflow-hidden">
                        <div className="absolute top-0 left-0 right-0 h-1 bg-[#2196F3]"></div>
                        <div className="flex justify-between items-center mb-4 pb-3 border-b border-[#F5F6F7] mt-1">
                            <h3 className="font-bold text-[16px] text-[#003366]">Meeting Details</h3>
                            <button className="text-[#2196F3] font-bold text-[13px] hover:underline">Edit</button>
                        </div>
                        <div className="flex flex-col gap-4 text-[13.5px]">
                            <div className="flex justify-between flex-wrap gap-1"><span className="font-semibold text-[#6684A3]">Next Meeting Date</span><span className="text-[#003366] font-medium">{c.next_meeting}</span></div>
                            <div className="flex flex-col sm:flex-row sm:justify-between gap-1"><span className="font-semibold text-[#6684A3]">Meeting Frequency</span><span className="text-[#003366] font-medium sm:text-right max-w-full sm:max-w-[150px] leading-tight break-words">{c.frequency}</span></div>
                        </div>
                    </div>

                    {/* Meeting Time Action Row */}
                    <div
                        onClick={() => setIsModalOpen(true)}
                        className="bg-[#E9F4FE] border border-[#D3EAFD] rounded-xl p-4 cursor-pointer hover:shadow-[0_4px_12px_rgba(33,150,243,0.15)] transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 group"
                    >
                        <div>
                            <div className="text-[11px] font-bold text-[#6684A3] uppercase tracking-wider mb-1">📅 Meeting Time</div>
                            <div className="text-xl sm:text-[20px] font-extrabold text-[#2196F3] leading-none">{meetingTime}</div>
                        </div>
                        <div className="bg-[#2196F3] w-full sm:w-auto text-white px-4 py-2.5 sm:py-2 rounded-full text-[14px] sm:text-[13px] font-bold shadow-sm group-hover:bg-[#1976D2] transition-colors flex items-center justify-center gap-1">
                            Get AI Slot <ChevronRight size={16} />
                        </div>
                    </div>

                    {/* Performance Card */}
                    <div className="bg-white rounded-xl shadow-[0_2px_8px_rgba(27,36,44,0.08)] p-5 relative overflow-hidden mb-8">
                        <div className="absolute top-0 left-0 right-0 h-1 bg-[#2196F3]"></div>
                        <h3 className="font-bold text-[16px] text-[#003366] mb-4 pb-3 border-b border-[#F5F6F7] mt-1">Centre Leader</h3>
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-12 h-12 rounded-full bg-[#D3EAFD] text-[#2196F3] flex items-center justify-center font-bold text-lg border-2 border-white shadow-sm">LD</div>
                            <div>
                                <div className="font-bold text-[16px] text-[#003366] leading-tight mb-0.5">{c.leader}</div>
                                <div className="text-[13px] text-[#6684A3] font-medium">ID: {c.leader_id}</div>
                            </div>
                        </div>

                        <h3 className="font-bold text-[16px] text-[#003366] mb-4 pb-3 border-b border-[#F5F6F7]">Performance</h3>
                        <div className="flex items-center gap-3 mb-5">
                            <div className="text-4xl font-extrabold text-[#003366] tracking-tight">{c.rating.toFixed(1)}</div>
                            <div className="-mt-1">{renderStars(c.rating)}</div>
                        </div>

                        <div className="flex flex-col gap-3.5 text-[13.5px]">
                            <div className="flex justify-between">
                                <span className="font-semibold text-[#6684A3]">Attendance Rate</span>
                                <span className="text-[#1A9F00] font-extrabold text-[15px]">{c.attendance ? `${Math.round(c.attendance * 100)}%` : 'N/A'}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="font-semibold text-[#6684A3]">Collection Rate</span>
                                <span className="text-[#1A9F00] font-extrabold text-[15px]">{c.collection ? `${Math.round(c.collection * 100)}%` : 'N/A'}</span>
                            </div>
                            <div className="flex justify-between border-t border-slate-100 pt-3 mt-1">
                                <span className="font-bold text-[#003366] text-[15px]">Total Members</span>
                                <span className="font-extrabold text-[16px] text-[#003366]">{c.members}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* RIGHT COLUMN: Groups */}
                <div className="w-full md:w-[55%]">
                    <div className="bg-white rounded-xl shadow-[0_2px_8px_rgba(27,36,44,0.08)] mt-0 relative overflow-hidden">
                        <div className="absolute top-0 left-0 right-0 h-1 bg-[#2196F3]"></div>
                        <div className="flex border-b border-[#E2E5E8] px-2 pt-1">
                            <button className="px-6 py-4 border-b-[3px] border-[#2196F3] text-[#003366] font-bold text-[15px]">Groups</button>
                            <button className="px-6 py-4 border-b-[3px] border-transparent text-[#6684A3] font-bold text-[15px] hover:text-[#003366] transition-colors">Notes</button>
                        </div>

                        <div className="flex flex-col pb-2">
                            {/* Group Item */}
                            <div className="flex items-center justify-between py-4 px-6 border-b border-[#F5F6F7] hover:bg-slate-50 cursor-pointer transition-colors group">
                                <div className="flex items-center gap-3 sm:gap-4 shrink-0 max-w-[80%]">
                                    <div className="w-10 h-10 sm:w-11 sm:h-11 shrink-0 rounded-full bg-[#E2E5E8] text-[#003366] flex items-center justify-center font-bold text-sm shadow-sm border-2 border-white">T1</div>
                                    <div className="min-w-0">
                                        <div className="font-bold text-[#003366] mb-0.5 text-[14px] sm:text-[15px] group-hover:text-[#2196F3] transition-colors truncate">Tumkur C1G1</div>
                                        <div className="text-[12px] sm:text-[13px] text-[#6684A3] font-medium truncate">ID: 000032489260</div>
                                    </div>
                                </div>
                                <ChevronRight className="text-[#C5CBD1] shrink-0 group-hover:text-[#2196F3] transition-colors" size={20} />
                            </div>

                            <div className="flex items-center justify-between py-4 px-4 sm:px-6 border-b border-[#F5F6F7] hover:bg-slate-50 cursor-pointer transition-colors group">
                                <div className="flex items-center gap-3 sm:gap-4 shrink-0 max-w-[80%]">
                                    <div className="w-10 h-10 sm:w-11 sm:h-11 shrink-0 rounded-full bg-[#D1ECCC] text-[#1A9F00] flex items-center justify-center font-bold text-sm shadow-sm border-2 border-white">RD</div>
                                    <div className="min-w-0">
                                        <div className="font-bold text-[#003366] mb-0.5 text-[14px] sm:text-[15px] group-hover:text-[#2196F3] transition-colors truncate">Radhika Devi</div>
                                        <div className="text-[12px] sm:text-[13px] text-[#6684A3] font-medium truncate">ID: 000032489261</div>
                                    </div>
                                </div>
                                <ChevronRight className="text-[#C5CBD1] shrink-0 group-hover:text-[#2196F3] transition-colors" size={20} />
                            </div>

                            <div className="flex items-center justify-between py-4 px-4 sm:px-6 border-b border-[#F5F6F7] hover:bg-slate-50 cursor-pointer transition-colors group">
                                <div className="flex items-center gap-3 sm:gap-4 shrink-0 max-w-[80%]">
                                    <div className="w-10 h-10 sm:w-11 sm:h-11 shrink-0 rounded-full bg-[#D3EAFD] text-[#2196F3] flex items-center justify-center font-bold text-sm shadow-sm border-2 border-white">T2</div>
                                    <div className="min-w-0">
                                        <div className="font-bold text-[#003366] mb-0.5 text-[14px] sm:text-[15px] group-hover:text-[#2196F3] transition-colors truncate">Tumkur C1G2</div>
                                        <div className="text-[12px] sm:text-[13px] text-[#6684A3] font-medium truncate">ID: 000032489262</div>
                                    </div>
                                </div>
                                <ChevronRight className="text-[#C5CBD1] shrink-0 group-hover:text-[#2196F3] transition-colors" size={20} />
                            </div>

                            <div className="flex items-center justify-between py-4 px-4 sm:px-6 hover:bg-slate-50 cursor-pointer transition-colors group">
                                <div className="flex items-center gap-3 sm:gap-4 shrink-0 max-w-[80%]">
                                    <div className="w-10 h-10 sm:w-11 sm:h-11 shrink-0 rounded-full bg-[#FDECDA] text-[#F4A246] flex items-center justify-center font-bold text-sm shadow-sm border-2 border-white">T3</div>
                                    <div className="min-w-0">
                                        <div className="font-bold text-[#003366] mb-0.5 text-[14px] sm:text-[15px] group-hover:text-[#2196F3] transition-colors truncate">Tumkur C1G3</div>
                                        <div className="text-[12px] sm:text-[13px] text-[#6684A3] font-medium truncate">ID: 000032489263</div>
                                    </div>
                                </div>
                                <ChevronRight className="text-[#C5CBD1] shrink-0 group-hover:text-[#2196F3] transition-colors" size={20} />
                            </div>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default SmartSchedulerPage;
