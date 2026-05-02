export interface User {
  id: number;
  username: string;
  email?: string;
  first_name: string;
  last_name: string;
  role: "CR" | "SIAE" | "ENG";
  phone_number?: string;
  vacation_status?: boolean;
  is_active?: boolean;
  date_joined?: string;
  last_login?: string | null;
  is_staff?: boolean;
  is_superuser?: boolean;
  technologies?: Array<{ technology: Technology; is_default: boolean }>;
  permissions?: {
    is_admin: boolean;
    is_manager: boolean;
    is_read_only: boolean;
    is_siae?: boolean;
    is_eng?: boolean;
    is_superuser?: boolean;
  };
}

export interface Technology {
  id: number;
  name: string;
  slug: string;
  color_code: string;
  role: "CR" | "SIAE" | "ENG";
}

export interface Assignment {
  id: number;
  shift: number;
  user: User;
  type: "WORK_HOURS" | "STANDBY";
  standby_detail?: {
    id?: number;
    role: "PRIMARY" | "BACKUP";
    phone_number: string;
  } | null;
}

export interface Shift {
  id: number;
  date: string;
  technology: Technology;
  notes: string;
  assignments: Assignment[];
  created_by?: User;
}

export interface ShiftSummary {
  id: number;
  date: string;
  technology: Technology;
  assignment_count: number;
  has_standby?: boolean;
}

export interface ShiftColumnProps {
  title?: string;
  roleFilter: "SIAE" | "ENG";
  technologies: Technology[] | undefined;
  shiftsByTechId: Map<number, Shift>;
  isLoading: boolean;
  canAddUser: boolean;
  canCreateShift?: boolean;
  isAdmin: boolean;
  dateStr: string;
  layout: "stacked" | "tabbed";
  onAddUser: (shiftId: number) => void;
  onCreateShift?: (techId?: number) => void;
  onEditShift?: (shift: Shift) => void;
  onDeleteShift?: (shiftId: number) => void;
  onEditAssignment?: (assignment: Assignment) => void;
}

export interface DayDrawerProps {
  date: Date;
  onClose: () => void;
}

export interface AddAssignmentDialogProps {
  shiftId: number;
  date: string;
  onClose: () => void;
}

export interface CreateShiftDialogProps {
  date: string;
  onClose: () => void;
  defaultTechnologyId?: number | string;
}

export interface UserCardProps {
  assignmentId: number;
  user: User;
  type: "WORK_HOURS" | "STANDBY";
  standbyDetail?: {
    role: "PRIMARY" | "BACKUP";
    phone_number: string;
  } | null;
  dateStr?: string;
  hideTechnology?: boolean;
  compact?: boolean;
  onEdit?: () => void;
}

export interface CalendarCellProps {
  date: Date;
  dateStr?: string;
  currentMonth: Date;
  shifts: ShiftSummary[];
  vacations: Vacation[];
  isSelected: boolean;
  isMultiSelected?: boolean;
  onClick: (e: React.MouseEvent) => void;
}

export interface CalendarMonthViewProps {
  month: Date;
  selectedDate: Date | null;
  shiftsByDay: Map<string, ShiftSummary[]>;
  vacationsByDay: Map<string, Vacation[]>;
  onSelectDate: (date: Date, event: React.MouseEvent | React.KeyboardEvent) => void;
  onChangeMonth: (date: Date) => void;
  multiSelectedDates?: Set<string>;
  onClearSelection?: () => void;
}

export interface AdminDayPanelProps {
  selectedDates: string[];
  singleDayShifts?: Shift[];
  shiftSummariesByDate?: Map<string, ShiftSummary[]>;
  technologies?: Technology[];
  users?: User[];
  isLoading: boolean;
  canManage: boolean;
  isAdmin: boolean;
  isSuperuser?: boolean;
  userRole?: string;
  layout: "stacked" | "tabbed";
  onAddUser: (shiftId: number) => void;
  onCreateShift: (dateStr: string, techId?: number) => void;
  onEditShift: (shift: Shift) => void;
  onDeleteShift: (id: number) => void;
  onEditAssignment: (assignment: Assignment, dateStr?: string) => void;
  onClearSelection: () => void;
  onLayoutChange?: (layout: "stacked" | "tabbed") => void;
  onDeleteShifts?: (dateStrs: string[], techIds?: number[], allDays?: boolean, assignmentType?: "WORK_HOURS" | "STANDBY" | "ALL") => void;
  onBulkAssign?: (data: {
    dateStrs: string[],
    techIds: number[],
    userIds: number[],
    type: "WORK_HOURS" | "STANDBY",
    standbyRole?: "PRIMARY" | "BACKUP",
    standbyPhone?: string,
    // For per-technology autopopulate: maps techId -> userIds for that specific tech only
    techUserMapping?: Map<number, number[]>,
  }) => void;
  onFixDefaults?: (data: {
    date_start: string;
    date_end: string;
    technology_ids: number[];
  }) => void;
}

export interface TechUserMapping {
  techId: number;
  userIds: number[];
}

export interface Vacation {
  id: number;
  user: User;
  start_date: string;
  end_date: string;
  type?: "PTO" | "SICK" | "HOLIDAY" | "OTHER";
  notes: string;
}

export interface SiteSettings {
  brand_name: string;
  client_role_label: string;
  consultant_role_label: string;
}
