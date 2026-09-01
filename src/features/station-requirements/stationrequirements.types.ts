// Types for the Station Requirements Form
// Based strictly on the official case categories document
// CHANGES: removed all "quarter" fields (DR login only picks a station).
// "quantity" on each item = how many of that file/register are needed.

export interface StationRequirementItem {
  division: string;
  name: string;
  quantity: number; // how many needed, e.g. 1, 2, 3...
}

export interface StationRequirementSubmission {
  id?: string;
  station: string;
  fileFolders: StationRequirementItem[];
  registers: StationRequirementItem[];
  submittedAt: string;
  submittedBy?: string; // User ID from auth
  submitterName?: string; // Full name of submitter
  submitterEmail?: string; // Email of submitter
}

export interface StationRequirementSummary {
  id?: string;
  station: string;
  fileFoldersTotal: number;
  registersTotal: number;
  submittedAt: string;
}

// Input types for API endpoints
export interface CreateSubmissionInput {
  station: string;
  fileFolders: StationRequirementItem[];
  registers: StationRequirementItem[];
}

export interface GetSubmissionsQuery {
  station?: string;
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

// ============================================
// CASE CATEGORIES - From the official document
// (unchanged - verified against the uploaded doc, matches exactly)
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
// CASE CODES - Using unique keys (category + name)
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
// CASE COLORS - Using unique keys (category + name)
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

// ============================================
// Helper functions
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

// Get all case names with their categories
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