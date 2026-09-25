export interface UserSummary {
    id: string;
    email: string;
    full_name: string;
    first_name: string;
    last_name: string;
    avatar: string | null;
    is_active: boolean;
    is_admin: boolean;
    is_verified: boolean;
    permissions: string[];
    created_at: string;
  }
  
  export function userRole(u: UserSummary): 'admin' | 'creator' | 'user' {
    if (u.is_admin) return 'admin';
    if (u.permissions?.includes('can_create_survey')) return 'creator';
    return 'user';
  }