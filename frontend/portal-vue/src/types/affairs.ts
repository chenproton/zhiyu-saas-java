export interface TrainingProgram {
  id: string;
  name: string;
  code?: string;
  majorId?: string;
  majorName?: string;
  entryYear: number;
  level?: string;
  duration?: number;
  totalCredits?: number;
  status: string;
  description?: string;
  courseCount: number;
  createdBy?: string;
  createdByName?: string;
  collaborators?: string[];
  collaboratorNames?: string[];
  batchId?: string;
  batchName?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AffairsTerm {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  weeksCount: number;
  isCurrent: boolean;
  createdAt: string;
}

export interface TeachingPlan {
  id: string;
  programId: string;
  programName?: string;
  termId: string;
  termName?: string;
  majorId?: string;
  majorName?: string;
  entryYear: number;
  status: string;
  entryCount: number;
  generatedAt: string;
  confirmedAt?: string;
  createdBy?: string;
  createdByName?: string;
  collaborators?: string[];
  batchId?: string;
  batchName?: string;
  updatedAt?: string;
  rejectReason?: string;
}

export interface TeachingPlanEntry {
  id: string;
  planId: string;
  courseName: string;
  courseCode?: string;
  courseId?: string;
  type: string;
  nature?: string;
  credits: number;
  totalHours: number;
  weekHours: number;
  startWeek: number;
  endWeek: number;
  weekPattern: string;
  classNodeId?: string;
  className?: string;
  classNodeIds?: string[];
  classNames?: string[];
  teacherId?: string;
  teacherName?: string;
  teacherType?: string;
  venueType?: string;
  scenarioId?: string;
  scenarioName?: string;
  positionName?: string;
  status: string;
}

export interface TeachingPlanDetail extends TeachingPlan {
  entries: TeachingPlanEntry[];
}

export interface Venue {
  id: string;
  name: string;
  type: string;
  capacity?: number;
  createdAt: string;
}

export interface PeriodSlot {
  id: string;
  name: string;
  type: string;
  sortOrder: number;
  startTime?: string;
  endTime?: string;
}

export interface ScheduleEntry {
  id: string;
  termId: string;
  planEntryId?: string;
  courseName: string;
  courseCode?: string;
  courseId?: string;
  type: string;
  classNodeId: string;
  className?: string;
  classNodeIds?: string[];
  classNames?: string[];
  teacherId?: string;
  teacherName?: string;
  dayOfWeek: number;
  periods: string[];
  startWeek: number;
  endWeek: number;
  weekPattern: string;
  venueId?: string;
  venueName?: string;
  scenarioId?: string;
  scenarioName?: string;
  source: string;
  status: string;
  version: number;
  resourceVersion?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ScheduleEntryPayload {
  termId: string;
  planEntryId?: string;
  courseName: string;
  courseCode?: string;
  courseId?: string;
  type?: string;
  classNodeId: string;
  classNodeIds?: string[];
  teacherId?: string;
  dayOfWeek: number;
  periods: string[];
  startWeek: number;
  endWeek: number;
  weekPattern?: string;
  venueId?: string;
  scenarioId?: string;
}

export interface ScheduleConflict {
  kind: string;
  entryId: string;
  courseName: string;
  className?: string;
  teacherName?: string;
  venueName?: string;
  dayOfWeek: number;
  periods: string[];
  startWeek: number;
  endWeek: number;
  weekPattern: string;
}

export interface TimetableResponse {
  items: ScheduleEntry[];
  total: number;
  version: number;
}
