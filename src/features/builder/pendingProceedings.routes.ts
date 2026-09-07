// routes/pendingProceedings.routes.ts

import { Router } from 'express';
import {
  createSubmissionController,
  updateSubmissionController,
  getSubmissionController,
  getSubmissionsController,
  deleteSubmissionController,
  getSubmissionStatsController,
  getAdminDashboardController,
  downloadReportController,
  getCategoriesController,
  getItemsByCategoryController,
  bulkUpsertSubmissionsController,
} from './pendingProceedings.controller';
import { protect, adminOnly, drOnly, adminOrDr } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validate.middleware';
import {
  createSubmissionSchema,
  updateSubmissionSchema,
  getSubmissionSchema,
  deleteSubmissionSchema,
  getSubmissionsSchema,
  downloadReportSchema,
} from './pendingProceedings.validation';

const router = Router();

// ============================================================
// ✅ All routes require authentication
// ============================================================
router.use(protect);

// ============================================================
// ✅ Shared Routes (Accessible by BOTH Admin and DR)
// ============================================================

// GET /api/pending-proceedings/categories
router.get('/categories', adminOrDr, getCategoriesController);

// GET /api/pending-proceedings/categories/:category/items
router.get('/categories/:category/items', adminOrDr, getItemsByCategoryController);

// GET /api/pending-proceedings/stats
router.get('/stats', adminOrDr, getSubmissionStatsController);

// ============================================================
// ✅ DR Only Routes
// ============================================================

// GET /api/pending-proceedings/my-submissions
router.get(
  '/my-submissions',
  drOnly,
  validate(getSubmissionsSchema),
  getSubmissionsController
);

// POST /api/pending-proceedings
router.post(
  '/',
  drOnly,
  validate(createSubmissionSchema),
  createSubmissionController
);

// PUT /api/pending-proceedings/:id
router.put(
  '/:id',
  drOnly,
  validate(updateSubmissionSchema),
  updateSubmissionController
);

// ============================================================
// ✅ Admin Only Routes - MUST come before any /:id routes
// ============================================================

// ⚠️ IMPORTANT: All specific routes MUST be defined BEFORE /:id

// GET /api/pending-proceedings
router.get(
  '/',
  adminOnly,
  validate(getSubmissionsSchema),
  getSubmissionsController
);

// GET /api/pending-proceedings/dashboard
router.get(
  '/dashboard',
  adminOnly,
  getAdminDashboardController
);

// ⚠️ CRITICAL: /download-report MUST come before /:id
// GET /api/pending-proceedings/download-report
router.get(
  '/download-report',
  adminOnly,
  validate(downloadReportSchema),
  downloadReportController
);

// ============================================================
// ✅ Admin Only Routes with ID parameter
// ============================================================

// POST /api/pending-proceedings/bulk
router.post(
  '/bulk',
  adminOnly,
  bulkUpsertSubmissionsController
);

// DELETE /api/pending-proceedings/:id
router.delete(
  '/:id',
  adminOnly,
  validate(deleteSubmissionSchema),
  deleteSubmissionController
);

// ============================================================
// ✅ Shared Routes with ID parameter - MUST come LAST
// ============================================================

// GET /api/pending-proceedings/:id - This MUST be the LAST route
router.get(
  '/:id',
  adminOrDr,
  validate(getSubmissionSchema),
  getSubmissionController
);

export default router;