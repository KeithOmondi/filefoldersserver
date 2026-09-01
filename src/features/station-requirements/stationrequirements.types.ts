// Types for the Station Requirements Form
// Based strictly on the official case categories document
// CHANGES: 
// - removed all "quarter" fields (DR login only picks a station)
// - "quantity" on each item = how many of that file/register are needed
// - Added draft functionality with status field
// - Added email tracking fields
// - Added station tracking for admin dashboard
// - Added comprehensive register categories for all case types

// ============================================
// Core Types
// ============================================

export interface StationRequirementItem {
  division: string;
  name: string;
  quantity: number; // how many needed, e.g. 1, 2, 3...
}

export type SubmissionStatus = 'draft' | 'submitted';
export type ReviewStatus = 'pending' | 'approved' | 'needs_revision';

// ============================================
// Station Types (for admin tracking)
// ============================================

export type StationStatus = 
  | 'not_started'     // No submission exists for this station
  | 'in_progress'     // Has a draft but not submitted
  | 'submitted'       // Has been submitted
  | 'pending_review'  // Submitted but needs admin review
  | 'approved'        // Approved by admin
  | 'needs_revision'; // Needs changes

export interface StationSubmissionStatus {
  station: string;
  status: StationStatus;
  lastUpdatedAt?: string;
  submittedAt?: string;
  submittedBy?: string;
  submitterName?: string;
  draftExists: boolean;
  hasSubmitted: boolean;
  assignedTo?: string;
  assignedToName?: string;
  progress: {
    fileFoldersComplete: boolean;
    registersComplete: boolean;
    percentageComplete: number;
  };
}

export interface StationReport {
  totalStations: number;
  stationsByStatus: Record<StationStatus, number>;
  stations: StationSubmissionStatus[];
  summary: {
    completed: number;
    pending: number;
    notStarted: number;
    total: number;
    completionRate: number;
  };
}

export interface StationRequirementSubmission {
  id?: string;
  station: string;
  fileFolders: StationRequirementItem[];
  registers: StationRequirementItem[];
  status: SubmissionStatus;
  submittedAt?: string;
  updatedAt: string;
  submittedBy?: string;
  submitterName?: string;
  submitterEmail?: string;
  emailSent?: boolean;
  emailSentAt?: string;
  emailError?: string;
  adminReviewed?: boolean;
  adminReviewedAt?: string;
  adminReviewedBy?: string;
  adminNotes?: string;
  reviewStatus?: ReviewStatus;
}

export interface StationRequirementSummary {
  id?: string;
  station: string;
  fileFoldersTotal: number;
  registersTotal: number;
  status: SubmissionStatus;
  submittedAt?: string;
  updatedAt: string;
  submitterName?: string;
  reviewStatus?: ReviewStatus;
}

// ============================================
// Draft-specific Types
// ============================================

export interface DraftSubmission extends StationRequirementSubmission {
  status: 'draft';
  submittedAt?: never;
}

export interface SubmittedSubmission extends StationRequirementSubmission {
  status: 'submitted';
  submittedAt: string;
}

// ============================================
// Input Types for API Endpoints
// ============================================

export interface CreateSubmissionInput {
  station: string;
  fileFolders: StationRequirementItem[];
  registers: StationRequirementItem[];
  status?: SubmissionStatus;
}

export interface UpdateSubmissionInput {
  station?: string;
  fileFolders?: StationRequirementItem[];
  registers?: StationRequirementItem[];
  status?: SubmissionStatus;
  reviewStatus?: ReviewStatus;
  adminNotes?: string;
}

export interface SubmitDraftInput {
  id: string;
  sendEmail?: boolean;
}

export interface GetSubmissionsQuery {
  station?: string;
  status?: SubmissionStatus;
  reviewStatus?: ReviewStatus;
  fromDate?: string;
  toDate?: string;
  page?: number;
  limit?: number;
  sortBy?: 'updatedAt' | 'submittedAt' | 'station';
  sortOrder?: 'asc' | 'desc';
  adminView?: boolean;
}

export interface GetStationReportQuery {
  status?: StationStatus;
  fromDate?: string;
  toDate?: string;
  page?: number;
  limit?: number;
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

export interface DraftListResponse {
  drafts: StationRequirementSummary[];
  total: number;
  page: number;
  limit: number;
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
  pendingReviews: number;
  draftsCount: number;
  submittedCount: number;
  notStartedCount: number;
  completionRate: number;
  recentActivity: Array<{
    id: string;
    station: string;
    action: 'submitted' | 'approved' | 'updated' | 'created' | 'reviewed' | 'rejected';
    timestamp: string;
    user: string;
    details?: string;
  }>;
  stationsByRegion?: Record<string, StationReport>;
}

export interface AdminReviewQueue {
  pending: StationRequirementSubmission[];
  approved: StationRequirementSubmission[];
  needsRevision: StationRequirementSubmission[];
  total: number;
}

// ============================================
// CASE CATEGORIES - File Folders
// (Original case categories for file folders)
// ============================================

export const CASE_CATEGORIES = {
  "Criminal": [
    "Murder",
    "Applications",
    "Appeals",
    "Court Martial",
    "Revisions",
    "2nd Appeals"
  ],
  "Anti-Corruption & Economic Crimes": [
    "Appeals",
    "Judicial Review",
    "Suit",
    "Revision",
    "Miscellaneous",
    "Petitions"
  ],
  "Commercial & Tax": [
    "Commercial Civil Matters",
    "Commercial Miscellaneous",
    "Insolvency Cause",
    "Insolvency Petition",
    "Income Tax Appeal",
    "Insolvency Notice",
    "Commercial Appeal",
    "Commercial Petitions",
    "Arbitration"
  ],
  "Admiralty": [
    "Admiralty"
  ],
  "Civil": [
    "High Court Civil",
    "High Court Civil Miscellaneous",
    "High Court Civil Appeals/Applications"
  ],
  "Family": [
    "Family Appeals",
    "Family Miscellaneous Applications",
    "Probate & Administration",
    "Divorce",
    "Adoption",
    "Matrimonial Properties"
  ],
  "Judicial Review": [
    "Judicial Review",
    "Judicial Review Miscellaneous"
  ],
  "Constitutional & Human Rights": [
    "Constitutional & Human Rights Petition",
    "Petition",
    "Miscellaneous Petition",
    "Election Appeal",
    "Miscellaneous Election Appeal",
    "Election Petition"
  ]
} as const;

// ============================================
// CASE REGISTERS - By Category
// (For the registers section - second page)
// ============================================

export const CASE_REGISTERS = {
  // A. CRIMINAL CASE REGISTERS
  "Criminal": [
    "Criminal Application/Murder Case Register",
    "Criminal Miscellaneous Application Case Register",
    "Criminal Revision Case Register",
    "Criminal Appeal Case Register"
  ],
  
  // B. ANTI-CORRUPTION & ECONOMIC CRIMES CASE REGISTERS
  "Anti-Corruption & Economic Crimes": [
    "Anti-Corruption and Economic Crimes Suits Case Register",
    "Anti-Corruption and Economic Crimes Petition Case Register",
    "Anti-Corruption and Economic Crimes Appeals Case Register",
    "Anti-Corruption and Economic Crimes Revision Case Register",
    "Anti-Corruption and Economic Crimes Miscellaneous Case Register"
  ],
  
  // C. CIVIL CASE REGISTERS
  "Civil": [
    "Civil Case Register",
    "Civil Appeals Case Register",
    "Miscellaneous Civil Application Case Register"
  ],
  
  // D. COMMERCIAL CASE REGISTERS
  "Commercial & Tax": [
    "Commercial Suits Case Register",
    "Commercial Miscellaneous Case Register",
    "Commercial Appeal Case Register",
    "Income Tax Appeals Case Register",
    "Insolvency Notices Case Register",
    "Insolvency Case Register",
    "Insolvency Petition Case Register",
    "Arbitration Case Register",
    "Admiralty Case Register"
  ],
  
  // E. CONSTITUTIONAL & HUMAN RIGHTS CASE REGISTERS
  "Constitutional & Human Rights": [
    "Constitutional & Human Rights Petition Case Register",
    "Constitutional & Human Rights Miscellaneous Case Register"
  ],
  
  // F. JUDICIAL REVIEW CASE REGISTERS
  "Judicial Review": [
    "Judicial Review Case Register",
    "Judicial Review Miscellaneous Application Case Register"
  ],
  
  // G. FAMILY CASE REGISTERS
  "Family": [
    "Family Civil Case Register",
    "Probate and Administration Case Register",
    "Matrimonial Properties Case Register",
    "Adoption Case Register",
    "Family Appeals Case Register",
    "Family Miscellaneous Case Register",
    "Divorce Case Register"
  ]
} as const;

// ============================================
// ADDITIONAL REGISTERS
// (Appended after main categories)
// ============================================

export const ADDITIONAL_REGISTERS = [
  "File Movement Register",
  "Accession Register",
  "Missing File Register",
  "Exhibit Register",
  "Court Assistants Exhibit Register",
  "Certified Urgent Applications Tracking Register",
  "Injunction Register", // ✅ Added here
  "Tracking Register for High Court Appeal Pending Due to Lack of Lower Court Record",
  "Tracking Registers for Appeals to Court of Appeal"
] as const;

// ============================================
// ALL REGISTERS (Combined for easy access)
// ============================================

export const ALL_REGISTERS = {
  ...CASE_REGISTERS,
  "Additional": ADDITIONAL_REGISTERS as unknown as readonly string[]
} as const;

// ============================================
// CASE CODES - File Folders
// ============================================

export const CASE_CODES = {
  // Criminal
  "Criminal_Murder": "HC.CR.C.",
  "Criminal_Applications": "HC.MISC.CR.APPL",
  "Criminal_Appeals": "HC.CR.A.",
  "Criminal_Court Martial": "HCCMA",
  "Criminal_Revisions": "HC.CR.REV",
  "Criminal_2nd Appeals": "K.C.A",

  // Anti-Corruption & Economic Crimes
  "Anti-Corruption & Economic Crimes_Appeals": "HCACECA",
  "Anti-Corruption & Economic Crimes_Judicial Review": "HCACEC JR",
  "Anti-Corruption & Economic Crimes_Suit": "HCACECS",
  "Anti-Corruption & Economic Crimes_Revision": "HCACECR",
  "Anti-Corruption & Economic Crimes_Miscellaneous": "HCACEMISC",
  "Anti-Corruption & Economic Crimes_Petitions": "HCACEC PETITION",

  // Commercial & Tax
  "Commercial & Tax_Commercial Civil Matters": "HCCOMM",
  "Commercial & Tax_Commercial Miscellaneous": "HCCOMMMISC",
  "Commercial & Tax_Insolvency Cause": "HCCOMMIC",
  "Commercial & Tax_Insolvency Petition": "HCCOMMIP",
  "Commercial & Tax_Income Tax Appeal": "HCCOMMITA",
  "Commercial & Tax_Insolvency Notice": "HCCOMMIN",
  "Commercial & Tax_Commercial Appeal": "HCCCOMMA",
  "Commercial & Tax_Commercial Petitions": "HCCOMMPET",
  "Commercial & Tax_Arbitration": "HCCOMMARB",

  // Admiralty
  "Admiralty_Admiralty": "HCCOMMADMIR",

  // Civil
  "Civil_High Court Civil": "HCCC",
  "Civil_High Court Civil Miscellaneous": "HCCC Misc.",
  "Civil_High Court Civil Appeals/Applications": "HCCA",

  // Family
  "Family_Family Appeals": "HCFA",
  "Family_Family Miscellaneous Applications": "HCFMISC",
  "Family_Probate & Administration": "HCFP & A",
  "Family_Divorce": "HCFDC",
  "Family_Adoption": "HCFADOP",
  "Family_Matrimonial Properties": "HCFOS",

  // Judicial Review
  "Judicial Review_Judicial Review": "HCJR",
  "Judicial Review_Judicial Review Miscellaneous": "HCJRMISC",

  // Constitutional & Human Rights
  "Constitutional & Human Rights_Constitutional & Human Rights Petition": "CHR",
  "Constitutional & Human Rights_Petition": "HCCHRPET",
  "Constitutional & Human Rights_Miscellaneous Petition": "HCCCHRPETMISC",
  "Constitutional & Human Rights_Election Appeal": "HCCHREPA",
  "Constitutional & Human Rights_Miscellaneous Election Appeal": "HCCHRMEPA",
  "Constitutional & Human Rights_Election Petition": "HCCHREP"
} as const;

// ============================================
// CASE COLORS - File Folders
// ============================================

export const CASE_COLORS = {
  // Criminal
  "Criminal_Murder": "Dark Purple",
  "Criminal_Applications": "Light Yellow",
  "Criminal_Appeals": "Red",
  "Criminal_Court Martial": "Red",
  "Criminal_Revisions": "Sky Blue",
  "Criminal_2nd Appeals": "Dark Pink",

  // Anti-Corruption & Economic Crimes
  "Anti-Corruption & Economic Crimes_Appeals": "Blue",
  "Anti-Corruption & Economic Crimes_Judicial Review": "Dark Green",
  "Anti-Corruption & Economic Crimes_Suit": "Maroon",
  "Anti-Corruption & Economic Crimes_Revision": "Neon Green",
  "Anti-Corruption & Economic Crimes_Miscellaneous": "Orange",
  "Anti-Corruption & Economic Crimes_Petitions": "Red",

  // Commercial & Tax
  "Commercial & Tax_Commercial Civil Matters": "Light Purple",
  "Commercial & Tax_Commercial Miscellaneous": "Light Purple",
  "Commercial & Tax_Insolvency Cause": "Light Purple",
  "Commercial & Tax_Insolvency Petition": "Light Purple",
  "Commercial & Tax_Income Tax Appeal": "Light Purple",
  "Commercial & Tax_Insolvency Notice": "Light Purple",
  "Commercial & Tax_Commercial Appeal": "Light Purple",
  "Commercial & Tax_Commercial Petitions": "Light Purple",
  "Commercial & Tax_Arbitration": "Light Purple",

  // Admiralty
  "Admiralty_Admiralty": "Sky Blue",

  // Civil
  "Civil_High Court Civil": "Orange",
  "Civil_High Court Civil Miscellaneous": "Orange",
  "Civil_High Court Civil Appeals/Applications": "Grey",

  // Family
  "Family_Family Appeals": "Grey",
  "Family_Family Miscellaneous Applications": "Yellow",
  "Family_Probate & Administration": "Pink",
  "Family_Divorce": "Purple",
  "Family_Adoption": "Cream",
  "Family_Matrimonial Properties": "Yellow",

  // Judicial Review
  "Judicial Review_Judicial Review": "Dark Green",
  "Judicial Review_Judicial Review Miscellaneous": "Dark Green",

  // Constitutional & Human Rights
  "Constitutional & Human Rights_Constitutional & Human Rights Petition": "Light Green",
  "Constitutional & Human Rights_Petition": "Light Green",
  "Constitutional & Human Rights_Miscellaneous Petition": "Light Green",
  "Constitutional & Human Rights_Election Appeal": "Light Green",
  "Constitutional & Human Rights_Miscellaneous Election Appeal": "Light Green",
  "Constitutional & Human Rights_Election Petition": "Light Green"
} as const;

// ============================================
// Type definitions
// ============================================

export type CaseCategory = keyof typeof CASE_CATEGORIES;
export type CaseName = typeof CASE_CATEGORIES[CaseCategory][number];
export type RegisterCategory = keyof typeof CASE_REGISTERS;
export type RegisterName = typeof CASE_REGISTERS[RegisterCategory][number];
export type AdditionalRegister = typeof ADDITIONAL_REGISTERS[number];

// ============================================
// Helper functions - File Folders
// ============================================

export const CASE_CATEGORIES_LIST = Object.keys(CASE_CATEGORIES) as CaseCategory[];

export function getCaseCode(category: CaseCategory, caseName: CaseName): string {
  const key = `${category}_${caseName}` as keyof typeof CASE_CODES;
  return CASE_CODES[key];
}

export function getCaseColor(category: CaseCategory, caseName: CaseName): string {
  const key = `${category}_${caseName}` as keyof typeof CASE_COLORS;
  return CASE_COLORS[key];
}

export function getCasesByCategory(category: CaseCategory): CaseName[] {
  return CASE_CATEGORIES[category] as unknown as CaseName[];
}

export function getAllCases(): { category: CaseCategory; name: CaseName; code: string; color: string }[] {
  const result: { category: CaseCategory; name: CaseName; code: string; color: string }[] = [];

  for (const category of CASE_CATEGORIES_LIST) {
    const cases = getCasesByCategory(category);
    for (const caseName of cases) {
      result.push({
        category,
        name: caseName,
        code: getCaseCode(category, caseName),
        color: getCaseColor(category, caseName)
      });
    }
  }

  return result;
}

// ============================================
// Helper functions - Registers
// ============================================

export const REGISTER_CATEGORIES_LIST = Object.keys(CASE_REGISTERS) as RegisterCategory[];

export function getRegistersByCategory(category: RegisterCategory): RegisterName[] {
  return CASE_REGISTERS[category] as unknown as RegisterName[];
}

export function getAllRegisters(): { category: string; name: string }[] {
  const result: { category: string; name: string }[] = [];

  for (const category of REGISTER_CATEGORIES_LIST) {
    const registers = getRegistersByCategory(category as RegisterCategory);
    for (const register of registers) {
      result.push({
        category,
        name: register
      });
    }
  }

  // Add additional registers
  for (const register of ADDITIONAL_REGISTERS) {
    result.push({
      category: 'Additional',
      name: register
    });
  }

  return result;
}

export function getAllRegisterCategories(): string[] {
  return [...REGISTER_CATEGORIES_LIST, 'Additional'];
}

// ============================================
// Draft Helper Functions
// ============================================

export function isDraft(submission: StationRequirementSubmission): submission is DraftSubmission {
  return submission.status === 'draft';
}

export function isSubmitted(submission: StationRequirementSubmission): submission is SubmittedSubmission {
  return submission.status === 'submitted';
}

export function getSubmissionStatusText(status: SubmissionStatus): string {
  return status === 'draft' ? 'Draft' : 'Submitted';
}

export function getSubmissionStatusColor(status: SubmissionStatus): string {
  return status === 'draft' ? '#F59E0B' : '#10B981';
}

export function calculateTotals(submission: StationRequirementSubmission): {
  fileFoldersTotal: number;
  registersTotal: number;
  totalItems: number;
} {
  const fileFoldersTotal = submission.fileFolders.reduce((sum, item) => sum + item.quantity, 0);
  const registersTotal = submission.registers.reduce((sum, item) => sum + item.quantity, 0);
  return {
    fileFoldersTotal,
    registersTotal,
    totalItems: fileFoldersTotal + registersTotal
  };
}

// ============================================
// Admin Dashboard Helper Functions
// ============================================

export function getStationStatusText(status: StationStatus): string {
  const statusMap: Record<StationStatus, string> = {
    'not_started': 'Not Started',
    'in_progress': 'In Progress',
    'submitted': 'Submitted',
    'pending_review': 'Pending Review',
    'approved': 'Approved',
    'needs_revision': 'Needs Revision'
  };
  return statusMap[status];
}

export function getStationStatusColor(status: StationStatus): string {
  const colorMap: Record<StationStatus, string> = {
    'not_started': '#9CA3AF',
    'in_progress': '#F59E0B',
    'submitted': '#3B82F6',
    'pending_review': '#8B5CF6',
    'approved': '#10B981',
    'needs_revision': '#EF4444'
  };
  return colorMap[status];
}

export function getStationProgress(submission?: StationRequirementSubmission): StationSubmissionStatus['progress'] {
  if (!submission) {
    return {
      fileFoldersComplete: false,
      registersComplete: false,
      percentageComplete: 0
    };
  }

  const hasFileFolders = submission.fileFolders.length > 0;
  const hasRegisters = submission.registers.length > 0;
  
  return {
    fileFoldersComplete: hasFileFolders,
    registersComplete: hasRegisters,
    percentageComplete: (hasFileFolders ? 50 : 0) + (hasRegisters ? 50 : 0)
  };
}

export function determineStationStatus(
  submission?: StationRequirementSubmission,
  reviewStatus?: ReviewStatus
): StationStatus {
  if (!submission) {
    return 'not_started';
  }

  if (submission.status === 'draft') {
    return 'in_progress';
  }

  if (submission.status === 'submitted') {
    if (reviewStatus === 'approved') {
      return 'approved';
    }
    if (reviewStatus === 'needs_revision') {
      return 'needs_revision';
    }
    if (reviewStatus === 'pending' || !reviewStatus) {
      return 'pending_review';
    }
    return 'submitted';
  }

  return 'not_started';
}

export function getReviewStatusText(status: ReviewStatus): string {
  const statusMap: Record<ReviewStatus, string> = {
    'pending': 'Pending Review',
    'approved': 'Approved',
    'needs_revision': 'Needs Revision'
  };
  return statusMap[status];
}

export function getReviewStatusColor(status: ReviewStatus): string {
  const colorMap: Record<ReviewStatus, string> = {
    'pending': '#8B5CF6',
    'approved': '#10B981',
    'needs_revision': '#EF4444'
  };
  return colorMap[status];
}