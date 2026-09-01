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
  CASE_REGISTERS,
  ADDITIONAL_REGISTERS,
  CaseCategory,
  RegisterCategory,
  calculateTotals,
} from './stationrequirements.types';
import { catchAsync } from '../../utils/catchasync';
import { sendResponse } from '../../utils/Apiresponse';
import { AppError } from '../../utils/Apperror';
import { sendSubmissionConfirmation } from '../../utils/sendMail';

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




// controllers/stationrequirements.controller.ts

// GET /api/station-requirements/my-submissions
// DRs can view their own submissions (drafts and submitted)
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
    // DRs only see their own submissions
    adminView: false,
    // Filter by submitter
    //submittedBy: userId,
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
};