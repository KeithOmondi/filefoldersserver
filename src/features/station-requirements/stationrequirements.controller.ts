// controllers/stationrequirements.controller.ts
import { Request, Response } from 'express';
import * as stationRequirementsService from './stationrequirements.service';
import PDFDocument from 'pdfkit';
//import * as ExcelJS from 'exceljs';
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
  //SubmissionStats,
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
// Download consolidated report (PDF or Word)
// ============================================================
export const downloadReportHandler = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  // Only admins can download reports
  if (req.user?.role !== 'admin') {
    throw new AppError('Only administrators can download reports', 403);
  }

  console.log('🔍 [Controller] downloadReport');

  const validatedQuery = req.validatedQuery || req.query;
  const format = (validatedQuery.format || 'pdf') as 'pdf' | 'docx';
  
  const queryParams: DownloadReportQuery = {
    format: format,
    fromDate: validatedQuery.fromDate as string | undefined,
    toDate: validatedQuery.toDate as string | undefined,
    status: validatedQuery.status as string | undefined,
  };

  // Generate report data using the service
  const { rows, summary } = await stationRequirementsService.generateReportData(queryParams);

  if (rows.length === 0) {
    throw new AppError('No data available for report', 404);
  }

  // Build filter info for display
  let filterInfo = 'All Stations';
  if (queryParams.fromDate && queryParams.toDate) {
    filterInfo = `From: ${queryParams.fromDate} To: ${queryParams.toDate}`;
  } else if (queryParams.fromDate) {
    filterInfo = `From: ${queryParams.fromDate}`;
  } else if (queryParams.toDate) {
    filterInfo = `To: ${queryParams.toDate}`;
  }
  if (queryParams.status) {
    filterInfo += ` | Status: ${queryParams.status}`;
  }

  // Generate PDF
  if (format === 'pdf') {
    const doc = new PDFDocument({
      size: 'A4',
      margin: 50,
      info: {
        Title: 'Station Requirements Report',
        Author: 'Court System',
        Subject: 'Station Requirements Summary',
        Keywords: 'station, requirements, report',
        CreationDate: new Date(),
      },
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=station-requirements-report-${new Date().toISOString().split('T')[0]}.pdf`);

    doc.pipe(res);

    // Header
    doc.fontSize(18).font('Helvetica-Bold').text('STATION REQUIREMENTS REPORT', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(10).font('Helvetica').text(`Generated: ${new Date().toLocaleString()}`, { align: 'center' });
    doc.moveDown(0.5);

    // Filter info
    doc.fontSize(10).text(`Filter: ${filterInfo}`, { align: 'center' });
    doc.moveDown();

    // Summary Section
    doc.fontSize(14).font('Helvetica-Bold').text('SUMMARY', { underline: true });
    doc.moveDown(0.5);

    const summaryData: Array<[string, string | number]> = [
      ['Metric', 'Value'],
      ['Total Stations', summary.totalStations],
      ['Submitted', summary.submitted],
      ['Pending Review', summary.pendingReview],
      ['Approved', summary.approved],
      ['Needs Revision', summary.needsRevision],
      ['Draft Only', summary.draftOnly],
      ['Not Started', summary.notStarted],
      ['Total File Folders', summary.totalFileFolders],
      ['Total Registers', summary.totalRegisters],
      ['Completion Rate', `${summary.completionRate}%`],
    ];

    let y = doc.y;
    summaryData.forEach((row, index) => {
      const x = index === 0 ? 50 : 200;
      doc.font(index === 0 ? 'Helvetica-Bold' : 'Helvetica')
         .fontSize(index === 0 ? 10 : 9)
         .text(row[0], x, y, { width: 150 });
      // Fix: Ensure the value is converted to string
      const value = row[1] !== undefined && row[1] !== null ? String(row[1]) : '';
      doc.text(value, x + 150, y, { width: 100 });
      y += 20;
    });

    doc.moveDown(2);

    // Detailed Report Table
    doc.fontSize(14).font('Helvetica-Bold').text('DETAILED REPORT', { underline: true });
    doc.moveDown(0.5);

    // Table headers
    const tableHeaders = ['#', 'Station', 'DR', 'Status', 'Folders', 'Registers', 'Total'];
    const headerY = doc.y;
    doc.fontSize(8).font('Helvetica-Bold');

    let tableX = 50;
    const colWidths = [25, 80, 80, 70, 45, 45, 45];
    
    tableHeaders.forEach((header, index) => {
      doc.text(header, tableX, headerY, { width: colWidths[index], align: 'center' });
      tableX += colWidths[index];
    });

    // Draw header line
    doc.moveTo(50, headerY + 15).lineTo(50 + colWidths.reduce((a, b) => a + b, 0), headerY + 15).stroke();
    doc.moveDown();

    // Table rows
    let rowY = doc.y;
    let rowCount = 0;

    rows.forEach((row, rowIndex) => {
      // Check if we need a new page
      if (rowY > 700) {
        doc.addPage();
        rowY = 50;
      }

      const status = row['Submission Status'] || 'Not Started';
      let statusColor = 'black';
      if (status === 'Approved') statusColor = 'green';
      else if (status === 'Pending Review') statusColor = 'orange';
      else if (status === 'Needs Revision') statusColor = 'red';
      else if (status === 'Draft') statusColor = 'blue';
      else if (status === 'Not Started') statusColor = 'gray';

      const rowData = [
        (rowIndex + 1).toString(),
        row['Station'] || '',
        row['Assigned DR'] || '',
        status,
        String(row['File Folders'] || 0),
        String(row['Registers'] || 0),
        String(row['Total Items'] || 0),
      ];

      doc.fontSize(7).font('Helvetica');
      let xPos = 50;
      rowData.forEach((data, colIndex) => {
        if (colIndex === 3) {
          doc.fillColor(statusColor).text(data, xPos, rowY, { width: colWidths[colIndex], align: 'center' });
          doc.fillColor('black');
        } else {
          doc.text(data, xPos, rowY, { width: colWidths[colIndex], align: 'center' });
        }
        xPos += colWidths[colIndex];
      });

      rowY += 20;
      rowCount++;

      // Draw row line
      if (rowCount % 10 === 0) {
        doc.moveTo(50, rowY).lineTo(50 + colWidths.reduce((a, b) => a + b, 0), rowY).stroke();
      }
    });

    // Zero Submissions Section
    const zeroSubmissions = rows.filter(row => 
      row['Submission Status'] === 'Not Started' || row['Submission Status'] === 'Draft'
    );

    if (zeroSubmissions.length > 0) {
      doc.addPage();
      doc.fontSize(14).font('Helvetica-Bold').text('ZERO SUBMISSIONS REPORT', { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(10).font('Helvetica').text(`Total stations with no submission or draft only: ${zeroSubmissions.length}`);
      doc.moveDown();

      // Table for zero submissions
      const zeroHeaders = ['#', 'Station', 'DR', 'Status'];
      const zeroColWidths = [30, 120, 120, 100];
      let zeroY = doc.y;

      doc.fontSize(8).font('Helvetica-Bold');
      let zeroX = 50;
      zeroHeaders.forEach((header, index) => {
        doc.text(header, zeroX, zeroY, { width: zeroColWidths[index], align: 'center' });
        zeroX += zeroColWidths[index];
      });
      doc.moveTo(50, zeroY + 15).lineTo(50 + zeroColWidths.reduce((a, b) => a + b, 0), zeroY + 15).stroke();
      doc.moveDown();

      zeroY = doc.y;
      zeroSubmissions.forEach((row, index) => {
        if (zeroY > 700) {
          doc.addPage();
          zeroY = 50;
        }

        const rowData = [
          (index + 1).toString(),
          row['Station'] || '',
          row['Assigned DR'] || '',
          row['Submission Status'] || 'Not Started',
        ];

        doc.fontSize(7).font('Helvetica');
        let xPos = 50;
        rowData.forEach((data, colIndex) => {
          doc.text(data, xPos, zeroY, { width: zeroColWidths[colIndex], align: 'center' });
          xPos += zeroColWidths[colIndex];
        });
        zeroY += 20;
      });
    }

    doc.end();
    return;
  }

  // Generate Word (DOCX) - using simple HTML format that Word can read
  if (format === 'docx') {
    let html = `
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Station Requirements Report</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 40px; }
          h1 { text-align: center; color: #1a365d; }
          .subtitle { text-align: center; color: #4a5568; margin-bottom: 20px; }
          h2 { color: #2d3748; border-bottom: 2px solid #4299e1; padding-bottom: 5px; margin-top: 30px; }
          table { width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 12px; }
          th { background-color: #2b6cb0; color: white; padding: 10px; border: 1px solid #2b6cb0; text-align: left; }
          td { padding: 8px; border: 1px solid #e2e8f0; }
          tr:nth-child(even) { background-color: #f7fafc; }
          .status-approved { color: #38a169; font-weight: bold; }
          .status-pending { color: #d69e2e; font-weight: bold; }
          .status-revision { color: #e53e3e; font-weight: bold; }
          .status-draft { color: #3182ce; font-weight: bold; }
          .status-notstarted { color: #718096; font-weight: bold; }
          .status-submitted { color: #2b6cb0; font-weight: bold; }
          .summary-table { width: 50%; margin: 20px auto; }
          .summary-table td { padding: 8px 15px; }
          .summary-table tr:nth-child(even) { background-color: #edf2f7; }
          .summary-table .label { font-weight: bold; }
          .zero-section { margin-top: 30px; }
          .page-break { page-break-after: always; }
          .footer { text-align: center; color: #718096; font-size: 10px; margin-top: 30px; }
    </style>
  </head>
  <body>
    <h1>STATION REQUIREMENTS REPORT</h1>
    <p class="subtitle">Generated: ${new Date().toLocaleString()}</p>
    <p class="subtitle">Filter: ${filterInfo}</p>

    <h2>SUMMARY</h2>
    <table class="summary-table">
      <tr><td class="label">Total Stations</td><td>${summary.totalStations}</td></tr>
      <tr><td class="label">Submitted</td><td>${summary.submitted}</td></tr>
      <tr><td class="label">Pending Review</td><td>${summary.pendingReview}</td></tr>
      <tr><td class="label">Approved</td><td>${summary.approved}</td></tr>
      <tr><td class="label">Needs Revision</td><td>${summary.needsRevision}</td></tr>
      <tr><td class="label">Draft Only</td><td>${summary.draftOnly}</td></tr>
      <tr><td class="label">Not Started</td><td>${summary.notStarted}</td></tr>
      <tr><td class="label">Total File Folders</td><td>${summary.totalFileFolders}</td></tr>
      <tr><td class="label">Total Registers</td><td>${summary.totalRegisters}</td></tr>
      <tr><td class="label">Completion Rate</td><td>${summary.completionRate}%</td></tr>
    </table>

    <h2>DETAILED REPORT</h2>
    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>Station</th>
          <th>Assigned DR</th>
          <th>Submission Status</th>
          <th>File Folders</th>
          <th>Registers</th>
          <th>Total Items</th>
        </tr>
      </thead>
      <tbody>
    `;

    rows.forEach((row, index) => {
      const status = row['Submission Status'] || 'Not Started';
      let statusClass = 'status-notstarted';
      if (status === 'Approved') statusClass = 'status-approved';
      else if (status === 'Pending Review') statusClass = 'status-pending';
      else if (status === 'Needs Revision') statusClass = 'status-revision';
      else if (status === 'Draft') statusClass = 'status-draft';
      else if (status === 'Submitted') statusClass = 'status-submitted';

      html += `
        <tr>
          <td>${index + 1}</td>
          <td>${row['Station'] || ''}</td>
          <td>${row['Assigned DR'] || ''}</td>
          <td class="${statusClass}">${status}</td>
          <td>${row['File Folders'] || 0}</td>
          <td>${row['Registers'] || 0}</td>
          <td>${row['Total Items'] || 0}</td>
        </tr>
      `;
    });

    html += `
      </tbody>
    </table>
    `;

    // Zero Submissions Section
    const zeroSubmissions = rows.filter(row => 
      row['Submission Status'] === 'Not Started' || row['Submission Status'] === 'Draft'
    );

    if (zeroSubmissions.length > 0) {
      html += `
        <div class="page-break"></div>
        <h2>ZERO SUBMISSIONS</h2>
        <p>Total stations with no submission or draft only: ${zeroSubmissions.length}</p>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Station</th>
              <th>Assigned DR</th>
              <th>Submission Status</th>
            </tr>
          </thead>
          <tbody>
      `;

      zeroSubmissions.forEach((row, index) => {
        const status = row['Submission Status'] || 'Not Started';
        let statusClass = 'status-notstarted';
        if (status === 'Draft') statusClass = 'status-draft';

        html += `
          <tr>
            <td>${index + 1}</td>
            <td>${row['Station'] || ''}</td>
            <td>${row['Assigned DR'] || ''}</td>
            <td class="${statusClass}">${status}</td>
          </tr>
        `;
      });

      html += `
          </tbody>
        </table>
      `;
    }

    html += `
    <p class="footer">Generated by Court System - ${new Date().toLocaleString()}</p>
  </body>
  </html>
  `;

    res.setHeader('Content-Type', 'application/msword');
    res.setHeader('Content-Disposition', `attachment; filename=station-requirements-report-${new Date().toISOString().split('T')[0]}.doc`);
    res.send(html);
    return;
  }

  throw new AppError('Unsupported format. Please use pdf or docx.', 400);
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