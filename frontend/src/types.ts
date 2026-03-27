export interface Category {
  id: string;
  name: string;
  color: string;
  icon?: string;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  category_id?: string;
  estimated_size: 'small' | 'medium' | 'large' | 'half_day' | 'full_day';
  deadline?: string;
  status: 'pending' | 'in_progress' | 'done';
  created_at: string;
  completed_at?: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  category_id?: string;
  start_time: string;
  end_time: string;
  created_at: string;
}

export interface TimeLog {
  id: string;
  task_id?: string;
  title: string;
  category_id?: string;
  start_time: string;
  end_time?: string;
  created_at: string;
}

export interface Settings {
  sleep_start: string;
  sleep_end: string;
  timezone: string;
}
