/**
 * NORTH INDIA STATE DATA
 * Uttar Pradesh, Rajasthan, Bihar
 * Following same structure as existing states
 */

import { State, District, Branch, Centre } from './geoDataComplete';

// ==================== UTTAR PRADESH ====================
// Key districts: Lucknow, Varanasi, Kanpur

const lucknowBranch1: Branch = {
    name: "Lucknow Central",
    coord: [26.8467, 80.9462],
    glp: 45.2,
    clients: 11300,
    centres: [
        { name: "Gomti Nagar Centre", coord: [26.8547, 80.9965], clients: 2400, glp: 9.6, activeLoans: 2520, par30: 1.8, par90: 0.9 },
        { name: "Hazratganj Centre", coord: [26.8547, 80.9429], clients: 2200, glp: 8.8, activeLoans: 2310, par30: 1.6, par90: 0.8 },
        { name: "Alambagh Centre", coord: [26.8205, 80.9187], clients: 2300, glp: 9.2, activeLoans: 2415, par30: 1.7, par90: 0.85 },
        { name: "Indira Nagar Centre", coord: [26.8918, 80.9971], clients: 2200, glp: 8.8, activeLoans: 2310, par30: 1.6, par90: 0.8 },
        { name: "Aliganj Centre", coord: [26.9157, 80.9881], clients: 2200, glp: 8.8, activeLoans: 2310, par30: 1.7, par90: 0.85 }
    ]
};

const lucknowBranch2: Branch = {
    name: "Lucknow East",
    coord: [26.8700, 81.0100],
    glp: 38.5,
    clients: 9600,
    centres: [
        { name: "Chinhat Centre", coord: [26.9174, 81.0350], clients: 2000, glp: 8.0, activeLoans: 2100, par30: 1.9, par90: 0.95 },
        { name: "Dubagga Centre", coord: [26.8456, 81.0089], clients: 1900, glp: 7.6, activeLoans: 1995, par30: 1.8, par90: 0.9 },
        { name: "Bakshi Ka Talab Centre", coord: [26.9625, 80.9711], clients: 1950, glp: 7.8, activeLoans: 2048, par30: 1.7, par90: 0.85 },
        { name: "Barabanki Road Centre", coord: [26.9308, 81.0489], clients: 1900, glp: 7.6, activeLoans: 1995, par30: 1.8, par90: 0.9 },
        { name: "Sarojini Nagar Centre", coord: [26.8489, 81.0046], clients: 1850, glp: 7.5, activeLoans: 1943, par30: 1.9, par90: 0.95 }
    ]
};

const lucknowDistrict: District = {
    name: "Lucknow",
    coord: [26.8467, 80.9462],
    branches: [lucknowBranch1, lucknowBranch2],
    glp: 0, clients: 0 // Will be calculated
};

const varanasiDistrict: District = {
    name: "Varanasi",
    coord: [25.3176, 82.9739],
    branches: [
        {
            name: "Varanasi Cantonment",
            coord: [25.3176, 82.9739],
            glp: 42.0,
            clients: 10500,
            centres: [
                { name: "Bhelupur Centre", coord: [25.2820, 82.9903], clients: 2100, glp: 8.4, activeLoans: 2205, par30: 1.5, par90: 0.75 },
                { name: "Sigra Centre", coord: [25.3192, 82.9907], clients: 2100, glp: 8.4, activeLoans: 2205, par30: 1.6, par90: 0.8 },
                { name: "Lanka Centre", coord: [25.2820, 83.0045], clients: 2100, glp: 8.4, activeLoans: 2205, par30: 1.5, par90: 0.75 },
                { name: "Maldahiya Centre", coord: [25.3412, 82.9543], clients: 2100, glp: 8.4, activeLoans: 2205, par30: 1.6, par90: 0.8 },
                { name: "Lahurabir Centre", coord: [25.3500, 82.9900], clients: 2100, glp: 8.4, activeLoans: 2205, par30: 1.5, par90: 0.75 }
            ]
        }
    ],
    glp: 0, clients: 0
};

export const uttarPradeshState: State = {
    name: "Uttar Pradesh",
    coord: [26.8467, 80.9462],
    color: "#ec4899", // Pink
    districts: [lucknowDistrict, varanasiDistrict],
    glp: 0, clients: 0 // Will be calculated by rollup
};

// ==================== RAJASTHAN ====================

const jaipurBranch: Branch = {
    name: "Jaipur Pink City",
    coord: [26.9124, 75.7873],
    glp: 40.5,
    clients: 10100,
    centres: [
        { name: "Malviya Nagar Centre", coord: [26.8523, 75.8146], clients: 2000, glp: 8.0, activeLoans: 2100, par30: 1.4, par90: 0.7 },
        { name: "Mansarovar Centre", coord: [26.8757, 75.7667], clients: 2050, glp: 8.2, activeLoans: 2153, par30: 1.3, par90: 0.65 },
        { name: "Vaishali Nagar Centre", coord: [26.9157, 75.7259], clients: 2000, glp: 8.0, activeLoans: 2100, par30: 1.4, par90: 0.7 },
        { name: "Pratap Nagar Centre", coord: [26.8755, 75.8005], clients: 2050, glp: 8.2, activeLoans: 2153, par30: 1.3, par90: 0.65 },
        { name: "Jagatpura Centre", coord: [26.8467, 75.8648], clients: 2000, glp: 8.1, activeLoans: 2100, par30: 1.4, par90: 0.7 }
    ]
};

const jodhpurDistrict: District = {
    name: "Jodhpur",
    coord: [26.2389, 73.0243],
    branches: [
        {
            name: "Jodhpur Central",
            coord: [26.2389, 73.0243],
            glp: 35.0,
            clients: 8800,
            centres: [
                { name: "Sardarpura Centre", coord: [26.2747, 73.0164], clients: 1750, glp: 7.0, activeLoans: 1838, par30: 1.5, par90: 0.75 },
                { name: "Paota Centre", coord: [26.2946, 73.0172], clients: 1800, glp: 7.2, activeLoans: 1890, par30: 1.4, par90: 0.7 },
                { name: "Chopasni Centre", coord: [26.2365, 73.0064], clients: 1750, glp: 7.0, activeLoans: 1838, par30: 1.5, par90: 0.75 },
                { name: "Shastri Nagar Centre", coord: [26.2629, 73.0073], clients: 1800, glp: 7.2, activeLoans: 1890, par30: 1.4, par90: 0.7 },
                { name: "Ratanada Centre", coord: [26.2749, 73.0382], clients: 1700, glp: 6.6, activeLoans: 1785, par30: 1.5, par90: 0.75 }
            ]
        }
    ],
    glp: 0, clients: 0
};

export const rajasthanState: State = {
    name: "Rajasthan",
    coord: [26.9124, 75.7873],
    color: "#f59e0b", // Amber
    districts: [
        { name: "Jaipur", coord: [26.9124, 75.7873], branches: [jaipurBranch], glp: 0, clients: 0 },
        jodhpurDistrict
    ],
    glp: 0, clients: 0
};

// ==================== BIHAR ====================

const patnaBranch: Branch = {
    name: "Patna Gandhinagar",
    coord: [25.5941, 85.1376],
    glp: 32.5,
    clients: 8100,
    centres: [
        { name: "Boring Road Centre", coord: [25.6015, 85.1462], clients: 1650, glp: 6.6, activeLoans: 1733, par30: 2.0, par90: 1.0 },
        { name: "Kankarbagh Centre", coord: [25.5948, 85.1699], clients: 1600, glp: 6.4, activeLoans: 1680, par30: 1.9, par90: 0.95 },
        { name: "Rajendra Nagar Centre", coord: [25.6112, 85.1780], clients: 1650, glp: 6.6, activeLoans: 1733, par30: 2.0, par90: 1.0 },
        { name: "Danapur Centre", coord: [25.5942, 85.0458], clients: 1600, glp: 6.4, activeLoans: 1680, par30: 1.9, par90: 0.95 },
        { name: "Patliputra Centre", coord: [25.5751, 85.1384], clients: 1600, glp: 6.5, activeLoans: 1680, par30: 2.0, par90: 1.0 }
    ]
};

export const biharState: State = {
    name: "Bihar",
    coord: [25.5941, 85.1376],
    color: "#8b5cf6", // Purple
    districts: [
        { name: "Patna", coord: [25.5941, 85.1376], branches: [patnaBranch], glp: 0, clients: 0 }
    ],
    glp: 0, clients: 0
};
