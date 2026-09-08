// Types for the Pending Proceedings Form
// Based strictly on the official case categories document

// ============================================
// Core Types
// ============================================

export interface PendingProceedingItem {
  division: string;
  name: string;
  quantity: number;
}

export type SubmissionStatus = 'submitted';

// ============================================
// Station Types
// ============================================

export type StationStatus = 
  | 'not_started'
  | 'submitted';

export interface StationSubmissionStatus {
  station: string;
  status: StationStatus;
  lastUpdatedAt?: string;
  submittedAt?: string;
  submittedBy?: string;
  submitterName?: string;
  hasSubmitted: boolean;
  progress: {
    courtOfAppealComplete: boolean;
    subordinateCourtsComplete: boolean;
    percentageComplete: number;
  };
}

export interface StationReport {
  totalStations: number;
  stationsByStatus: Record<StationStatus, number>;
  stations: StationSubmissionStatus[];
  summary: {
    completed: number;
    notStarted: number;
    total: number;
    completionRate: number;
  };
}

// ============================================
// Submission Types
// ============================================

export interface StationRequirementSubmission {
  id?: string;
  station: string;
  courtOfAppeal: PendingProceedingItem[];
  subordinateCourts: PendingProceedingItem[];
  status: SubmissionStatus;
  submittedAt: string;
  updatedAt: string;
  submittedBy?: string;
  submitterName?: string;
  submitterEmail?: string;
  emailSent?: boolean;
  emailSentAt?: string;
  emailError?: string;
}

export interface StationRequirementSummary {
  id?: string;
  station: string;
  courtOfAppealTotal: number;
  subordinateCourtsTotal: number;
  status: SubmissionStatus;
  submittedAt: string;
  updatedAt: string;
  submitterName?: string;
}

// ============================================
// Input Types
// ============================================

export interface CreateSubmissionInput {
  station: string;
  courtOfAppeal: PendingProceedingItem[];
  subordinateCourts: PendingProceedingItem[];
}

export interface UpdateSubmissionInput {
  station?: string;
  courtOfAppeal?: PendingProceedingItem[];
  subordinateCourts?: PendingProceedingItem[];
}

export interface GetSubmissionsQuery {
  station?: string;
  fromDate?: string;
  toDate?: string;
  page?: number;
  limit?: number;
  sortBy?: 'updatedAt' | 'submittedAt' | 'station';
  sortOrder?: 'asc' | 'desc';
}

export interface GetStationReportQuery {
  status?: StationStatus;
  fromDate?: string;
  toDate?: string;
  page?: number;
  limit?: number;
}

// ============================================
// Report Types
// ============================================

export type ReportFormat = 'pdf' | 'docx' | 'json';

export interface DownloadReportQuery {
  format?: ReportFormat;
  fromDate?: string;
  toDate?: string;
}

export interface ReportRow {
  'Station': string;
  'Assigned DR': string;
  'DR Email': string;
  'Submission Status': 'Submitted' | 'Not Submitted';
  'Court of Appeal Items': number;
  'Subordinate Courts Items': number;
  'Total Items': number;
  'Submitted At': string;
  'Last Updated': string;
}

export interface ReportSummary {
  totalStations: number;
  submitted: number;
  notSubmitted: number;
  totalCourtOfAppeal: number;
  totalSubordinateCourts: number;
  completionRate: number;
}

export interface ReportData {
  rows: ReportRow[];
  summary: ReportSummary;
}

// ============================================
// Response Types
// ============================================

export interface SubmissionResponse {
  submission: StationRequirementSubmission;
  message?: string;
}

export interface SubmissionsListResponse {
  submissions: StationRequirementSummary[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface StationReportResponse {
  report: StationReport;
  message?: string;
}

// ============================================
// Email Tracking Types
// ============================================

export interface EmailStatus {
  sent: boolean;
  sentAt?: string;
  error?: string;
  recipient: string;
  recipientName: string;
}

// ============================================
// Admin Dashboard Types
// ============================================

export interface AdminDashboardStats {
  totalStations: number;
  submissionsToday: number;
  submittedCount: number;
  notStartedCount: number;
  completionRate: number;
  recentActivity: Array<{
    id: string;
    station: string;
    action: 'submitted' | 'updated';
    timestamp: string;
    user: string;
    details?: string;
  }>;
  stationsByRegion?: Record<string, StationReport>;
}

// ============================================
// Submission Statistics Types
// ============================================

export interface SubmissionStats {
  totalStations: number;
  submitted: number;
  notSubmitted: number;
  notStarted: number;
}

// ============================================
// PENDING PROCEEDINGS CATEGORIES
// ✅ appeal = "to", subordinate = "from"
// ============================================

export const PENDING_PROCEEDINGS_CATEGORIES = {
  "Pending Proceedings to Court of Appeal": [
    "Civil",
    "Criminal",
    "Succession"
  ],
  "Pending Proceedings from Subordinate Courts": [
    "Civil",
    "Criminal",
    "Succession"
  ]
} as const;

// ============================================
// Type Definitions
// ============================================

export type PendingProceedingCategory = keyof typeof PENDING_PROCEEDINGS_CATEGORIES;
export type PendingProceedingName = typeof PENDING_PROCEEDINGS_CATEGORIES[PendingProceedingCategory][number];

// ============================================
// Helper Functions - Categories
// ============================================

export const PENDING_PROCEEDINGS_CATEGORIES_LIST = Object.keys(PENDING_PROCEEDINGS_CATEGORIES) as PendingProceedingCategory[];

export function getPendingProceedingsByCategory(category: PendingProceedingCategory): PendingProceedingName[] {
  return PENDING_PROCEEDINGS_CATEGORIES[category] as unknown as PendingProceedingName[];
}

export function getAllPendingProceedings(): { category: PendingProceedingCategory; name: PendingProceedingName }[] {
  const result: { category: PendingProceedingCategory; name: PendingProceedingName }[] = [];

  for (const category of PENDING_PROCEEDINGS_CATEGORIES_LIST) {
    const items = getPendingProceedingsByCategory(category);
    for (const item of items) {
      result.push({
        category,
        name: item
      });
    }
  }

  return result;
}

// ============================================
// Helper Functions - Submissions
// ============================================

export function getSubmissionStatusText(status: SubmissionStatus): string {
  return 'Submitted';
}

export function getSubmissionStatusColor(status: SubmissionStatus): string {
  return '#10B981';
}

export function calculateTotals(submission: StationRequirementSubmission): {
  courtOfAppealTotal: number;
  subordinateCourtsTotal: number;
  totalItems: number;
} {
  const courtOfAppealTotal = submission.courtOfAppeal.reduce((sum, item) => sum + item.quantity, 0);
  const subordinateCourtsTotal = submission.subordinateCourts.reduce((sum, item) => sum + item.quantity, 0);
  return {
    courtOfAppealTotal,
    subordinateCourtsTotal,
    totalItems: courtOfAppealTotal + subordinateCourtsTotal
  };
}

// ============================================
// Helper Functions - Admin Dashboard
// ============================================

export function getStationStatusText(status: StationStatus): string {
  const statusMap: Record<StationStatus, string> = {
    'not_started': 'Not Started',
    'submitted': 'Submitted'
  };
  return statusMap[status];
}

export function getStationStatusColor(status: StationStatus): string {
  const colorMap: Record<StationStatus, string> = {
    'not_started': '#9CA3AF',
    'submitted': '#10B981'
  };
  return colorMap[status];
}

export function getStationProgress(submission?: StationRequirementSubmission): StationSubmissionStatus['progress'] {
  if (!submission) {
    return {
      courtOfAppealComplete: false,
      subordinateCourtsComplete: false,
      percentageComplete: 0
    };
  }

  const hasCourtOfAppeal = submission.courtOfAppeal.length > 0;
  const hasSubordinateCourts = submission.subordinateCourts.length > 0;
  
  return {
    courtOfAppealComplete: hasCourtOfAppeal,
    subordinateCourtsComplete: hasSubordinateCourts,
    percentageComplete: (hasCourtOfAppeal ? 50 : 0) + (hasSubordinateCourts ? 50 : 0)
  };
}

export function determineStationStatus(
  submission?: StationRequirementSubmission
): StationStatus {
  if (!submission) {
    return 'not_started';
  }
  return 'submitted';
}

// ============================================
// Helper Functions - Statistics
// ============================================

export function getSubmissionStats(
  allStations: string[],
  submissions: StationRequirementSubmission[]
): SubmissionStats {
  const latestByStation = new Map<string, StationRequirementSubmission>();
  
  for (const sub of submissions) {
    const existing = latestByStation.get(sub.station);
    if (!existing || new Date(sub.updatedAt) > new Date(existing.updatedAt)) {
      latestByStation.set(sub.station, sub);
    }
  }

  let submitted = 0;
  let notStarted = 0;

  for (const station of allStations) {
    const submission = latestByStation.get(station);
    if (!submission) {
      notStarted++;
    } else {
      submitted++;
    }
  }

  return {
    totalStations: allStations.length,
    submitted,
    notSubmitted: notStarted,
    notStarted,
  };
}

// ============================================
// Helper Functions - Reports
// ============================================

export function generateReportSummary(
  totalStations: number,
  statusCounts: Record<string, number>
): ReportSummary {
  const submitted = statusCounts['submitted'] || 0;
  const notSubmitted = statusCounts['not_submitted'] || 0;

  return {
    totalStations,
    submitted,
    notSubmitted,
    totalCourtOfAppeal: 0,
    totalSubordinateCourts: 0,
    completionRate: totalStations > 0 ? Math.round((submitted / totalStations) * 100) : 0,
  };
}

// ============================================
// Helper Functions - Report Generation
// ============================================

export function formatReportDate(date: string | Date): string {
  if (!date) return 'N/A';
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

export function formatReportDateTime(date: string | Date): string {
  if (!date) return 'N/A';
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}