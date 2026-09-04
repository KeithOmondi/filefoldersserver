// controllers/stationrequirements.controller.ts
import { Request, Response } from 'express';
import * as stationRequirementsService from './stationrequirements.service';
import PDFDocument from 'pdfkit';
import {
  CreateSubmissionInput,
  UpdateSubmissionInput,
  GetSubmissionsQuery,
  GetStationReportQuery,
  StationRequirementItem,
  SubmissionStatus,
  ReviewStatus,
  CASE_CATEGORIES,
  CASE_REGISTERS,
  ADDITIONAL_REGISTERS,
  CaseCategory,
  RegisterCategory,
  calculateTotals,
  DownloadReportQuery,
} from './stationrequirements.types';
import { catchAsync } from '../../utils/catchasync';
import { sendResponse } from '../../utils/Apiresponse';
import { AppError } from '../../utils/Apperror';
import { sendSubmissionConfirmation } from '../../utils/sendMail';
import { query } from '../../config/db';

// Extend Express Request to include user and validated data
interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    fullName?: string;
    role: 'admin' | 'dr';
  };
  validatedData?: any;
  validatedQuery?: any;
  validatedBody?: any;
  validatedParams?: any;
}

// ============================================================
// VALIDATION HELPERS
// ============================================================

const isValidCaseCategory = (category: string): category is CaseCategory => {
  return Object.keys(CASE_CATEGORIES).includes(category);
};

const isValidCaseName = (category: CaseCategory, name: string): boolean => {
  const cases = CASE_CATEGORIES[category] as readonly string[];
  return cases.includes(name);
};

const isValidRegisterCategory = (category: string): category is RegisterCategory | 'Additional' => {
  return Object.keys(CASE_REGISTERS).includes(category) || category === 'Additional';
};

// Type guard to check if value is a valid StationRequirementItem
const isValidRequirementItem = (item: unknown): item is StationRequirementItem => {
  if (!item || typeof item !== 'object') {
    return false;
  }

  const obj = item as Record<string, unknown>;

  const hasValidDivision = typeof obj.division === 'string' && obj.division.trim().length > 0;
  const hasValidName = typeof obj.name === 'string' && obj.name.trim().length > 0;
  const hasValidQuantity = typeof obj.quantity === 'number' && !isNaN(obj.quantity) && obj.quantity >= 0;

  return hasValidDivision && hasValidName && hasValidQuantity;
};

// ============================================================
// LOGGING HELPERS
// ============================================================

// Helper to log item details with validation
const logItemDetails = (items: unknown[], type: string): void => {
  if (!Array.isArray(items)) {
    console.warn(`⚠️ ${type} is not an array!`);
    return;
  }

  console.log(`🔍 [${type}] array length: ${items.length}`);

  items.forEach((item: unknown, index: number) => {
    if (isValidRequirementItem(item)) {
      const isValidCategory = isValidCaseCategory(item.division);
      const isValidName = isValidCategory ? isValidCaseName(item.division as CaseCategory, item.name) : false;

      console.log(`  [${index}] division: ${item.division} (${typeof item.division}) ${isValidCategory ? '✅' : '❌'}`);
      console.log(`  [${index}] name: ${item.name} (${typeof item.name}) ${isValidName ? '✅' : '❌'}`);
      console.log(`  [${index}] quantity: ${item.quantity} (${typeof item.quantity})`);

      if (!isValidCategory) {
        console.warn(`  ⚠️  Invalid category: "${item.division}". Valid categories: ${Object.keys(CASE_CATEGORIES).join(', ')}`);
      }
      if (isValidCategory && !isValidName) {
        console.warn(`  ⚠️  Invalid name: "${item.name}" for category "${item.division}". Valid names: ${CASE_CATEGORIES[item.division as CaseCategory].join(', ')}`);
      }
    } else {
      console.warn(`  [${index}] Invalid item:`, item);
    }
  });
};

// Helper to log register item details
const logRegisterDetails = (items: unknown[], type: string): void => {
  if (!Array.isArray(items)) {
    console.warn(`⚠️ ${type} is not an array!`);
    return;
  }

  const allRegisterCategories = [...Object.keys(CASE_REGISTERS), 'Additional'];

  console.log(`🔍 [${type}] array length: ${items.length}`);

  items.forEach((item: unknown, index: number) => {
    if (isValidRequirementItem(item)) {
      const isValidCategory = isValidRegisterCategory(item.division);
      
      let validNames: string[] = [];
      if (item.division === 'Additional') {
        validNames = [...ADDITIONAL_REGISTERS];
      } else if (isValidCategory) {
        validNames = CASE_REGISTERS[item.division as RegisterCategory] as unknown as string[];
      }
      
      const isValidName = isValidCategory && validNames.includes(item.name);

      console.log(`  [${index}] division: ${item.division} (${typeof item.division}) ${isValidCategory ? '✅' : '❌'}`);
      console.log(`  [${index}] name: ${item.name} (${typeof item.name}) ${isValidName ? '✅' : '❌'}`);
      console.log(`  [${index}] quantity: ${item.quantity} (${typeof item.quantity})`);

      if (!isValidCategory) {
        console.warn(`  ⚠️  Invalid register category: "${item.division}". Valid categories: ${allRegisterCategories.join(', ')}`);
      }
      if (isValidCategory && !isValidName) {
        console.warn(`  ⚠️  Invalid register name: "${item.name}" for category "${item.division}". Valid names: ${validNames.join(', ')}`);
      }
    } else {
      console.warn(`  [${index}] Invalid item:`, item);
    }
  });
};

// Helper to check for undefined/null values recursively
const findUndefinedValues = (obj: unknown, path: string = ''): void => {
  if (obj === undefined || obj === null) {
    console.warn(`⚠️ Undefined/null value at: ${path}`);
    return;
  }

  if (typeof obj === 'object' && obj !== null) {
    Object.entries(obj).forEach(([key, value]) => {
      const newPath = path ? `${path}.${key}` : key;
      if (value === undefined || value === null) {
        console.warn(`⚠️ Undefined/null value at: ${newPath}`);
      } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        findUndefinedValues(value, newPath);
      } else if (Array.isArray(value)) {
        value.forEach((item, index) => {
          if (typeof item === 'object' && item !== null) {
            findUndefinedValues(item, `${newPath}[${index}]`);
          }
        });
      }
    });
  }
};

// ============================================================
// Helper function to send confirmation email
// ============================================================
const sendConfirmationEmail = async (
  submission: any,
  isDraftSubmission: boolean = false
): Promise<void> => {
  // Only send email if it's a submitted submission (not draft)
  if (isDraftSubmission || submission.status !== 'submitted') {
    return;
  }

  // Check if we have email to send to
  if (!submission.submitterEmail) {
    console.warn('⚠️ No submitter email found, skipping email');
    return;
  }

  try {
    const totals = calculateTotals(submission);
    await sendSubmissionConfirmation(
      submission.submitterEmail,
      submission.submitterName || 'User',
      submission.station,
      totals.fileFoldersTotal,
      totals.registersTotal,
      submission.id
    );
    
    // Update email status
    await stationRequirementsService.updateEmailStatus(submission.id, true);
    
    console.log('✅ Confirmation email sent to:', submission.submitterEmail);
  } catch (emailError) {
    console.error('❌ Failed to send confirmation email:', emailError);
    // Update email status with error
    await stationRequirementsService.updateEmailStatus(
      submission.id, 
      false, 
      emailError instanceof Error ? emailError.message : 'Unknown error'
    );
    // Don't throw - email failure shouldn't stop the submission
  }
};

// ============================================================
// GET /api/station-requirements/categories
// Get all valid case categories and their names (File Folders)
// ============================================================
export const getCaseCategoriesHandler = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  console.log('🔍 [Controller] getCaseCategories');

  const categories = stationRequirementsService.getAllValidCases();

  console.log('✅ [Controller] Case categories retrieved:', categories.length);

  sendResponse(res, 200, { categories }, 'Case categories retrieved successfully');
});

// ============================================================
// GET /api/station-requirements/register-categories
// Get all valid register categories and their names
// ============================================================
export const getRegisterCategoriesHandler = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  console.log('🔍 [Controller] getRegisterCategories');

  const categories = stationRequirementsService.getAllValidRegisters();

  console.log('✅ [Controller] Register categories retrieved:', categories.length);

  sendResponse(res, 200, { categories }, 'Register categories retrieved successfully');
});

// ============================================================
// GET /api/station-requirements/registers
// Get all valid register names (flat list with categories)
// ============================================================
export const getRegistersHandler = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  console.log('🔍 [Controller] getRegisters');

  const allRegisters = stationRequirementsService.getAllValidRegisters();
  
  // Also return a flat list for easier frontend use
  const flatRegisters: { category: string; name: string }[] = [];
  for (const category of allRegisters) {
    for (const name of category.names) {
      flatRegisters.push({ category: category.category, name });
    }
  }

  console.log('✅ [Controller] Registers retrieved:', flatRegisters.length);

  sendResponse(
    res, 
    200, 
    { 
      categories: allRegisters,
      registers: flatRegisters 
    }, 
    'Registers retrieved successfully'
  );
});

// ============================================================
// POST /api/station-requirements
// Create new submission (draft or submitted)
// ============================================================
export const createSubmissionHandler = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  // ✅ USE VALIDATED BODY from middleware
  const validatedBody = req.validatedBody || req.body;
  
  console.log('🔍 [Controller] createSubmission - Using validated data');
  console.log('🔍 [Controller] validatedBody:', JSON.stringify(validatedBody, null, 2));

  // User info
  const userId = req.user?.id;
  const userEmail = req.user?.email;
  const userName = req.user?.fullName;

  // Prepare the input from validated data
  const input: CreateSubmissionInput = {
    station: validatedBody.station,
    fileFolders: validatedBody.fileFolders || [],
    registers: validatedBody.registers || [],
    status: validatedBody.status || 'draft',
  };

  console.log('🔍 [Controller] Final input to service:', JSON.stringify(input, null, 2));

  const submission = await stationRequirementsService.createSubmission(input, userId, userEmail, userName);

  console.log('✅ [Controller] Submission created successfully:', {
    id: submission.id,
    station: submission.station,
    status: submission.status,
    fileFoldersCount: submission.fileFolders.length,
    registersCount: submission.registers.length,
  });

  // Send confirmation email if submitted (not draft)
  await sendConfirmationEmail(submission, submission.status === 'draft');

  sendResponse(res, 201, { submission }, 'Submission created successfully');
});

// ============================================================
// GET /api/station-requirements
// Get submissions with filtering
// ============================================================
export const getSubmissionsHandler = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  // ✅ USE VALIDATED QUERY from middleware
  const validatedQuery = req.validatedQuery || req.query;
  
  console.log('🔍 [Controller] getSubmissions - Using validated query:', validatedQuery);

  // Build query object from validated data
  const query: GetSubmissionsQuery = {
    station: validatedQuery.station as string | undefined,
    status: validatedQuery.status as SubmissionStatus | undefined,
    reviewStatus: validatedQuery.reviewStatus as ReviewStatus | undefined,
    fromDate: validatedQuery.fromDate as string | undefined,
    toDate: validatedQuery.toDate as string | undefined,
    page: validatedQuery.page || 1,
    limit: validatedQuery.limit || 20,
    sortBy: validatedQuery.sortBy || 'updatedAt',
    sortOrder: validatedQuery.sortOrder || 'desc',
    adminView: validatedQuery.adminView === true || req.user?.role === 'admin',
  };

  console.log('🔍 [Controller] getSubmissions query:', query);

  const result = await stationRequirementsService.getSubmissions(query);

  console.log('✅ [Controller] Submissions retrieved:', {
    total: result.total,
    submissionsCount: result.submissions.length,
  });

  sendResponse(
    res,
    200,
    {
      submissions: result.submissions,
      total: result.total,
      page: query.page || 1,
      limit: query.limit || 20,
      hasMore: (query.page || 1) * (query.limit || 20) < result.total,
    },
    'Submissions retrieved successfully'
  );
});

// ============================================================
// GET /api/station-requirements/:id
// Get single submission by ID
// ============================================================
export const getSubmissionByIdHandler = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  // ✅ USE VALIDATED PARAMS from middleware
  const validatedParams = req.validatedParams || req.params;
  const id = validatedParams.id;

  if (!id) {
    throw new AppError('Submission ID is required', 400);
  }

  console.log('🔍 [Controller] getSubmissionById - Using validated params:', id);

  const submission = await stationRequirementsService.getSubmissionById(id);

  console.log('✅ [Controller] Submission retrieved:', {
    id: submission.id,
    station: submission.station,
    status: submission.status,
    submittedBy: submission.submitterName || submission.submitterEmail || 'Unknown User',
    fileFoldersCount: submission.fileFolders.length,
    registersCount: submission.registers.length,
  });

  sendResponse(res, 200, { submission }, 'Submission retrieved successfully');
});

// ============================================================
// PUT /api/station-requirements/:id
// Update submission
// ============================================================
export const updateSubmissionHandler = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  // ✅ USE VALIDATED PARAMS AND BODY from middleware
  const validatedParams = req.validatedParams || req.params;
  const validatedBody = req.validatedBody || req.body;
  
  const id = validatedParams.id;

  if (!id) {
    throw new AppError('Submission ID is required', 400);
  }

  console.log('🔍 [Controller] updateSubmission - Using validated data:', { id, body: validatedBody });

  const input: UpdateSubmissionInput = {
    station: validatedBody.station,
    fileFolders: validatedBody.fileFolders,
    registers: validatedBody.registers,
    status: validatedBody.status,
    reviewStatus: validatedBody.reviewStatus,
    adminNotes: validatedBody.adminNotes,
  };

  const userId = req.user?.id;

  const submission = await stationRequirementsService.updateSubmission(id, input, userId);

  console.log('✅ [Controller] Submission updated:', {
    id: submission.id,
    station: submission.station,
    status: submission.status,
  });

  sendResponse(res, 200, { submission }, 'Submission updated successfully');
});

// ============================================================
// POST /api/station-requirements/:id/submit
// Submit a draft
// ============================================================
export const submitDraftHandler = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  // ✅ USE VALIDATED PARAMS AND BODY from middleware
  const validatedParams = req.validatedParams || req.params;
  const validatedBody = req.validatedBody || req.body;
  
  const id = validatedParams.id;

  if (!id) {
    throw new AppError('Submission ID is required', 400);
  }

  console.log('🔍 [Controller] submitDraft - Using validated data:', id);

  const sendEmail = validatedBody.sendEmail !== false;
  const userId = req.user?.id;

  const submission = await stationRequirementsService.submitDraft(id, userId, sendEmail);

  console.log('✅ [Controller] Draft submitted:', {
    id: submission.id,
    station: submission.station,
    submittedAt: submission.submittedAt,
  });

  // Send confirmation email if requested
  if (sendEmail) {
    await sendConfirmationEmail(submission, false);
  }

  sendResponse(res, 200, { submission }, 'Draft submitted successfully');
});

// ============================================================
// POST /api/station-requirements/:id/review
// Admin review submission
// ============================================================
export const adminReviewHandler = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  // ✅ USE VALIDATED PARAMS AND BODY from middleware
  const validatedParams = req.validatedParams || req.params;
  const validatedBody = req.validatedBody || req.body;
  
  const id = validatedParams.id;

  if (!id) {
    throw new AppError('Submission ID is required', 400);
  }

  // Only admins can review
  if (req.user?.role !== 'admin') {
    throw new AppError('Only administrators can review submissions', 403);
  }

  console.log('🔍 [Controller] adminReview - Using validated data:', { id, body: validatedBody });

  const { reviewStatus, adminNotes, sendNotification = true } = validatedBody;

  if (!reviewStatus) {
    throw new AppError('Review status is required', 400);
  }

  const submission = await stationRequirementsService.adminReview(
    id,
    reviewStatus,
    adminNotes,
    req.user?.id,
    sendNotification
  );

  console.log('✅ [Controller] Submission reviewed:', {
    id: submission.id,
    station: submission.station,
    reviewStatus: submission.reviewStatus,
  });

  // Send notification email if requested
  if (sendNotification && submission.submitterEmail) {
    try {
      // TODO: Implement admin review notification email
      console.log('✅ [Controller] Review notification would be sent to:', submission.submitterEmail);
    } catch (emailError) {
      console.error('❌ [Controller] Failed to send review notification:', emailError);
    }
  }

  sendResponse(res, 200, { submission }, 'Submission reviewed successfully');
});

// ============================================================
// GET /api/station-requirements/report
// Get station report (admin dashboard)
// ============================================================
export const getStationReportHandler = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  // ✅ USE VALIDATED QUERY from middleware
  const validatedQuery = req.validatedQuery || req.query;
  
  // Only admins can view the report
  if (req.user?.role !== 'admin') {
    throw new AppError('Only administrators can view the station report', 403);
  }

  const query: GetStationReportQuery = {
    status: validatedQuery.status as any,
    fromDate: validatedQuery.fromDate as string | undefined,
    toDate: validatedQuery.toDate as string | undefined,
    page: validatedQuery.page || undefined,
    limit: validatedQuery.limit || undefined,
  };

  console.log('🔍 [Controller] getStationReport - Using validated query:', query);

  const report = await stationRequirementsService.getStationReport(query);

  console.log('✅ [Controller] Station report retrieved:', {
    totalStations: report.totalStations,
    stationsByStatus: report.stationsByStatus,
  });

  sendResponse(res, 200, { report }, 'Station report retrieved successfully');
});

// ============================================================
// GET /api/station-requirements/dashboard
// Get admin dashboard stats
// ============================================================
export const getAdminDashboardHandler = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  // Only admins can view the dashboard
  if (req.user?.role !== 'admin') {
    throw new AppError('Only administrators can view the dashboard', 403);
  }

  console.log('🔍 [Controller] getAdminDashboard');

  const stats = await stationRequirementsService.getAdminDashboardStats();

  console.log('✅ [Controller] Dashboard stats retrieved:', {
    totalStations: stats.totalStations,
    pendingReviews: stats.pendingReviews,
    completionRate: stats.completionRate,
  });

  sendResponse(res, 200, { stats }, 'Dashboard stats retrieved successfully');
});

// ============================================================
// GET /api/station-requirements/review-queue
// Get admin review queue
// ============================================================
export const getReviewQueueHandler = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  // Only admins can view the review queue
  if (req.user?.role !== 'admin') {
    throw new AppError('Only administrators can view the review queue', 403);
  }

  console.log('🔍 [Controller] getReviewQueue');

  const queue = await stationRequirementsService.getAdminReviewQueue();

  console.log('✅ [Controller] Review queue retrieved:', {
    pending: queue.pending.length,
    approved: queue.approved.length,
    needsRevision: queue.needsRevision.length,
    total: queue.total,
  });

  sendResponse(res, 200, { queue }, 'Review queue retrieved successfully');
});

// ============================================================
// DELETE /api/station-requirements/:id
// Delete submission
// ============================================================
export const deleteSubmissionHandler = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  // ✅ USE VALIDATED PARAMS from middleware
  const validatedParams = req.validatedParams || req.params;
  const id = validatedParams.id;

  if (!id) {
    throw new AppError('Submission ID is required', 400);
  }

  console.log('🔍 [Controller] deleteSubmission - Using validated params:', id);

  await stationRequirementsService.deleteSubmission(id);

  console.log('✅ [Controller] Submission deleted:', id);

  sendResponse(res, 200, null, 'Submission deleted successfully');
});

// ============================================================
// GET /api/station-requirements/totals
// Get submission totals
// ============================================================
export const getSubmissionTotalsHandler = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  console.log('🔍 [Controller] getSubmissionTotals');

  const totals = await stationRequirementsService.getSubmissionTotals();

  console.log('✅ [Controller] Totals retrieved:', totals);

  sendResponse(res, 200, totals, 'Totals retrieved successfully');
});

// ============================================================
// GET /api/station-requirements/stations
// Get unique stations
// ============================================================
export const getUniqueStationsHandler = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  console.log('🔍 [Controller] getUniqueStations');

  const stations = await stationRequirementsService.getUniqueStations();

  console.log('✅ [Controller] Unique stations retrieved:', stations.length);

  sendResponse(res, 200, { stations }, 'Stations retrieved successfully');
});

// ============================================================
// GET /api/station-requirements/valid-cases
// Get all valid case categories and names for frontend (File Folders)
// ============================================================
export const getValidCasesHandler = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  console.log('🔍 [Controller] getValidCases');

  const categories = stationRequirementsService.getValidCaseCategories();
  const allCases = categories.map(category => ({
    category,
    names: stationRequirementsService.getValidCaseNames(category),
  }));

  console.log('✅ [Controller] Valid cases retrieved:', allCases.length);

  sendResponse(res, 200, { categories: allCases }, 'Valid cases retrieved successfully');
});

// ============================================================
// GET /api/station-requirements/valid-registers
// Get all valid register categories and names for frontend
// ============================================================
export const getValidRegistersHandler = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  console.log('🔍 [Controller] getValidRegisters');

  const categories = stationRequirementsService.getAllValidRegisters();

  console.log('✅ [Controller] Valid registers retrieved:', categories.length);

  sendResponse(res, 200, { categories }, 'Valid registers retrieved successfully');
});

// ============================================================
// GET /api/station-requirements/my-submissions
// DRs can view their own submissions (drafts and submitted)
// ============================================================
export const getMySubmissionsHandler = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  // ✅ USE VALIDATED QUERY from middleware
  const validatedQuery = req.validatedQuery || req.query;
  
  // Only DRs can access this
  if (req.user?.role !== 'dr') {
    throw new AppError('Only Deputy Registrars can view their own submissions', 403);
  }

  const userId = req.user?.id;

  if (!userId) {
    throw new AppError('User ID not found', 401);
  }

  console.log('🔍 [Controller] getMySubmissions - User:', {
    userId,
    userRole: req.user?.role,
    userEmail: req.user?.email,
  });

  // Build query object from validated data
  const query: GetSubmissionsQuery = {
    station: validatedQuery.station as string | undefined,
    status: validatedQuery.status as SubmissionStatus | undefined,
    reviewStatus: validatedQuery.reviewStatus as ReviewStatus | undefined,
    fromDate: validatedQuery.fromDate as string | undefined,
    toDate: validatedQuery.toDate as string | undefined,
    page: validatedQuery.page || 1,
    limit: validatedQuery.limit || 20,
    sortBy: validatedQuery.sortBy || 'updatedAt',
    sortOrder: validatedQuery.sortOrder || 'desc',
    adminView: false,
  };

  console.log('🔍 [Controller] getMySubmissions query:', query);

  const result = await stationRequirementsService.getSubmissions(query);

  console.log('✅ [Controller] My submissions retrieved:', {
    total: result.total,
    submissionsCount: result.submissions.length,
  });

  sendResponse(
    res,
    200,
    {
      submissions: result.submissions,
      total: result.total,
      page: query.page || 1,
      limit: query.limit || 20,
      hasMore: (query.page || 1) * (query.limit || 20) < result.total,
    },
    'Your submissions retrieved successfully'
  );
});

// ============================================================
// GET /api/station-requirements/submission-stats
// Get submission statistics (submitted, draft only, not started)
// ============================================================
export const getSubmissionStatsHandler = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  console.log('🔍 [Controller] getSubmissionStats');

  // Get all stations from users table
  const allStationsResult = await query(`
    SELECT DISTINCT station 
    FROM users 
    WHERE role = 'dr' AND is_active = true
    ORDER BY station ASC
  `);

  const allStations: string[] = allStationsResult.rows.map((row: any) => String(row.station)).filter(Boolean);

  if (allStations.length === 0) {
    sendResponse(res, 200, {
      totalStations: 0,
      submitted: 0,
      notSubmitted: 0,
      draftOnly: 0,
      notStarted: 0,
    }, 'No stations found');
    return;
  }

  // Get date filters if provided
  const validatedQuery = req.validatedQuery || req.query;
  const fromDate = validatedQuery.fromDate as string | undefined;
  const toDate = validatedQuery.toDate as string | undefined;

  const stats = await stationRequirementsService.getSubmissionStats(
    allStations,
    fromDate,
    toDate
  );

  console.log('✅ [Controller] Submission stats retrieved:', stats);

  sendResponse(res, 200, stats, 'Submission statistics retrieved successfully');
});


// ============================================================
// GET /api/station-requirements/download-report
// Download consolidated report (PDF or Word) - Styled with Judiciary Letterhead
// ============================================================
export const downloadReportHandler = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  // 1. Authorization
  if (req.user?.role !== 'admin') {
    throw new AppError('Only administrators can download reports', 403);
  }

  const validatedQuery = req.validatedQuery || req.query;
  const format = (validatedQuery.format || 'pdf') as 'pdf' | 'docx';
  
  const queryParams: DownloadReportQuery = {
    format: format,
    status: validatedQuery.status as string | undefined,
  };

  // 2. Fetch Data
  const { rows, summary } = await stationRequirementsService.generateReportData(queryParams);

  if (!rows || rows.length === 0) {
    throw new AppError('No data available for report', 404);
  }

  let filterInfo = 'All Stations';
  if (queryParams.status) {
    const statusLabel = queryParams.status === 'submitted' ? 'Submitted' : 'Not Submitted';
    filterInfo += ` | Status: ${statusLabel}`;
  }

  const logoUrl = 'https://res.cloudinary.com/do0yflasl/image/upload/v1784363826/ORHC_L_crclut.jpg';

  // ============================================================
  // FORMAT: PDF GENERATION (PDFKit Engine)
  // ============================================================
  if (format === 'pdf') {
    const doc = new PDFDocument({
      size: 'A4',
      margin: 40,
      bufferPages: true, // Enabled for dynamic page count computation (Page X of Y)
      info: {
        Title: 'Station Requirements Report',
        Author: 'Court System',
        Subject: 'Station Requirements Summary',
        CreationDate: new Date(),
      },
    });

    const filename = `station-requirements-report-${new Date().toISOString().split('T')[0]}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    doc.pipe(res);

    // Fetch logo safely with timeout
    let logoBuffer: Buffer | null = null;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);
      const response = await fetch(logoUrl, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (response.ok) {
        const arrayBuf = await response.arrayBuffer();
        logoBuffer = Buffer.from(arrayBuf);
      }
    } catch {
      console.warn('⚠️ Could not load logo image, applying fallback styling.');
    }

    // --- Header Section ---
    let currentY = 30;
    if (logoBuffer) {
      // Center image horizontally: A4 Width (595.28) - 80 / 2 = 257.64
      doc.image(logoBuffer, 257, currentY, { width: 80 });
      currentY += 85;
    } else {
      doc.fontSize(16).font('Helvetica-Bold').fillColor('#1e3a5f').text('JUDICIARY', 0, currentY, { align: 'center' });
      doc.fontSize(9).font('Helvetica').fillColor('#4B5563').text('REPUBLIC OF KENYA', 0, currentY + 18, { align: 'center' });
      currentY += 40;
    }

    doc.fontSize(13).font('Helvetica-Bold').fillColor('#1e3a5f').text('OFFICE OF THE REGISTRAR', 0, currentY, { align: 'center' });
    doc.fontSize(10).font('Helvetica').fillColor('#374151').text('HIGH COURT OF KENYA', 0, currentY + 16, { align: 'center' });
    doc.fontSize(11).font('Helvetica-Bold').fillColor('#1e3a5f').text('STATION REQUIREMENTS REPORT', 0, currentY + 32, { align: 'center' });

    currentY += 50;

    // Double Accent Lines
    doc.moveTo(40, currentY).lineTo(555, currentY).strokeColor('#1e3a5f').lineWidth(1.5).stroke();
    doc.moveTo(40, currentY + 3).lineTo(555, currentY + 3).strokeColor('#c59b27').lineWidth(1).stroke();

    // Contact Information Bar
    currentY += 10;
    doc.fontSize(7.5).font('Helvetica').fillColor('#4B5563')
      .text('Milimani Law Courts | 3rd Floor, Chamber 337 | P.O. Box 30041-00100 | Nairobi', 0, currentY, { align: 'center' })
      .text('Tel: +254 0730 181478 | Email: registrar@highcourt.go.ke | www.judiciary.go.ke', 0, currentY + 11, { align: 'center' });

    currentY += 26;
    doc.moveTo(40, currentY).lineTo(555, currentY).strokeColor('#E5E7EB').lineWidth(0.5).stroke();

    // Metadata Bar
    currentY += 8;
    doc.fontSize(8).font('Helvetica-Oblique').fillColor('#6B7280')
      .text(`Generated: ${new Date().toLocaleString()}  |  Filter: ${filterInfo}`, 0, currentY, { align: 'center' });

    // --- Summary Section ---
    currentY += 22;
    doc.fontSize(10).font('Helvetica-Bold').fillColor('#1e3a5f').text('EXECUTIVE SUMMARY', 40, currentY);
    
    currentY += 14;
    const summaryX = 40;
    const summaryWidth = 515;
    const colWidth = summaryWidth / 6;

    // Outer Summary Card
    doc.roundedRect(summaryX, currentY, summaryWidth, 42, 4).fillAndStroke('#F8FAFC', '#E2E8F0');

    const summaryLabels = ['Total Stations', 'Submitted', 'Pending', 'File Folders', 'Registers', 'Completion'];
    const summaryValues = [
      String(summary.totalStations),
      String(summary.submitted),
      String(summary.notSubmitted),
      summary.totalFileFolders.toLocaleString(),
      summary.totalRegisters.toLocaleString(),
      `${summary.completionRate}%`
    ];

    summaryLabels.forEach((label, i) => {
      const cellX = summaryX + (i * colWidth);
      doc.fontSize(7).font('Helvetica-Bold').fillColor('#64748B').text(label.toUpperCase(), cellX, currentY + 8, { width: colWidth, align: 'center' });
      
      let valColor = '#0F172A';
      if (i === 1) valColor = '#10B981';
      if (i === 2) valColor = '#EF4444';
      
      doc.fontSize(10).font('Helvetica-Bold').fillColor(valColor).text(summaryValues[i], cellX, currentY + 22, { width: colWidth, align: 'center' });
    });

    // --- Table Headers Setup ---
    currentY += 56;
    doc.fontSize(10).font('Helvetica-Bold').fillColor('#1e3a5f').text('STATION DETAILS', 40, currentY);
    currentY += 15;

    const tableX = 40;
    const columns = [
      { label: '#', width: 25, align: 'center' },
      { label: 'Station', width: 140, align: 'left' },
      { label: 'Assigned DR', width: 130, align: 'left' },
      { label: 'Status', width: 80, align: 'center' },
      { label: 'Folders', width: 45, align: 'right' },
      { label: 'Registers', width: 45, align: 'right' },
      { label: 'Total', width: 50, align: 'right' },
    ];

    const drawTableHeader = (yPos: number) => {
      let x = tableX;
      doc.rect(tableX, yPos, 515, 20).fill('#1e3a5f');
      doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#FFFFFF');
      
      columns.forEach(col => {
        doc.text(col.label, x + 4, yPos + 6, { width: col.width - 8, align: col.align as any });
        x += col.width;
      });
      return yPos + 20;
    };

    currentY = drawTableHeader(currentY);

    // --- Table Content ---
    rows.forEach((row, index) => {
      // Prevents table rows from breaking over page footers
      if (currentY > 730) {
        doc.addPage();
        currentY = 40;
        currentY = drawTableHeader(currentY);
      }

      const isEven = index % 2 === 0;
      if (isEven) {
        doc.rect(tableX, currentY, 515, 18).fill('#F8FAFC');
      }

      const status = row['Submission Status'] || 'Not Submitted';
      const isSubmitted = status === 'Submitted';

      let x = tableX;
      doc.fontSize(7.5).font('Helvetica').fillColor('#1E293B');

      // Index
      doc.text(String(index + 1), x + 4, currentY + 5, { width: columns[0].width - 8, align: 'center' });
      x += columns[0].width;

      // Station Name
      doc.text(row['Station'] || '-', x + 4, currentY + 5, { width: columns[1].width - 8, align: 'left', lineBreak: false });
      x += columns[1].width;

      // DR
      doc.text(row['Assigned DR'] || '-', x + 4, currentY + 5, { width: columns[2].width - 8, align: 'left', lineBreak: false });
      x += columns[2].width;

      // Status Indicator
      const circleColor = isSubmitted ? '#10B981' : '#9CA3AF';
      const statusTextColor = isSubmitted ? '#065F46' : '#4B5563';
      doc.circle(x + 12, currentY + 8.5, 3).fill(circleColor);
      doc.fillColor(statusTextColor).text(status, x + 18, currentY + 5, { width: columns[3].width - 20, align: 'left' });
      x += columns[3].width;

      // Quantities
      doc.fillColor('#1E293B');
      doc.text(Number(row['File Folders'] || 0).toLocaleString(), x + 4, currentY + 5, { width: columns[4].width - 8, align: 'right' });
      x += columns[4].width;

      doc.text(Number(row['Registers'] || 0).toLocaleString(), x + 4, currentY + 5, { width: columns[5].width - 8, align: 'right' });
      x += columns[5].width;

      doc.font('Helvetica-Bold').text(Number(row['Total Items'] || 0).toLocaleString(), x + 4, currentY + 5, { width: columns[6].width - 8, align: 'right' });

      currentY += 18;
    });

    // Outer Table Line Bottom
    doc.moveTo(tableX, currentY).lineTo(tableX + 515, currentY).strokeColor('#E2E8F0').lineWidth(1).stroke();

    // --- Dynamic Multi-Page Footer (Page X of Y) ---
    const range = doc.bufferedPageRange();
    const totalPages = range.count;

    for (let i = 0; i < totalPages; i++) {
      doc.switchToPage(i);

      const pageHeight = doc.page.height;
      const footerY = pageHeight - 30;

      // Divider Line above footer
      doc.moveTo(40, footerY - 18).lineTo(555, footerY - 18).strokeColor('#E2E8F0').lineWidth(0.5).stroke();

      // Motto / Legal Tagline (Centered)
      doc
        .fontSize(7.5)
        .font('Helvetica-Oblique')
        .fillColor('#9CA3AF')
        .text('Social Transformation through Access to Justice — Justice Be Our Shield and Defender', 40, footerY - 10, {
          width: 515,
          align: 'center',
        });

      // Page X of Y Counter (Right-aligned)
      doc
        .fontSize(8)
        .font('Helvetica')
        .fillColor('#6B7280')
        .text(`Page ${i + 1} of ${totalPages}`, 40, footerY, {
          width: 515,
          align: 'right',
        });
    }

    doc.end();
    return;
  }

  // ============================================================
  // FORMAT: WORD GENERATION (Native Docx Compatible HTML)
  // ============================================================
  if (format === 'docx') {
    const htmlContent = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head>
        <meta charset="UTF-8">
        <title>Station Requirements Report</title>
        <!--[if gte mso 9]>
        <xml>
          <w:WordDocument>
            <w:View>Print</w:View>
            <w:Zoom>100</w:Zoom>
            <w:DoNotOptimizeForCustomX选/>
          </w:WordDocument>
        </xml>
        <![endif]-->
        <style>
          @page Section1 { size: 595.3pt 841.9pt; margin: 36.0pt 36.0pt 36.0pt 36.0pt; }
          div.Section1 { page: Section1; }
          body { font-family: 'Segoe UI', Arial, sans-serif; color: #1e293b; }
          .header { text-align: center; margin-bottom: 15px; }
          .logo { max-height: 70px; width: auto; margin-bottom: 10px; }
          .title-main { font-size: 16pt; font-weight: bold; color: #1e3a5f; text-transform: uppercase; margin: 0; }
          .title-sub { font-size: 11pt; font-weight: 600; color: #475569; margin: 2px 0 0 0; }
          .title-doc { font-size: 12pt; font-weight: bold; color: #c59b27; margin-top: 6px; }
          .divider { border-bottom: 2px solid #1e3a5f; margin-top: 10px; }
          .divider-accent { border-bottom: 1px solid #c59b27; margin-top: 2px; margin-bottom: 10px; }
          .meta-info { font-size: 8pt; color: #64748b; text-align: center; margin-bottom: 20px; }
          
          /* Cards */
          .section-title { font-size: 11pt; font-weight: bold; color: #1e3a5f; margin-bottom: 8px; text-transform: uppercase; border-bottom: 1px solid #cbd5e1; padding-bottom: 3px; }
          .summary-table { width: 100%; border-collapse: collapse; margin-bottom: 25px; background-color: #f8fafc; }
          .summary-table td { border: 1px solid #cbd5e1; padding: 8px; text-align: center; width: 16.6%; }
          .summary-label { font-size: 7.5pt; font-weight: bold; color: #475569; text-transform: uppercase; }
          .summary-value { font-size: 12pt; font-weight: bold; color: #0f172a; margin-top: 4px; }
          
          /* Main Table */
          .data-table { width: 100%; border-collapse: collapse; margin-top: 10px; }
          .data-table th { background-color: #1e3a5f; color: #ffffff; font-size: 8pt; font-weight: bold; padding: 6px; border: 1px solid #1e3a5f; }
          .data-table td { font-size: 8pt; padding: 6px; border: 1px solid #e2e8f0; vertical-align: middle; }
          .data-table tr:nth-child(even) { background-color: #f8fafc; }
          
          /* Status Tags */
          .badge-submitted { color: #065f46; font-weight: bold; }
          .badge-pending { color: #4b5563; font-weight: bold; }
          .footer { text-align: center; font-size: 8pt; color: #9ca3af; margin-top: 30px; font-style: italic; }
        </style>
      </head>
      <body>
        <div class="Section1">
          <!-- Header -->
          <div class="header">
            <img src="${logoUrl}" class="logo" alt="Judiciary Logo"><br>
            <div class="title-main">Office of the Registrar</div>
            <div class="title-sub">HIGH COURT OF KENYA</div>
            <div class="title-doc">STATION REQUIREMENTS REPORT</div>
          </div>

          <div class="divider"></div>
          <div class="divider-accent"></div>

          <div class="meta-info">
            Milimani Law Courts | 3rd Floor, Chamber 337 | P.O. Box 30041-00100 | Nairobi<br>
            Tel: +254 0730 181478 | Email: registrar@highcourt.go.ke | www.judiciary.go.ke<br>
            <strong>Generated:</strong> ${new Date().toLocaleString()} &nbsp;|&nbsp; <strong>Filter:</strong> ${filterInfo}
          </div>

          <!-- Summary -->
          <div class="section-title">Executive Summary</div>
          <table class="summary-table">
            <tr>
              <td><div class="summary-label">Total Stations</div><div class="summary-value">${summary.totalStations}</div></td>
              <td><div class="summary-label">Submitted</div><div class="summary-value" style="color: #10b981;">${summary.submitted}</div></td>
              <td><div class="summary-label">Pending</div><div class="summary-value" style="color: #ef4444;">${summary.notSubmitted}</div></td>
              <td><div class="summary-label">File Folders</div><div class="summary-value">${summary.totalFileFolders.toLocaleString()}</div></td>
              <td><div class="summary-label">Registers</div><div class="summary-value">${summary.totalRegisters.toLocaleString()}</div></td>
              <td><div class="summary-label">Completion Rate</div><div class="summary-value">${summary.completionRate}%</div></td>
            </tr>
          </table>

          <!-- Detailed Data -->
          <div class="section-title">Station Details</div>
          <table class="data-table">
            <thead>
              <tr>
                <th style="width: 5%;">#</th>
                <th style="width: 25%; text-align: left;">Station</th>
                <th style="width: 25%; text-align: left;">Assigned DR</th>
                <th style="width: 15%; text-align: center;">Status</th>
                <th style="width: 10%; text-align: right;">Folders</th>
                <th style="width: 10%; text-align: right;">Registers</th>
                <th style="width: 10%; text-align: right;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${rows.map((row, index) => {
                const status = row['Submission Status'] || 'Not Submitted';
                const isSubmitted = status === 'Submitted';
                return `
                  <tr>
                    <td style="text-align: center;">${index + 1}</td>
                    <td><strong>${row['Station'] || '-'}</strong></td>
                    <td>${row['Assigned DR'] || '-'}</td>
                    <td style="text-align: center;" class="${isSubmitted ? 'badge-submitted' : 'badge-pending'}">
                      ${isSubmitted ? '&#9679; Submitted' : '&#9675; Pending'}
                    </td>
                    <td style="text-align: right;">${Number(row['File Folders'] || 0).toLocaleString()}</td>
                    <td style="text-align: right;">${Number(row['Registers'] || 0).toLocaleString()}</td>
                    <td style="text-align: right;"><strong>${Number(row['Total Items'] || 0).toLocaleString()}</strong></td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>

          <div class="footer">
            Social Transformation through Access to Justice &bull; Justice Be Our Shield and Defender
          </div>
        </div>
      </body>
      </html>
    `;

    const filename = `station-requirements-report-${new Date().toISOString().split('T')[0]}.doc`;
    res.setHeader('Content-Type', 'application/msword');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(htmlContent);
    return;
  }

  throw new AppError('Unsupported format requested. Please specify pdf or docx.', 400);
});

// ============================================================
// EXPORT
// ============================================================
export default {
  createSubmissionHandler,
  getSubmissionsHandler,
  getSubmissionByIdHandler,
  updateSubmissionHandler,
  submitDraftHandler,
  adminReviewHandler,
  deleteSubmissionHandler,
  getSubmissionTotalsHandler,
  getUniqueStationsHandler,
  getCaseCategoriesHandler,
  getRegisterCategoriesHandler,
  getRegistersHandler,
  getValidCasesHandler,
  getValidRegistersHandler,
  getStationReportHandler,
  getAdminDashboardHandler,
  getReviewQueueHandler,
  getMySubmissionsHandler,
  getSubmissionStatsHandler,
  downloadReportHandler,
};