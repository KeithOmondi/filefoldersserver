// controllers/stationrequirements.controller.ts
import { Request, Response } from 'express';
import * as stationRequirementsService from './stationrequirements.service';
import {
  CreateSubmissionInput,
  UpdateSubmissionInput,
  GetSubmissionsQuery,
  GetStationReportQuery,
  StationRequirementItem,
  SubmissionStatus,
  ReviewStatus,
  CASE_CATEGORIES,
  CaseCategory,
  calculateTotals,
} from './stationrequirements.types';
import { catchAsync } from '../../utils/catchasync';
import { sendResponse } from '../../utils/Apiresponse';
import { AppError } from '../../utils/Apperror';
import { sendSubmissionConfirmation } from '../../utils/sendMail';

// Extend Express Request to include user
interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    fullName?: string;
    role: 'admin' | 'dr';
  };
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
// Get all valid case categories and their names
// ============================================================
export const getCaseCategoriesHandler = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  console.log('🔍 [Controller] getCaseCategories');

  const categories = stationRequirementsService.getAllValidCases();

  console.log('✅ [Controller] Case categories retrieved:', categories.length);

  sendResponse(res, 200, { categories }, 'Case categories retrieved successfully');
});

// ============================================================
// POST /api/station-requirements
// Create new submission (draft or submitted)
// ============================================================
export const createSubmissionHandler = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  console.log('🔍 [1] Raw request body:', JSON.stringify(req.body, null, 2));
  console.log('🔍 [1] Raw body type:', typeof req.body);
  console.log('🔍 [1] Raw body keys:', Object.keys(req.body || {}));

  // Check for undefined values
  console.log('🔍 [2] Checking for undefined values in request body:');
  findUndefinedValues(req.body);

  // Check specific fields
  console.log('🔍 [3] Field checks:');
  console.log('  - station:', req.body.station, `(${typeof req.body.station})`);
  console.log('  - fileFolders:', req.body.fileFolders, `(${typeof req.body.fileFolders})`);
  console.log('  - registers:', req.body.registers, `(${typeof req.body.registers})`);
  console.log('  - status:', req.body.status, `(${typeof req.body.status})`);

  // Check fileFolders array with validation
  logItemDetails(req.body.fileFolders || [], 'fileFolders');

  // Check registers array with validation
  logItemDetails(req.body.registers || [], 'registers');

  // User info
  console.log('🔍 [6] User info:', {
    userId: req.user?.id,
    userRole: req.user?.role,
    userEmail: req.user?.email,
    userName: req.user?.fullName,
  });

  // Get userId from authenticated request
  const userId = req.user?.id;
  const userEmail = req.user?.email;
  const userName = req.user?.fullName;

  // Prepare the input
  const input: CreateSubmissionInput = {
    station: req.body.station,
    fileFolders: req.body.fileFolders || [],
    registers: req.body.registers || [],
    status: req.body.status || 'draft',
  };

  console.log('🔍 [8] Final input to service:', JSON.stringify(input, null, 2));

  const submission = await stationRequirementsService.createSubmission(input, userId, userEmail, userName);

  console.log('✅ [9] Submission created successfully:', {
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

// In stationrequirements.controller.ts - update getSubmissionsHandler

export const getSubmissionsHandler = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  // Build query object from req.query with proper parsing
  const query: GetSubmissionsQuery = {
    station: req.query.station as string | undefined,
    status: req.query.status as SubmissionStatus | undefined,
    reviewStatus: req.query.reviewStatus as ReviewStatus | undefined,
    fromDate: req.query.fromDate as string | undefined,
    toDate: req.query.toDate as string | undefined,
    page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
    limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 20,
    sortBy: req.query.sortBy as 'updatedAt' | 'submittedAt' | 'station' || 'updatedAt',
    sortOrder: req.query.sortOrder as 'asc' | 'desc' || 'desc',
    adminView: req.query.adminView === 'true' || req.user?.role === 'admin',
  };

  console.log('🔍 [Controller] getSubmissions query:', query);

  const result = await stationRequirementsService.getSubmissions(query);

  console.log('✅ [Controller] Submissions retrieved:', {
    total: result.total,
    firstSubmissionId: result.submissions[0]?.id,
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
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

  if (!id) {
    throw new AppError('Submission ID is required', 400);
  }

  console.log('🔍 [Controller] getSubmissionById:', id);

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
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

  if (!id) {
    throw new AppError('Submission ID is required', 400);
  }

  console.log('🔍 [Controller] updateSubmission:', { id, body: req.body });

  // Validate update data
  if (req.body.fileFolders) {
    logItemDetails(req.body.fileFolders, 'fileFolders');
  }
  if (req.body.registers) {
    logItemDetails(req.body.registers, 'registers');
  }

  const input: UpdateSubmissionInput = {
    station: req.body.station,
    fileFolders: req.body.fileFolders,
    registers: req.body.registers,
    status: req.body.status,
    reviewStatus: req.body.reviewStatus,
    adminNotes: req.body.adminNotes,
  };

  const userId = req.user?.id;

  const submission = await stationRequirementsService.updateSubmission(id, input, userId);

  console.log('✅ [Controller] Submission updated:', {
    id: submission.id,
    station: submission.station,
    status: submission.status,
    updatedBy: submission.submitterName || submission.submitterEmail || 'Unknown User',
  });

  sendResponse(res, 200, { submission }, 'Submission updated successfully');
});

// ============================================================
// POST /api/station-requirements/:id/submit
// Submit a draft
// ============================================================
export const submitDraftHandler = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

  if (!id) {
    throw new AppError('Submission ID is required', 400);
  }

  console.log('🔍 [Controller] submitDraft:', id);

  const sendEmail = req.body.sendEmail !== false;
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
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

  if (!id) {
    throw new AppError('Submission ID is required', 400);
  }

  // Only admins can review
  if (req.user?.role !== 'admin') {
    throw new AppError('Only administrators can review submissions', 403);
  }

  console.log('🔍 [Controller] adminReview:', { id, body: req.body });

  const { reviewStatus, adminNotes, sendNotification = true } = req.body;

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
    reviewedBy: req.user?.id,
  });

  // Send notification email if requested
  if (sendNotification && submission.submitterEmail) {
    try {
      // TODO: Implement admin review notification email
      // await sendAdminReviewNotification(
      //   submission.submitterEmail,
      //   submission.submitterName || 'User',
      //   submission.station,
      //   reviewStatus,
      //   adminNotes
      // );
      console.log('✅ [Controller] Review notification would be sent to:', submission.submitterEmail);
    } catch (emailError) {
      console.error('❌ [Controller] Failed to send review notification:', emailError);
      // Don't throw - email failure shouldn't stop the review
    }
  }

  sendResponse(res, 200, { submission }, 'Submission reviewed successfully');
});

// ============================================================
// GET /api/station-requirements/report
// Get station report (admin dashboard)
// ============================================================
export const getStationReportHandler = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  // Only admins can view the report
  if (req.user?.role !== 'admin') {
    throw new AppError('Only administrators can view the station report', 403);
  }

  const query: GetStationReportQuery = {
    status: req.query.status as any,
    fromDate: req.query.fromDate as string | undefined,
    toDate: req.query.toDate as string | undefined,
    page: req.query.page ? parseInt(req.query.page as string, 10) : undefined,
    limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined,
  };

  console.log('🔍 [Controller] getStationReport:', query);

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
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

  if (!id) {
    throw new AppError('Submission ID is required', 400);
  }

  console.log('🔍 [Controller] deleteSubmission:', id);

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
// Get all valid case categories and names for frontend
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
  getValidCasesHandler,
  getStationReportHandler,
  getAdminDashboardHandler,
  getReviewQueueHandler,
};