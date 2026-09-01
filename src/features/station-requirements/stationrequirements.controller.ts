// controllers/stationrequirements.controller.ts
import { Request, Response } from 'express';
import * as stationRequirementsService from './stationrequirements.service';
import {
  CreateSubmissionInput,
  GetSubmissionsQuery,
  StationRequirementItem,
  CASE_CATEGORIES,
  CaseCategory,
} from './stationrequirements.types';
import { catchAsync } from '../../utils/catchasync';
import { sendResponse } from '../../utils/Apiresponse';
import { AppError } from '../../utils/Apperror';

// Extend Express Request to include user
interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
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
// GET /api/station-requirements/categories
// NEW: Get all valid case categories and their names
// ============================================================
export const getCaseCategoriesHandler = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  console.log('🔍 [Controller] getCaseCategories');

  const categories = stationRequirementsService.getAllValidCases();

  console.log('✅ [Controller] Case categories retrieved:', categories.length);

  sendResponse(res, 200, { categories }, 'Case categories retrieved successfully');
});

// ============================================================
// POST /api/station-requirements
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

  // Check fileFolders array with validation
  logItemDetails(req.body.fileFolders || [], 'fileFolders');

  // Check registers array with validation
  logItemDetails(req.body.registers || [], 'registers');

  // User info
  console.log('🔍 [6] User info:', {
    userId: req.user?.id,
    userRole: req.user?.role,
    userEmail: req.user?.email,
  });

  // Get userId from authenticated request
  const userId = req.user?.id;

  // Prepare the input
  const input: CreateSubmissionInput = req.body;

  console.log('🔍 [8] Final input to service:', JSON.stringify(input, null, 2));

  const submission = await stationRequirementsService.createSubmission(input, userId);

  console.log('✅ [9] Submission created successfully:', {
    id: submission.id,
    station: submission.station,
    fileFoldersCount: submission.fileFolders.length,
    registersCount: submission.registers.length,
  });

  sendResponse(res, 201, { submission }, 'Submission created successfully');
});

// ============================================================
// GET /api/station-requirements
// ============================================================
export const getSubmissionsHandler = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  // Build query object from req.query
  const query: GetSubmissionsQuery = {
    station: req.query.station as string | undefined,
    fromDate: req.query.fromDate as string | undefined,
    toDate: req.query.toDate as string | undefined,
    page: req.query.page ? parseInt(req.query.page as string, 10) : undefined,
    limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined,
  };

  console.log('🔍 [Controller] getSubmissions query:', query);

  const result = await stationRequirementsService.getSubmissions(query);

  // Log the response to verify IDs are included
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
    },
    'Submissions retrieved successfully'
  );
});

// ============================================================
// GET /api/station-requirements/:id
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
    submittedBy: submission.submitterName || submission.submitterEmail || 'Unknown User',
    fileFoldersCount: submission.fileFolders.length,
    registersCount: submission.registers.length,
  });

  sendResponse(res, 200, { submission }, 'Submission retrieved successfully');
});

// ============================================================
// GET /api/station-requirements/station/:station
// ============================================================
export const getSubmissionsByStationHandler = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  const station = Array.isArray(req.params.station) ? req.params.station[0] : req.params.station;

  if (!station) {
    throw new AppError('Station name is required', 400);
  }

  console.log('🔍 [Controller] getSubmissionsByStation:', { station });

  const submissions = await stationRequirementsService.getSubmissionsByStation(station);

  console.log('✅ [Controller] Submissions by station retrieved:', {
    station,
    count: submissions.length,
  });

  sendResponse(res, 200, { submissions }, 'Submissions retrieved successfully');
});

// ============================================================
// PUT /api/station-requirements/:id
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

  const input: Partial<CreateSubmissionInput> = req.body;
  const userId = req.user?.id;

  const submission = await stationRequirementsService.updateSubmission(id, input, userId);

  console.log('✅ [Controller] Submission updated:', {
    id: submission.id,
    station: submission.station,
    updatedBy: submission.submitterName || submission.submitterEmail || 'Unknown User',
  });

  sendResponse(res, 200, { submission }, 'Submission updated successfully');
});

// ============================================================
// DELETE /api/station-requirements/:id
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
// ============================================================
export const getSubmissionTotalsHandler = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  console.log('🔍 [Controller] getSubmissionTotals');

  const totals = await stationRequirementsService.getSubmissionTotals();

  console.log('✅ [Controller] Totals retrieved:', totals);

  sendResponse(res, 200, totals, 'Totals retrieved successfully');
});

// ============================================================
// GET /api/station-requirements/stations
// ============================================================
export const getUniqueStationsHandler = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  console.log('🔍 [Controller] getUniqueStations');

  const stations = await stationRequirementsService.getUniqueStations();

  console.log('✅ [Controller] Unique stations retrieved:', stations.length);

  sendResponse(res, 200, { stations }, 'Stations retrieved successfully');
});

// ============================================================
// GET /api/station-requirements/valid-cases
// NEW: Get all valid case categories and names for frontend
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
  getSubmissionsByStationHandler,
  updateSubmissionHandler,
  deleteSubmissionHandler,
  getSubmissionTotalsHandler,
  getUniqueStationsHandler,
  getCaseCategoriesHandler,
  getValidCasesHandler,
};