// services/pendingProceedings.service.ts

import { query, pool } from '../../config/db';
import { AppError } from '../../utils/Apperror';
import {
  PendingProceedingItem,
  StationRequirementSubmission,
  StationRequirementSummary,
  StationSubmissionStatus,
  StationReport,
  StationStatus,
  SubmissionStatus,
  SubmissionStats,
  ReportData,
  ReportRow,
  ReportSummary,
  CreateSubmissionInput,
  UpdateSubmissionInput,
  GetSubmissionsQuery,
  GetStationReportQuery,
  PENDING_PROCEEDINGS_CATEGORIES,
  calculateTotals,
  determineStationStatus,
  getStationProgress,
} from './pendingProceedings.types';

type DbRow = Record<string, unknown>;

// ============================================================
// Row Mappers
// ============================================================

const mapPendingProceedingItem = (row: DbRow): PendingProceedingItem => ({
  division: String(row.division),
  name: String(row.name),
  quantity: Number(row.quantity),
});

const mapPendingProceedingItems = (itemsJson: string): PendingProceedingItem[] => {
  try {
    const parsed = typeof itemsJson === 'string' ? JSON.parse(itemsJson) : itemsJson;
    if (Array.isArray(parsed)) {
      return parsed.map((item) => ({
        division: String(item.division || ''),
        name: String(item.name || ''),
        quantity: Number(item.quantity || 0),
      }));
    }
    return [];
  } catch {
    return [];
  }
};

const mapSubmissionRow = (row: DbRow): StationRequirementSubmission => ({
  id: String(row.id),
  station: String(row.station),
  courtOfAppeal: mapPendingProceedingItems(String(row.court_of_appeal)),
  subordinateCourts: mapPendingProceedingItems(String(row.subordinate_courts)),
  status: String(row.status) as SubmissionStatus,
  submittedAt: String(row.submitted_at),
  updatedAt: String(row.updated_at),
  submittedBy: row.submitted_by ? String(row.submitted_by) : undefined,
  submitterName: row.submitter_name ? String(row.submitter_name) : undefined,
  submitterEmail: row.submitter_email ? String(row.submitter_email) : undefined,
  emailSent: row.email_sent ? Boolean(row.email_sent) : undefined,
  emailSentAt: row.email_sent_at ? String(row.email_sent_at) : undefined,
  emailError: row.email_error ? String(row.email_error) : undefined,
});

const mapSummaryRow = (row: DbRow): StationRequirementSummary => ({
  id: String(row.id),
  station: String(row.station),
  courtOfAppealTotal: Number(row.court_of_appeal_total || 0),
  subordinateCourtsTotal: Number(row.subordinate_courts_total || 0),
  status: String(row.status) as SubmissionStatus,
  submittedAt: String(row.submitted_at),
  updatedAt: String(row.updated_at),
  submitterName: row.submitter_name ? String(row.submitter_name) : undefined,
});

// ============================================================
// Helper Functions
// ============================================================

const getStationList = async (): Promise<string[]> => {
  const result = await query(`SELECT DISTINCT station FROM pending_proceedings_submissions ORDER BY station`);
  if (result.rows.length === 0) {
    // If no submissions exist, return default stations
    // In production, this would come from a stations table
    return ['Station 1', 'Station 2', 'Station 3'];
  }
  return result.rows.map((row) => String(row.station));
};

const getLatestSubmissionForStation = async (
  station: string
): Promise<StationRequirementSubmission | null> => {
  const result = await query(
    `SELECT * FROM pending_proceedings_submissions 
     WHERE station = $1 
     ORDER BY updated_at DESC 
     LIMIT 1`,
    [station]
  );
  if (!result.rows.length) return null;
  return mapSubmissionRow(result.rows[0]);
};

// ============================================================
// CREATE SUBMISSION
// ============================================================

export const createSubmission = async (
  input: CreateSubmissionInput
): Promise<StationRequirementSubmission> => {
  const { station, courtOfAppeal, subordinateCourts } = input;

  if (!station?.trim()) {
    throw new AppError('Station is required', 400);
  }

  // Check if station already has a submission
  const existing = await getLatestSubmissionForStation(station);
  if (existing) {
    throw new AppError(`Station "${station}" already has a submission. Use update instead.`, 409);
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const result = await client.query(
      `INSERT INTO pending_proceedings_submissions 
       (station, court_of_appeal, subordinate_courts, status, submitted_at, updated_at)
       VALUES ($1, $2, $3, 'submitted', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       RETURNING *`,
      [station, JSON.stringify(courtOfAppeal), JSON.stringify(subordinateCourts)]
    );

    await client.query('COMMIT');
    return mapSubmissionRow(result.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

// ============================================================
// UPDATE SUBMISSION
// ============================================================

export const updateSubmission = async (
  id: string,
  input: UpdateSubmissionInput
): Promise<StationRequirementSubmission> => {
  if (!id?.trim()) {
    throw new AppError('Valid submission ID is required', 400);
  }

  const current = await getSubmissionById(id);

  const updates: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (input.station) {
    updates.push(`station = $${paramIndex}`);
    values.push(input.station);
    paramIndex++;
  }
  if (input.courtOfAppeal) {
    updates.push(`court_of_appeal = $${paramIndex}`);
    values.push(JSON.stringify(input.courtOfAppeal));
    paramIndex++;
  }
  if (input.subordinateCourts) {
    updates.push(`subordinate_courts = $${paramIndex}`);
    values.push(JSON.stringify(input.subordinateCourts));
    paramIndex++;
  }

  if (!updates.length) {
    throw new AppError('No fields to update', 400);
  }

  updates.push(`updated_at = CURRENT_TIMESTAMP`);

  values.push(id);
  const result = await query(
    `UPDATE pending_proceedings_submissions 
     SET ${updates.join(', ')} 
     WHERE id = $${paramIndex} 
     RETURNING *`,
    values
  );

  if (!result.rows.length) {
    throw new AppError('Submission not found', 404);
  }

  return mapSubmissionRow(result.rows[0]);
};

// ============================================================
// GET SUBMISSION BY ID
// ============================================================

export const getSubmissionById = async (id: string): Promise<StationRequirementSubmission> => {
  if (!id?.trim()) {
    throw new AppError('Valid submission ID is required', 400);
  }

  const result = await query(`SELECT * FROM pending_proceedings_submissions WHERE id = $1`, [id.trim()]);
  if (!result.rows.length) {
    throw new AppError('Submission not found', 404);
  }

  return mapSubmissionRow(result.rows[0]);
};

// ============================================================
// GET SUBMISSIONS (List)
// ============================================================

export const getSubmissions = async (
  queryParams: GetSubmissionsQuery
): Promise<{
  submissions: StationRequirementSummary[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}> => {
  const { station, fromDate, toDate, page = 1, limit = 20, sortBy = 'updatedAt', sortOrder = 'desc' } = queryParams;

  const conditions: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (station) {
    conditions.push(`station = $${paramIndex}`);
    values.push(station);
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

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const offset = (page - 1) * limit;

  const sortColumnMap: Record<NonNullable<GetSubmissionsQuery['sortBy']>, string> = {
    updatedAt: 'updated_at',
    submittedAt: 'submitted_at',
    station: 'station',
  };
  const sortColumn = sortColumnMap[sortBy] ?? 'updated_at';
  const sortDirection = sortOrder === 'asc' ? 'ASC' : 'DESC';

  const countResult = await query(
    `SELECT COUNT(*) as total FROM pending_proceedings_submissions ${whereClause}`,
    values
  );
  const total = parseInt(String(countResult.rows[0]?.total ?? '0'), 10);

  const result = await query(
    `SELECT 
       id, station, status, submitted_at, updated_at, submitter_name,
       (SELECT COALESCE(SUM((value->>'quantity')::int), 0) 
        FROM jsonb_array_elements(court_of_appeal) AS value) as court_of_appeal_total,
       (SELECT COALESCE(SUM((value->>'quantity')::int), 0) 
        FROM jsonb_array_elements(subordinate_courts) AS value) as subordinate_courts_total
     FROM pending_proceedings_submissions 
     ${whereClause} 
     ORDER BY ${sortColumn} ${sortDirection} 
     LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
    [...values, limit, offset]
  );

  const submissions = result.rows.map(mapSummaryRow);

  return {
    submissions,
    total,
    page,
    limit,
    hasMore: page * limit < total,
  };
};

// ============================================================
// DELETE SUBMISSION
// ============================================================

export const deleteSubmission = async (id: string): Promise<void> => {
  if (!id?.trim()) {
    throw new AppError('Valid submission ID is required', 400);
  }

  const result = await query(`DELETE FROM pending_proceedings_submissions WHERE id = $1`, [id.trim()]);
  if (!result.rowCount) {
    throw new AppError('Submission not found', 404);
  }
};

// ============================================================
// GET STATION REPORT
// ============================================================

export const getStationReport = async (
  queryParams: GetStationReportQuery
): Promise<{ report: StationReport; total: number; page: number; limit: number; hasMore: boolean }> => {
  const { status, fromDate, toDate, page = 1, limit = 20 } = queryParams;
  const offset = (page - 1) * limit;

  // Get all stations (from submissions table)
  const allStations = await getStationList();

  // Get submissions with optional filters
  const conditions: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

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

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  // Get latest submission per station
  const submissionsResult = await query(
    `SELECT DISTINCT ON (station) * 
     FROM pending_proceedings_submissions 
     ${whereClause}
     ORDER BY station, updated_at DESC`,
    values
  );

  const submissions = submissionsResult.rows.map(mapSubmissionRow);

  // Build station status objects
  let stationStatuses: StationSubmissionStatus[] = [];

  // Filter by status if provided
  let filteredSubmissions = submissions;
  if (status) {
    filteredSubmissions = submissions.filter((sub) => determineStationStatus(sub) === status);
  }

  for (const station of allStations) {
    const submission = submissions.find((s) => s.station === station);
    const subStatus = determineStationStatus(submission);

    // Skip if status filter doesn't match
    if (status && subStatus !== status) continue;

    const progress = getStationProgress(submission);

    stationStatuses.push({
      station,
      status: subStatus,
      lastUpdatedAt: submission?.updatedAt,
      submittedAt: submission?.submittedAt,
      submittedBy: submission?.submittedBy,
      submitterName: submission?.submitterName,
      hasSubmitted: !!submission,
      progress,
    });
  }

  // Paginate
  const total = stationStatuses.length;
  stationStatuses = stationStatuses.slice(offset, offset + limit);

  // Calculate summary
  const statusCounts: Record<StationStatus, number> = {
    not_started: 0,
    submitted: 0,
  };

  for (const ss of stationStatuses) {
    statusCounts[ss.status] = (statusCounts[ss.status] || 0) + 1;
  }

  // Calculate counts for all stations (not just paginated)
  const allStatusCounts: Record<StationStatus, number> = {
    not_started: 0,
    submitted: 0,
  };

  for (const station of allStations) {
    const submission = submissions.find((s) => s.station === station);
    const subStatus = determineStationStatus(submission);
    allStatusCounts[subStatus] = (allStatusCounts[subStatus] || 0) + 1;
  }

  const report: StationReport = {
    totalStations: allStations.length,
    stationsByStatus: allStatusCounts,
    stations: stationStatuses,
    summary: {
      completed: allStatusCounts.submitted || 0,
      notStarted: allStatusCounts.not_started || 0,
      total: allStations.length,
      completionRate: allStations.length > 0 ? Math.round((allStatusCounts.submitted / allStations.length) * 100) : 0,
    },
  };

  return {
    report,
    total,
    page,
    limit,
    hasMore: page * limit < total,
  };
};

// ============================================================
// GET SUBMISSION STATS
// ============================================================

export const getSubmissionStats = async (): Promise<SubmissionStats> => {
  const allStations = await getStationList();

  // Get latest submission per station
  const result = await query(
    `SELECT DISTINCT ON (station) * FROM pending_proceedings_submissions ORDER BY station, updated_at DESC`
  );

  const submissions = result.rows.map(mapSubmissionRow);

  let submitted = 0;
  let notStarted = 0;

  for (const station of allStations) {
    const submission = submissions.find((s) => s.station === station);
    if (submission) {
      submitted++;
    } else {
      notStarted++;
    }
  }

  return {
    totalStations: allStations.length,
    submitted,
    notSubmitted: notStarted,
    notStarted,
  };
};

// ============================================================
// ADMIN DASHBOARD
// ============================================================

export const getAdminDashboardStats = async (): Promise<{
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
}> => {
  const stats = await getSubmissionStats();

  // Get today's submissions
  const todayResult = await query(
    `SELECT COUNT(*) as count FROM pending_proceedings_submissions 
     WHERE submitted_at::date = CURRENT_DATE`
  );
  const submissionsToday = parseInt(String(todayResult.rows[0]?.count ?? '0'), 10);

  // Get recent activity
  const recentResult = await query(
    `SELECT id, station, 'submitted' as action, submitted_at as timestamp, 
            COALESCE(submitter_name, 'Unknown') as user
     FROM pending_proceedings_submissions 
     ORDER BY submitted_at DESC 
     LIMIT 10`
  );

  const recentActivity = recentResult.rows.map((row) => ({
    id: String(row.id),
    station: String(row.station),
    action: 'submitted' as const,
    timestamp: String(row.timestamp),
    user: String(row.user),
  }));

  return {
    totalStations: stats.totalStations,
    submissionsToday,
    submittedCount: stats.submitted,
    notStartedCount: stats.notStarted,
    completionRate: stats.totalStations > 0 ? Math.round((stats.submitted / stats.totalStations) * 100) : 0,
    recentActivity,
  };
};

// ============================================================
// DOWNLOAD REPORT
// ============================================================

export const generateReportData = async (
  fromDate?: string,
  toDate?: string
): Promise<ReportData> => {
  const conditions: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

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

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  // Get latest submission per station
  const result = await query(
    `SELECT DISTINCT ON (station) 
       id, station, court_of_appeal, subordinate_courts, status, 
       submitted_at, updated_at, submitter_name, submitter_email,
       (SELECT COALESCE(SUM((value->>'quantity')::int), 0) 
        FROM jsonb_array_elements(court_of_appeal) AS value) as court_of_appeal_total,
       (SELECT COALESCE(SUM((value->>'quantity')::int), 0) 
        FROM jsonb_array_elements(subordinate_courts) AS value) as subordinate_courts_total
     FROM pending_proceedings_submissions 
     ${whereClause}
     ORDER BY station, updated_at DESC`,
    values
  );

  const submissions = result.rows.map((row) => {
    const sub = mapSubmissionRow(row);
    const totals = calculateTotals(sub);
    return {
      ...sub,
      courtOfAppealTotal: Number(row.court_of_appeal_total || 0),
      subordinateCourtsTotal: Number(row.subordinate_courts_total || 0),
      totalItems: totals.totalItems,
    };
  });

  // Get all stations
  const allStations = await getStationList();

  const rows: ReportRow[] = [];
  let totalCourtOfAppeal = 0;
  let totalSubordinateCourts = 0;

  for (const station of allStations) {
    const sub = submissions.find((s) => s.station === station);
    const hasSubmitted = !!sub;

    if (sub) {
      totalCourtOfAppeal += sub.courtOfAppealTotal;
      totalSubordinateCourts += sub.subordinateCourtsTotal;
    }

    rows.push({
      'Station': station,
      'Assigned DR': sub?.submitterName || 'Not Assigned',
      'DR Email': sub?.submitterEmail || 'Not Provided',
      'Submission Status': hasSubmitted ? 'Submitted' : 'Not Submitted',
      'Court of Appeal Items': sub?.courtOfAppealTotal || 0,
      'Subordinate Courts Items': sub?.subordinateCourtsTotal || 0,
      'Total Items': sub?.totalItems || 0,
      'Submitted At': sub?.submittedAt || 'N/A',
      'Last Updated': sub?.updatedAt || 'N/A',
    });
  }

  const summary: ReportSummary = {
    totalStations: allStations.length,
    submitted: submissions.length,
    notSubmitted: allStations.length - submissions.length,
    totalCourtOfAppeal,
    totalSubordinateCourts,
    completionRate: allStations.length > 0 ? Math.round((submissions.length / allStations.length) * 100) : 0,
  };

  return { rows, summary };
};

// ============================================================
// VALIDATION HELPERS
// ============================================================

export const validateProceedingItems = (
  items: PendingProceedingItem[],
  category: string
): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];
  const validCategories = Object.keys(PENDING_PROCEEDINGS_CATEGORIES);

  if (!validCategories.includes(category)) {
    errors.push(`Invalid category: "${category}". Must be one of: ${validCategories.join(', ')}`);
    return { valid: false, errors };
  }

  const validNames = PENDING_PROCEEDINGS_CATEGORIES[category as keyof typeof PENDING_PROCEEDINGS_CATEGORIES];

  for (const item of items) {
    if (!item.division?.trim()) {
      errors.push(`Division is required for item "${item.name}"`);
    }
    if (!item.name?.trim()) {
      errors.push(`Name is required for item in division "${item.division}"`);
    }
    if (!validNames.includes(item.name as any)) {
      errors.push(`Invalid name "${item.name}" for category "${category}". Must be one of: ${validNames.join(', ')}`);
    }
    if (item.quantity < 0) {
      errors.push(`Quantity must be 0 or greater for item "${item.name}"`);
    }
  }

  return { valid: errors.length === 0, errors };
};

// ============================================================
// EXPORT
// ============================================================

export default {
  createSubmission,
  updateSubmission,
  getSubmissionById,
  getSubmissions,
  deleteSubmission,
  getStationReport,
  getSubmissionStats,
  getAdminDashboardStats,
  generateReportData,
  validateProceedingItems,
};