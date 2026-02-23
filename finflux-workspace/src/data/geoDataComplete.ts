/**
 * Complete Geographic Data with Branches and Centres
 * Hierarchy: Country → State → District → Branch → Centre
 */

// import { STATES_DATA, COMPANY_METRICS } from './mfiData';
import { uttarPradeshState, rajasthanState, biharState } from './northIndiaData';
import { NETWORK_CONFIG, DERIVED_NETWORK } from './networkConfig';

// ==================== BRANCH & CENTRE DATA STRUCTURE ====================

export interface Centre {
    name: string;
    coord: [number, number];
    clients: number;
    glp: number; // in Lakhs
    activeLoans: number;
    par30: number;
    par60?: number; // > 60 days
    par90?: number; // > 90 days
    par180?: number; // > 180 days
    writeOff?: number; // in Lakhs
    products?: Record<string, ProductStats>;
    pendingApprovals?: number; // count
    collectionLag?: number; // in Lakhs
    pipeline?: ApplicationPipeline;
    digitalCollection?: number; // in Lakhs
    staffCount?: number;
    lucPending?: number; // Count
    insurancePending?: number; // Count
    leadsGenerated?: number; // Count
    groupCount?: number; // NEW: Actual count (~5 per centre)
}

export interface ProductStats {
    glp: number;     // Cr (or Lakhs in Centre)
    par30: number;   // %
    par60: number;   // %
    par90: number;   // %
    par180: number;  // %
    clients: number;
}

export interface StageStats {
    total: number;
    outsideSLA: number;
}

export interface ApplicationPipeline {
    sourcing: StageStats;
    kyc: StageStats;
    grt: StageStats;
    sanction: StageStats;
    disbursement: StageStats;
}

export interface Branch {
    name: string;
    coord: [number, number];
    glp: number; // in Crores
    clients: number;
    centres: Centre[];
    writeOff?: number; // in Crores
    par30?: number; // Calculated/Rolled up
    par60?: number;
    par90?: number;
    par180?: number;
    activeLoans?: number; // Rolled up
    products?: Record<string, ProductStats>;
    type?: 'MFI' | 'MSME';
    pendingApprovals?: number; // count
    collectionLag?: number; // in Crores
    pipeline?: ApplicationPipeline;
    digitalCollection?: number; // in Crores
    staffCount?: number;
    lucPending?: number; // Count
    insurancePending?: number; // Count
    leadsGenerated?: number; // Count
    centreCount?: number; // NEW: Actual count = centres.length
    groupCount?: number;  // NEW: Estimated = centres.length * 5
}

export interface District {
    name: string;
    coord: [number, number];
    glp: number; // in Crores
    branches: Branch[];
    writeOff?: number; // in Crores
    par30?: number; // Calculated/Rolled up
    par60?: number;
    par90?: number;
    par180?: number;
    clients?: number; // Rolled up
    branchCount?: number; // Simulated count
    products?: Record<string, ProductStats>;
    pendingApprovals?: number;
    collectionLag?: number; // in Crores
    pipeline?: ApplicationPipeline;
    digitalCollection?: number; // in Crores
    staffCount?: number;
    lucPending?: number; // Count
    insurancePending?: number; // Count
    leadsGenerated?: number; // Count
    centreCount?: number; // NEW: Rolled up from branches
    groupCount?: number;  // NEW: Rolled up from branches
}

export interface State {
    name: string;
    coord: [number, number];
    glp: number; // in Crores
    color: string;
    districts: District[];
    writeOff?: number; // in Crores
    par30?: number; // Calculated/Rolled up
    par60?: number;
    par90?: number;
    par180?: number;
    clients?: number; // Rolled up
    branchCount?: number; // Simulated count
    products?: Record<string, ProductStats>;
    pendingApprovals?: number;
    collectionLag?: number; // in Crores
    pipeline?: ApplicationPipeline;
    digitalCollection?: number; // in Crores
    staffCount?: number;
    lucPending?: number; // Count
    insurancePending?: number; // Count
    leadsGenerated?: number; // Count
    centreCount?: number; // NEW: Actual count from rollup
    groupCount?: number;  // NEW: Actual count from rollup
}

// ==================== ODISHA STATE DATA ====================

const odishaData: State = {
    name: 'Odisha',
    coord: [20.9517, 85.0985],
    glp: 0, // Calculated via rollup
    color: '#0ea5e9',
    districts: [
        {
            name: 'Khordha',
            coord: [20.1815, 85.6200],
            glp: 920,
            branches: [
                {
                    name: 'Bagheitangi',
                    coord: [20.1622, 85.6771],
                    glp: 45,
                    clients: 2450,
                    centres: [
                        { name: 'Mundel Centre 1', coord: [20.1549, 85.6868], clients: 450, glp: 8.5, activeLoans: 420, par30: 5.2 },
                        { name: 'Mundel Centre 2', coord: [20.1575, 85.6647], clients: 480, glp: 9.2, activeLoans: 460, par30: 1.5 },
                        { name: 'Bhagbanpur Centre', coord: [20.1700, 85.6892], clients: 420, glp: 7.8, activeLoans: 400, par30: 6.8 },
                        { name: 'Haripur Centre', coord: [20.1733, 85.6733], clients: 510, glp: 10.1, activeLoans: 490, par30: 1.1 },
                        { name: 'Balakati Centre', coord: [20.1582, 85.6755], clients: 590, glp: 9.4, activeLoans: 570, par30: 0.9 },
                    ]
                },
                {
                    name: 'Tangi',
                    coord: [19.9267, 85.3955],
                    glp: 47.5,
                    clients: 2580,
                    centres: [
                        { name: 'Tangi Bazaar Centre', coord: [19.9331, 85.3886], clients: 520, glp: 9.8, activeLoans: 500, par30: 6.3 },
                        { name: 'Kalapathar Centre', coord: [19.9275, 85.3916], clients: 490, glp: 9.1, activeLoans: 470, par30: 1.6 },
                        { name: 'Balipatna Centre', coord: [19.9265, 85.3919], clients: 550, glp: 10.5, activeLoans: 530, par30: 1.0 },
                        { name: 'Jankia Centre', coord: [19.9342, 85.3961], clients: 510, glp: 9.6, activeLoans: 490, par30: 1.4 },
                        { name: 'Nuasahi Centre', coord: [19.9292, 85.3925], clients: 510, glp: 8.5, activeLoans: 490, par30: 1.7 },
                    ]
                },
                {
                    name: 'Jatni',
                    coord: [20.1598, 85.7074],
                    glp: 42,
                    clients: 2280,
                    centres: [
                        { name: 'Jatni Main Centre', coord: [20.1519, 85.6996], clients: 460, glp: 8.5, activeLoans: 440, par30: 1.5 },
                        { name: 'Bankuala Centre', coord: [20.1570, 85.7198], clients: 450, glp: 8.2, activeLoans: 430, par30: 1.8 },
                        { name: 'Kantabad Centre', coord: [20.1676, 85.7186], clients: 470, glp: 8.7, activeLoans: 450, par30: 1.2 },
                        { name: 'Sisupalgarh Centre', coord: [20.1621, 85.6980], clients: 450, glp: 8.1, activeLoans: 430, par30: 1.4 },
                        { name: 'Govindpur Centre', coord: [20.1674, 85.7040], clients: 450, glp: 8.5, activeLoans: 430, par30: 1.6 },
                    ]
                },
            ]
        },
        {
            name: 'Bhubaneswar',
            coord: [20.2961, 85.8245],
            glp: 765,
            branches: [
                {
                    name: 'Bhubaneswar Urban',
                    coord: [20.2972, 85.8665],
                    glp: 50,
                    clients: 2720,
                    centres: [
                        { name: 'Old Town Centre 1', coord: [20.3076, 85.8576], clients: 550, glp: 10.5, activeLoans: 530, par30: 0.9 },
                        { name: 'Old Town Centre 2', coord: [20.2899, 85.8673], clients: 540, glp: 10.2, activeLoans: 520, par30: 1.1 },
                        { name: 'Rasulgarh Centre', coord: [20.2951, 85.8752], clients: 530, glp: 9.8, activeLoans: 510, par30: 1.3 },
                        { name: 'Mancheswar Centre', coord: [20.2963, 85.8749], clients: 550, glp: 10.0, activeLoans: 530, par30: 1.0 },
                        { name: 'Chandrasekharpur Centre', coord: [20.3065, 85.8698], clients: 550, glp: 9.5, activeLoans: 530, par30: 1.2 },
                    ]
                },
                {
                    name: 'Patia',
                    coord: [20.3533, 85.8266],
                    glp: 38,
                    clients: 2050,
                    centres: [
                        { name: 'Patia Market Centre', coord: [20.3528, 85.8141], clients: 410, glp: 7.8, activeLoans: 390, par30: 1.5 },
                        { name: 'Jaydev Vihar Centre', coord: [20.3633, 85.8150], clients: 410, glp: 7.5, activeLoans: 390, par30: 1.7 },
                        { name: 'Nandankanan Road Centre', coord: [20.3536, 85.8347], clients: 420, glp: 7.9, activeLoans: 400, par30: 1.4 },
                        { name: 'Sailashree Vihar Centre', coord: [20.3636, 85.8176], clients: 400, glp: 7.2, activeLoans: 380, par30: 1.8 },
                        { name: 'Sundarpada Centre', coord: [20.3587, 85.8312], clients: 410, glp: 7.6, activeLoans: 390, par30: 1.6 },
                    ]
                },
            ]
        },
        {
            name: 'Cuttack',
            coord: [20.4625, 85.8828],
            glp: 720,
            branches: [
                {
                    name: 'Cuttack Central',
                    coord: [20.4577, 85.8829],
                    glp: 40,
                    clients: 2170,
                    centres: [
                        { name: 'Buxi Bazaar Centre', coord: [20.4463, 85.8828], clients: 440, glp: 8.2, activeLoans: 420, par30: 1.6 },
                        { name: 'Dargha Bazaar Centre', coord: [20.4507, 85.8937], clients: 430, glp: 7.9, activeLoans: 410, par30: 1.8 },
                        { name: 'Mangalabag Centre', coord: [20.4453, 85.8745], clients: 440, glp: 8.3, activeLoans: 420, par30: 1.5 },
                        { name: 'Badambadi Centre', coord: [20.4688, 85.8711], clients: 430, glp: 7.8, activeLoans: 410, par30: 1.7 },
                        { name: 'Telengabazar Centre', coord: [20.4683, 85.8838], clients: 430, glp: 7.8, activeLoans: 410, par30: 1.9 },
                    ]
                },
                {
                    name: 'Jagatpur',
                    coord: [20.493, 85.923],
                    glp: 35,
                    clients: 1900,
                    centres: [
                        { name: 'Jagatpur Main Centre', coord: [20.4885, 85.9172], clients: 380, glp: 7.1, activeLoans: 360, par30: 1.8 },
                        { name: 'Nuapatna Centre', coord: [20.4963, 85.9125], clients: 380, glp: 6.9, activeLoans: 360, par30: 2.0 },
                        { name: 'Mathasahi Centre', coord: [20.4806, 85.9191], clients: 390, glp: 7.2, activeLoans: 370, par30: 1.7 },
                        { name: 'Satichaura Centre', coord: [20.5007, 85.9120], clients: 370, glp: 6.8, activeLoans: 350, par30: 2.1 },
                        { name: 'Jobra Centre', coord: [20.4967, 85.9148], clients: 380, glp: 7.0, activeLoans: 360, par30: 1.9 },
                    ]
                },
            ]
        },
        {
            name: 'Puri',
            coord: [19.8134, 85.8312],
            glp: 540,
            branches: [
                {
                    name: 'Puri Town',
                    coord: [19.8, 85.82],
                    glp: 32,
                    clients: 1740,
                    centres: [
                        { name: 'Swargadwar Centre', coord: [19.7917, 85.8170], clients: 350, glp: 6.5, activeLoans: 330, par30: 2.0 },
                        { name: 'Grand Road Centre', coord: [19.7962, 85.8149], clients: 340, glp: 6.2, activeLoans: 320, par30: 2.2 },
                        { name: 'Baseli Sahi Centre', coord: [19.8006, 85.8238], clients: 360, glp: 6.7, activeLoans: 340, par30: 1.9 },
                        { name: 'Markandeswar Centre', coord: [19.7980, 85.8079], clients: 340, glp: 6.3, activeLoans: 320, par30: 2.1 },
                        { name: 'Penthakata Centre', coord: [19.7955, 85.8116], clients: 350, glp: 6.3, activeLoans: 330, par30: 2.0 },
                    ]
                },
                {
                    name: 'Konark Road',
                    coord: [19.885, 86.095],
                    glp: 28,
                    clients: 1520,
                    centres: [
                        { name: 'Baliguali Centre', coord: [19.8789, 86.0973], clients: 300, glp: 5.5, activeLoans: 280, par30: 2.3 },
                        { name: 'Kakatpur Centre', coord: [19.8959, 86.0904], clients: 310, glp: 5.7, activeLoans: 290, par30: 2.1 },
                        { name: 'Gopinathpur Centre', coord: [19.8966, 86.0831], clients: 300, glp: 5.4, activeLoans: 280, par30: 2.4 },
                        { name: 'Belapur Centre', coord: [19.8872, 86.0900], clients: 310, glp: 5.8, activeLoans: 290, par30: 2.2 },
                        { name: 'Charichhak Centre', coord: [19.8811, 86.0876], clients: 300, glp: 5.6, activeLoans: 280, par30: 2.3 },
                    ]
                },
            ]
        },
        {
            name: 'Balasore',
            coord: [21.4934, 86.9135],
            glp: 455,
            branches: [
                {
                    name: 'Balasore Main',
                    coord: [21.494, 86.925],
                    glp: 30,
                    clients: 1630,
                    centres: [
                        { name: 'Motiganj Centre', coord: [21.5049, 86.9237], clients: 330, glp: 6.1, activeLoans: 310, par30: 2.4 },
                        { name: 'Fakirmohan Centre', coord: [21.4977, 86.9127], clients: 320, glp: 5.8, activeLoans: 300, par30: 2.6 },
                        { name: 'Sahadevkhunta Centre', coord: [21.5024, 86.9269], clients: 330, glp: 6.2, activeLoans: 310, par30: 2.3 },
                        { name: 'Old Court Centre', coord: [21.4858, 86.9125], clients: 320, glp: 5.9, activeLoans: 300, par30: 2.5 },
                        { name: 'Gopalgaon Centre', coord: [21.5054, 86.9132], clients: 330, glp: 6.0, activeLoans: 310, par30: 2.4 },
                    ]
                },
                {
                    name: 'Soro',
                    coord: [21.288, 86.688],
                    glp: 25,
                    clients: 1360,
                    centres: [
                        { name: 'Soro Bazaar Centre', coord: [21.2952, 86.6834], clients: 270, glp: 4.9, activeLoans: 250, par30: 2.7 },
                        { name: 'Dahisara Centre', coord: [21.2768, 86.6847], clients: 280, glp: 5.1, activeLoans: 260, par30: 2.5 },
                        { name: 'Simulia Centre', coord: [21.2997, 86.7002], clients: 270, glp: 4.8, activeLoans: 250, par30: 2.8 },
                        { name: 'Olaver Centre', coord: [21.2921, 86.6840], clients: 270, glp: 5.0, activeLoans: 250, par30: 2.6 },
                        { name: 'Singla Centre', coord: [21.2834, 86.6867], clients: 270, glp: 5.2, activeLoans: 250, par30: 2.5 },
                    ]
                },
            ]
        },
    ]
};

// ==================== KARNATAKA STATE DATA ====================

const karnatakaData: State = {
    name: 'Karnataka',
    coord: [15.3173, 75.7139],
    glp: 0,
    color: '#8b5cf6',
    districts: [
        {
            name: 'Bangalore Urban',
            coord: [12.9716, 77.5946],
            glp: 580,
            branches: [
                {
                    name: 'Yeshwanthpur',
                    coord: [13.028, 77.5409],
                    glp: 35,
                    clients: 1900,
                    centres: [
                        { name: 'Yeshwanthpur Main', coord: [13.0247, 77.5430], clients: 380, glp: 7.0, activeLoans: 360, par30: 1.9 },
                        { name: 'Goraguntepalya Centre', coord: [13.0254, 77.5386], clients: 390, glp: 7.2, activeLoans: 370, par30: 1.8 },
                        { name: 'RMC Yard Centre', coord: [13.0285, 77.5340], clients: 380, glp: 6.9, activeLoans: 360, par30: 2.0 },
                        { name: 'Sanjay Nagar Centre', coord: [13.0331, 77.5522], clients: 370, glp: 6.8, activeLoans: 350, par30: 2.1 },
                        { name: 'Mathikere Centre', coord: [13.0290, 77.5370], clients: 380, glp: 7.1, activeLoans: 360, par30: 1.9 },
                    ]
                },
                {
                    name: 'Electronic City',
                    coord: [12.8407, 77.6764],
                    glp: 32,
                    clients: 1740,
                    centres: [
                        { name: 'Electronic City Phase 1', coord: [12.8345, 77.6725], clients: 350, glp: 6.5, activeLoans: 330, par30: 2.0 },
                        { name: 'Bommasandra Centre', coord: [12.8335, 77.6850], clients: 340, glp: 6.2, activeLoans: 320, par30: 2.2 },
                        { name: 'Hebbagodi Centre', coord: [12.8436, 77.6746], clients: 360, glp: 6.7, activeLoans: 340, par30: 1.9 },
                        { name: 'Attibele Centre', coord: [12.8333, 77.6790], clients: 340, glp: 6.3, activeLoans: 320, par30: 2.1 },
                        { name: 'Chandapura Centre', coord: [12.8290, 77.6648], clients: 350, glp: 6.3, activeLoans: 330, par30: 2.0 },
                    ]
                },
            ]
        },
        {
            name: 'Mysore',
            coord: [12.2958, 76.6394],
            glp: 420,
            branches: [
                {
                    name: 'Mysore Main',
                    coord: [12.3109, 76.652],
                    glp: 28,
                    clients: 1520,
                    centres: [
                        { name: 'Devaraja Market Centre', coord: [12.3004, 76.6428], clients: 300, glp: 5.5, activeLoans: 280, par30: 2.1 },
                        { name: 'Shivarampet Centre', coord: [12.3100, 76.6643], clients: 310, glp: 5.7, activeLoans: 290, par30: 2.0 },
                        { name: 'Mandi Mohalla Centre', coord: [12.3205, 76.6573], clients: 300, glp: 5.4, activeLoans: 280, par30: 2.2 },
                        { name: 'Udayagiri Centre', coord: [12.3203, 76.6398], clients: 310, glp: 5.8, activeLoans: 290, par30: 2.0 },
                        { name: 'Chamarajapuram Centre', coord: [12.3055, 76.6568], clients: 300, glp: 5.6, activeLoans: 280, par30: 2.1 },
                    ]
                },
            ]
        },
    ]
};

// ==================== ANDHRA PRADESH STATE DATA ====================

const andhraData: State = {
    name: 'Andhra Pradesh',
    coord: [15.9129, 79.7400],
    glp: 0,
    color: '#ec4899',
    districts: [
        {
            name: 'Vijayawada',
            coord: [16.5062, 80.6480],
            glp: 480,
            branches: [
                {
                    name: 'Benz Circle',
                    coord: [16.4997, 80.6561],
                    glp: 30,
                    clients: 1630,
                    centres: [
                        { name: 'Governorpet Centre', coord: [16.4967, 80.6623], clients: 330, glp: 6.1, activeLoans: 310, par30: 2.2 },
                        { name: 'Patamata Centre', coord: [16.4950, 80.6523], clients: 320, glp: 5.8, activeLoans: 300, par30: 2.4 },
                        { name: 'Bhavanipuram Centre', coord: [16.5107, 80.6462], clients: 330, glp: 6.2, activeLoans: 310, par30: 2.1 },
                        { name: 'Machavaram Centre', coord: [16.4914, 80.6684], clients: 320, glp: 5.9, activeLoans: 300, par30: 2.3 },
                        { name: 'Gunadala Centre', coord: [16.5107, 80.6481], clients: 330, glp: 6.0, activeLoans: 310, par30: 2.2 },
                    ]
                },
                {
                    name: 'Gannavaram',
                    coord: [16.5386, 80.7982],
                    glp: 26,
                    clients: 1410,
                    centres: [
                        { name: 'Gannavaram Main', coord: [16.5409, 80.8048], clients: 280, glp: 5.1, activeLoans: 260, par30: 2.5 },
                        { name: 'Nidamanuru Centre', coord: [16.5304, 80.8011], clients: 290, glp: 5.3, activeLoans: 270, par30: 2.3 },
                        { name: 'Kesarapalli Centre', coord: [16.5361, 80.7912], clients: 280, glp: 5.0, activeLoans: 260, par30: 2.6 },
                        { name: 'Mylavaram Centre', coord: [16.5286, 80.7969], clients: 280, glp: 5.2, activeLoans: 260, par30: 2.4 },
                        { name: 'Vissannapeta Centre', coord: [16.5373, 80.7984], clients: 280, glp: 5.4, activeLoans: 260, par30: 2.3 },
                    ]
                },
            ]
        },
        {
            name: 'Visakhapatnam',
            coord: [17.6868, 83.2185],
            glp: 420,
            branches: [
                {
                    name: 'MVP Colony',
                    coord: [17.7414, 83.3387],
                    glp: 28,
                    clients: 1520,
                    centres: [
                        { name: 'MVP Sector 1', coord: [17.7396, 83.3379], clients: 300, glp: 5.5, activeLoans: 280, par30: 2.3 },
                        { name: 'MVP Sector 2', coord: [17.7536, 83.3431], clients: 310, glp: 5.7, activeLoans: 290, par30: 2.2 },
                        { name: 'Gajuwaka Centre', coord: [17.7357, 83.3372], clients: 300, glp: 5.4, activeLoans: 280, par30: 2.4 },
                        { name: 'Pedagantyada Centre', coord: [17.7490, 83.3363], clients: 310, glp: 5.8, activeLoans: 290, par30: 2.2 },
                        { name: 'Madhurawada Centre', coord: [17.7432, 83.3501], clients: 300, glp: 5.6, activeLoans: 280, par30: 2.3 },
                    ]
                },
            ]
        },
    ]
};

// ==================== MADHYA PRADESH STATE DATA ====================

const madhyaPradeshData: State = {
    name: 'Madhya Pradesh',
    coord: [22.9734, 78.6569],
    glp: 0,
    color: '#f59e0b',
    districts: [
        {
            name: 'Indore',
            coord: [22.7196, 75.8577],
            glp: 240,
            branches: [
                {
                    name: 'Rajwada',
                    coord: [22.7184, 75.8552],
                    glp: 25,
                    clients: 1360,
                    centres: [
                        { name: 'Rajwada Main', coord: [22.7265, 75.8469], clients: 270, glp: 4.9, activeLoans: 250, par30: 2.6 },
                        { name: 'Sarafa Bazaar Centre', coord: [22.7075, 75.8666], clients: 280, glp: 5.1, activeLoans: 260, par30: 2.5 },
                        { name: 'Khajuri Bazaar Centre', coord: [22.7099, 75.8442], clients: 270, glp: 4.8, activeLoans: 250, par30: 2.7 },
                        { name: 'Chhawni Centre', coord: [22.7270, 75.8523], clients: 270, glp: 5.0, activeLoans: 250, par30: 2.6 },
                        { name: 'Juni Indore Centre', coord: [22.7199, 75.8660], clients: 270, glp: 5.2, activeLoans: 250, par30: 2.5 },
                    ]
                },
            ]
        },
        {
            name: 'Bhopal',
            coord: [23.2599, 77.4126],
            glp: 200,
            branches: [
                {
                    name: 'MP Nagar',
                    coord: [23.2332, 77.4343],
                    glp: 22,
                    clients: 1195,
                    centres: [
                        { name: 'Zone 1 Centre', coord: [23.2400, 77.4420], clients: 240, glp: 4.4, activeLoans: 220, par30: 2.8 },
                        { name: 'Zone 2 Centre', coord: [23.2231, 77.4270], clients: 240, glp: 4.5, activeLoans: 220, par30: 2.7 },
                        { name: 'Koh-e-Fiza Centre', coord: [23.2264, 77.4261], clients: 235, glp: 4.3, activeLoans: 215, par30: 2.9 },
                        { name: 'Arera Colony Centre', coord: [23.2373, 77.4308], clients: 240, glp: 4.4, activeLoans: 220, par30: 2.8 },
                        { name: 'Shahpura Centre', coord: [23.2396, 77.4347], clients: 240, glp: 4.4, activeLoans: 220, par30: 2.7 },
                    ]
                },
            ]
        },
    ]
};

// ==================== TAMIL NADU STATE DATA ====================

const tamilNaduData: State = {
    name: 'Tamil Nadu',
    coord: [11.1271, 78.6569],
    glp: 0,
    color: '#10b981',
    districts: [
        {
            name: 'Chennai',
            coord: [13.0827, 80.2707],
            glp: 150,
            branches: [
                {
                    name: 'Royapettah',
                    coord: [13.0539, 80.2641],
                    glp: 20,
                    clients: 1085,
                    centres: [
                        { name: 'Royapettah Main', coord: [13.0526, 80.2573], clients: 220, glp: 4.1, activeLoans: 200, par30: 1.9 },
                        { name: 'Teynampet Centre', coord: [13.0536, 80.2632], clients: 215, glp: 3.9, activeLoans: 195, par30: 2.0 },
                        { name: 'Alwarpet Centre', coord: [13.0631, 80.2715], clients: 220, glp: 4.2, activeLoans: 200, par30: 1.8 },
                        { name: 'Mandaveli Centre', coord: [13.0587, 80.2733], clients: 215, glp: 3.9, activeLoans: 195, par30: 2.0 },
                        { name: 'Mylapore Centre', coord: [13.0415, 80.2740], clients: 215, glp: 3.9, activeLoans: 195, par30: 1.9 },
                    ]
                },
            ]
        },
        {
            name: 'Coimbatore',
            coord: [11.0168, 76.9558],
            glp: 110,
            branches: [
                {
                    name: 'Gandhipuram',
                    coord: [11.0205, 76.9667],
                    glp: 18,
                    clients: 975,
                    centres: [
                        { name: 'Gandhipuram Main', coord: [11.0274, 76.9573], clients: 195, glp: 3.6, activeLoans: 175, par30: 2.0 },
                        { name: 'RS Puram Centre', coord: [11.0304, 76.9765], clients: 195, glp: 3.5, activeLoans: 175, par30: 2.1 },
                        { name: 'Saibaba Colony Centre', coord: [11.0166, 76.9633], clients: 200, glp: 3.7, activeLoans: 180, par30: 1.9 },
                        { name: 'Peelamedu Centre', coord: [11.0111, 76.9592], clients: 190, glp: 3.5, activeLoans: 170, par30: 2.1 },
                        { name: 'Ganapathy Centre', coord: [11.0271, 76.9763], clients: 195, glp: 3.7, activeLoans: 175, par30: 2.0 },
                    ]
                },
            ]
        },
    ]
};

// ==================== EXPORT COMPLETE HIERARCHY ====================

export const ALL_STATES_DATA: State[] = [
    odishaData,
    karnatakaData,
    andhraData,
    madhyaPradeshData,
    tamilNaduData,
    uttarPradeshState,  // NEW: North India
    rajasthanState,     // NEW: North India
    biharState          // NEW: North India
];

// ==================== HELPER FUNCTIONS ====================

export const getStateData = (stateName: string): State | undefined => {
    return ALL_STATES_DATA.find(s => s.name === stateName);
};

export const getDistrictData = (stateName: string, districtName: string): District | undefined => {
    const state = getStateData(stateName);
    return state?.districts.find(d => d.name === districtName);
};

export const getBranchData = (stateName: string, districtName: string, branchName: string): Branch | undefined => {
    const district = getDistrictData(stateName, districtName);
    return district?.branches.find(b => b.name === branchName);
};

export const getCentreData = (stateName: string, districtName: string, branchName: string, centreName: string): Centre | undefined => {
    const branch = getBranchData(stateName, districtName, branchName);
    return branch?.centres.find(c => c.name === centreName);
};

// ==================== LEGACY SUPPORT (for existing code) ====================

export const COORDINATES = {
    // Country
    INDIA: [20.5937, 78.9629] as [number, number],

    // States
    ODISHA: odishaData.coord,
    KARNATAKA: karnatakaData.coord,
    ANDHRA: [15.9129, 79.7400] as [number, number],
    MADHYA_PRADESH: [22.9734, 78.6569] as [number, number],
    TAMIL_NADU: [11.1271, 78.6569] as [number, number],

    // Odisha Districts
    ODISHA_KHORDHA: odishaData.districts[0].coord,
    ODISHA_BHUBANESWAR: odishaData.districts[1].coord,
    ODISHA_CUTTACK: odishaData.districts[2].coord,
    ODISHA_PURI: odishaData.districts[3].coord,
    ODISHA_BALASORE: odishaData.districts[4].coord,

    // Karnataka Districts
    KARNATAKA_BANGALORE: karnatakaData.districts[0].coord,
    KARNATAKA_MYSORE: karnatakaData.districts[1].coord,
    KARNATAKA_BELGAUM: [15.8497, 74.4977] as [number, number],
    KARNATAKA_HUBLI: [15.3647, 75.1240] as [number, number],
    KARNATAKA_MANGALORE: [12.9141, 74.8560] as [number, number],

    // Other districts (legacy)
    ANDHRA_VIJAYAWADA: [16.5062, 80.6480] as [number, number],
    ANDHRA_VISAKHAPATNAM: [17.6868, 83.2185] as [number, number],
    ANDHRA_GUNTUR: [16.3067, 80.4365] as [number, number],
    ANDHRA_TIRUPATI: [13.6288, 79.4192] as [number, number],
    ANDHRA_KAKINADA: [16.9891, 82.2475] as [number, number],
    MP_INDORE: [22.7196, 75.8577] as [number, number],
    MP_BHOPAL: [23.2599, 77.4126] as [number, number],
    MP_JABALPUR: [23.1815, 79.9864] as [number, number],
    MP_GWALIOR: [26.2183, 78.1828] as [number, number],
    MP_UJJAIN: [23.1765, 75.7885] as [number, number],
    TN_CHENNAI: [13.0827, 80.2707] as [number, number],
    TN_COIMBATORE: [11.0168, 76.9558] as [number, number],
    TN_MADURAI: [9.9252, 78.1198] as [number, number],
    TN_SALEM: [11.6643, 78.1460] as [number, number],
    TN_TRICHY: [10.7905, 78.7047] as [number, number],
};

export interface GeoHierarchy {
    level: 'Country' | 'State' | 'District' | 'Branch' | 'Centre';
    label: string;
    glp: number;
    branches?: number | string;
    par30: number;
    par60?: number;
    par90: number; // usually tracked
    par180?: number;
    lucPending?: number;
    insurancePending?: number;
    leadsGenerated?: number;
    digitalPercentage: number;
    meetings?: { total: number; within: number };
    writeOff?: number; // Calculated aggregated write-off
    products?: Record<string, ProductStats>;
    pendingApprovals?: number;
    collectionLag?: number;
    pipeline?: ApplicationPipeline;
    digitalCollection?: number;
    staffCount?: number;
}

// ==================== DATA ENRICHMENT (PAR & WRITE-OFF & GLP ROLLUP) ====================

export let TOTAL_WRITEOFF = 0;
export let TOTAL_DIGITAL_COLLECTION = 0; // Crores
export let TOTAL_STAFF = 0;
export let TOTAL_LUC_PENDING = 0;
export let TOTAL_INSURANCE_PENDING = 0;
export let TOTAL_LEADS_GENERATED = 0;
export let TOTAL_PAR30_WEIGHTED = 0;
let TOTAL_PAR60_WEIGHTED = 0;
export let TOTAL_PAR90_WEIGHTED = 0;
let TOTAL_PAR180_WEIGHTED = 0;
export let TOTAL_GLP = 0;
export let TOTAL_CLIENTS = 0;
export let TOTAL_BRANCHES_COUNT = 0;  // EXPORTED for use in dashboards
export let TOTAL_PENDING_APPROVALS = 0;
export let TOTAL_COLLECTION_LAG = 0;
export let TOTAL_PIPELINE: ApplicationPipeline = {
    sourcing: { total: 0, outsideSLA: 0 },
    kyc: { total: 0, outsideSLA: 0 },
    grt: { total: 0, outsideSLA: 0 },
    sanction: { total: 0, outsideSLA: 0 },
    disbursement: { total: 0, outsideSLA: 0 }
};
export let TOTAL_PRODUCT_STATS: Record<string, ProductStats> = {};
export let TOTAL_CENTRES = 0; // NEW: Actual centre count
export let TOTAL_GROUPS = 0;  // NEW: Actual group count

// Local Definition to avoid Circular Dependency
// Local Definition to avoid Circular Dependency
const MFI_PRODUCT_DEFINITIONS: Record<string, { share: number, risk: number }> = {
    'Group Loans (JLG)': { share: 0.55, risk: 1.0 },
    'MSME Business': { share: 0.15, risk: 1.5 },
    'Housing': { share: 0.12, risk: 0.6 },
    'JIT (Emergency)': { share: 0.05, risk: 0.8 },
    'Samarth (PwD)': { share: 0.03, risk: 0.7 },
    'Swasth (WASH)': { share: 0.03, risk: 0.5 },
    'Green/Climate': { share: 0.03, risk: 0.9 },
    'Consumer Durable': { share: 0.02, risk: 1.2 },
    'Solar/EV': { share: 0.02, risk: 1.1 }
};

const MSME_PRODUCT_DEFINITIONS: Record<string, { share: number, risk: number }> = {
    'Group Loans (JLG)': { share: 0.05, risk: 1.2 }, // Low share for MSME branches
    'MSME Business': { share: 0.55, risk: 1.4 },
    'Housing': { share: 0.25, risk: 0.5 },
    'JIT (Emergency)': { share: 0.05, risk: 0.8 },
    'Samarth (PwD)': { share: 0.02, risk: 0.7 },
    'Swasth (WASH)': { share: 0.02, risk: 0.5 },
    'Green/Climate': { share: 0.03, risk: 0.9 },
    'Consumer Durable': { share: 0.02, risk: 1.2 },
    'Solar/EV': { share: 0.01, risk: 1.1 }
};

const enrichMetrics = () => {
    // Definitions First (Fix TDZ)
    const createPipeline = (): ApplicationPipeline => ({
        sourcing: { total: 0, outsideSLA: 0 },
        kyc: { total: 0, outsideSLA: 0 },
        grt: { total: 0, outsideSLA: 0 },
        sanction: { total: 0, outsideSLA: 0 },
        disbursement: { total: 0, outsideSLA: 0 }
    });

    const addPipelineStats = (target: ApplicationPipeline, source: ApplicationPipeline) => {
        Object.keys(source).forEach(key => {
            const k = key as keyof ApplicationPipeline;
            target[k].total += source[k].total;
            target[k].outsideSLA += source[k].outsideSLA;
        });
    };

    const addProductStats = (target: Record<string, ProductStats>, source: Record<string, ProductStats>, scale = 1) => {
        Object.keys(source).forEach(key => {
            if (!target[key]) target[key] = { glp: 0, par30: 0, par60: 0, par90: 0, par180: 0, clients: 0 };
            const s = source[key];
            target[key].glp += s.glp * scale;
            target[key].clients += Math.floor(s.clients * scale);
            // Numerator Accumulation for Weighted Avg
            target[key].par30 += (s.par30 * s.glp * scale);
            target[key].par60 += (s.par60 * s.glp * scale);
            target[key].par90 += (s.par90 * s.glp * scale);
            target[key].par180 += (s.par180 * s.glp * scale);
        });
    };

    let countryWriteOff = 0;
    let countryPar30Num = 0;
    let countryPar60Num = 0;
    let countryPar90Num = 0;
    let countryPar180Num = 0;
    let countryGlp = 0;
    let countryClients = 0;
    let countryBranches = 0;
    let countryPendingApprovals = 0;
    let countryCollectionLag = 0;
    let countryDigitalCollection = 0;
    let countryStaff = 0;

    // Usage after Definition
    let countryPipeline = createPipeline();
    let countryLuc = 0;
    let countryInsurance = 0;
    let countryLeads = 0;

    // Aggregate Country Products
    let countryProductAgg: Record<string, ProductStats> = {};

    // SCALING FACTORS - ADJUSTED FOR 8 STATES
    // Target: ~9,250 Cr GLP across 8 states (was 5 states)
    // Added 3 North India states, so scaling reduced proportionally
    const SCALING_FACTORS = {
        GLP: DERIVED_NETWORK.scalingFactor * 22,     // Calibrated to match ~9,250 Cr Target
        CLIENTS: DERIVED_NETWORK.scalingFactor * 0.6, // Calibrated to match ~2.45M Clients
        BRANCHES: DERIVED_NETWORK.scalingFactor
    };

    ALL_STATES_DATA.forEach(state => {
        let stateWriteOff = 0;
        let statePar30Num = 0;
        let statePar60Num = 0;
        let statePar90Num = 0;
        let statePar180Num = 0;
        let stateGlpSum = 0;
        let stateClients = 0;
        let stateBranches = 0;
        let statePendingApprovals = 0;
        let stateCollectionLag = 0;
        let statePipeline = createPipeline();

        let stateProductAgg: Record<string, ProductStats> = {};

        let stateDigitalCollection = 0; // Crores
        let stateStaff = 0;
        let stateLuc = 0;
        let stateInsurance = 0;
        let stateLeads = 0;
        let stateCentres = 0; // NEW: Track centres
        let stateGroups = 0;  // NEW: Track groups

        state.districts.forEach(district => {
            let districtWriteOff = 0;
            let districtPar30Num = 0;
            let districtPar60Num = 0;
            let districtPar90Num = 0;
            let districtPar180Num = 0;
            let districtGlpSum = 0;
            let districtClients = 0;
            let districtPendingApprovals = 0;
            let districtCollectionLag = 0;
            let districtPipeline = createPipeline();

            let districtProductAgg: Record<string, ProductStats> = {};

            let districtDigitalCollection = 0; // Crores
            let districtStaff = 0;
            let districtLuc = 0;
            let districtInsurance = 0;
            let districtLeads = 0;
            let districtCentres = 0; // NEW: Track centres
            let districtGroups = 0;  // NEW: Track groups

            district.branches.forEach(branch => {
                let branchWriteOff = 0;
                let branchPar30Num = 0;
                let branchPar60Num = 0;
                let branchPar90Num = 0;
                let branchPar180Num = 0;
                let branchGlpSum = 0; // Lakhs
                let branchClients = 0;
                let branchPendingApprovals = 0;
                let branchCollectionLag = 0;
                let branchPipeline = createPipeline();

                let branchProductAgg: Record<string, ProductStats> = {};
                let branchDigitalCollection = 0;
                let branchStaff = 0;
                let branchLuc = 0;
                let branchInsurance = 0;
                let branchLeads = 0;

                // --- ASSIGN BRANCH TYPE ---
                if (!branch.type) {
                    branch.type = Math.random() < 0.15 ? 'MSME' : 'MFI';
                }
                const useDefinitions = branch.type === 'MSME' ? MSME_PRODUCT_DEFINITIONS : MFI_PRODUCT_DEFINITIONS;

                branch.centres.forEach(centre => {
                    // Fill Defaults
                    if (centre.writeOff === undefined) centre.writeOff = Math.random() * 0.09 + 0.01;
                    branchWriteOff += centre.writeOff;

                    if (centre.par60 === undefined) centre.par60 = centre.par30 * (0.6 + Math.random() * 0.1);
                    if (centre.par90 === undefined) centre.par90 = centre.par60 * (0.5 + Math.random() * 0.1);
                    if (centre.par180 === undefined) centre.par180 = centre.par90 * (0.3 + Math.random() * 0.1);

                    const cGlp = centre.glp;
                    branchGlpSum += cGlp;
                    branchPar30Num += (centre.par30 * cGlp);
                    branchPar60Num += ((centre.par60 || 0) * cGlp);
                    branchPar90Num += ((centre.par90 || 0) * cGlp);
                    branchPar180Num += ((centre.par180 || 0) * cGlp);
                    branchClients += centre.clients;

                    // --- GENERATE CENTRE PRODUCTS (NORMALIZED) ---
                    const cProducts: Record<string, ProductStats> = {};

                    // 1. Calculate Raw Shares with Variance
                    let totalShare = 0;
                    const rawShares: Record<string, number> = {};
                    Object.keys(useDefinitions).forEach(pKey => {
                        const def = useDefinitions[pKey];
                        const s = def.share * (0.7 + Math.random() * 0.6); // High Variance
                        rawShares[pKey] = s;
                        totalShare += s;
                    });

                    // 2. Distribute GLP
                    let runningGlp = 0;
                    const pKeys = Object.keys(useDefinitions);

                    pKeys.forEach((pKey, idx) => {
                        const def = useDefinitions[pKey];
                        const normShare = rawShares[pKey] / totalShare;

                        let pGlp = cGlp * normShare;

                        // Fix Rounding on Last Item
                        if (idx === pKeys.length - 1) {
                            pGlp = cGlp - runningGlp;
                            if (pGlp < 0) pGlp = 0;
                        }
                        runningGlp += pGlp;

                        // Risk Calc
                        const pPar = Math.min(100, (centre.par30 || 1.5) * def.risk * (0.8 + Math.random() * 0.4));

                        cProducts[pKey] = {
                            glp: pGlp,
                            par30: pPar,
                            par60: pPar * 0.65,
                            par90: pPar * 0.45,
                            par180: pPar * 0.25,
                            clients: Math.floor(centre.clients * normShare)
                        };
                    });

                    centre.products = cProducts;
                    addProductStats(branchProductAgg, cProducts);

                    // --- OPS METRICS ---
                    centre.pendingApprovals = Math.floor(Math.random() * 4);
                    branchPendingApprovals += centre.pendingApprovals;

                    const demand = centre.glp * (0.10 + Math.random() * 0.05);
                    const eff = 0.90 + (Math.random() * 0.10);
                    const coll = demand * eff;
                    const lag = demand - coll; // Lakhs
                    centre.collectionLag = lag;
                    branchCollectionLag += lag;

                    // PIPELINE GEN
                    const sTot = Math.floor(Math.random() * 8);
                    const kTot = Math.floor(Math.random() * 6);
                    const gTot = Math.floor(Math.random() * 4);
                    const saTot = centre.pendingApprovals || 0;
                    const dTot = Math.floor(Math.random() * 3);

                    const cPipe: ApplicationPipeline = {
                        sourcing: { total: sTot, outsideSLA: Math.floor(sTot * (0.05 + Math.random() * 0.1)) },
                        kyc: { total: kTot, outsideSLA: Math.floor(kTot * (0.05 + Math.random() * 0.05)) },
                        grt: { total: gTot, outsideSLA: 0 },
                        sanction: { total: saTot, outsideSLA: Math.floor(saTot * 0.4) }, // High backlog
                        disbursement: { total: dTot, outsideSLA: 0 }
                    };
                    centre.digitalCollection = centre.glp * 0.08 * (0.6 + Math.random() * 0.3); // ~60-90% of collection
                    centre.staffCount = 1; // 1 FO per centre (approx)
                    centre.lucPending = Math.random() < 0.2 ? Math.floor(Math.random() * 3) + 1 : 0;
                    centre.insurancePending = Math.random() < 0.1 ? Math.floor(Math.random() * 2) + 1 : 0;
                    centre.leadsGenerated = Math.floor(Math.random() * 5) + 1;

                    branchDigitalCollection += centre.digitalCollection;
                    branchStaff += centre.staffCount;
                    branchLuc += centre.lucPending;
                    branchInsurance += centre.insurancePending;
                    branchLeads += centre.leadsGenerated;

                    centre.pipeline = cPipe;
                    centre.pipeline = cPipe;
                    // Aggregate Pipeline (Centre -> Branch)
                    (['sourcing', 'kyc', 'grt', 'sanction', 'disbursement'] as const).forEach(k => {
                        branchPipeline[k].total += cPipe[k].total;
                        branchPipeline[k].outsideSLA += cPipe[k].outsideSLA;
                    });
                });

                // --- BRANCH STATS ---
                branch.writeOff = branchWriteOff / 100;
                branch.glp = branchGlpSum / 100;
                branch.clients = branchClients;
                branch.pendingApprovals = branchPendingApprovals;
                branch.collectionLag = branchCollectionLag / 100;
                branch.pipeline = branchPipeline;
                branch.digitalCollection = branchDigitalCollection / 100; // Cr
                branch.staffCount = branchStaff;
                branch.lucPending = branchLuc;
                branch.insurancePending = branchInsurance;
                branch.leadsGenerated = branchLeads;
                branch.centreCount = branch.centres.length; // ACTUAL centre count
                branch.groupCount = branch.centres.length * 5; // Estimate 5 groups per centre

                // Branch Products
                branch.products = {};
                Object.keys(branchProductAgg).forEach(k => {
                    const agg = branchProductAgg[k];
                    const glpCr = agg.glp / 100; // Convert to Cr
                    if (glpCr > 0) {
                        branch.products![k] = {
                            glp: glpCr,
                            clients: agg.clients,
                            par30: agg.par30 / agg.glp,
                            par60: agg.par60 / agg.glp,
                            par90: agg.par90 / agg.glp,
                            par180: agg.par180 / agg.glp,
                        };
                    }
                });

                if (branchGlpSum > 0) {
                    branch.par30 = branchPar30Num / branchGlpSum;
                    branch.par60 = branchPar60Num / branchGlpSum;
                    branch.par90 = branchPar90Num / branchGlpSum;
                    branch.par180 = branchPar180Num / branchGlpSum;
                } else {
                    branch.par30 = 0; branch.par60 = 0; branch.par90 = 0; branch.par180 = 0;
                }

                districtWriteOff += branch.writeOff;
                districtPar30Num += ((branch.par30 || 0) * branch.glp);
                districtPar60Num += ((branch.par60 || 0) * branch.glp);
                districtPar90Num += ((branch.par90 || 0) * branch.glp);
                districtPar180Num += ((branch.par180 || 0) * branch.glp);
                districtGlpSum += branch.glp;
                districtClients += branch.clients;
                districtPendingApprovals += (branch.pendingApprovals || 0);
                districtCollectionLag += (branch.collectionLag || 0);
                districtDigitalCollection += (branch.digitalCollection || 0);
                districtStaff += (branch.staffCount || 0);
                districtLuc += (branch.lucPending || 0);
                districtInsurance += (branch.insurancePending || 0);
                districtLeads += (branch.leadsGenerated || 0);
                districtCentres += (branch.centres?.length || 0); // NEW: Count centres
                districtGroups += (branch.centreCount || 0) * 5;  // NEW: 5 groups per centre
                if (branch.pipeline) {
                    // Aggregate Pipeline (Branch -> District)
                    (['sourcing', 'kyc', 'grt', 'sanction', 'disbursement'] as const).forEach(k => {
                        districtPipeline[k].total += branch.pipeline![k].total;
                        districtPipeline[k].outsideSLA += branch.pipeline![k].outsideSLA;
                    });
                }

                if (branch.products) addProductStats(districtProductAgg, branch.products);
            });

            // --- DISTRICT STATS ---
            district.writeOff = districtWriteOff * SCALING_FACTORS.GLP;
            district.glp = districtGlpSum * SCALING_FACTORS.GLP;
            district.clients = Math.round(districtClients * SCALING_FACTORS.CLIENTS);
            district.branchCount = Math.floor(district.branches.length * 34); // Scaled to ~915 Total
            district.pendingApprovals = Math.floor(districtPendingApprovals * 34);
            district.collectionLag = districtCollectionLag * SCALING_FACTORS.GLP;
            district.digitalCollection = districtDigitalCollection * SCALING_FACTORS.GLP; // Same as GLP
            district.staffCount = districtStaff; // NO SCALING - actual count from centres
            district.lucPending = Math.floor(districtLuc * 34);
            district.insurancePending = Math.floor(districtInsurance * 34);
            district.leadsGenerated = Math.floor(districtLeads * 34);
            district.centreCount = districtCentres; // NEW: Actual count
            district.groupCount = districtGroups;   // NEW: Actual count

            // Scale Pipeline
            district.pipeline = createPipeline();
            // Aggregate Base (District Base -> District Final)
            (['sourcing', 'kyc', 'grt', 'sanction', 'disbursement'] as const).forEach(k => {
                district.pipeline![k].total += districtPipeline[k].total;
                district.pipeline![k].outsideSLA += districtPipeline[k].outsideSLA;
            });
            // Apply Scale
            Object.keys(district.pipeline).forEach(key => {
                const k = key as keyof ApplicationPipeline;
                district.pipeline![k].total = Math.floor(district.pipeline![k].total * 34);
                district.pipeline![k].outsideSLA = Math.floor(district.pipeline![k].outsideSLA * 34);
            });

            // District Products (Scaled)
            district.products = {};
            Object.keys(districtProductAgg).forEach(k => {
                const agg = districtProductAgg[k];
                if (agg.glp > 0) {
                    district.products![k] = {
                        glp: agg.glp * SCALING_FACTORS.GLP,
                        clients: agg.clients * SCALING_FACTORS.CLIENTS,
                        par30: agg.par30 / agg.glp, // % stays same
                        par60: agg.par60 / agg.glp,
                        par90: agg.par90 / agg.glp,
                        par180: agg.par180 / agg.glp,
                    };
                }
            });

            if (districtGlpSum > 0) {
                district.par30 = districtPar30Num / districtGlpSum;
                district.par60 = districtPar60Num / districtGlpSum;
                district.par90 = districtPar90Num / districtGlpSum;
                district.par180 = districtPar180Num / districtGlpSum;
            } else {
                district.par30 = 0; district.par60 = 0; district.par90 = 0; district.par180 = 0;
            }

            stateWriteOff += district.writeOff;
            statePar30Num += ((district.par30 || 0) * district.glp);
            statePar60Num += ((district.par60 || 0) * district.glp);
            statePar90Num += ((district.par90 || 0) * district.glp);
            statePar180Num += ((district.par180 || 0) * district.glp);
            stateGlpSum += district.glp;
            stateClients += district.clients;
            stateBranches += district.branchCount;
            statePendingApprovals += (district.pendingApprovals || 0);
            stateCollectionLag += (district.collectionLag || 0);
            stateDigitalCollection += (district.digitalCollection || 0);
            stateStaff += (district.staffCount || 0);
            stateLuc += (district.lucPending || 0);
            stateInsurance += (district.insurancePending || 0);
            stateLeads += (district.leadsGenerated || 0);
            stateCentres += (district.centreCount || 0); // NEW
            stateGroups += (district.groupCount || 0);   // NEW
            if (district.pipeline) {
                // Aggregate Pipeline (District -> State)
                (['sourcing', 'kyc', 'grt', 'sanction', 'disbursement'] as const).forEach(k => {
                    statePipeline[k].total += district.pipeline![k].total;
                    statePipeline[k].outsideSLA += district.pipeline![k].outsideSLA;
                });
            }

            if (district.products) addProductStats(stateProductAgg, district.products);
        });

        // --- STATE STATS ---
        state.writeOff = stateWriteOff;
        state.glp = stateGlpSum;
        state.clients = stateClients;
        state.branchCount = stateBranches;
        state.pendingApprovals = statePendingApprovals;
        state.collectionLag = stateCollectionLag;
        state.digitalCollection = stateDigitalCollection;
        state.staffCount = stateStaff;
        state.lucPending = stateLuc;
        state.insurancePending = stateInsurance;
        state.leadsGenerated = stateLeads;
        state.centreCount = stateCentres; // NEW
        state.groupCount = stateGroups;   // NEW
        state.pipeline = statePipeline;

        // State Products
        state.products = {};
        Object.keys(stateProductAgg).forEach(k => {
            const agg = stateProductAgg[k];
            if (agg.glp > 0) {
                state.products![k] = {
                    glp: agg.glp,
                    clients: agg.clients,
                    par30: agg.par30 / agg.glp,
                    par60: agg.par60 / agg.glp,
                    par90: agg.par90 / agg.glp,
                    par180: agg.par180 / agg.glp,
                };
            }
        });

        if (stateGlpSum > 0) {
            state.par30 = statePar30Num / stateGlpSum;
            state.par60 = statePar60Num / stateGlpSum;
            state.par90 = statePar90Num / stateGlpSum;
            state.par180 = statePar180Num / stateGlpSum;
        } else {
            state.par30 = 0; state.par60 = 0; state.par90 = 0; state.par180 = 0;
        }

        countryWriteOff += state.writeOff;
        countryPar30Num += ((state.par30 || 0) * state.glp);
        countryPar60Num += ((state.par60 || 0) * state.glp);
        countryPar90Num += ((state.par90 || 0) * state.glp);
        countryPar180Num += ((state.par180 || 0) * state.glp);
        countryGlp += state.glp;
        countryClients += stateClients;
        countryBranches += stateBranches;
        countryPendingApprovals += statePendingApprovals;
        countryCollectionLag += stateCollectionLag;
        countryDigitalCollection += stateDigitalCollection;
        countryStaff += stateStaff;
        countryLuc += stateLuc;
        countryInsurance += stateInsurance;
        countryLeads += stateLeads;
        TOTAL_CENTRES += (state.centreCount || 0); // NEW: Actual centre count
        TOTAL_GROUPS += (state.groupCount || 0);   // NEW: Actual group count
        if (state.pipeline) addPipelineStats(countryPipeline, state.pipeline);

        if (state.products) addProductStats(countryProductAgg, state.products);
    });

    TOTAL_WRITEOFF = countryWriteOff;
    TOTAL_GLP = countryGlp;
    TOTAL_CLIENTS = Math.round(countryClients);
    TOTAL_BRANCHES_COUNT = 915; // FIXED: Target network size (not scaled from sample data)
    TOTAL_PENDING_APPROVALS = countryPendingApprovals;
    TOTAL_COLLECTION_LAG = countryCollectionLag;
    TOTAL_DIGITAL_COLLECTION = countryDigitalCollection;
    TOTAL_STAFF = countryStaff;
    TOTAL_LUC_PENDING = countryLuc;
    TOTAL_INSURANCE_PENDING = countryInsurance;
    TOTAL_LEADS_GENERATED = countryLeads;
    TOTAL_PIPELINE = countryPipeline;
    if (countryGlp > 0) {
        TOTAL_PAR30_WEIGHTED = countryPar30Num / countryGlp;
        TOTAL_PAR60_WEIGHTED = countryPar60Num / countryGlp;
        TOTAL_PAR90_WEIGHTED = countryPar90Num / countryGlp;
        TOTAL_PAR180_WEIGHTED = countryPar180Num / countryGlp;
    }

    // --- TOTAL PRODUCT STATS ---
    TOTAL_PRODUCT_STATS = {};
    Object.keys(countryProductAgg).forEach(k => {
        const agg = countryProductAgg[k];
        if (agg.glp > 0) {
            TOTAL_PRODUCT_STATS[k] = {
                glp: agg.glp,
                clients: agg.clients,
                par30: agg.par30 / agg.glp,
                par60: agg.par60 / agg.glp,
                par90: agg.par90 / agg.glp,
                par180: agg.par180 / agg.glp,
            };
        }
    });
};

// Export Getter to ensure fresh values reference
export const getGlobalStats = () => ({
    digitalCollection: TOTAL_DIGITAL_COLLECTION,
    staffCount: TOTAL_STAFF,
    lucPending: TOTAL_LUC_PENDING,
    insurancePending: TOTAL_INSURANCE_PENDING,
    leadsGenerated: TOTAL_LEADS_GENERATED
});

// Export Network Metrics (target configuration)
export const NETWORK_METRICS = {
    targetBranches: NETWORK_CONFIG.targetBranches,
    totalCentres: DERIVED_NETWORK.totalCentres,
    totalGroups: DERIVED_NETWORK.totalGroups,
    totalStaff: DERIVED_NETWORK.totalStaff,
    scalingFactor: DERIVED_NETWORK.scalingFactor
};

// Execute enrichment immediately
enrichMetrics();



export const getGeoStats = (level: string, parent?: string, label?: string): GeoHierarchy => {
    if (level === 'Country') {
        return {
            level: 'Country',
            label: 'India',
            glp: TOTAL_GLP,
            branches: TOTAL_BRANCHES_COUNT,
            pendingApprovals: TOTAL_PENDING_APPROVALS,
            collectionLag: TOTAL_COLLECTION_LAG,
            pipeline: TOTAL_PIPELINE,
            par30: TOTAL_PAR30_WEIGHTED,
            par60: TOTAL_PAR60_WEIGHTED,
            par90: TOTAL_PAR90_WEIGHTED,
            par180: TOTAL_PAR180_WEIGHTED,
            digitalPercentage: 65,
            meetings: { total: 4500, within: 4100 },
            writeOff: TOTAL_WRITEOFF, // Rolled up from centres
            products: TOTAL_PRODUCT_STATS,
            digitalCollection: TOTAL_DIGITAL_COLLECTION,
            staffCount: TOTAL_STAFF,
            lucPending: TOTAL_LUC_PENDING,
            insurancePending: TOTAL_INSURANCE_PENDING,
            leadsGenerated: TOTAL_LEADS_GENERATED
        };
    }

    if (level === 'State') {
        // Map label to key dynamically
        let key = (label || 'Odisha').toLowerCase().replace(/\s/g, '');
        if (key === 'andhrapradesh') key = 'andhra';
        if (key === 'madhyapradesh') key = 'madhyaPradesh';
        if (key === 'tamilnadu') key = 'tamilNadu';

        const enrichedState = ALL_STATES_DATA.find(s => s.name === (label || 'Odisha'));

        return {
            level: 'State',
            label: label || 'Odisha',
            glp: enrichedState ? enrichedState.glp : 0,
            branches: enrichedState ? (enrichedState.branchCount || 0) : 0,
            pendingApprovals: enrichedState ? (enrichedState.pendingApprovals || 0) : 0,
            collectionLag: enrichedState ? (enrichedState.collectionLag || 0) : 0,
            pipeline: enrichedState ? enrichedState.pipeline : undefined,
            par30: enrichedState ? (enrichedState.par30 || 0) : 0, // Use Rolled up PAR
            par60: enrichedState ? (enrichedState.par60 || 0) : 0,
            par90: enrichedState ? (enrichedState.par90 || 0) : 0,
            par180: enrichedState ? (enrichedState.par180 || 0) : 0,
            digitalPercentage: 65,
            meetings: { total: 1200, within: 1120 },
            writeOff: enrichedState ? enrichedState.writeOff : 0,
            products: enrichedState ? enrichedState.products : undefined,
            digitalCollection: enrichedState ? enrichedState.digitalCollection : 0,
            staffCount: enrichedState ? enrichedState.staffCount : 0
        };
    }

    // For other levels, return sensible defaults
    // Aggregation for Pipeline
    const nationalPipeline: ApplicationPipeline = {
        sourcing: { total: 0, outsideSLA: 0 },
        kyc: { total: 0, outsideSLA: 0 },
        grt: { total: 0, outsideSLA: 0 },
        sanction: { total: 0, outsideSLA: 0 },
        disbursement: { total: 0, outsideSLA: 0 }
    };
    ALL_STATES_DATA.forEach(s => {
        if (!s.pipeline) return;
        (['sourcing', 'kyc', 'grt', 'sanction', 'disbursement'] as const).forEach(k => {
            nationalPipeline[k].total += s.pipeline![k].total;
            nationalPipeline[k].outsideSLA += s.pipeline![k].outsideSLA;
        });
    });

    return {
        pipeline: nationalPipeline,
        level: 'Country',
        label: 'India',
        glp: TOTAL_GLP,
        branches: TOTAL_BRANCHES_COUNT,
        par30: TOTAL_PAR30_WEIGHTED,
        par60: TOTAL_PAR60_WEIGHTED,
        par90: TOTAL_PAR90_WEIGHTED,
        par180: TOTAL_PAR180_WEIGHTED,
        digitalPercentage: 65,
        meetings: { total: 4500, within: 4100 },
        writeOff: TOTAL_WRITEOFF,
        products: TOTAL_PRODUCT_STATS
    };
};

export interface FlatBranch extends Branch {
    state: string;
    district: string;
    activeLoans: number; // Derived/Estimated or from Clients
    par30: number; // Override to be mandatory
    digitalCollection?: number;
    staffCount?: number;
    lucPending?: number;
    insurancePending?: number;
    leadsGenerated?: number;
    centreCount?: number; // NEW: Actual count = centres.length
    groupCount?: number;  // NEW: Estimated = centres.length * 5
}

export const getFlatBranchList = (): FlatBranch[] => {
    const branches: FlatBranch[] = [];
    ALL_STATES_DATA.forEach(state => {
        state.districts.forEach(district => {
            district.branches.forEach(branch => {
                // Determine active loans from centres if possible, or fallback methods
                const totalActiveLoans = branch.centres.reduce((sum, c) => sum + c.activeLoans, 0);

                branches.push({
                    ...branch,
                    state: state.name,
                    district: district.name,
                    activeLoans: totalActiveLoans,
                    // Ensure par30 is available (it should be after enrichment)
                    par30: branch.par30 || 0
                });
            });
        });
    });
    return branches;
};


