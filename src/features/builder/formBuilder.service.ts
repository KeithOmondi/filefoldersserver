// services/formBuilder.service.ts

import { query } from '../../config/db';
import { AppError } from '../../utils/Apperror';
import {
  DynamicForm,
  FormSection,
  FormSettings,
  FormSubmission,
  SectionResponse,
  QuestionResponse,
  FormsListResponse,
  SubmissionsListResponse,
  createSection,
  generateId,
  Question,
  FormTemplate,
  FORM_TEMPLATES,
  createQuestion,
  CreateQuestionInput,
  CreateSectionInput,
  FormAnalytics,
  QuestionAnalytics,
  ExportResponse,
} from './adminFormBuilder.types';
import {
  validateResponseAgainstForm,
  CreateFormPayload,
  UpdateFormPayload,
  SubmitFormResponsePayload,
  GetFormsQuery,
  GetFormSubmissionsQuery,
  ReviewFormSubmissionPayload,
} from './formBuilder.validation';

// ============================================================
// Type for database row
// ============================================================
type DbRow = Record<string, unknown>;

// ============================================================
// Map database row to DynamicForm
// ============================================================
const mapFormRow = (row: DbRow): DynamicForm => {
  let sections: FormSection[] = [];
  try {
    if (row.sections) {
      sections = typeof row.sections === 'string' ? JSON.parse(row.sections) : (row.sections as FormSection[]);
    }
  } catch (error) {
    console.error('Error parsing sections:', error);
    sections = [];
  }

  let settings: FormSettings;
  try {
    settings = typeof row.settings === 'string' ? JSON.parse(row.settings) : (row.settings as FormSettings);
  } catch (error) {
    console.error('Error parsing settings:', error);
    settings = {} as FormSettings;
  }

  return {
    id: String(row.id),
    title: String(row.title),
    description: row.description ? String(row.description) : undefined,
    sections,
    settings,
    status: String(row.status) as DynamicForm['status'],
    createdBy: String(row.created_by),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    publishedAt: row.published_at ? String(row.published_at) : undefined,
    closedAt: row.closed_at ? String(row.closed_at) : undefined,
    responseCount: Number(row.response_count ?? 0),
    averageTimeToComplete: row.average_time_to_complete !== undefined && row.average_time_to_complete !== null
      ? Number(row.average_time_to_complete)
      : undefined,
    tags: Array.isArray(row.tags) ? (row.tags as string[]) : undefined,
    collaborators: Array.isArray(row.collaborators) ? (row.collaborators as string[]) : undefined,
  };
};

// ============================================================
// Map database row to FormSubmission
// ============================================================
const mapSubmissionRow = (row: DbRow): FormSubmission => {
  let sections: SectionResponse[] = [];
  try {
    if (row.sections) {
      sections = typeof row.sections === 'string' ? JSON.parse(row.sections) : (row.sections as SectionResponse[]);
    }
  } catch (error) {
    console.error('Error parsing submission sections:', error);
    sections = [];
  }

  let correctAnswers: FormSubmission['correctAnswers'];
  try {
    if (row.correct_answers) {
      correctAnswers = typeof row.correct_answers === 'string' ? JSON.parse(row.correct_answers) : (row.correct_answers as FormSubmission['correctAnswers']);
    }
  } catch (error) {
    console.error('Error parsing correct_answers:', error);
  }

  let location: FormSubmission['location'];
  try {
    if (row.location) {
      location = typeof row.location === 'string' ? JSON.parse(row.location) : (row.location as FormSubmission['location']);
    }
  } catch (error) {
    console.error('Error parsing location:', error);
  }

  return {
    id: String(row.id),
    formId: String(row.form_id),
    formTitle: String(row.form_title),
    submissionId: String(row.submission_id),
    respondentId: row.respondent_id ? String(row.respondent_id) : undefined,
    respondentEmail: row.respondent_email ? String(row.respondent_email) : undefined,
    respondentName: row.respondent_name ? String(row.respondent_name) : undefined,
    isLoggedIn: Boolean(row.is_logged_in),
    sections,
    totalTimeSpent: row.total_time_spent !== undefined && row.total_time_spent !== null ? Number(row.total_time_spent) : undefined,
    status: String(row.status) as FormSubmission['status'],
    submittedAt: row.submitted_at ? String(row.submitted_at) : undefined,
    updatedAt: String(row.updated_at),
    score: row.score !== undefined && row.score !== null ? Number(row.score) : undefined,
    maxScore: row.max_score !== undefined && row.max_score !== null ? Number(row.max_score) : undefined,
    passed: row.passed !== undefined && row.passed !== null ? Boolean(row.passed) : undefined,
    gradedBy: row.graded_by ? String(row.graded_by) : undefined,
    gradedAt: row.graded_at ? String(row.graded_at) : undefined,
    feedback: row.feedback ? String(row.feedback) : undefined,
    correctAnswers,
    ipAddress: row.ip_address ? String(row.ip_address) : undefined,
    userAgent: row.user_agent ? String(row.user_agent) : undefined,
    location,
  };
};

// ============================================================
// Helper: generate a short, human-shareable submission reference
// ============================================================
const generateSubmissionId = (): string =>
  `SUB-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

// ============================================================
// CREATE FORM
// ============================================================
export const createForm = async (
  input: CreateFormPayload,
  userId: string
): Promise<DynamicForm> => {
  if (!userId) {
    throw new AppError('User not authenticated', 401);
  }

  const { title, description, sections, settings } = input;

  for (const section of sections) {
    if (!section.questions || section.questions.length === 0) {
      throw new AppError(`Section "${section.title}" must have at least one question`, 400);
    }
  }

  const sectionsWithIds = sections.map(createSection);

  const result = await query(
    `INSERT INTO dynamic_forms (
       title, description, sections, settings, status, created_by, response_count
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [
      title.trim(),
      description?.trim() || null,
      JSON.stringify(sectionsWithIds),
      JSON.stringify(settings || {}),
      'draft',
      userId,
      0,
    ]
  );

  if (!result.rows || result.rows.length === 0) {
    throw new AppError('Failed to create form', 500);
  }

  return mapFormRow(result.rows[0]);
};

// ============================================================
// GET FORMS
// ============================================================
export const getForms = async (queryParams: GetFormsQuery): Promise<FormsListResponse> => {
  const { status, search, tags, page, limit, sortBy, sortOrder } = queryParams;

  const validPage = Math.max(1, page);
  const validLimit = Math.min(100, Math.max(1, limit));

  const conditions: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (status) {
    conditions.push(`status = $${paramIndex}`);
    values.push(status);
    paramIndex++;
  }

  if (search) {
    conditions.push(`(title ILIKE $${paramIndex} OR description ILIKE $${paramIndex})`);
    values.push(`%${search}%`);
    paramIndex++;
  }

  if (tags && tags.length > 0) {
    conditions.push(`tags && $${paramIndex}::text[]`);
    values.push(tags);
    paramIndex++;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const offset = (validPage - 1) * validLimit;

  const sortColumnMap: Record<GetFormsQuery['sortBy'], string> = {
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    title: 'title',
    status: 'status',
    responseCount: 'response_count',
  };
  const sortColumn = sortColumnMap[sortBy] || 'created_at';
  const sortDirection = sortOrder === 'asc' ? 'ASC' : 'DESC';

  const countResult = await query(`SELECT COUNT(*) as total FROM dynamic_forms ${whereClause}`, values);
  const total = parseInt((countResult.rows[0]?.total as string) || '0', 10);

  const result = await query(
    `SELECT *
     FROM dynamic_forms
     ${whereClause}
     ORDER BY ${sortColumn} ${sortDirection}
     LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
    [...values, validLimit, offset]
  );

  const forms = result.rows.map(mapFormRow);

  return {
    forms,
    total,
    page: validPage,
    limit: validLimit,
    hasMore: validPage * validLimit < total,
  };
};

// ============================================================
// GET FORM BY ID
// ============================================================
export const getFormById = async (id: string): Promise<DynamicForm> => {
  if (!id || typeof id !== 'string' || id.trim() === '') {
    throw new AppError('Valid form ID is required', 400);
  }

  const result = await query(`SELECT * FROM dynamic_forms WHERE id = $1`, [id.trim()]);

  if (!result.rows || result.rows.length === 0) {
    throw new AppError('Form not found', 404);
  }

  return mapFormRow(result.rows[0]);
};

// ============================================================
// UPDATE FORM
// ============================================================
export const updateForm = async (
  id: string,
  input: UpdateFormPayload,
  userId: string
): Promise<DynamicForm> => {
  if (!userId) {
    throw new AppError('User not authenticated', 401);
  }

  const currentForm = await getFormById(id);

  const updates: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (input.title) {
    updates.push(`title = $${paramIndex}`);
    values.push(input.title.trim());
    paramIndex++;
  }

  if (input.description !== undefined) {
    updates.push(`description = $${paramIndex}`);
    values.push(input.description?.trim() || null);
    paramIndex++;
  }

  if (input.sections) {
    for (const section of input.sections) {
      if (!section.questions || section.questions.length === 0) {
        throw new AppError(`Section "${section.title}" must have at least one question`, 400);
      }
    }

    const sectionsWithIds: FormSection[] = input.sections.map((section, index) => {
      const existingSection = currentForm.sections.find(s => s.title === section.title);
      const sectionId = existingSection?.id || generateId();

      return {
        ...section,
        id: sectionId,
        questions: section.questions.map((question, questionIndex) => {
          const existingQuestion = existingSection?.questions.find(
            q => q.title === question.title && q.type === question.type
          );
          const questionId = existingQuestion?.id || generateId();
          return {
            ...question,
            id: questionId,
            options: (question.options || []).map(opt => {
              const existingOption = existingQuestion?.options?.find(o => o.value === opt.value);
              return { ...opt, id: existingOption?.id || opt.id || generateId() };
            }),
            gridRows: (question.gridRows || []).map(row => {
              const existingRow = existingQuestion?.gridRows?.find(r => r.label === row.label);
              return { ...row, id: existingRow?.id || row.id || generateId() };
            }),
            gridColumns: (question.gridColumns || []).map(col => {
              const existingColumn = existingQuestion?.gridColumns?.find(c => c.label === col.label);
              return { ...col, id: existingColumn?.id || col.id || generateId() };
            }),
          };
        }),
        order: section.order !== undefined ? section.order : index,
      };
    });

    updates.push(`sections = $${paramIndex}`);
    values.push(JSON.stringify(sectionsWithIds));
    paramIndex++;
  }

  if (input.settings) {
    const mergedSettings = { ...currentForm.settings, ...input.settings };
    updates.push(`settings = $${paramIndex}`);
    values.push(JSON.stringify(mergedSettings));
    paramIndex++;
  }

  if (input.status) {
    updates.push(`status = $${paramIndex}`);
    values.push(input.status);
    paramIndex++;

    if (input.status === 'published' && currentForm.status !== 'published') {
      updates.push(`published_at = CURRENT_TIMESTAMP`);
    }
    if (input.status === 'closed' && currentForm.status !== 'closed') {
      updates.push(`closed_at = CURRENT_TIMESTAMP`);
    }
  }

  updates.push(`updated_at = CURRENT_TIMESTAMP`);

  if (updates.length === 1) {
    throw new AppError('No fields to update', 400);
  }

  values.push(id.trim());

  const result = await query(
    `UPDATE dynamic_forms
     SET ${updates.join(', ')}
     WHERE id = $${paramIndex}
     RETURNING *`,
    values
  );

  if (!result.rows || result.rows.length === 0) {
    throw new AppError('Failed to update form', 500);
  }

  return mapFormRow(result.rows[0]);
};

// ============================================================
// DELETE FORM
// ============================================================
export const deleteForm = async (id: string): Promise<void> => {
  if (!id || typeof id !== 'string' || id.trim() === '') {
    throw new AppError('Valid form ID is required', 400);
  }

  await getFormById(id);

  const checkResult = await query(
    `SELECT COUNT(*) as count FROM form_submissions WHERE form_id = $1`,
    [id.trim()]
  );

  const count = parseInt((checkResult.rows[0]?.count as string) || '0', 10);
  if (count > 0) {
    throw new AppError(`Cannot delete form with ${count} existing submissions. Archive it instead.`, 400);
  }

  const result = await query('DELETE FROM dynamic_forms WHERE id = $1', [id.trim()]);

  if (!result.rowCount || result.rowCount === 0) {
    throw new AppError('Form not found', 404);
  }
};

// ============================================================
// SUBMIT FORM RESPONSE
// ============================================================
export const submitFormResponse = async (
  formId: string,
  input: SubmitFormResponsePayload,
  userId: string | undefined,
  userEmail: string | undefined,
  userName: string | undefined,
  requestMeta?: { ipAddress?: string; userAgent?: string }
): Promise<FormSubmission> => {
  const form = await getFormById(formId);

  if (form.status !== 'published') {
    throw new AppError('This form is not available for submissions', 400);
  }

  if (form.settings.requireLogin && !userId) {
    throw new AppError('You must be logged in to submit this form', 401);
  }

  if (form.settings.limitResponses && form.settings.maxResponses !== undefined) {
    if (form.responseCount >= form.settings.maxResponses) {
      throw new AppError('This form has reached its maximum number of responses', 400);
    }
  }

  if (form.settings.responseDeadline && new Date(form.settings.responseDeadline).getTime() < Date.now()) {
    throw new AppError('The deadline for submitting this form has passed', 400);
  }

  const validation = validateResponseAgainstForm(form, input.sections);
  if (!validation.valid) {
    throw new AppError(validation.errors.join('; '), 400);
  }

  const { sections, status = 'submitted', respondentEmail, respondentName } = input;
  const submissionId = generateSubmissionId();

  const result = await query(
    `INSERT INTO form_submissions (
       form_id, form_title, submission_id, respondent_id, respondent_email, respondent_name,
       is_logged_in, sections, status, submitted_at, ip_address, user_agent
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, ${status === 'submitted' ? 'CURRENT_TIMESTAMP' : 'NULL'}, $10, $11)
     RETURNING *`,
    [
      formId.trim(),
      form.title,
      submissionId,
      userId || null,
      respondentEmail || userEmail || null,
      respondentName || userName || null,
      Boolean(userId),
      JSON.stringify(sections),
      status,
      requestMeta?.ipAddress || null,
      requestMeta?.userAgent || null,
    ]
  );

  if (!result.rows || result.rows.length === 0) {
    throw new AppError('Failed to submit form response', 500);
  }

  if (status === 'submitted') {
    await query(`UPDATE dynamic_forms SET response_count = response_count + 1 WHERE id = $1`, [formId.trim()]);
  }

  return mapSubmissionRow(result.rows[0]);
};

// ============================================================
// GET FORM SUBMISSIONS
// ============================================================
export const getFormSubmissions = async (
  formId: string,
  queryParams: GetFormSubmissionsQuery
): Promise<SubmissionsListResponse> => {
  const { respondentEmail, respondentName, status, fromDate, toDate, graded, page, limit } = queryParams;

  await getFormById(formId);

  const validPage = Math.max(1, page);
  const validLimit = Math.min(100, Math.max(1, limit));

  const conditions: string[] = ['form_id = $1'];
  const values: unknown[] = [formId.trim()];
  let paramIndex = 2;

  if (respondentEmail) {
    conditions.push(`respondent_email ILIKE $${paramIndex}`);
    values.push(`%${respondentEmail}%`);
    paramIndex++;
  }

  if (respondentName) {
    conditions.push(`respondent_name ILIKE $${paramIndex}`);
    values.push(`%${respondentName}%`);
    paramIndex++;
  }

  if (status) {
    conditions.push(`status = $${paramIndex}`);
    values.push(status);
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

  if (graded !== undefined) {
    conditions.push(graded ? `graded_at IS NOT NULL` : `graded_at IS NULL`);
  }

  const whereClause = `WHERE ${conditions.join(' AND ')}`;
  const offset = (validPage - 1) * validLimit;

  const countResult = await query(`SELECT COUNT(*) as total FROM form_submissions ${whereClause}`, values);
  const total = parseInt((countResult.rows[0]?.total as string) || '0', 10);

  const result = await query(
    `SELECT *
     FROM form_submissions
     ${whereClause}
     ORDER BY submitted_at DESC
     LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
    [...values, validLimit, offset]
  );

  const submissions = result.rows.map(mapSubmissionRow);

  return {
    submissions,
    total,
    page: validPage,
    limit: validLimit,
    hasMore: validPage * validLimit < total,
  };
};

// ============================================================
// GET FORM SUBMISSION BY ID
// ============================================================
export const getFormSubmissionById = async (id: string): Promise<FormSubmission> => {
  if (!id || typeof id !== 'string' || id.trim() === '') {
    throw new AppError('Valid submission ID is required', 400);
  }

  const result = await query(`SELECT * FROM form_submissions WHERE id = $1`, [id.trim()]);

  if (!result.rows || result.rows.length === 0) {
    throw new AppError('Submission not found', 404);
  }

  return mapSubmissionRow(result.rows[0]);
};

// ============================================================
// REVIEW / GRADE FORM SUBMISSION
// ============================================================
export const reviewFormSubmission = async (
  id: string,
  input: ReviewFormSubmissionPayload,
  userId: string
): Promise<FormSubmission> => {
  if (!userId) {
    throw new AppError('User not authenticated', 401);
  }

  const submission = await getFormSubmissionById(id);

  if (submission.status !== 'submitted') {
    throw new AppError('Only submitted submissions can be reviewed', 400);
  }

  let updatedSections = submission.sections;
  if (input.questionScores) {
    updatedSections = submission.sections.map(section => ({
      ...section,
      responses: section.responses.map((response: QuestionResponse) => {
        const scoreUpdate = input.questionScores?.[response.questionId];
        return scoreUpdate ? { ...response, ...scoreUpdate } : response;
      }),
    }));
  }

  const result = await query(
    `UPDATE form_submissions
     SET graded_by = $1,
         graded_at = CURRENT_TIMESTAMP,
         feedback = $2,
         score = $3,
         passed = $4,
         sections = $5,
         status = 'edited',
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $6
     RETURNING *`,
    [
      userId,
      input.feedback?.trim() || null,
      input.score ?? null,
      input.passed ?? null,
      JSON.stringify(updatedSections),
      id.trim(),
    ]
  );

  if (!result.rows || result.rows.length === 0) {
    throw new AppError('Failed to review submission', 500);
  }

  return mapSubmissionRow(result.rows[0]);
};

// ============================================================
// GET SUBMISSIONS BY USER (self-service view)
// ============================================================
export const getMyFormSubmissions = async (
  userId: string,
  queryParams: { formId?: string; status?: FormSubmission['status']; page: number; limit: number }
): Promise<SubmissionsListResponse> => {
  if (!userId) {
    throw new AppError('User not authenticated', 401);
  }

  const { formId, status, page = 1, limit = 20 } = queryParams;

  const validPage = Math.max(1, page);
  const validLimit = Math.min(100, Math.max(1, limit));

  const conditions: string[] = ['respondent_id = $1'];
  const values: unknown[] = [userId];
  let paramIndex = 2;

  if (formId) {
    conditions.push(`form_id = $${paramIndex}`);
    values.push(formId.trim());
    paramIndex++;
  }

  if (status) {
    conditions.push(`status = $${paramIndex}`);
    values.push(status);
    paramIndex++;
  }

  const whereClause = `WHERE ${conditions.join(' AND ')}`;
  const offset = (validPage - 1) * validLimit;

  const countResult = await query(`SELECT COUNT(*) as total FROM form_submissions ${whereClause}`, values);
  const total = parseInt((countResult.rows[0]?.total as string) || '0', 10);

  const result = await query(
    `SELECT *
     FROM form_submissions
     ${whereClause}
     ORDER BY updated_at DESC
     LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
    [...values, validLimit, offset]
  );

  const submissions = result.rows.map(mapSubmissionRow);

  return {
    submissions,
    total,
    page: validPage,
    limit: validLimit,
    hasMore: validPage * validLimit < total,
  };
};

// ============================================================
// DELETE FORM SUBMISSION (drafts only, own submissions only)
// ============================================================
export const deleteFormSubmission = async (id: string, userId: string): Promise<void> => {
  if (!userId) {
    throw new AppError('User not authenticated', 401);
  }

  const submission = await getFormSubmissionById(id);

  if (submission.status !== 'draft') {
    throw new AppError('Only draft submissions can be deleted', 400);
  }

  if (submission.respondentId !== userId) {
    throw new AppError('You can only delete your own submissions', 403);
  }

  const result = await query('DELETE FROM form_submissions WHERE id = $1', [id.trim()]);

  if (!result.rowCount || result.rowCount === 0) {
    throw new AppError('Submission not found', 404);
  }
};

// ============================================================
// GET FORM STATISTICS
// ============================================================
export const getFormStatistics = async (
  formId: string
): Promise<{
  totalSubmissions: number;
  draftCount: number;
  submittedCount: number;
  gradedCount: number;
  averageScore: number | null;
  submissionsByDate: Array<{ date: string; count: number }>;
}> => {
  await getFormById(formId);

  const totalResult = await query(`SELECT COUNT(*) as count FROM form_submissions WHERE form_id = $1`, [formId.trim()]);
  const totalSubmissions = parseInt((totalResult.rows[0]?.count as string) || '0', 10);

  const draftResult = await query(
    `SELECT COUNT(*) as count FROM form_submissions WHERE form_id = $1 AND status = 'draft'`,
    [formId.trim()]
  );
  const draftCount = parseInt((draftResult.rows[0]?.count as string) || '0', 10);

  const submittedResult = await query(
    `SELECT COUNT(*) as count FROM form_submissions WHERE form_id = $1 AND status IN ('submitted', 'edited')`,
    [formId.trim()]
  );
  const submittedCount = parseInt((submittedResult.rows[0]?.count as string) || '0', 10);

  const gradedResult = await query(
    `SELECT COUNT(*) as count FROM form_submissions WHERE form_id = $1 AND graded_at IS NOT NULL`,
    [formId.trim()]
  );
  const gradedCount = parseInt((gradedResult.rows[0]?.count as string) || '0', 10);

  const avgScoreResult = await query(
    `SELECT AVG(score) as avg_score FROM form_submissions WHERE form_id = $1 AND score IS NOT NULL`,
    [formId.trim()]
  );
  const averageScore = avgScoreResult.rows[0]?.avg_score !== null && avgScoreResult.rows[0]?.avg_score !== undefined
    ? Number(avgScoreResult.rows[0].avg_score)
    : null;

  const byDateResult = await query(
    `SELECT DATE(submitted_at) as date, COUNT(*) as count
     FROM form_submissions
     WHERE form_id = $1 AND status IN ('submitted', 'edited') AND submitted_at IS NOT NULL
     AND submitted_at >= CURRENT_DATE - INTERVAL '30 days'
     GROUP BY DATE(submitted_at)
     ORDER BY date DESC`,
    [formId.trim()]
  );
  const submissionsByDate = byDateResult.rows.map(row => ({
    date: String(row.date),
    count: parseInt(String(row.count), 10),
  }));

  return {
    totalSubmissions,
    draftCount,
    submittedCount,
    gradedCount,
    averageScore,
    submissionsByDate,
  };
};

// ============================================================
// GET FORM ANALYTICS
// ============================================================
export const getFormAnalytics = async (
  formId: string,
  options: { fromDate?: string; toDate?: string }
): Promise<FormAnalytics> => {
  await getFormById(formId);

  const { fromDate, toDate } = options;

  let dateFilter = '';
  const values: unknown[] = [formId.trim()];
  let paramIndex = 2;

  if (fromDate) {
    dateFilter += ` AND submitted_at >= $${paramIndex}`;
    values.push(fromDate);
    paramIndex++;
  }

  if (toDate) {
    dateFilter += ` AND submitted_at <= $${paramIndex}`;
    values.push(toDate);
    paramIndex++;
  }

  // Total views
  const viewsResult = await query(
    `SELECT COUNT(*) as count FROM form_views WHERE form_id = $1${dateFilter}`,
    values
  );
  const totalViews = parseInt((viewsResult.rows[0]?.count as string) || '0', 10);

  // Total starts
  const startsResult = await query(
    `SELECT COUNT(DISTINCT respondent_id) as count FROM form_submissions 
     WHERE form_id = $1 AND respondent_id IS NOT NULL${dateFilter}`,
    values
  );
  const totalStarts = parseInt((startsResult.rows[0]?.count as string) || '0', 10);

  // Total submissions
  const submissionsResult = await query(
    `SELECT COUNT(*) as count FROM form_submissions 
     WHERE form_id = $1 AND status IN ('submitted', 'edited')${dateFilter}`,
    values
  );
  const totalSubmissions = parseInt((submissionsResult.rows[0]?.count as string) || '0', 10);

  // Average time
  const avgTimeResult = await query(
    `SELECT AVG(total_time_spent) as avg_time FROM form_submissions 
     WHERE form_id = $1 AND total_time_spent IS NOT NULL AND status IN ('submitted', 'edited')${dateFilter}`,
    values
  );
  const averageTime = avgTimeResult.rows[0]?.avg_time !== null && avgTimeResult.rows[0]?.avg_time !== undefined
    ? Number(avgTimeResult.rows[0].avg_time)
    : 0;

  // Daily stats
  const dailyStatsResult = await query(
    `SELECT DATE(submitted_at) as date, 
            COUNT(*) as submissions,
            COUNT(DISTINCT respondent_id) as starts
     FROM form_submissions 
     WHERE form_id = $1 AND status IN ('submitted', 'edited') AND submitted_at IS NOT NULL
     AND submitted_at >= CURRENT_DATE - INTERVAL '30 days'
     GROUP BY DATE(submitted_at)
     ORDER BY date DESC`,
    [formId.trim()]
  );

  const dailyStats = dailyStatsResult.rows.map(row => ({
    date: String(row.date),
    views: 0,
    starts: parseInt(String(row.starts), 10),
    submissions: parseInt(String(row.submissions), 10),
  }));

  // Question analytics
  const form = await getFormById(formId);
  const questionAnalytics: QuestionAnalytics[] = [];

  for (const section of form.sections) {
    for (const question of section.questions) {
      const qStats = await getQuestionAnalytics(formId, question.id, fromDate, toDate);
      questionAnalytics.push(qStats);
    }
  }

  // Country distribution
  const countriesResult = await query(
    `SELECT location->>'country' as country, COUNT(*) as count
     FROM form_submissions 
     WHERE form_id = $1 AND location IS NOT NULL AND location->>'country' IS NOT NULL${dateFilter ? dateFilter.replace(/AND/g, '') : ''}
     GROUP BY location->>'country'
     ORDER BY count DESC`,
    values
  );

  const countries: { [key: string]: number } = {};
  countriesResult.rows.forEach(row => {
    countries[String(row.country)] = parseInt(String(row.count), 10);
  });

  const completionRate = totalStarts > 0 ? (totalSubmissions / totalStarts) * 100 : 0;

  return {
    formId,
    totalViews,
    totalStarts,
    totalSubmissions,
    completionRate,
    averageTime,
    dailyStats,
    questionAnalytics,
    countries,
  };
};

// ============================================================
// Helper: Get analytics for a single question
// ============================================================
const getQuestionAnalytics = async (
  formId: string,
  questionId: string,
  fromDate?: string,
  toDate?: string
): Promise<QuestionAnalytics> => {
  let dateFilter = '';
  const values: unknown[] = [formId.trim(), questionId];
  let paramIndex = 3;

  if (fromDate) {
    dateFilter += ` AND fs.submitted_at >= $${paramIndex}`;
    values.push(fromDate);
    paramIndex++;
  }

  if (toDate) {
    dateFilter += ` AND fs.submitted_at <= $${paramIndex}`;
    values.push(toDate);
    paramIndex++;
  }

  const result = await query(
    `SELECT fs.sections as sections
     FROM form_submissions fs
     WHERE fs.form_id = $1 AND fs.status IN ('submitted', 'edited')${dateFilter}`,
    values
  );

  let totalResponses = 0;
  let skippedResponses = 0;
  const responseValues: any[] = [];
  const responseDistribution: { [key: string]: number } = {};

  result.rows.forEach(row => {
    try {
      const sections = typeof row.sections === 'string' ? JSON.parse(row.sections) : row.sections;
      for (const section of sections) {
        for (const response of section.responses) {
          if (response.questionId === questionId) {
            totalResponses++;
            const value = response.value;
            if (value === undefined || value === null || value === '') {
              skippedResponses++;
            } else {
              responseValues.push(value);
              const key = typeof value === 'object' ? JSON.stringify(value) : String(value);
              responseDistribution[key] = (responseDistribution[key] || 0) + 1;
            }
          }
        }
      }
    } catch (error) {
      console.error('Error parsing submission sections:', error);
    }
  });

  let averageValue: number | undefined;
  const numericValues = responseValues.filter(v => typeof v === 'number' || !isNaN(Number(v)));
  if (numericValues.length > 0) {
    const sum = numericValues.reduce((acc, v) => acc + Number(v), 0);
    averageValue = sum / numericValues.length;
  }

  return {
    questionId,
    totalResponses,
    skippedResponses,
    averageValue,
    responseDistribution,
    averageTimeToAnswer: undefined,
  };
};

// ============================================================
// EXPORT SUBMISSIONS
// ============================================================
export const exportSubmissions = async (
  formId: string,
  options: {
    format: 'csv' | 'excel' | 'pdf' | 'json';
    fromDate?: string;
    toDate?: string;
    status?: 'draft' | 'submitted' | 'edited' | 'deleted';
  }
): Promise<ExportResponse> => {
  const { format, fromDate, toDate, status } = options;

  const form = await getFormById(formId);

  const conditions: string[] = ['form_id = $1'];
  const values: unknown[] = [formId.trim()];
  let paramIndex = 2;

  if (status) {
    conditions.push(`status = $${paramIndex}`);
    values.push(status);
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

  const whereClause = `WHERE ${conditions.join(' AND ')}`;

  const result = await query(
    `SELECT * FROM form_submissions ${whereClause} ORDER BY submitted_at DESC`,
    values
  );

  const submissions = result.rows.map(mapSubmissionRow);

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `submissions_${form.title.replace(/\s+/g, '_')}_${timestamp}.${format === 'excel' ? 'xlsx' : format}`;

  // For JSON, return without generating a file
  if (format === 'json') {
    return {
      url: `/exports/${filename}`,
      format,
      filename,
    };
  }

  // Generate file for other formats
  let exportData: any;
  switch (format) {
    case 'csv':
      exportData = convertToCSV(submissions, form);
      break;
    case 'excel':
      exportData = convertToExcel(submissions, form);
      break;
    case 'pdf':
      exportData = convertToPDF(submissions, form);
      break;
    default:
      exportData = submissions;
  }

  // In a real implementation, save the file and return the URL
  return {
    url: `/exports/${filename}`,
    format,
    filename,
  };
};

// ============================================================
// Helper: Convert submissions to CSV
// ============================================================
const convertToCSV = (submissions: FormSubmission[], form: DynamicForm): string => {
  const headers = ['Submission ID', 'Respondent', 'Email', 'Submitted At', 'Status', 'Score'];
  
  form.sections.forEach(section => {
    section.questions.forEach(question => {
      headers.push(question.title);
    });
  });

  let csv = headers.join(',') + '\n';

  submissions.forEach(submission => {
    const row: string[] = [
      submission.submissionId,
      submission.respondentName || '',
      submission.respondentEmail || '',
      submission.submittedAt || '',
      submission.status,
      submission.score !== undefined ? String(submission.score) : '',
    ];

    const answerMap: { [key: string]: string } = {};
    submission.sections.forEach(section => {
      section.responses.forEach(response => {
        const value = response.value;
        if (value !== undefined && value !== null && value !== '') {
          answerMap[response.questionId] = typeof value === 'object' ? JSON.stringify(value) : String(value);
        } else {
          answerMap[response.questionId] = '';
        }
      });
    });

    form.sections.forEach(section => {
      section.questions.forEach(question => {
        row.push(answerMap[question.id] || '');
      });
    });

    csv += row.join(',') + '\n';
  });

  return csv;
};

// ============================================================
// Helper: Convert submissions to Excel (placeholder)
// ============================================================
const convertToExcel = (submissions: FormSubmission[], form: DynamicForm): any => {
  return {
    submissions,
    formTitle: form.title,
    exportedAt: new Date().toISOString(),
  };
};

// ============================================================
// Helper: Convert submissions to PDF (placeholder)
// ============================================================
const convertToPDF = (submissions: FormSubmission[], form: DynamicForm): any => {
  return {
    submissions,
    formTitle: form.title,
    exportedAt: new Date().toISOString(),
  };
};

// ============================================================
// ADD QUESTION TO SECTION
// ============================================================
export const addQuestion = async (
  formId: string,
  sectionId: string,
  questionData: CreateQuestionInput,
  position: number | undefined,
  userId: string
): Promise<Question> => {
  if (!userId) {
    throw new AppError('User not authenticated', 401);
  }

  const form = await getFormById(formId);

  const sectionIndex = form.sections.findIndex(s => s.id === sectionId);
  if (sectionIndex === -1) {
    throw new AppError('Section not found', 404);
  }

  const newQuestion = createQuestion(questionData);

  const section = form.sections[sectionIndex];
  const questions = [...section.questions];
  const insertIndex = position !== undefined && position >= 0 && position <= questions.length
    ? position
    : questions.length;
  questions.splice(insertIndex, 0, newQuestion);

  const updatedSection = { ...section, questions };
  form.sections[sectionIndex] = updatedSection;

  await updateForm(formId, { sections: form.sections as unknown as CreateSectionInput[] }, userId);

  return newQuestion;
};

// ============================================================
// UPDATE QUESTION
// ============================================================
export const updateQuestion = async (
  formId: string,
  sectionId: string,
  questionId: string,
  questionData: Partial<Question>,
  userId: string
): Promise<Question> => {
  if (!userId) {
    throw new AppError('User not authenticated', 401);
  }

  const form = await getFormById(formId);

  const sectionIndex = form.sections.findIndex(s => s.id === sectionId);
  if (sectionIndex === -1) {
    throw new AppError('Section not found', 404);
  }

  const section = form.sections[sectionIndex];
  const questionIndex = section.questions.findIndex(q => q.id === questionId);
  if (questionIndex === -1) {
    throw new AppError('Question not found', 404);
  }

  const updatedQuestion = {
    ...section.questions[questionIndex],
    ...questionData,
    id: questionId,
  };

  section.questions[questionIndex] = updatedQuestion;
  form.sections[sectionIndex] = section;

  await updateForm(formId, { sections: form.sections as unknown as CreateSectionInput[] }, userId);

  return updatedQuestion;
};

// ============================================================
// DELETE QUESTION
// ============================================================
export const deleteQuestion = async (
  formId: string,
  sectionId: string,
  questionId: string,
  userId: string
): Promise<void> => {
  if (!userId) {
    throw new AppError('User not authenticated', 401);
  }

  const form = await getFormById(formId);

  const sectionIndex = form.sections.findIndex(s => s.id === sectionId);
  if (sectionIndex === -1) {
    throw new AppError('Section not found', 404);
  }

  const section = form.sections[sectionIndex];
  const questionIndex = section.questions.findIndex(q => q.id === questionId);
  if (questionIndex === -1) {
    throw new AppError('Question not found', 404);
  }

  section.questions.splice(questionIndex, 1);
  form.sections[sectionIndex] = section;

  await updateForm(formId, { sections: form.sections as unknown as CreateSectionInput[] }, userId);
};

// ============================================================
// ADD SECTION TO FORM
// ============================================================
export const addSection = async (
  formId: string,
  sectionData: CreateSectionInput,
  userId: string
): Promise<FormSection> => {
  if (!userId) {
    throw new AppError('User not authenticated', 401);
  }

  const form = await getFormById(formId);

  const newSection = createSection({
    ...sectionData,
    order: sectionData.order !== undefined ? sectionData.order : form.sections.length,
  });

  form.sections.push(newSection);

  await updateForm(formId, { sections: form.sections as unknown as CreateSectionInput[] }, userId);

  return newSection;
};

// ============================================================
// DELETE SECTION
// ============================================================
export const deleteSection = async (
  formId: string,
  sectionId: string,
  userId: string
): Promise<void> => {
  if (!userId) {
    throw new AppError('User not authenticated', 401);
  }

  const form = await getFormById(formId);

  const sectionIndex = form.sections.findIndex(s => s.id === sectionId);
  if (sectionIndex === -1) {
    throw new AppError('Section not found', 404);
  }

  if (form.sections.length <= 1) {
    throw new AppError('Cannot delete the last section of a form', 400);
  }

  form.sections.splice(sectionIndex, 1);

  await updateForm(formId, { sections: form.sections as unknown as CreateSectionInput[] }, userId);
};

// ============================================================
// REORDER SECTIONS
// ============================================================
export const reorderSections = async (
  formId: string,
  sectionOrders: Array<{ sectionId: string; order: number }>,
  userId: string
): Promise<DynamicForm> => {
  if (!userId) {
    throw new AppError('User not authenticated', 401);
  }

  const form = await getFormById(formId);

  const orderMap = new Map<string, number>();
  sectionOrders.forEach(({ sectionId, order }) => {
    orderMap.set(sectionId, order);
  });

  form.sections = form.sections.map(section => ({
    ...section,
    order: orderMap.get(section.id) ?? section.order,
  }));

  form.sections.sort((a, b) => a.order - b.order);

  return await updateForm(formId, { sections: form.sections as unknown as CreateSectionInput[] }, userId);
};

// ============================================================
// DUPLICATE FORM
// ============================================================
export const duplicateForm = async (
  formId: string,
  newTitle: string,
  userId: string
): Promise<DynamicForm> => {
  if (!userId) {
    throw new AppError('User not authenticated', 401);
  }

  const originalForm = await getFormById(formId);

  const duplicatedSections = originalForm.sections.map(section => ({
    ...section,
    id: generateId(),
    questions: section.questions.map(q => ({
      ...q,
      id: generateId(),
      options: q.options?.map(opt => ({ ...opt, id: generateId() })),
      gridRows: q.gridRows?.map(row => ({ ...row, id: generateId() })),
      gridColumns: q.gridColumns?.map(col => ({ ...col, id: generateId() })),
    })),
  }));

  return await createForm({
    title: newTitle,
    description: `Copy of: ${originalForm.description || originalForm.title}`,
    sections: duplicatedSections,
    settings: originalForm.settings,
  }, userId);
};

// ============================================================
// GET FORM TEMPLATES
// ============================================================
export const getFormTemplates = async (options: {
  category?: string;
  search?: string;
  limit?: number;
}): Promise<FormTemplate[]> => {
  const { category, search, limit = 50 } = options;

  let templates = FORM_TEMPLATES;

  if (category) {
    templates = templates.filter(t => t.category.toLowerCase() === category.toLowerCase());
  }

  if (search) {
    const searchLower = search.toLowerCase();
    templates = templates.filter(t =>
      t.name.toLowerCase().includes(searchLower) ||
      t.description.toLowerCase().includes(searchLower)
    );
  }

  templates = templates.sort((a, b) => b.popularity - a.popularity);
  templates = templates.slice(0, limit);

  return templates;
};

// ============================================================
// CREATE FORM FROM TEMPLATE
// ============================================================
export const createFormFromTemplate = async (
  templateId: string,
  title: string,
  userId: string,
  settings?: Partial<FormSettings>
): Promise<DynamicForm> => {
  if (!userId) {
    throw new AppError('User not authenticated', 401);
  }

  const templates = await getFormTemplates({});
  const template = templates.find(t => t.id === templateId);

  if (!template) {
    throw new AppError('Template not found', 404);
  }

  const sections = template.sections.map(section => ({
    ...section,
    id: generateId(),
    questions: section.questions.map(q => ({
      ...q,
      id: generateId(),
      options: q.options?.map(opt => ({ ...opt, id: generateId() })),
      gridRows: q.gridRows?.map(row => ({ ...row, id: generateId() })),
      gridColumns: q.gridColumns?.map(col => ({ ...col, id: generateId() })),
    })),
  }));

  const mergedSettings = {
    ...template.settings,
    ...settings,
    isPublished: false,
  };

  return await createForm({
    title,
    description: template.description,
    sections,
    settings: mergedSettings as FormSettings,
  }, userId);
};

// ============================================================
// UPDATE EXPORT
// ============================================================
export default {
  createForm,
  getForms,
  getFormById,
  updateForm,
  deleteForm,
  submitFormResponse,
  getFormSubmissions,
  getFormSubmissionById,
  reviewFormSubmission,
  getMyFormSubmissions,
  deleteFormSubmission,
  getFormStatistics,
  getFormAnalytics,
  exportSubmissions,
  addQuestion,
  updateQuestion,
  deleteQuestion,
  addSection,
  deleteSection,
  reorderSections,
  duplicateForm,
  getFormTemplates,
  createFormFromTemplate,
};