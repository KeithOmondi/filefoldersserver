// services/stationrequirements.service.ts
import { query } from '../../config/db';
import { AppError } from '../../utils/Apperror';
import {
  StationRequirementSubmission,
  StationRequirementSummary,
  StationRequirementItem,
  CreateSubmissionInput,
  GetSubmissionsQuery,
} from './stationrequirements.types';

// Type for database row
type DbRow = Record<string, unknown>;

// ============================================================
// FIXED: Map database row to StationRequirementSubmission with submitter details
// ============================================================
const mapSubmissionRow = (row: DbRow): StationRequirementSubmission => {
  // Log the row for debugging
  console.log('🔍 Mapping database row:', JSON.stringify(row, null, 2));
  
  // Check if row exists
  if (!row) {
    throw new AppError('No data returned from database', 500);
  }

  // Extract and validate required fields
  const id = row.id ? String(row.id).trim() : '';
  const station = row.station ? String(row.station).trim() : '';
  const quarter = row.quarter ? String(row.quarter).trim() : '';
  const submittedAt = row.submitted_at ? String(row.submitted_at).trim() : '';

  // Validate required fields exist and are not empty
  if (!id) {
    console.error('Missing or invalid id in row:', row);
    throw new AppError('Invalid submission data: missing id', 500);
  }
  if (!station) {
    console.error('Missing or invalid station in row:', row);
    throw new AppError('Invalid submission data: missing station', 500);
  }
  if (!quarter) {
    console.error('Missing or invalid quarter in row:', row);
    throw new AppError('Invalid submission data: missing quarter', 500);
  }
  if (!submittedAt) {
    console.error('Missing or invalid submitted_at in row:', row);
    throw new AppError('Invalid submission data: missing submitted_at', 500);
  }

  // Parse file_folders - handle both JSON string and parsed array
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

  // Parse registers - handle both JSON string and parsed array
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

  // Ensure fileFolders and registers are arrays
  if (!Array.isArray(fileFolders)) {
    console.warn('fileFolders is not an array, converting to empty array');
    fileFolders = [];
  }
  if (!Array.isArray(registers)) {
    console.warn('registers is not an array, converting to empty array');
    registers = [];
  }

  // Return the mapped submission with submitter details
  return {
    id,
    station,
    quarter,
    fileFolders,
    registers,
    submittedAt,
    submittedBy: row.submitted_by ? String(row.submitted_by) : undefined,
    submitterName: row.submitter_name ? String(row.submitter_name) : undefined,
    submitterEmail: row.submitter_email ? String(row.submitter_email) : undefined,
  };
};

// ============================================================
// FIXED: Map database row to StationRequirementSummary with ID
// ============================================================
const mapSummaryRow = (row: DbRow): StationRequirementSummary => {
  return {
    id: row.id ? String(row.id) : undefined,
    station: row.station ? String(row.station) : '',
    quarter: row.quarter ? String(row.quarter) : '',
    fileFoldersTotal: Number(row.file_folders_total) || 0,
    registersTotal: Number(row.registers_total) || 0,
    submittedAt: row.submitted_at ? String(row.submitted_at) : new Date().toISOString(),
  };
};

// ============================================================
// Validate input items
// ============================================================
const validateItems = (items: StationRequirementItem[], type: string): void => {
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
    if (typeof item.quantity !== 'number' || isNaN(item.quantity) || item.quantity < 0) {
      throw new AppError(`${type}[${index}]: quantity must be a valid number >= 0`, 400);
    }
  });
};

// ============================================================
// CREATE SUBMISSION
// ============================================================
export const createSubmission = async (
  input: CreateSubmissionInput,
  userId?: string
): Promise<StationRequirementSubmission> => {
  console.log('🔍 [Service] createSubmission called with:', {
    station: input.station,
    quarter: input.quarter,
    fileFoldersCount: input.fileFolders?.length || 0,
    registersCount: input.registers?.length || 0,
    userId,
  });

  if (!input) {
    throw new AppError('No input data provided', 400);
  }

  if (!input.station || typeof input.station !== 'string' || input.station.trim() === '') {
    throw new AppError('Station name is required', 400);
  }

  if (!input.quarter || typeof input.quarter !== 'string' || input.quarter.trim() === '') {
    throw new AppError('Quarter is required', 400);
  }

  const fileFolders = input.fileFolders || [];
  const registers = input.registers || [];

  validateItems(fileFolders, 'fileFolders');
  validateItems(registers, 'registers');

  const hasValidItem = (items: StationRequirementItem[]): boolean => {
    return items.some(item => item.quantity > 0);
  };

  if (!hasValidItem(fileFolders) && !hasValidItem(registers)) {
    throw new AppError('At least one item with quantity greater than 0 is required', 400);
  }

  const cleanFileFolders = fileFolders.map(item => ({
    division: item.division.trim(),
    name: item.name.trim(),
    quantity: item.quantity,
  }));

  const cleanRegisters = registers.map(item => ({
    division: item.division.trim(),
    name: item.name.trim(),
    quantity: item.quantity,
  }));

  console.log('🔍 [Service] Inserting into database:', {
    station: input.station.trim(),
    quarter: input.quarter.trim(),
    fileFoldersCount: cleanFileFolders.length,
    registersCount: cleanRegisters.length,
  });

  const result = await query(
    `INSERT INTO station_requirements (station, quarter, file_folders, registers, submitted_by)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [
      input.station.trim(),
      input.quarter.trim(),
      JSON.stringify(cleanFileFolders),
      JSON.stringify(cleanRegisters),
      userId || null,
    ]
  );

  if (!result.rows || result.rows.length === 0) {
    throw new AppError('Failed to create submission', 500);
  }

  console.log('✅ [Service] Submission created successfully:', {
    id: result.rows[0].id,
    station: result.rows[0].station,
  });

  return mapSubmissionRow(result.rows[0]);
};

// ============================================================
// GET SUBMISSIONS
// ============================================================
export const getSubmissions = async (
  queryParams: GetSubmissionsQuery
): Promise<{ submissions: StationRequirementSummary[]; total: number }> => {
  const {
    station,
    quarter,
    fromDate,
    toDate,
    page = 1,
    limit = 20,
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

  if (quarter) {
    conditions.push(`quarter = $${paramIndex}`);
    values.push(quarter);
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

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const offset = (validPage - 1) * validLimit;

  const countResult = await query(
    `SELECT COUNT(*) as total FROM station_requirements ${whereClause}`,
    values
  );

  const total = parseInt((countResult.rows[0]?.total as string) || '0', 10);

  const result = await query(
    `SELECT 
       id,
       station,
       quarter,
       submitted_at,
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
     ORDER BY submitted_at DESC
     LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
    [...values, validLimit, offset]
  );

  const submissions = result.rows.map(mapSummaryRow);

  return { submissions, total };
};

// ============================================================
// GET SUBMISSION BY ID - Include user details
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
// GET SUBMISSIONS BY STATION
// ============================================================
export const getSubmissionsByStation = async (
  station: string,
  quarter?: string
): Promise<StationRequirementSubmission[]> => {
  if (!station || typeof station !== 'string' || station.trim() === '') {
    throw new AppError('Valid station name is required', 400);
  }

  let queryText = 'SELECT * FROM station_requirements WHERE station ILIKE $1';
  const values: unknown[] = [`%${station.trim()}%`];

  if (quarter) {
    queryText += ' AND quarter = $2';
    values.push(quarter);
  }

  queryText += ' ORDER BY submitted_at DESC';

  const result = await query(queryText, values);
  return result.rows.map(mapSubmissionRow);
};

// ============================================================
// UPDATE SUBMISSION
// ============================================================
export const updateSubmission = async (
  id: string,
  input: Partial<CreateSubmissionInput>,
  userId?: string
): Promise<StationRequirementSubmission> => {
  if (!id || typeof id !== 'string' || id.trim() === '') {
    throw new AppError('Valid submission ID is required', 400);
  }

  await getSubmissionById(id);

  const updates: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (input.station) {
    updates.push(`station = $${paramIndex}`);
    values.push(input.station.trim());
    paramIndex++;
  }

  if (input.quarter) {
    updates.push(`quarter = $${paramIndex}`);
    values.push(input.quarter.trim());
    paramIndex++;
  }

  if (input.fileFolders) {
    const fileFolders = input.fileFolders;
    validateItems(fileFolders, 'fileFolders');
    updates.push(`file_folders = $${paramIndex}`);
    values.push(JSON.stringify(fileFolders));
    paramIndex++;
  }

  if (input.registers) {
    const registers = input.registers;
    validateItems(registers, 'registers');
    updates.push(`registers = $${paramIndex}`);
    values.push(JSON.stringify(registers));
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
// GET SUBMISSION TOTALS
// ============================================================
export const getSubmissionTotals = async (): Promise<{
  totalSubmissions: number;
  totalFileFolders: number;
  totalRegisters: number;
  uniqueStations: number;
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
      COUNT(DISTINCT station) as unique_stations
    FROM station_requirements
  `);

  if (!result.rows || result.rows.length === 0) {
    return {
      totalSubmissions: 0,
      totalFileFolders: 0,
      totalRegisters: 0,
      uniqueStations: 0,
    };
  }

  const row = result.rows[0];
  return {
    totalSubmissions: parseInt((row.total_submissions as string) || '0', 10),
    totalFileFolders: parseInt((row.total_file_folders as string) || '0', 10),
    totalRegisters: parseInt((row.total_registers as string) || '0', 10),
    uniqueStations: parseInt((row.unique_stations as string) || '0', 10),
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
// GET UNIQUE QUARTERS
// ============================================================
export const getUniqueQuarters = async (): Promise<string[]> => {
  const result = await query(
    'SELECT DISTINCT quarter FROM station_requirements ORDER BY quarter DESC'
  );

  if (!result.rows) {
    return [];
  }

  return result.rows.map((row) => row.quarter as string).filter(Boolean);
};