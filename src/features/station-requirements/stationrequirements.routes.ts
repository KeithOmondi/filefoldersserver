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
  getMySubmissionsHandler, // Add this
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

// GET /api/station-requirements/categories - Get all case categories with their names (File Folders)
router.get('/categories', adminOrDr, getCaseCategoriesHandler);

// GET /api/station-requirements/register-categories - Get all register categories with their names
router.get('/register-categories', adminOrDr, getRegisterCategoriesHandler);

// GET /api/station-requirements/registers - Get all registers (flat list with categories)
router.get('/registers', adminOrDr, getRegistersHandler);

// GET /api/station-requirements/valid-cases - Get all valid case categories and names for frontend
router.get('/valid-cases', adminOrDr, getValidCasesHandler);

// GET /api/station-requirements/valid-registers - Get all valid register categories and names for frontend
router.get('/valid-registers', adminOrDr, getValidRegistersHandler);

// GET /api/station-requirements/stations - Get all unique stations
router.get('/stations', adminOrDr, getUniqueStationsHandler);

// ============================================================
// ✅ DR Only Routes - Must come BEFORE admin routes
// ============================================================

// GET /api/station-requirements/my-submissions - DRs can view their own submissions (drafts + submitted)
router.get(
  '/my-submissions',
  drOnly,
  validate(getSubmissionsSchema),
  getMySubmissionsHandler
);

// POST /api/station-requirements - DRs can create submissions (draft or submitted)
router.post(
  '/',
  drOnly,
  validate(createSubmissionSchema),
  createSubmissionHandler
);

// POST /api/station-requirements/:id/submit - DRs can submit their draft
router.post(
  '/:id/submit',
  drOnly,
  validate(submitDraftSchema),
  submitDraftHandler
);

// PUT /api/station-requirements/:id - DRs can update their own submission
router.put(
  '/:id',
  drOnly,
  validate(updateSubmissionSchema),
  updateSubmissionHandler
);

// ============================================================
// ✅ Admin Only Routes - SPECIFIC routes FIRST
// ============================================================

// ⚠️ IMPORTANT: Put /totals BEFORE /:id to avoid conflict
router.get('/totals', adminOnly, getSubmissionTotalsHandler);

// GET /api/station-requirements - Admin can view all submissions with filtering
router.get(
  '/',
  adminOnly,
  validate(getSubmissionsSchema),
  getSubmissionsHandler
);

// GET /api/station-requirements/report - Admin station report
router.get(
  '/report',
  adminOnly,
  validate(getStationReportSchema),
  getStationReportHandler
);

// GET /api/station-requirements/dashboard - Admin dashboard stats
router.get(
  '/dashboard',
  adminOnly,
  getAdminDashboardHandler
);

// GET /api/station-requirements/review-queue - Admin review queue
router.get(
  '/review-queue',
  adminOnly,
  getReviewQueueHandler
);

// ============================================================
// ✅ Admin Only Routes with ID parameter
// ============================================================

// POST /api/station-requirements/:id/review - Admin reviews a submission
router.post(
  '/:id/review',
  adminOnly,
  validate(adminReviewSchema),
  adminReviewHandler
);

// DELETE /api/station-requirements/:id - Admin can delete any submission
router.delete(
  '/:id',
  adminOnly,
  validate(deleteSubmissionSchema),
  deleteSubmissionHandler
);

// ============================================================
// ✅ Shared Routes with ID parameter - MUST come LAST
// ============================================================

// GET /api/station-requirements/:id - Get a specific submission
router.get(
  '/:id',
  adminOrDr,
  validate(getSubmissionSchema),
  getSubmissionByIdHandler
);

export default router;