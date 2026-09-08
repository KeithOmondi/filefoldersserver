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
import { query } from '../../config/db';

// ============================================================
// Helper to get user from database
// ============================================================

const getUserFromDb = async (userId: string): Promise<{ fullName: string; email: string } | null> => {
  try {
    const result = await query(
      `SELECT full_name, email FROM users WHERE id = $1`,
      [userId]
    );
    if (result.rows.length > 0) {
      return {
        fullName: result.rows[0].full_name || 'Unknown User',
        email: result.rows[0].email || 'unknown@email.com',
      };
    }
    return null;
  } catch (error) {
    console.error('❌ Error fetching user from DB:', error);
    return null;
  }
};

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
      'Pending Proceedings from Subordinate Courts'
    );
    if (!subordinateCourtsValidation.valid) {
      throw new AppError(subordinateCourtsValidation.errors.join('; '), 400);
    }

    // ✅ Get user from request
    const authUser = req.user as { id: string; email?: string; role?: string } | undefined;

    let userId = authUser?.id;
    let fullName = 'Unknown User';
    let email = authUser?.email || 'unknown@email.com';

    // ✅ Fetch full user from database if userId exists
    if (userId) {
      const userFromDb = await getUserFromDb(userId);
      if (userFromDb) {
        fullName = userFromDb.fullName;
        email = userFromDb.email || email;
        console.log('✅ Fetched user from DB:', { userId, fullName, email });
      } else {
        console.warn('⚠️ User not found in DB:', userId);
      }
    }

    console.log('📤 Creating submission with:', { userId, fullName, email });

    const submission = await createSubmission(
      validated.body,
      userId,
      { fullName, email }
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

    res.status(200).json({
      success: true,
      data: {
        submission: submission
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

    res.status(200).json({
      success: true,
      data: {
        submission: submission
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
        stats: stats,
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
        data: stats,
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
      res.status(200).json({
        success: true,
        data: {
          data: reportData,
          format: 'pdf',
        },
        message: 'PDF generation not implemented yet',
      });
    } else if (format === 'docx') {
      res.status(200).json({
        success: true,
        data: {
          data: reportData,
          format: 'docx',
        },
        message: 'DOCX generation not implemented yet',
      });
    } else {
      res.status(200).json({
        success: true,
        data: {
          data: reportData,
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
        data: categories,
      },
    });
  }
);

// ============================================================
// GET ITEMS BY CATEGORY
// ============================================================

export const getItemsByCategoryController = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
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
        data: {
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

    // ✅ Get user from request
    const authUser = req.user as { id: string; email?: string; role?: string } | undefined;
    const userId = authUser?.id;
    let fullName = 'Unknown User';
    let email = authUser?.email || 'unknown@email.com';

    // ✅ Fetch full user from database if userId exists
    if (userId) {
      const userFromDb = await getUserFromDb(userId);
      if (userFromDb) {
        fullName = userFromDb.fullName;
        email = userFromDb.email || email;
        console.log('✅ Fetched user from DB for bulk:', { userId, fullName, email });
      } else {
        console.warn('⚠️ User not found in DB for bulk:', userId);
      }
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
          result = await createSubmission(
            {
              station: submission.station,
              courtOfAppeal: submission.courtOfAppeal || [],
              subordinateCourts: submission.subordinateCourts || [],
            },
            userId,
            { fullName, email }
          );
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
        data: {
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