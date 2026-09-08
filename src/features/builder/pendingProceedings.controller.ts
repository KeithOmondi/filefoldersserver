// controllers/pendingProceedings.controller.ts

import { Request, Response, NextFunction } from 'express';
import { AppError } from '../../utils/Apperror';
import {
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
} from './pendingProceedings.service';
import {
  createSubmissionSchema,
  updateSubmissionSchema,
  getSubmissionSchema,
  deleteSubmissionSchema,
  getSubmissionsSchema,
  getStationReportSchema,
  downloadReportSchema,
  getAdminDashboardSchema,
} from './pendingProceedings.validation';
import { PENDING_PROCEEDINGS_CATEGORIES } from './pendingProceedings.types';
import { catchAsync } from '../../utils/catchasync';

// ============================================================
// CREATE SUBMISSION
// ============================================================

export const createSubmissionController = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const validated = createSubmissionSchema.parse(req);

    // Validate proceeding items
    const courtOfAppealValidation = validateProceedingItems(
      validated.body.courtOfAppeal,
      'Pending Proceedings to Court of Appeal'
    );
    if (!courtOfAppealValidation.valid) {
      throw new AppError(courtOfAppealValidation.errors.join('; '), 400);
    }

    const subordinateCourtsValidation = validateProceedingItems(
      validated.body.subordinateCourts,
      'Pending Proceedings to Subordinate Courts'
    );
    if (!subordinateCourtsValidation.valid) {
      throw new AppError(subordinateCourtsValidation.errors.join('; '), 400);
    }

    // ✅ Get user from request (assuming auth middleware adds user)
    const authUser = req.user as { id: string; fullName: string; email: string } | undefined;
    
    const submission = await createSubmission(
      validated.body,
      authUser?.id,
      authUser ? { fullName: authUser.fullName, email: authUser.email } : undefined
    );

    res.status(201).json({
      success: true,
      data: {
        submission: submission
      },
      message: 'Submission created successfully',
    });
  }
);

// ============================================================
// UPDATE SUBMISSION
// ============================================================

export const updateSubmissionController = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const validated = updateSubmissionSchema.parse(req);

    // Validate proceeding items if provided
    if (validated.body.courtOfAppeal) {
      const validation = validateProceedingItems(
        validated.body.courtOfAppeal,
        'Pending Proceedings to Court of Appeal'
      );
      if (!validation.valid) {
        throw new AppError(validation.errors.join('; '), 400);
      }
    }

    if (validated.body.subordinateCourts) {
      const validation = validateProceedingItems(
        validated.body.subordinateCourts,
        'Pending Proceedings from Subordinate Courts'
      );
      if (!validation.valid) {
        throw new AppError(validation.errors.join('; '), 400);
      }
    }

    const submission = await updateSubmission(
      validated.params.id,
      validated.body
    );

    // ✅ Fix: Return data as { submission: submission }
    res.status(200).json({
      success: true,
      data: {
        submission: submission  // ✅ Wrap in submission object
      },
      message: 'Submission updated successfully',
    });
  }
);

// ============================================================
// GET SUBMISSION BY ID
// ============================================================

export const getSubmissionController = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const validated = getSubmissionSchema.parse(req);

    const submission = await getSubmissionById(validated.params.id);

    // ✅ Fix: Return data as { submission: submission }
    res.status(200).json({
      success: true,
      data: {
        submission: submission  // ✅ Wrap in submission object
      },
    });
  }
);

// ============================================================
// GET SUBMISSIONS (List)
// ============================================================

export const getSubmissionsController = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const validated = getSubmissionsSchema.parse(req);

    const result = await getSubmissions(validated.query);

    // ✅ This one is already correct - returns submissions array directly
    res.status(200).json({
      success: true,
      data: {
        submissions: result.submissions,
        total: result.total,
        page: result.page,
        limit: result.limit,
        hasMore: result.hasMore,
      },
    });
  }
);

// ============================================================
// DELETE SUBMISSION
// ============================================================

export const deleteSubmissionController = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const validated = deleteSubmissionSchema.parse(req);

    await deleteSubmission(validated.params.id);

    res.status(200).json({
      success: true,
      message: 'Submission deleted successfully',
    });
  }
);

// ============================================================
// GET STATION REPORT
// ============================================================

export const getStationReportController = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const validated = getStationReportSchema.parse(req);

    const result = await getStationReport(validated.query);

    res.status(200).json({
      success: true,
      data: {
        report: result.report,
        pagination: {
          total: result.total,
          page: result.page,
          limit: result.limit,
          hasMore: result.hasMore,
        },
      },
    });
  }
);

// ============================================================
// GET SUBMISSION STATS
// ============================================================

export const getSubmissionStatsController = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const stats = await getSubmissionStats();

    res.status(200).json({
      success: true,
      data: {
        stats: stats,  // ✅ Wrap in stats object
      },
    });
  }
);

// ============================================================
// GET ADMIN DASHBOARD
// ============================================================

export const getAdminDashboardController = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const validated = getAdminDashboardSchema.parse(req);

    const stats = await getAdminDashboardStats();

    res.status(200).json({
      success: true,
      data: {
        data: stats,  // ✅ Wrap in data object
      },
    });
  }
);

// ============================================================
// DOWNLOAD REPORT
// ============================================================

export const downloadReportController = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const validated = downloadReportSchema.parse(req);

    const { format = 'pdf', fromDate, toDate } = validated.query;

    const reportData = await generateReportData(fromDate, toDate);

    if (format === 'pdf') {
      // Generate PDF (implement with your PDF library of choice)
      res.status(200).json({
        success: true,
        data: {
          data: reportData,  // ✅ Wrap in data object
          format: 'pdf',
        },
        message: 'PDF generation not implemented yet',
      });
    } else if (format === 'docx') {
      res.status(200).json({
        success: true,
        data: {
          data: reportData,  // ✅ Wrap in data object
          format: 'docx',
        },
        message: 'DOCX generation not implemented yet',
      });
    } else {
      // Default to JSON
      res.status(200).json({
        success: true,
        data: {
          data: reportData,  // ✅ Wrap in data object
          format: 'json',
        },
      });
    }
  }
);

// ============================================================
// GET AVAILABLE CATEGORIES
// ============================================================

export const getCategoriesController = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const categories = Object.keys(PENDING_PROCEEDINGS_CATEGORIES).map((key) => ({
      category: key,
      items: PENDING_PROCEEDINGS_CATEGORIES[key as keyof typeof PENDING_PROCEEDINGS_CATEGORIES],
    }));

    res.status(200).json({
      success: true,
      data: {
        data: categories,  // ✅ Wrap in data object
      },
    });
  }
);

// ============================================================
// GET ITEMS BY CATEGORY
// ============================================================

export const getItemsByCategoryController = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    // Ensure category is a string (not string[])
    const category = Array.isArray(req.params.category) 
      ? req.params.category[0] 
      : req.params.category;

    if (!category) {
      throw new AppError('Category parameter is required', 400);
    }

    const categories = Object.keys(PENDING_PROCEEDINGS_CATEGORIES);
    if (!categories.includes(category)) {
      throw new AppError(
        `Invalid category. Must be one of: ${categories.join(', ')}`,
        400
      );
    }

    const items = PENDING_PROCEEDINGS_CATEGORIES[category as keyof typeof PENDING_PROCEEDINGS_CATEGORIES];

    res.status(200).json({
      success: true,
      data: {
        data: {  // ✅ Wrap in data object
          category,
          items,
        },
      },
    });
  }
);

// ============================================================
// BULK CREATE/UPDATE SUBMISSIONS
// ============================================================

export const bulkUpsertSubmissionsController = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const { submissions } = req.body;

    if (!Array.isArray(submissions) || submissions.length === 0) {
      throw new AppError('Submissions array is required and must not be empty', 400);
    }

    const results = [];
    const errors = [];

    for (const submission of submissions) {
      try {
        // Validate proceeding items
        const courtOfAppealValidation = validateProceedingItems(
          submission.courtOfAppeal || [],
          'Pending Proceedings to Court of Appeal'
        );
        if (!courtOfAppealValidation.valid) {
          errors.push({
            station: submission.station,
            error: courtOfAppealValidation.errors.join('; '),
          });
          continue;
        }

        const subordinateCourtsValidation = validateProceedingItems(
          submission.subordinateCourts || [],
          'Pending Proceedings from Subordinate Courts'
        );
        if (!subordinateCourtsValidation.valid) {
          errors.push({
            station: submission.station,
            error: subordinateCourtsValidation.errors.join('; '),
          });
          continue;
        }

        // Check if submission exists
        const existing = await getSubmissionById(submission.id).catch(() => null);

        let result;
        if (existing) {
          // Update
          result = await updateSubmission(submission.id, {
            station: submission.station,
            courtOfAppeal: submission.courtOfAppeal,
            subordinateCourts: submission.subordinateCourts,
          });
        } else {
          // Create
          result = await createSubmission({
            station: submission.station,
            courtOfAppeal: submission.courtOfAppeal || [],
            subordinateCourts: submission.subordinateCourts || [],
          });
        }

        results.push(result);
      } catch (error) {
        errors.push({
          station: submission.station,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    res.status(200).json({
      success: true,
      data: {
        data: {  // ✅ Wrap in data object
          results,
          errors,
          summary: {
            total: submissions.length,
            successful: results.length,
            failed: errors.length,
          },
        },
      },
    });
  }
);

// ============================================================
// EXPORT
// ============================================================

export default {
  createSubmissionController,
  updateSubmissionController,
  getSubmissionController,
  getSubmissionsController,
  deleteSubmissionController,
  getStationReportController,
  getSubmissionStatsController,
  getAdminDashboardController,
  downloadReportController,
  getCategoriesController,
  getItemsByCategoryController,
  bulkUpsertSubmissionsController,
};