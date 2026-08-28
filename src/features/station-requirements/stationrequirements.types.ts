// Types for the Station Requirements Form

export interface StationRequirementItem {
  division: string;
  name: string;
  quantity: number;
}

// ✅ UPDATED: Added submitterName and submitterEmail
export interface StationRequirementSubmission {
  id?: string;
  station: string;
  quarter: string;
  fileFolders: StationRequirementItem[];
  registers: StationRequirementItem[];
  submittedAt: string;
  submittedBy?: string; // User ID from auth
  submitterName?: string; // ✅ Full name of submitter
  submitterEmail?: string; // ✅ Email of submitter
}

// ✅ FIXED: Added id field to Summary
export interface StationRequirementSummary {
  id?: string;
  station: string;
  quarter: string;
  fileFoldersTotal: number;
  registersTotal: number;
  submittedAt: string;
}

// Input types for API endpoints
export interface CreateSubmissionInput {
  station: string;
  quarter: string;
  fileFolders: StationRequirementItem[];
  registers: StationRequirementItem[];
}

export interface GetSubmissionsQuery {
  station?: string;
  quarter?: string;
  fromDate?: string;
  toDate?: string;
  page?: number;
  limit?: number;
}

// Response types
export interface SubmissionResponse {
  submission: StationRequirementSubmission;
  message?: string;
}

export interface SubmissionsListResponse {
  submissions: StationRequirementSummary[];
  total: number;
  page: number;
  limit: number;
}

// Validation schemas will be in separate file
export const FILE_FOLDERS_CATEGORIES = {
  "Civil": ["Civil (Suits)", "Civil Appeals", "Civil Miscellaneous"],
  "Criminal": ["Criminal Cases (Murder)", "CR. Appeals", "CR. Petition", "CR. Constitutional Petition", "Criminal 1st Appeals", "Criminal Revision", "Cr. Miscellaneous"],
  "Family": ["Adoption", "Matrimonial Property", "Family Civil Appeals", "Succession (P & A)", "Family Civil", "Family Appeals", "Family Miscellaneous"],
  "Anti-Corruption & Economic Crimes": ["Acec Petition", "Acec Suits", "Acec Miscellaneous", "Acec Revision", "Acec Appeals", "Acec Judicial Review", "Miscellaneous Petition", "Petitions"],
  "Constitutional & Human Rights": ["CHR-Petitions", "CHR-Election", "Miscellaneous Petition"],
  "Judicial Review": ["Judicial Review", "Miscellaneous Judicial Review"],
  "Civil Appellate": ["Civil Appeals", "Civil Tribunals", "Small Claims Appeals", "Civil Appeal Misc."]
} as const;

export const REGISTERS_CATEGORIES = {
  "Criminal": ["Criminal Revision", "Murder Cases", "Criminal Misc. Application", "CR. Appeals", "CR. Petition", "CR. Constitutional Petition"],
  "Civil": ["Civil Cases (Suits)", "Civil Miscellaneous", "Civil Appeals"],
  "Family": ["Family Misc. Application", "P & A", "Adoption", "Family Appeals", "Matrimonial Property"],
  "Judicial Review": ["Judicial Review"],
  "Constitutional & Human Rights": ["Const. & H/Rights Petition"],
  "Anti-Corruption & Economic Crimes": ["Acec Judicial Review", "Acec Appeals", "Acec Revision", "Acec Miscellaneous", "Acec Suits", "Acec Petition"],
  "Civil Appellate": ["Civil Appeals", "Civil Tribunals", "Small Claims Appeals", "Civil Appeal Misc."]
} as const;

export type FileFolderCategory = keyof typeof FILE_FOLDERS_CATEGORIES;
export type RegisterCategory = keyof typeof REGISTERS_CATEGORIES;