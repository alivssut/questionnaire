export type AssignmentStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'OVERDUE';

export interface AssignmentUser {
  id: string;
  full_name: string;
  email: string;
  avatar?: string | null;
}

export interface Assignment {
  id: string;
  survey: string;
  survey_title: string;
  user: AssignmentUser;
  assigned_by: string | null;
  status: AssignmentStatus;
  assigned_at: string;
  start_date: string | null;
  due_date: string | null;
  completed_at: string | null;
  allow_resume: boolean;
  is_past_due: boolean;
  response_id: string | null; 
}