// routes/stationrequirements.routes.ts

import { Router } from 'express';
import {
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
} from './stationrequirements.controller';
import { 
  protect, 
  adminOnly, 
  drOnly, 
  adminOrDr,
} from '../../middleware/auth.middleware';
import {
  createSubmissionSchema,
  getSubmissionsSchema,
  getSubmissionSchema,
  updateSubmissionSchema,
  deleteSubmissionSchema,
  submitDraftSchema,
  adminReviewSchema,
  getStationReportSchema,
  getSubmissionStatsSchema,
  downloadReportSchema,
} from './stationrequirements.validation';
import { validate } from '../../middleware/validate.middleware';

const router = Router();

// ============================================================
// ✅ All routes require authentication
// ============================================================
router.use(protect);

// ============================================================
// ✅ Shared Routes (Accessible by BOTH Admin and DR)
// ============================================================

// GET /api/station-requirements/categories
router.get('/categories', adminOrDr, getCaseCategoriesHandler);

// GET /api/station-requirements/register-categories
router.get('/register-categories', adminOrDr, getRegisterCategoriesHandler);

// GET /api/station-requirements/registers
router.get('/registers', adminOrDr, getRegistersHandler);

// GET /api/station-requirements/valid-cases
router.get('/valid-cases', adminOrDr, getValidCasesHandler);

// GET /api/station-requirements/valid-registers
router.get('/valid-registers', adminOrDr, getValidRegistersHandler);

// GET /api/station-requirements/stations
router.get('/stations', adminOrDr, getUniqueStationsHandler);

// ============================================================
// ✅ DR Only Routes
// ============================================================

// GET /api/station-requirements/my-submissions
router.get(
  '/my-submissions',
  drOnly,
  validate(getSubmissionsSchema),
  getMySubmissionsHandler
);

// POST /api/station-requirements
router.post(
  '/',
  drOnly,
  validate(createSubmissionSchema),
  createSubmissionHandler
);

// POST /api/station-requirements/:id/submit
router.post(
  '/:id/submit',
  drOnly,
  validate(submitDraftSchema),
  submitDraftHandler
);

// PUT /api/station-requirements/:id
router.put(
  '/:id',
  drOnly,
  validate(updateSubmissionSchema),
  updateSubmissionHandler
);

// ============================================================
// ✅ Admin Only Routes - MUST come before any /:id routes
// ============================================================

// ⚠️ IMPORTANT: All specific routes MUST be defined BEFORE /:id

// GET /api/station-requirements/totals
router.get('/totals', adminOnly, getSubmissionTotalsHandler);

// GET /api/station-requirements
router.get(
  '/',
  adminOnly,
  validate(getSubmissionsSchema),
  getSubmissionsHandler
);

// GET /api/station-requirements/report
router.get(
  '/report',
  adminOnly,
  validate(getStationReportSchema),
  getStationReportHandler
);

// GET /api/station-requirements/dashboard
router.get(
  '/dashboard',
  adminOnly,
  getAdminDashboardHandler
);

// GET /api/station-requirements/review-queue
router.get(
  '/review-queue',
  adminOnly,
  getReviewQueueHandler
);

// GET /api/station-requirements/submission-stats
router.get(
  '/submission-stats',
  adminOnly,
  validate(getSubmissionStatsSchema),
  getSubmissionStatsHandler
);

// ⚠️ CRITICAL: /download-report MUST come before /:id
// GET /api/station-requirements/download-report
router.get(
  '/download-report',
  adminOnly,
  validate(downloadReportSchema),
  downloadReportHandler
);

// ============================================================
// ✅ Admin Only Routes with ID parameter
// ============================================================

// POST /api/station-requirements/:id/review
router.post(
  '/:id/review',
  adminOnly,
  validate(adminReviewSchema),
  adminReviewHandler
);

// DELETE /api/station-requirements/:id
router.delete(
  '/:id',
  adminOnly,
  validate(deleteSubmissionSchema),
  deleteSubmissionHandler
);

// ============================================================
// ✅ Shared Routes with ID parameter - MUST come LAST
// ============================================================

// GET /api/station-requirements/:id - This MUST be the LAST route
router.get(
  '/:id',
  adminOrDr,
  validate(getSubmissionSchema),
  getSubmissionByIdHandler
);

export default router;