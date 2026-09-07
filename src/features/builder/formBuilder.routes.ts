// routes/formBuilder.routes.ts

import { Router } from 'express';
import {
  createForm,
  getForms,
  getFormById,
  updateForm,
  deleteForm,
  publishForm,
  unpublishForm,
  submitFormResponse,
  getFormSubmissions,
  getMyFormSubmissions,
  getFormSubmissionById,
  reviewFormSubmission,
  deleteFormSubmission,
  getFormStatistics,
  getFormAnalytics,
  exportSubmissions,
  addQuestion,
  updateQuestion,
  deleteQuestion,
  addSection,
  deleteSection,
  reorderSections,
  duplicateForm,
  getFormTemplates,
  createFormFromTemplate,
} from './formBuilder.controller';
import {
  protect,
  adminOnly,
  drOnly,
  adminOrDr,
} from '../../middleware/auth.middleware';
import {
  createFormSchema,
  updateFormSchema,
  getFormsSchema,
  getFormSchema,
  deleteFormSchema,
  submitFormResponseSchema,
  getFormSubmissionsSchema,
  getFormSubmissionSchema,
  reviewFormSubmissionSchema,
  addQuestionSchema,
  updateQuestionSchema,
  deleteQuestionSchema,
  addSectionSchema,
  deleteSectionSchema,
  exportSubmissionsSchema,
  getFormAnalyticsSchema,
} from './formBuilder.validation';
import { validate } from '../../middleware/validate.middleware';

const router = Router();

// ============================================================
// ✅ All routes require authentication
// ============================================================
router.use(protect);

// ============================================================
// ✅ Admin Only Routes - Specific routes FIRST (no :id params)
// ============================================================

// GET /api/forms/templates - Get available form templates
router.get(
  '/templates',
  adminOnly,
  getFormTemplates
);

// POST /api/forms/templates/:templateId - Create a form from a template
router.post(
  '/templates/:templateId',
  adminOnly,
  validate(createFormSchema),
  createFormFromTemplate
);

// POST /api/forms - Admin creates a new form
router.post(
  '/',
  adminOnly,
  validate(createFormSchema),
  createForm
);

// GET /api/forms - Admin can view all forms with filtering
router.get(
  '/',
  adminOnly,
  validate(getFormsSchema),
  getForms
);

// GET /api/forms/my-submissions - DRs can view their own submissions
router.get(
  '/my-submissions',
  drOnly,
  validate(getFormsSchema),
  getMyFormSubmissions
);

// ============================================================
// ✅ Routes with :formId parameter
// ============================================================

// GET /api/forms/statistics/:formId - Admin can view form statistics
router.get(
  '/statistics/:formId',
  adminOnly,
  validate(getFormSchema),
  getFormStatistics
);

// GET /api/forms/analytics/:formId - Admin can view detailed analytics
router.get(
  '/analytics/:formId',
  adminOnly,
  validate(getFormAnalyticsSchema),
  getFormAnalytics
);

// GET /api/forms/:formId/export - Export submissions
router.get(
  '/:formId/export',
  adminOnly,
  validate(exportSubmissionsSchema),
  exportSubmissions
);

// POST /api/forms/:formId/duplicate - Duplicate an existing form
router.post(
  '/:formId/duplicate',
  adminOnly,
  validate(getFormSchema),
  duplicateForm
);

// PUT /api/forms/:formId/publish - Admin publishes a form
router.put(
  '/:formId/publish',
  adminOnly,
  validate(getFormSchema),
  publishForm
);

// PUT /api/forms/:formId/unpublish - Admin unpublishes a form
router.put(
  '/:formId/unpublish',
  adminOnly,
  validate(getFormSchema),
  unpublishForm
);

// GET /api/forms/:formId/submissions - Admin can view all submissions for a form
router.get(
  '/:formId/submissions',
  adminOnly,
  validate(getFormSubmissionsSchema),
  getFormSubmissions
);

// POST /api/forms/:formId/submit - DRs can submit form responses
router.post(
  '/:formId/submit',
  drOnly,
  validate(submitFormResponseSchema),
  submitFormResponse
);

// ============================================================
// ✅ Section Management Routes (Admin Only)
// ============================================================

// POST /api/forms/:formId/sections - Add a new section
router.post(
  '/:formId/sections',
  adminOnly,
  validate(addSectionSchema),
  addSection
);

// PUT /api/forms/:formId/sections/reorder - Reorder sections
router.put(
  '/:formId/sections/reorder',
  adminOnly,
  validate(getFormSchema),
  reorderSections
);

// DELETE /api/forms/:formId/sections/:sectionId - Delete a section
router.delete(
  '/:formId/sections/:sectionId',
  adminOnly,
  validate(deleteSectionSchema),
  deleteSection
);

// ============================================================
// ✅ Question Management Routes (Admin Only)
// ============================================================

// POST /api/forms/:formId/sections/:sectionId/questions - Add a question
router.post(
  '/:formId/sections/:sectionId/questions',
  adminOnly,
  validate(addQuestionSchema),
  addQuestion
);

// PUT /api/forms/:formId/sections/:sectionId/questions/:questionId - Update a question
router.put(
  '/:formId/sections/:sectionId/questions/:questionId',
  adminOnly,
  validate(updateQuestionSchema),
  updateQuestion
);

// DELETE /api/forms/:formId/sections/:sectionId/questions/:questionId - Delete a question
router.delete(
  '/:formId/sections/:sectionId/questions/:questionId',
  adminOnly,
  validate(deleteQuestionSchema),
  deleteQuestion
);

// ============================================================
// ✅ Submission Management Routes
// ============================================================

// POST /api/forms/:formId/submissions/:id/review - Admin reviews a submission
router.post(
  '/:formId/submissions/:id/review',
  adminOnly,
  validate(reviewFormSubmissionSchema),
  reviewFormSubmission
);

// DELETE /api/forms/submissions/:id - DRs can delete their own draft submissions
router.delete(
  '/submissions/:id',
  drOnly,
  validate(getFormSubmissionSchema),
  deleteFormSubmission
);

// GET /api/forms/submissions/:id - Get a specific submission
router.get(
  '/submissions/:id',
  adminOrDr,
  validate(getFormSubmissionSchema),
  getFormSubmissionById
);

// ============================================================
// ✅ Admin Only Routes with :id parameter - MUST come AFTER specific routes
// ============================================================

// PUT /api/forms/:id - Admin updates a form
router.put(
  '/:id',
  adminOnly,
  validate(updateFormSchema),
  updateForm
);

// DELETE /api/forms/:id - Admin deletes a form
router.delete(
  '/:id',
  adminOnly,
  validate(deleteFormSchema),
  deleteForm
);

// GET /api/forms/:id - Get a specific form (both admin and DR can view)
// This MUST be LAST because :id catches everything
router.get(
  '/:id',
  adminOrDr,
  validate(getFormSchema),
  getFormById
);

export default router;