// services/stationrequirements.service.ts
import { query } from '../../config/db';
import { AppError } from '../../utils/Apperror';
import {
  StationRequirementSubmission,
  StationRequirementSummary,
  StationRequirementItem,
  CreateSubmissionInput,
  UpdateSubmissionInput,
  GetSubmissionsQuery,
  GetStationReportQuery,
  SubmissionStatus,
  StationStatus,
  ReviewStatus,
  StationReport,
  StationSubmissionStatus,
  AdminDashboardStats,
  AdminReviewQueue,
  CASE_CATEGORIES,
  CASE_REGISTERS,
  ADDITIONAL_REGISTERS,
  CaseCategory,
  RegisterCategory,
  CaseName,
} from './stationrequirements.types';

// Type for database row
type DbRow = Record<string, unknown>;

// ============================================================
// CATEGORY MAPPING - Map frontend category names to backend category names
// ============================================================
const CATEGORY_MAP: Record<string, string> = {
  // Frontend format (with "CASES" suffix) -> Backend format (without suffix)
  'CRIMINAL CASES': 'Criminal',
  'ANTI-CORRUPTION AND ECONOMIC CRIMES CASES': 'Anti-Corruption & Economic Crimes',
  'COMMERCIAL AND TAX CASES': 'Commercial & Tax',
  'ADMIRALTY': 'Admiralty',
  'CIVIL CASES': 'Civil',
  'FAMILY CASES': 'Family',
  'JUDICIAL REVIEW CASES': 'Judicial Review',
  'CONSTITUTIONAL AND HUMAN RIGHTS CASES': 'Constitutional & Human Rights',

  // Also handle the reverse mapping (backend format -> backend format)
  'Criminal': 'Criminal',
  'Anti-Corruption & Economic Crimes': 'Anti-Corruption & Economic Crimes',
  'Commercial & Tax': 'Commercial & Tax',
  'Admiralty': 'Admiralty',
  'Civil': 'Civil',
  'Family': 'Family',
  'Judicial Review': 'Judicial Review',
  'Constitutional & Human Rights': 'Constitutional & Human Rights',
};

// ============================================================
// Register Category Mapping
// ============================================================
const REGISTER_CATEGORY_MAP: Record<string, string> = {
  // Frontend format -> Backend format
  'CRIMINAL': 'Criminal',
  'ANTI-CORRUPTION AND ECONOMIC CRIMES': 'Anti-Corruption & Economic Crimes',
  'CIVIL': 'Civil',
  'COMMERCIAL': 'Commercial & Tax',
  'CONSTITUTIONAL AND HUMAN RIGHTS': 'Constitutional & Human Rights',
  'JUDICIAL REVIEW': 'Judicial Review',
  'FAMILY': 'Family',
  'ADDITIONAL': 'Additional',

  // Backend format -> Backend format
  'Criminal': 'Criminal',
  'Anti-Corruption & Economic Crimes': 'Anti-Corruption & Economic Crimes',
  'Civil': 'Civil',
  'Commercial & Tax': 'Commercial & Tax',
  'Constitutional & Human Rights': 'Constitutional & Human Rights',
  'Judicial Review': 'Judicial Review',
  'Family': 'Family',
  'Additional': 'Additional',
};

// ============================================================
// Normalize category name to match backend format
// ============================================================
const normalizeCategory = (category: string): string => {
  return CATEGORY_MAP[category] || category;
};

// ============================================================
// Normalize register category name to match backend format
// ============================================================
const normalizeRegisterCategory = (category: string): string => {
  return REGISTER_CATEGORY_MAP[category] || category;
};

// ============================================================
// VALIDATION: Check if a case name belongs to a valid category (File Folders)
// ============================================================
const isValidCaseCategory = (category: string): category is CaseCategory => {
  const normalized = normalizeCategory(category);
  return Object.keys(CASE_CATEGORIES).includes(normalized);
};

const isValidCaseName = (category: string, name: string): boolean => {
  const normalized = normalizeCategory(category);
  if (!Object.keys(CASE_CATEGORIES).includes(normalized)) {
    return false;
  }
  const cases = CASE_CATEGORIES[normalized as CaseCategory] as readonly string[];
  return cases.includes(name);
};

// ============================================================
// VALIDATION: Check if a register name belongs to a valid category
// ============================================================
const isValidRegisterCategory = (category: string): category is RegisterCategory | 'Additional' => {
  const normalized = normalizeRegisterCategory(category);
  return Object.keys(CASE_REGISTERS).includes(normalized) || normalized === 'Additional';
};

const isValidRegisterName = (category: string, name: string): boolean => {
  const normalized = normalizeRegisterCategory(category);
  
  if (normalized === 'Additional') {
    return ADDITIONAL_REGISTERS.includes(name as any);
  }
  
  if (!Object.keys(CASE_REGISTERS).includes(normalized)) {
    return false;
  }
  
  const registers = CASE_REGISTERS[normalized as RegisterCategory] as readonly string[];
  return registers.includes(name);
};

// ============================================================
// Validate File Folder Items
// ============================================================
const validateFileFolderItems = (items: StationRequirementItem[], type: string): void => {
  if (!Array.isArray(items)) {
    throw new AppError(`${type} must be an array`, 400);
  }

  items.forEach((item, index) => {
    if (!item.division || typeof item.division !== 'string' || item.division.trim() === '') {
      throw new AppError(`${type}[${index}]: division is required and must be a non-empty string`, 400);
    }

    if (!item.name || typeof item.name !== 'string' || item.name.trim() === '') {
      throw new AppError(`${type}[${index}]: name is required and must be a non-empty string`, 400);
    }

    // Validate that the division is a valid case category
    const normalizedDivision = normalizeCategory(item.division);
    if (!Object.keys(CASE_CATEGORIES).includes(normalizedDivision)) {
      throw new AppError(
        `${type}[${index}]: division "${item.division}" is not a valid case category. ` +
        `Valid categories are: ${Object.keys(CASE_CATEGORIES).join(', ')}`,
        400
      );
    }

    // Validate that the name belongs to the specified category
    const validNames = CASE_CATEGORIES[normalizedDivision as CaseCategory] as readonly string[];
    if (!validNames.includes(item.name)) {
      throw new AppError(
        `${type}[${index}]: name "${item.name}" is not valid for category "${item.division}". ` +
        `Valid names for this category are: ${validNames.join(', ')}`,
        400
      );
    }

    if (typeof item.quantity !== 'number' || isNaN(item.quantity) || item.quantity < 0) {
      throw new AppError(`${type}[${index}]: quantity must be a valid number >= 0`, 400);
    }
  });
};

// ============================================================
// Validate Register Items
// ============================================================
const validateRegisterItems = (items: StationRequirementItem[], type: string): void => {
  if (!Array.isArray(items)) {
    throw new AppError(`${type} must be an array`, 400);
  }

  const allRegisterCategories = [...Object.keys(CASE_REGISTERS), 'Additional'];

  items.forEach((item, index) => {
    if (!item.division || typeof item.division !== 'string' || item.division.trim() === '') {
      throw new AppError(`${type}[${index}]: division is required and must be a non-empty string`, 400);
    }

    if (!item.name || typeof item.name !== 'string' || item.name.trim() === '') {
      throw new AppError(`${type}[${index}]: name is required and must be a non-empty string`, 400);
    }

    // Validate that the division is a valid register category
    const normalizedDivision = normalizeRegisterCategory(item.division);
    if (!allRegisterCategories.includes(normalizedDivision)) {
      throw new AppError(
        `${type}[${index}]: division "${item.division}" is not a valid register category. ` +
        `Valid categories are: ${allRegisterCategories.join(', ')}`,
        400
      );
    }

    // Validate that the name belongs to the specified category
    let validNames: string[] = [];
    if (normalizedDivision === 'Additional') {
      validNames = [...ADDITIONAL_REGISTERS];
    } else {
      validNames = CASE_REGISTERS[normalizedDivision as RegisterCategory] as unknown as string[];
    }
    
    if (!validNames.includes(item.name)) {
      throw new AppError(
        `${type}[${index}]: name "${item.name}" is not valid for category "${item.division}". ` +
        `Valid names for this category are: ${validNames.join(', ')}`,
        400
      );
    }

    if (typeof item.quantity !== 'number' || isNaN(item.quantity) || item.quantity < 0) {
      throw new AppError(`${type}[${index}]: quantity must be a valid number >= 0`, 400);
    }
  });
};

// ============================================================
// Combined validation for all items
// ============================================================
const validateStationRequirementItems = (
  fileFolders: StationRequirementItem[], 
  registers: StationRequirementItem[]
): void => {
  validateFileFolderItems(fileFolders, 'fileFolders');
  validateRegisterItems(registers, 'registers');
};

// ============================================================
// Map database row to StationRequirementSubmission
// ============================================================
const mapSubmissionRow = (row: DbRow): StationRequirementSubmission => {
  console.log('🔍 Mapping database row:', JSON.stringify(row, null, 2));

  if (!row) {
    throw new AppError('No data returned from database', 500);
  }

  const id = row.id ? String(row.id).trim() : '';
  const station = row.station ? String(row.station).trim() : '';
  const submittedAt = row.submitted_at ? String(row.submitted_at).trim() : '';
  const status = row.status ? String(row.status).trim() as SubmissionStatus : 'draft';
  const updatedAt = row.updated_at ? String(row.updated_at).trim() : new Date().toISOString();
  const reviewStatus = row.review_status ? String(row.review_status).trim() as ReviewStatus : undefined;

  if (!id) {
    console.error('Missing or invalid id in row:', row);
    throw new AppError('Invalid submission data: missing id', 500);
  }
  if (!station) {
    console.error('Missing or invalid station in row:', row);
    throw new AppError('Invalid submission data: missing station', 500);
  }

  let fileFolders: StationRequirementItem[] = [];
  try {
    if (row.file_folders) {
      if (typeof row.file_folders === 'string') {
        fileFolders = JSON.parse(row.file_folders);
      } else if (Array.isArray(row.file_folders)) {
        fileFolders = row.file_folders as StationRequirementItem[];
      } else {
        console.warn('Unexpected file_folders format:', typeof row.file_folders);
        fileFolders = [];
      }
    }
  } catch (error) {
    console.error('Error parsing file_folders:', error);
    fileFolders = [];
  }

  let registers: StationRequirementItem[] = [];
  try {
    if (row.registers) {
      if (typeof row.registers === 'string') {
        registers = JSON.parse(row.registers);
      } else if (Array.isArray(row.registers)) {
        registers = row.registers as StationRequirementItem[];
      } else {
        console.warn('Unexpected registers format:', typeof row.registers);
        registers = [];
      }
    }
  } catch (error) {
    console.error('Error parsing registers:', error);
    registers = [];
  }

  if (!Array.isArray(fileFolders)) {
    console.warn('fileFolders is not an array, converting to empty array');
    fileFolders = [];
  }
  if (!Array.isArray(registers)) {
    console.warn('registers is not an array, converting to empty array');
    registers = [];
  }

  return {
    id,
    station,
    fileFolders,
    registers,
    status,
    updatedAt,
    submittedAt: status === 'submitted' ? submittedAt : undefined,
    submittedBy: row.submitted_by ? String(row.submitted_by) : undefined,
    submitterName: row.submitter_name ? String(row.submitter_name) : undefined,
    submitterEmail: row.submitter_email ? String(row.submitter_email) : undefined,
    emailSent: row.email_sent ? Boolean(row.email_sent) : false,
    emailSentAt: row.email_sent_at ? String(row.email_sent_at) : undefined,
    emailError: row.email_error ? String(row.email_error) : undefined,
    adminReviewed: row.admin_reviewed ? Boolean(row.admin_reviewed) : false,
    adminReviewedAt: row.admin_reviewed_at ? String(row.admin_reviewed_at) : undefined,
    adminReviewedBy: row.admin_reviewed_by ? String(row.admin_reviewed_by) : undefined,
    adminNotes: row.admin_notes ? String(row.admin_notes) : undefined,
    reviewStatus,
  };
};

// ============================================================
// Map database row to StationRequirementSummary
// ============================================================
const mapSummaryRow = (row: DbRow): StationRequirementSummary => {
  const status = row.status ? String(row.status).trim() as SubmissionStatus : 'draft';
  const reviewStatus = row.review_status ? String(row.review_status).trim() as ReviewStatus : undefined;
  
  return {
    id: row.id ? String(row.id) : undefined,
    station: row.station ? String(row.station) : '',
    fileFoldersTotal: Number(row.file_folders_total) || 0,
    registersTotal: Number(row.registers_total) || 0,
    status,
    submittedAt: row.submitted_at ? String(row.submitted_at) : undefined,
    updatedAt: row.updated_at ? String(row.updated_at) : new Date().toISOString(),
    submitterName: row.submitter_name ? String(row.submitter_name) : undefined,
    reviewStatus,
  };
};

// ============================================================
// Determine station status based on submission data
// ============================================================
const determineStationStatus = (
  submission?: StationRequirementSubmission | null,
  reviewStatus?: ReviewStatus
): StationStatus => {
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
};

// ============================================================
// Calculate progress for a station
// ============================================================
const calculateProgress = (submission?: StationRequirementSubmission) => {
  if (!submission) {
    return {
      fileFoldersComplete: false,
      registersComplete: false,
      percentageComplete: 0,
    };
  }

  const hasFileFolders = submission.fileFolders.length > 0 && 
    submission.fileFolders.some(item => item.quantity > 0);
  const hasRegisters = submission.registers.length > 0 && 
    submission.registers.some(item => item.quantity > 0);

  let percentage = 0;
  if (hasFileFolders) percentage += 50;
  if (hasRegisters) percentage += 50;

  return {
    fileFoldersComplete: hasFileFolders,
    registersComplete: hasRegisters,
    percentageComplete: percentage,
  };
};



// ============================================================
// CREATE SUBMISSION (with draft support)
// ============================================================
export const createSubmission = async (
  input: CreateSubmissionInput,
  userId?: string,
  userEmail?: string,
  userName?: string
): Promise<StationRequirementSubmission> => {
  console.log('🔍 [Service] createSubmission called with:', {
    station: input.station,
    fileFoldersCount: input.fileFolders?.length || 0,
    registersCount: input.registers?.length || 0,
    status: input.status || 'draft',
    userId,
    userEmail,
    userName,
  });

  if (!input) {
    throw new AppError('No input data provided', 400);
  }

  if (!input.station || typeof input.station !== 'string' || input.station.trim() === '') {
    throw new AppError('Station name is required', 400);
  }

  // ✅ CRITICAL FIX: If userId is not provided, throw an error
  if (!userId) {
    console.error('❌ [Service] No userId provided! User must be authenticated.');
    throw new AppError('User not authenticated. Please log in.', 401);
  }

  const fileFolders = input.fileFolders || [];
  const registers = input.registers || [];
  const status = input.status || 'draft';

  // Only validate items if status is 'submitted'
  if (status === 'submitted') {
    validateStationRequirementItems(fileFolders, registers);

    const hasValidItem = (items: StationRequirementItem[]): boolean => {
      return items.some(item => item.quantity > 0);
    };

    if (!hasValidItem(fileFolders) && !hasValidItem(registers)) {
      throw new AppError('At least one item with quantity greater than 0 is required for submission', 400);
    }
  }

  // Normalize division names before saving to database
  const cleanFileFolders = fileFolders.map(item => ({
    division: normalizeCategory(item.division.trim()),
    name: item.name.trim(),
    quantity: item.quantity,
  }));

  const cleanRegisters = registers.map(item => ({
    division: normalizeRegisterCategory(item.division.trim()),
    name: item.name.trim(),
    quantity: item.quantity,
  }));

  console.log('🔍 [Service] Inserting into database:', {
    station: input.station.trim(),
    fileFoldersCount: cleanFileFolders.length,
    registersCount: cleanRegisters.length,
    status,
    userId, // ✅ Log userId to verify it's being passed
    userEmail,
    userName,
  });

  let result;

  if (status === 'submitted') {
    result = await query(
      `INSERT INTO station_requirements (
         station, file_folders, registers, status, submitted_at, 
         submitted_by, submitter_email, submitter_name
       )
       VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, $5, $6, $7)
       RETURNING *`,
      [
        input.station.trim(),
        JSON.stringify(cleanFileFolders),
        JSON.stringify(cleanRegisters),
        status,
        userId, // ✅ userId should always be set here
        userEmail || null,
        userName || null,
      ]
    );
  } else {
    // For drafts, submitted_by should still be set (who created the draft)
    result = await query(
      `INSERT INTO station_requirements (
         station, file_folders, registers, status, 
         submitted_by, submitter_email, submitter_name
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        input.station.trim(),
        JSON.stringify(cleanFileFolders),
        JSON.stringify(cleanRegisters),
        status,
        userId, // ✅ userId should always be set here too
        userEmail || null,
        userName || null,
      ]
    );
  }

  if (!result.rows || result.rows.length === 0) {
    throw new AppError('Failed to create submission', 500);
  }

  console.log('✅ [Service] Submission created successfully:', {
    id: result.rows[0].id,
    station: result.rows[0].station,
    status: result.rows[0].status,
    submittedBy: result.rows[0].submitted_by, // ✅ Log to verify it's set
    submittedAt: result.rows[0].submitted_at,
  });

  return mapSubmissionRow(result.rows[0]);
};

// ============================================================
// GET SUBMISSIONS (with status filtering)
// ============================================================
export const getSubmissions = async (
  queryParams: GetSubmissionsQuery
): Promise<{ submissions: StationRequirementSummary[]; total: number }> => {
  const {
    station,
    status,
    reviewStatus,
    fromDate,
    toDate,
    page = 1,
    limit = 20,
    sortBy = 'updatedAt',
    sortOrder = 'desc',
    adminView = false,
  } = queryParams;

  const validPage = Math.max(1, page);
  const validLimit = Math.min(100, Math.max(1, limit));

  const conditions: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (station) {
    conditions.push(`station ILIKE $${paramIndex}`);
    values.push(`%${station}%`);
    paramIndex++;
  }

  if (status) {
    conditions.push(`status = $${paramIndex}`);
    values.push(status);
    paramIndex++;
  }

  if (reviewStatus) {
    conditions.push(`review_status = $${paramIndex}`);
    values.push(reviewStatus);
    paramIndex++;
  }

  if (fromDate) {
    conditions.push(`submitted_at >= $${paramIndex}`);
    values.push(fromDate);
    paramIndex++;
  }

  if (toDate) {
    conditions.push(`submitted_at <= $${paramIndex}`);
    values.push(toDate);
    paramIndex++;
  }

  // If not admin view, only show submitted submissions
  if (!adminView) {
    conditions.push(`status = 'submitted'`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const offset = (validPage - 1) * validLimit;

  const sortColumnMap: Record<string, string> = {
    updatedAt: 'updated_at',
    submittedAt: 'submitted_at',
    station: 'station',
  };
  const sortColumn = sortColumnMap[sortBy] || 'updated_at';
  const sortDirection = sortOrder === 'asc' ? 'ASC' : 'DESC';

  const countResult = await query(
    `SELECT COUNT(*) as total FROM station_requirements ${whereClause}`,
    values
  );

  const total = parseInt((countResult.rows[0]?.total as string) || '0', 10);

  const result = await query(
    `SELECT 
       id,
       station,
       status,
       submitted_at,
       updated_at,
       review_status,
       submitter_name,
       COALESCE(
         (SELECT SUM((value->>'quantity')::int) FROM jsonb_array_elements(file_folders) AS value),
         0
       ) as file_folders_total,
       COALESCE(
         (SELECT SUM((value->>'quantity')::int) FROM jsonb_array_elements(registers) AS value),
         0
       ) as registers_total
     FROM station_requirements
     ${whereClause}
     ORDER BY ${sortColumn} ${sortDirection}
     LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
    [...values, validLimit, offset]
  );

  const submissions = result.rows.map(mapSummaryRow);

  return { submissions, total };
};

// ============================================================
// GET SUBMISSION BY ID
// ============================================================
export const getSubmissionById = async (id: string): Promise<StationRequirementSubmission> => {
  if (!id || typeof id !== 'string' || id.trim() === '') {
    throw new AppError('Valid submission ID is required', 400);
  }

  const result = await query(
    `SELECT 
       sr.*,
       u.full_name as submitter_name,
       u.email as submitter_email
     FROM station_requirements sr
     LEFT JOIN users u ON sr.submitted_by = u.id
     WHERE sr.id = $1`,
    [id.trim()]
  );

  if (!result.rows || result.rows.length === 0) {
    throw new AppError('Submission not found', 404);
  }

  return mapSubmissionRow(result.rows[0]);
};

// ============================================================
// UPDATE SUBMISSION (with status transitions)
// ============================================================
export const updateSubmission = async (
  id: string,
  input: UpdateSubmissionInput,
  userId?: string
): Promise<StationRequirementSubmission> => {
  if (!id || typeof id !== 'string' || id.trim() === '') {
    throw new AppError('Valid submission ID is required', 400);
  }

  const currentSubmission = await getSubmissionById(id);

  const updates: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (input.station) {
    updates.push(`station = $${paramIndex}`);
    values.push(input.station.trim());
    paramIndex++;
  }

  if (input.fileFolders) {
    const fileFolders = input.fileFolders;
    validateFileFolderItems(fileFolders, 'fileFolders');
    const normalizedFileFolders = fileFolders.map(item => ({
      division: normalizeCategory(item.division.trim()),
      name: item.name.trim(),
      quantity: item.quantity,
    }));
    updates.push(`file_folders = $${paramIndex}`);
    values.push(JSON.stringify(normalizedFileFolders));
    paramIndex++;
  }

  if (input.registers) {
    const registers = input.registers;
    validateRegisterItems(registers, 'registers');
    const normalizedRegisters = registers.map(item => ({
      division: normalizeRegisterCategory(item.division.trim()),
      name: item.name.trim(),
      quantity: item.quantity,
    }));
    updates.push(`registers = $${paramIndex}`);
    values.push(JSON.stringify(normalizedRegisters));
    paramIndex++;
  }

  if (input.status) {
    const allowedTransitions: Record<SubmissionStatus, SubmissionStatus[]> = {
      'draft': ['draft', 'submitted'],
      'submitted': ['submitted'],
    };

    const allowed = allowedTransitions[currentSubmission.status] || [];
    if (!allowed.includes(input.status)) {
      throw new AppError(
        `Cannot transition from "${currentSubmission.status}" to "${input.status}". ` +
        `Allowed transitions: ${allowed.join(', ')}`,
        400
      );
    }

    updates.push(`status = $${paramIndex}`);
    values.push(input.status);
    paramIndex++;

    if (input.status === 'submitted') {
      updates.push(`submitted_at = CURRENT_TIMESTAMP`);
    }
  }

  if (input.reviewStatus) {
    updates.push(`review_status = $${paramIndex}`);
    values.push(input.reviewStatus);
    paramIndex++;
    updates.push(`admin_reviewed = true`);
    updates.push(`admin_reviewed_at = CURRENT_TIMESTAMP`);
    if (userId) {
      updates.push(`admin_reviewed_by = $${paramIndex}`);
      values.push(userId);
      paramIndex++;
    }
  }

  if (input.adminNotes !== undefined) {
    updates.push(`admin_notes = $${paramIndex}`);
    values.push(input.adminNotes);
    paramIndex++;
  }

  if (userId) {
    updates.push(`submitted_by = $${paramIndex}`);
    values.push(userId);
    paramIndex++;
  }

  updates.push(`updated_at = CURRENT_TIMESTAMP`);

  if (updates.length === 0) {
    throw new AppError('No fields to update', 400);
  }

  values.push(id.trim());

  const result = await query(
    `UPDATE station_requirements 
     SET ${updates.join(', ')}
     WHERE id = $${paramIndex}
     RETURNING *`,
    values
  );

  if (!result.rows || result.rows.length === 0) {
    throw new AppError('Failed to update submission', 500);
  }

  return mapSubmissionRow(result.rows[0]);
};

// ============================================================
// SUBMIT DRAFT (convert draft to submitted)
// ============================================================
export const submitDraft = async (
  id: string,
  userId?: string,
  sendEmail: boolean = true
): Promise<StationRequirementSubmission> => {
  const submission = await getSubmissionById(id);

  if (submission.status !== 'draft') {
    throw new AppError('Only drafts can be submitted', 400);
  }

  const hasFileFolders = submission.fileFolders.some(item => item.quantity > 0);
  const hasRegisters = submission.registers.some(item => item.quantity > 0);

  if (!hasFileFolders && !hasRegisters) {
    throw new AppError('Cannot submit draft with no items. Please add at least one item with quantity > 0.', 400);
  }

  const result = await query(
    `UPDATE station_requirements 
     SET status = 'submitted', 
         submitted_at = CURRENT_TIMESTAMP,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $1
     RETURNING *`,
    [id.trim()]
  );

  if (!result.rows || result.rows.length === 0) {
    throw new AppError('Failed to submit draft', 500);
  }

  const updatedSubmission = mapSubmissionRow(result.rows[0]);

  return updatedSubmission;
};

// ============================================================
// ADMIN REVIEW
// ============================================================
export const adminReview = async (
  id: string,
  reviewStatus: ReviewStatus,
  adminNotes?: string,
  adminId?: string,
  sendNotification: boolean = true
): Promise<StationRequirementSubmission> => {
  const submission = await getSubmissionById(id);

  if (submission.status !== 'submitted') {
    throw new AppError('Only submitted submissions can be reviewed', 400);
  }

  const updates: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  updates.push(`review_status = $${paramIndex}`);
  values.push(reviewStatus);
  paramIndex++;

  updates.push(`admin_reviewed = true`);
  updates.push(`admin_reviewed_at = CURRENT_TIMESTAMP`);

  if (adminId) {
    updates.push(`admin_reviewed_by = $${paramIndex}`);
    values.push(adminId);
    paramIndex++;
  }

  if (adminNotes) {
    updates.push(`admin_notes = $${paramIndex}`);
    values.push(adminNotes);
    paramIndex++;
  }

  updates.push(`updated_at = CURRENT_TIMESTAMP`);

  values.push(id.trim());

  const result = await query(
    `UPDATE station_requirements 
     SET ${updates.join(', ')}
     WHERE id = $${paramIndex}
     RETURNING *`,
    values
  );

  if (!result.rows || result.rows.length === 0) {
    throw new AppError('Failed to update submission', 500);
  }

  return mapSubmissionRow(result.rows[0]);
};

// ============================================================
// DELETE SUBMISSION
// ============================================================
export const deleteSubmission = async (id: string): Promise<void> => {
  if (!id || typeof id !== 'string' || id.trim() === '') {
    throw new AppError('Valid submission ID is required', 400);
  }

  await getSubmissionById(id);

  const result = await query(
    'DELETE FROM station_requirements WHERE id = $1',
    [id.trim()]
  );

  if (!result.rowCount || result.rowCount === 0) {
    throw new AppError('Submission not found', 404);
  }
};


// ============================================================
// GET ADMIN DASHBOARD STATS
// ============================================================
export const getAdminDashboardStats = async (): Promise<AdminDashboardStats> => {
  const report = await getStationReport({});

  const todayResult = await query(`
    SELECT COUNT(*) as count 
    FROM station_requirements 
    WHERE DATE(submitted_at) = CURRENT_DATE
  `);
  const submissionsToday = parseInt((todayResult.rows[0]?.count as string) || '0', 10);

  const pendingResult = await query(`
    SELECT COUNT(*) as count 
    FROM station_requirements 
    WHERE status = 'submitted' AND (review_status IS NULL OR review_status = 'pending')
  `);
  const pendingReviews = parseInt((pendingResult.rows[0]?.count as string) || '0', 10);

  const activityResult = await query(`
    SELECT 
      id,
      station,
      status,
      review_status,
      submitted_at,
      updated_at,
      submitter_name,
      CASE 
        WHEN status = 'submitted' AND (review_status IS NULL OR review_status = 'pending') THEN 'submitted'
        WHEN review_status = 'approved' THEN 'approved'
        WHEN review_status = 'needs_revision' THEN 'rejected'
        WHEN status = 'draft' THEN 'updated'
        ELSE 'submitted'
      END as action_type
    FROM station_requirements 
    ORDER BY updated_at DESC 
    LIMIT 10
  `);

  const recentActivity = activityResult.rows.map(row => ({
    id: String(row.id),
    station: String(row.station),
    action: String(row.action_type) as 'submitted' | 'approved' | 'updated' | 'created' | 'reviewed' | 'rejected',
    timestamp: String(row.updated_at || row.submitted_at),
    user: String(row.submitter_name || 'Unknown User'),
    details: `Station: ${row.station}`,
  }));

  return {
    totalStations: report.totalStations,
    submissionsToday,
    pendingReviews,
    draftsCount: report.stationsByStatus.in_progress,
    submittedCount: report.stationsByStatus.submitted + report.stationsByStatus.pending_review,
    notStartedCount: report.stationsByStatus.not_started,
    completionRate: report.summary.completionRate,
    recentActivity,
  };
};

// ============================================================
// GET ADMIN REVIEW QUEUE
// ============================================================
export const getAdminReviewQueue = async (): Promise<AdminReviewQueue> => {
  const result = await query(`
    SELECT 
      sr.*,
      u.full_name as submitter_name,
      u.email as submitter_email
    FROM station_requirements sr
    LEFT JOIN users u ON sr.submitted_by = u.id
    WHERE sr.status = 'submitted'
    ORDER BY sr.submitted_at ASC
  `);

  const pending: StationRequirementSubmission[] = [];
  const approved: StationRequirementSubmission[] = [];
  const needsRevision: StationRequirementSubmission[] = [];

  for (const row of result.rows) {
    const submission = mapSubmissionRow(row);
    if (submission.reviewStatus === 'approved') {
      approved.push(submission);
    } else if (submission.reviewStatus === 'needs_revision') {
      needsRevision.push(submission);
    } else {
      pending.push(submission);
    }
  }

  return {
    pending,
    approved,
    needsRevision,
    total: pending.length + approved.length + needsRevision.length,
  };
};

// ============================================================
// GET SUBMISSION TOTALS
// ============================================================
export const getSubmissionTotals = async (): Promise<{
  totalSubmissions: number;
  totalFileFolders: number;
  totalRegisters: number;
  uniqueStations: number;
  draftsCount: number;
  submittedCount: number;
}> => {
  const result = await query(`
    SELECT 
      COUNT(*) as total_submissions,
      COALESCE(
        (SELECT SUM((value->>'quantity')::int) 
         FROM station_requirements, jsonb_array_elements(file_folders) AS value),
        0
      ) as total_file_folders,
      COALESCE(
        (SELECT SUM((value->>'quantity')::int) 
         FROM station_requirements, jsonb_array_elements(registers) AS value),
        0
      ) as total_registers,
      COUNT(DISTINCT station) as unique_stations,
      COUNT(CASE WHEN status = 'draft' THEN 1 END) as drafts_count,
      COUNT(CASE WHEN status = 'submitted' THEN 1 END) as submitted_count
    FROM station_requirements
  `);

  if (!result.rows || result.rows.length === 0) {
    return {
      totalSubmissions: 0,
      totalFileFolders: 0,
      totalRegisters: 0,
      uniqueStations: 0,
      draftsCount: 0,
      submittedCount: 0,
    };
  }

  const row = result.rows[0];
  return {
    totalSubmissions: parseInt((row.total_submissions as string) || '0', 10),
    totalFileFolders: parseInt((row.total_file_folders as string) || '0', 10),
    totalRegisters: parseInt((row.total_registers as string) || '0', 10),
    uniqueStations: parseInt((row.unique_stations as string) || '0', 10),
    draftsCount: parseInt((row.drafts_count as string) || '0', 10),
    submittedCount: parseInt((row.submitted_count as string) || '0', 10),
  };
};

// ============================================================
// GET UNIQUE STATIONS
// ============================================================
export const getUniqueStations = async (): Promise<string[]> => {
  const result = await query(
    'SELECT DISTINCT station FROM station_requirements ORDER BY station ASC'
  );

  if (!result.rows) {
    return [];
  }

  return result.rows.map((row) => row.station as string).filter(Boolean);
};

// ============================================================
// GET ALL VALID CASE CATEGORIES AND NAMES (for frontend use)
// ============================================================
export const getValidCaseCategories = (): CaseCategory[] => {
  return Object.keys(CASE_CATEGORIES) as CaseCategory[];
};

export const getValidCaseNames = (category: CaseCategory): readonly string[] => {
  return CASE_CATEGORIES[category] as readonly string[];
};

export const getAllValidCases = (): { category: CaseCategory; names: readonly string[] }[] => {
  return Object.entries(CASE_CATEGORIES).map(([category, names]) => ({
    category: category as CaseCategory,
    names: names as readonly string[],
  }));
};

// ============================================================
// GET ALL VALID REGISTER CATEGORIES AND NAMES (for frontend use)
// ============================================================
export const getValidRegisterCategories = (): string[] => {
  return [...Object.keys(CASE_REGISTERS), 'Additional'];
};

export const getValidRegisterNames = (category: string): readonly string[] => {
  if (category === 'Additional') {
    return ADDITIONAL_REGISTERS as readonly string[];
  }
  return CASE_REGISTERS[category as RegisterCategory] as readonly string[];
};

export const getAllValidRegisters = (): { category: string; names: readonly string[] }[] => {
  const result: { category: string; names: readonly string[] }[] = [];
  
  for (const category of Object.keys(CASE_REGISTERS)) {
    result.push({
      category,
      names: CASE_REGISTERS[category as RegisterCategory] as readonly string[],
    });
  }
  
  result.push({
    category: 'Additional',
    names: ADDITIONAL_REGISTERS as readonly string[],
  });
  
  return result;
};

// ============================================================
// UPDATE EMAIL STATUS
// ============================================================
export const updateEmailStatus = async (
  submissionId: string,
  sent: boolean,
  error?: string
): Promise<void> => {
  const updates: string[] = ['email_sent = $1'];
  const values: unknown[] = [sent];
  let paramIndex = 2;

  if (sent) {
    updates.push(`email_sent_at = CURRENT_TIMESTAMP`);
  }

  if (error) {
    updates.push(`email_error = $${paramIndex}`);
    values.push(error);
    paramIndex++;
  }

  values.push(submissionId);

  await query(
    `UPDATE station_requirements 
     SET ${updates.join(', ')}
     WHERE id = $${paramIndex}`,
    values
  );
};


// services/stationrequirements.service.ts

// Add this new function
// ============================================================
// GET MY SUBMISSIONS (DRs only - sees own drafts and submitted)
// ============================================================
export const getMySubmissions = async (
  queryParams: GetSubmissionsQuery & { submittedBy: string }
): Promise<{ submissions: StationRequirementSummary[]; total: number }> => {
  const {
    station,
    status,
    reviewStatus,
    fromDate,
    toDate,
    page = 1,
    limit = 20,
    sortBy = 'updatedAt',
    sortOrder = 'desc',
    submittedBy,
  } = queryParams;

  const validPage = Math.max(1, page);
  const validLimit = Math.min(100, Math.max(1, limit));

  const conditions: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  // Always filter by submitted_by (DR's own submissions)
  conditions.push(`submitted_by = $${paramIndex}`);
  values.push(submittedBy);
  paramIndex++;

  if (station) {
    conditions.push(`station ILIKE $${paramIndex}`);
    values.push(`%${station}%`);
    paramIndex++;
  }

  if (status) {
    conditions.push(`status = $${paramIndex}`);
    values.push(status);
    paramIndex++;
  }

  if (reviewStatus) {
    conditions.push(`review_status = $${paramIndex}`);
    values.push(reviewStatus);
    paramIndex++;
  }

  if (fromDate) {
    conditions.push(`submitted_at >= $${paramIndex}`);
    values.push(fromDate);
    paramIndex++;
  }

  if (toDate) {
    conditions.push(`submitted_at <= $${paramIndex}`);
    values.push(toDate);
    paramIndex++;
  }

  // DRs see both drafts and submitted - no status filter unless specified

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const offset = (validPage - 1) * validLimit;

  const sortColumnMap: Record<string, string> = {
    updatedAt: 'updated_at',
    submittedAt: 'submitted_at',
    station: 'station',
  };
  const sortColumn = sortColumnMap[sortBy] || 'updated_at';
  const sortDirection = sortOrder === 'asc' ? 'ASC' : 'DESC';

  const countResult = await query(
    `SELECT COUNT(*) as total FROM station_requirements ${whereClause}`,
    values
  );

  const total = parseInt((countResult.rows[0]?.total as string) || '0', 10);

  const result = await query(
    `SELECT 
       id,
       station,
       status,
       submitted_at,
       updated_at,
       review_status,
       submitter_name,
       COALESCE(
         (SELECT SUM((value->>'quantity')::int) FROM jsonb_array_elements(file_folders) AS value),
         0
       ) as file_folders_total,
       COALESCE(
         (SELECT SUM((value->>'quantity')::int) FROM jsonb_array_elements(registers) AS value),
         0
       ) as registers_total
     FROM station_requirements
     ${whereClause}
     ORDER BY ${sortColumn} ${sortDirection}
     LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
    [...values, validLimit, offset]
  );

  const submissions = result.rows.map(mapSummaryRow);

  return { submissions, total };
};


// services/stationrequirements.service.ts

// Add this new function to get station submission status from users table
export const getStationSubmissionStatusFromUsers = async (): Promise<{
  stations: Array<{
    station: string;
    assignedDR: string;
    assignedDRName: string;
    assignedDREmail: string;
    status: 'not_started' | 'in_progress' | 'submitted' | 'pending_review' | 'approved' | 'needs_revision';
    lastUpdatedAt?: string;
    submittedAt?: string;
    hasDraft: boolean;
    hasSubmitted: boolean;
    fileFoldersTotal: number;
    registersTotal: number;
  }>;
  summary: {
    totalStations: number;
    notStarted: number;
    inProgress: number;
    submitted: number;
    pendingReview: number;
    approved: number;
    needsRevision: number;
  };
}> => {
  // Get all DRs with their stations from users table
  const usersResult = await query(`
    SELECT 
      id,
      full_name,
      email,
      station,
      role
    FROM users 
    WHERE role = 'dr' AND is_active = true
    ORDER BY station ASC
  `);

  if (!usersResult.rows || usersResult.rows.length === 0) {
    return {
      stations: [],
      summary: {
        totalStations: 0,
        notStarted: 0,
        inProgress: 0,
        submitted: 0,
        pendingReview: 0,
        approved: 0,
        needsRevision: 0,
      },
    };
  }

  // Get all submissions
  const submissionsResult = await query(`
    SELECT 
      station,
      status,
      review_status,
      submitted_at,
      updated_at,
      submitted_by,
      submitter_name,
      COALESCE(
        (SELECT SUM((value->>'quantity')::int) FROM jsonb_array_elements(file_folders) AS value),
        0
      ) as file_folders_total,
      COALESCE(
        (SELECT SUM((value->>'quantity')::int) FROM jsonb_array_elements(registers) AS value),
        0
      ) as registers_total
    FROM station_requirements
    ORDER BY updated_at DESC
  `);

  // Create a map of station -> latest submission
  const stationSubmissionMap: Record<string, any> = {};

  for (const row of submissionsResult.rows) {
    const station = String(row.station);
    // Only keep the latest submission for each station
    if (!stationSubmissionMap[station]) {
      stationSubmissionMap[station] = row;
    }
  }

  // Build station status list
  const stations: Array<any> = [];
  const summary = {
    totalStations: 0,
    notStarted: 0,
    inProgress: 0,
    submitted: 0,
    pendingReview: 0,
    approved: 0,
    needsRevision: 0,
  };

  for (const userRow of usersResult.rows) {
    const station = String(userRow.station);
    const submission = stationSubmissionMap[station];

    let status: any = 'not_started';
    let hasDraft = false;
    let hasSubmitted = false;
    let fileFoldersTotal = 0;
    let registersTotal = 0;
    let submittedAt: string | undefined;
    let updatedAt: string | undefined;

    if (submission) {
      const subStatus = String(submission.status);
      const reviewStatus = submission.review_status ? String(submission.review_status) : undefined;

      if (subStatus === 'draft') {
        status = 'in_progress';
        hasDraft = true;
      } else if (subStatus === 'submitted') {
        hasSubmitted = true;
        if (reviewStatus === 'approved') {
          status = 'approved';
        } else if (reviewStatus === 'needs_revision') {
          status = 'needs_revision';
        } else if (reviewStatus === 'pending' || !reviewStatus) {
          status = 'pending_review';
        } else {
          status = 'submitted';
        }
      }

      fileFoldersTotal = Number(submission.file_folders_total) || 0;
      registersTotal = Number(submission.registers_total) || 0;
      submittedAt = submission.submitted_at ? String(submission.submitted_at) : undefined;
      updatedAt = submission.updated_at ? String(submission.updated_at) : undefined;
    }

    // Update summary counts
    summary.totalStations++;
    if (status === 'not_started') summary.notStarted++;
    else if (status === 'in_progress') summary.inProgress++;
    else if (status === 'submitted') summary.submitted++;
    else if (status === 'pending_review') summary.pendingReview++;
    else if (status === 'approved') summary.approved++;
    else if (status === 'needs_revision') summary.needsRevision++;

    stations.push({
      station,
      assignedDR: String(userRow.id),
      assignedDRName: String(userRow.full_name),
      assignedDREmail: String(userRow.email),
      status,
      lastUpdatedAt: updatedAt,
      submittedAt,
      hasDraft,
      hasSubmitted,
      fileFoldersTotal,
      registersTotal,
    });
  }

  return {
    stations,
    summary,
  };
};

// Update the getStationReport function to use the new data source
export const getStationReport = async (
  queryParams: GetStationReportQuery
): Promise<StationReport> => {
  const {
    status,
    fromDate,
    toDate,
    page = 1,
    limit = 50,
  } = queryParams;

  // Use the new function that pulls from users table
  const { stations: allStations, summary } = await getStationSubmissionStatusFromUsers();

  // Apply filters
  let filteredStations = allStations;

  if (status) {
    filteredStations = filteredStations.filter(s => s.status === status);
  }

  if (fromDate) {
    filteredStations = filteredStations.filter(
      s => s.lastUpdatedAt && new Date(s.lastUpdatedAt) >= new Date(fromDate)
    );
  }

  if (toDate) {
    filteredStations = filteredStations.filter(
      s => s.lastUpdatedAt && new Date(s.lastUpdatedAt) <= new Date(toDate)
    );
  }

  // Apply pagination
  const startIndex = (page - 1) * limit;
  const paginatedStations = filteredStations.slice(startIndex, startIndex + limit);

  // Build status counts
  const statusCounts: Record<StationStatus, number> = {
    'not_started': summary.notStarted,
    'in_progress': summary.inProgress,
    'submitted': summary.submitted,
    'pending_review': summary.pendingReview,
    'approved': summary.approved,
    'needs_revision': summary.needsRevision,
  };

  return {
    totalStations: summary.totalStations,
    stationsByStatus: statusCounts,
    stations: paginatedStations.map(s => ({
      station: s.station,
      status: s.status,
      lastUpdatedAt: s.lastUpdatedAt,
      submittedAt: s.submittedAt,
      submittedBy: s.assignedDR,
      submitterName: s.assignedDRName,
      draftExists: s.hasDraft,
      hasSubmitted: s.hasSubmitted,
      progress: {
        fileFoldersComplete: s.fileFoldersTotal > 0,
        registersComplete: s.registersTotal > 0,
        percentageComplete: s.hasSubmitted ? 100 : (s.hasDraft ? 50 : 0),
      },
    })),
    summary: {
      completed: summary.approved,
      pending: summary.inProgress + summary.submitted + summary.pendingReview,
      notStarted: summary.notStarted,
      total: summary.totalStations,
      completionRate: summary.totalStations > 0 
        ? Math.round((summary.approved / summary.totalStations) * 100)
        : 0,
    },
  };
};