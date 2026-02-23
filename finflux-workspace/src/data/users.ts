/**
 * FINFLUX Analytics — User Accounts & Role-Based Access Control
 * Local credential store (no backend required for demo).
 */

export type UserRole = 'admin' | 'bm' | 'area_manager' | 'analyst';

export interface BranchFilter {
    state: string;
    district: string;
    branches: string[]; // allowed branch names; empty = all in district
}

export interface User {
    email: string;
    password: string;
    name: string;
    role: UserRole;
    allowedDashboards: string[];
    branchFilter?: BranchFilter; // undefined → no restriction (sees all)
}

export const USERS: User[] = [
    {
        // Platform Administrator — full access
        email: 'srinivas.rao@finflux.in',
        password: 'Finflux@2025',
        name: 'Srinivas Rao',
        role: 'admin',
        allowedDashboards: [
            'home', 'trends', 'collections', 'portfolio',
            'origination', 'branch', 'centre', 'products', 'geo', 'alerts', 'admin',
        ],
    },
    {
        // Branch Manager — Bagheitangi Branch, Khordha, Odisha
        email: 'rajesh.mohanty@finflux.in',
        password: 'Rajesh@2025',
        name: 'Rajesh Mohanty',
        role: 'bm',
        allowedDashboards: ['branch', 'centre', 'collections', 'geo', 'alerts'],
        branchFilter: {
            state: 'Odisha',
            district: 'Khordha',
            branches: ['Bagheitangi'],
        },
    },
    {
        // Area Manager — Khordha Area (3 branches), Odisha
        email: 'sunita.pattnaik@finflux.in',
        password: 'Sunita@2025',
        name: 'Sunita Pattnaik',
        role: 'area_manager',
        allowedDashboards: ['branch', 'centre', 'collections', 'origination', 'geo', 'alerts'],
        branchFilter: {
            state: 'Odisha',
            district: 'Khordha',
            branches: ['Bagheitangi', 'Tangi', 'Jatni'],
        },
    },
];

export const findUser = (email: string, password: string): User | undefined =>
    USERS.find(
        u => u.email.toLowerCase() === email.toLowerCase() && u.password === password,
    );

/** Persist logged-in user info to sessionStorage. */
export const persistUser = (user: User): void => {
    sessionStorage.setItem('finflux_role', user.role);
    sessionStorage.setItem('finflux_user_name', user.name);
    sessionStorage.setItem('finflux_allowed_dashboards', JSON.stringify(user.allowedDashboards));
    if (user.branchFilter) {
        sessionStorage.setItem('finflux_branch_filter', JSON.stringify(user.branchFilter));
    } else {
        sessionStorage.removeItem('finflux_branch_filter');
    }
};

/** Read branch filter from sessionStorage (if any). */
export const getBranchFilter = (): BranchFilter | null => {
    const raw = sessionStorage.getItem('finflux_branch_filter');
    return raw ? (JSON.parse(raw) as BranchFilter) : null;
};
