// routes/stationrequirements.routes.ts

import { Router } from 'express';
import {
  createSubmissionHandler,
  getSubmissionsHandler,
  getSubmissionByIdHandler,
  getSubmissionsByStationHandler,
  updateSubmissionHandler,
  deleteSubmissionHandler,
  getSubmissionTotalsHandler,
  getUniqueStationsHandler,
  getUniqueQuartersHandler,
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

// GET /api/station-requirements/stations - Get all unique stations
router.get('/stations', adminOrDr, getUniqueStationsHandler);

// GET /api/station-requirements/quarters - Get all unique quarters
router.get('/quarters', adminOrDr, getUniqueQuartersHandler);

// ============================================================
// ✅ Admin Only Routes - SPECIFIC routes FIRST
// ============================================================

// ⚠️ IMPORTANT: Put /totals BEFORE /:id to avoid conflict
router.get('/totals', adminOnly, getSubmissionTotalsHandler);

// GET /api/station-requirements - Admin can view all submissions with filtering
router.get(
  '/',
  adminOnly,
  getSubmissionsHandler
);

// ============================================================
// ✅ DR (Deputy Registrar) Only Routes
// ============================================================

// POST /api/station-requirements - DRs can create submissions
router.post(
  '/',
  drOnly,
  validate(createSubmissionSchema),
  createSubmissionHandler
);

// GET /api/station-requirements/station/:station - DRs can view their station's submissions
// ⚠️ IMPORTANT: Put /station/:station BEFORE /:id
router.get(
  '/station/:station',
  drOnly,
  getSubmissionsByStationHandler
);

// PUT /api/station-requirements/:id - DRs can update their own submission
router.put(
  '/:id',
  drOnly,
  validate(updateSubmissionSchema),
  updateSubmissionHandler
);

// ============================================================
// ✅ Shared Routes with ID parameter - MUST come LAST
// ============================================================

// GET /api/station-requirements/:id - Get a specific submission
router.get(
  '/:id',
  adminOrDr,
  getSubmissionByIdHandler
);

// DELETE /api/station-requirements/:id - Admin can delete any submission
router.delete(
  '/:id',
  adminOnly,
  validate(deleteSubmissionSchema),
  deleteSubmissionHandler
);

export default router;