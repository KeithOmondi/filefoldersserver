// controllers/formBuilder.controller.ts

import { Request, Response } from 'express';
import * as formBuilderService from './formBuilder.service';
import { catchAsync } from '../../utils/catchasync';
import { sendResponse } from '../../utils/Apiresponse';
import { AppError } from '../../utils/Apperror';

// Extend Express Request to include user
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
// CREATE FORM (Admin only)
// ============================================================
export const createForm = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  if (req.user?.role !== 'admin') {
    throw new AppError('Only administrators can create forms', 403);
  }

  const validatedBody = req.validatedBody || req.body;
  const userId = req.user?.id;

  if (!userId) {
    throw new AppError('User not authenticated', 401);
  }

  console.log('🔍 [Controller] createForm:', {
    title: validatedBody.title,
    sectionsCount: validatedBody.sections?.length || 0,
    userId,
  });

  const form = await formBuilderService.createForm(validatedBody, userId);

  console.log('✅ [Controller] Form created:', {
    id: form.id,
    title: form.title,
    status: form.status,
  });

  sendResponse(res, 201, { form }, 'Form created successfully');
});

// ============================================================
// GET FORMS
// ============================================================
export const getForms = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  const validatedQuery = req.validatedQuery || req.query;

  console.log('🔍 [Controller] getForms - Query:', validatedQuery);

  const queryParams = {
    status: validatedQuery.status as 'draft' | 'published' | 'archived' | 'closed' | undefined,
    search: validatedQuery.search as string | undefined,
    tags: (validatedQuery.tags as string[] | undefined) || [],
    page: validatedQuery.page || 1,
    limit: validatedQuery.limit || 20,
    sortBy: validatedQuery.sortBy || 'createdAt',
    sortOrder: validatedQuery.sortOrder || 'desc',
  };

  const result = await formBuilderService.getForms(queryParams);

  console.log('✅ [Controller] Forms retrieved:', {
    total: result.total,
    formsCount: result.forms.length,
    page: result.page,
  });

  sendResponse(
    res,
    200,
    {
      forms: result.forms,
      total: result.total,
      page: result.page,
      limit: result.limit,
      hasMore: result.hasMore,
    },
    'Forms retrieved successfully'
  );
});

// ============================================================
// GET FORM BY ID
// ============================================================
export const getFormById = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  const validatedParams = req.validatedParams || req.params;
  const id = validatedParams.id;

  if (!id) {
    throw new AppError('Form ID is required', 400);
  }

  console.log('🔍 [Controller] getFormById:', id);

  const form = await formBuilderService.getFormById(id);

  console.log('✅ [Controller] Form retrieved:', {
    id: form.id,
    title: form.title,
    status: form.status,
  });

  sendResponse(res, 200, { form }, 'Form retrieved successfully');
});

// ============================================================
// UPDATE FORM (Admin only)
// ============================================================
export const updateForm = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  if (req.user?.role !== 'admin') {
    throw new AppError('Only administrators can update forms', 403);
  }

  const validatedParams = req.validatedParams || req.params;
  const validatedBody = req.validatedBody || req.body;
  const id = validatedParams.id;
  const userId = req.user?.id;

  if (!id) {
    throw new AppError('Form ID is required', 400);
  }

  if (!userId) {
    throw new AppError('User not authenticated', 401);
  }

  console.log('🔍 [Controller] updateForm:', { id, userId });

  const form = await formBuilderService.updateForm(id, validatedBody, userId);

  console.log('✅ [Controller] Form updated:', {
    id: form.id,
    title: form.title,
    status: form.status,
  });

  sendResponse(res, 200, { form }, 'Form updated successfully');
});

// ============================================================
// DELETE FORM (Admin only)
// ============================================================
export const deleteForm = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  if (req.user?.role !== 'admin') {
    throw new AppError('Only administrators can delete forms', 403);
  }

  const validatedParams = req.validatedParams || req.params;
  const id = validatedParams.id;

  if (!id) {
    throw new AppError('Form ID is required', 400);
  }

  console.log('🔍 [Controller] deleteForm:', id);

  await formBuilderService.deleteForm(id);

  console.log('✅ [Controller] Form deleted:', id);

  sendResponse(res, 200, null, 'Form deleted successfully');
});

// ============================================================
// PUBLISH FORM (Admin only)
// ============================================================
export const publishForm = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  if (req.user?.role !== 'admin') {
    throw new AppError('Only administrators can publish forms', 403);
  }

  const validatedParams = req.validatedParams || req.params;
  const id = validatedParams.id;
  const userId = req.user?.id;

  if (!id) {
    throw new AppError('Form ID is required', 400);
  }

  if (!userId) {
    throw new AppError('User not authenticated', 401);
  }

  console.log('🔍 [Controller] publishForm:', id);

  const form = await formBuilderService.updateForm(id, { status: 'published' }, userId);

  console.log('✅ [Controller] Form published:', {
    id: form.id,
    title: form.title,
    publishedAt: form.publishedAt,
  });

  sendResponse(res, 200, { form }, 'Form published successfully');
});

// ============================================================
// UNPUBLISH FORM (Admin only)
// ============================================================
export const unpublishForm = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  if (req.user?.role !== 'admin') {
    throw new AppError('Only administrators can unpublish forms', 403);
  }

  const validatedParams = req.validatedParams || req.params;
  const id = validatedParams.id;
  const userId = req.user?.id;

  if (!id) {
    throw new AppError('Form ID is required', 400);
  }

  if (!userId) {
    throw new AppError('User not authenticated', 401);
  }

  console.log('🔍 [Controller] unpublishForm:', id);

  const form = await formBuilderService.updateForm(id, { status: 'draft' }, userId);

  console.log('✅ [Controller] Form unpublished:', {
    id: form.id,
    title: form.title,
  });

  sendResponse(res, 200, { form }, 'Form unpublished successfully');
});

// ============================================================
// SUBMIT FORM RESPONSE
// ============================================================
export const submitFormResponse = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  const validatedParams = req.validatedParams || req.params;
  const validatedBody = req.validatedBody || req.body;
  const formId = validatedParams.formId;
  const userId = req.user?.id;
  const userEmail = req.user?.email;
  const userName = req.user?.fullName;

  if (!formId) {
    throw new AppError('Form ID is required', 400);
  }

  console.log('🔍 [Controller] submitFormResponse:', {
    formId,
    userId: userId || 'anonymous',
    sectionsCount: validatedBody.sections?.length || 0,
  });

  const submission = await formBuilderService.submitFormResponse(
    formId,
    validatedBody,
    userId,
    userEmail,
    userName,
    { ipAddress: req.ip, userAgent: req.headers['user-agent'] }
  );

  console.log('✅ [Controller] Form response submitted:', {
    id: submission.id,
    formId: submission.formId,
    formTitle: submission.formTitle,
    submissionId: submission.submissionId,
    status: submission.status,
  });

  sendResponse(res, 201, { submission }, 'Form response submitted successfully');
});

// ============================================================
// GET FORM SUBMISSIONS (Admin only)
// ============================================================
export const getFormSubmissions = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  if (req.user?.role !== 'admin') {
    throw new AppError('Only administrators can view form submissions', 403);
  }

  const validatedParams = req.validatedParams || req.params;
  const validatedQuery = req.validatedQuery || req.query;
  const formId = validatedParams.formId;

  if (!formId) {
    throw new AppError('Form ID is required', 400);
  }

  console.log('🔍 [Controller] getFormSubmissions:', {
    formId,
    query: validatedQuery,
  });

  const result = await formBuilderService.getFormSubmissions(formId, {
    respondentEmail: validatedQuery.respondentEmail as string | undefined,
    respondentName: validatedQuery.respondentName as string | undefined,
    status: validatedQuery.status as 'draft' | 'submitted' | 'edited' | 'deleted' | undefined,
    fromDate: validatedQuery.fromDate as string | undefined,
    toDate: validatedQuery.toDate as string | undefined,
    graded: validatedQuery.graded as boolean | undefined,
    page: validatedQuery.page || 1,
    limit: validatedQuery.limit || 20,
  });

  console.log('✅ [Controller] Form submissions retrieved:', {
    total: result.total,
    submissionsCount: result.submissions.length,
  });

  sendResponse(
    res,
    200,
    {
      submissions: result.submissions,
      total: result.total,
      page: result.page,
      limit: result.limit,
      hasMore: result.hasMore,
    },
    'Form submissions retrieved successfully'
  );
});

// ============================================================
// GET MY FORM SUBMISSIONS
// ============================================================
export const getMyFormSubmissions = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  const validatedQuery = req.validatedQuery || req.query;
  const userId = req.user?.id;

  if (!userId) {
    throw new AppError('User not authenticated', 401);
  }

  console.log('🔍 [Controller] getMyFormSubmissions:', {
    userId,
    query: validatedQuery,
  });

  const result = await formBuilderService.getMyFormSubmissions(userId, {
    formId: validatedQuery.formId as string | undefined,
    status: validatedQuery.status as 'draft' | 'submitted' | 'edited' | 'deleted' | undefined,
    page: validatedQuery.page || 1,
    limit: validatedQuery.limit || 20,
  });

  console.log('✅ [Controller] My form submissions retrieved:', {
    total: result.total,
    submissionsCount: result.submissions.length,
  });

  sendResponse(
    res,
    200,
    {
      submissions: result.submissions,
      total: result.total,
      page: result.page,
      limit: result.limit,
      hasMore: result.hasMore,
    },
    'Your form submissions retrieved successfully'
  );
});

// ============================================================
// GET FORM SUBMISSION BY ID
// ============================================================
export const getFormSubmissionById = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  const validatedParams = req.validatedParams || req.params;
  const id = validatedParams.id;

  if (!id) {
    throw new AppError('Submission ID is required', 400);
  }

  console.log('🔍 [Controller] getFormSubmissionById:', id);

  const submission = await formBuilderService.getFormSubmissionById(id);

  // Admins can view any submission; everyone else can only view their own
  if (req.user?.role !== 'admin' && submission.respondentId !== req.user?.id) {
    throw new AppError('You can only view your own submissions', 403);
  }

  console.log('✅ [Controller] Form submission retrieved:', {
    id: submission.id,
    formId: submission.formId,
    formTitle: submission.formTitle,
    submissionId: submission.submissionId,
  });

  sendResponse(res, 200, { submission }, 'Form submission retrieved successfully');
});

// ============================================================
// REVIEW / GRADE FORM SUBMISSION (Admin only)
// ============================================================
export const reviewFormSubmission = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  if (req.user?.role !== 'admin') {
    throw new AppError('Only administrators can review submissions', 403);
  }

  const validatedParams = req.validatedParams || req.params;
  const validatedBody = req.validatedBody || req.body;
  const id = validatedParams.id;
  const userId = req.user?.id;

  if (!id) {
    throw new AppError('Submission ID is required', 400);
  }

  if (!userId) {
    throw new AppError('User not authenticated', 401);
  }

  console.log('🔍 [Controller] reviewFormSubmission:', { id, userId });

  const submission = await formBuilderService.reviewFormSubmission(id, validatedBody, userId);

  console.log('✅ [Controller] Form submission reviewed:', {
    id: submission.id,
    formId: submission.formId,
    formTitle: submission.formTitle,
    gradedBy: submission.gradedBy,
    gradedAt: submission.gradedAt,
  });

  sendResponse(res, 200, { submission }, 'Form submission reviewed successfully');
});

// ============================================================
// DELETE FORM SUBMISSION (Admin, or the respondent deleting their own draft)
// ============================================================
export const deleteFormSubmission = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  const validatedParams = req.validatedParams || req.params;
  const id = validatedParams.id;
  const userId = req.user?.id;

  if (!id) {
    throw new AppError('Submission ID is required', 400);
  }

  if (!userId) {
    throw new AppError('User not authenticated', 401);
  }

  console.log('🔍 [Controller] deleteFormSubmission:', { id, userId });

  const submission = await formBuilderService.getFormSubmissionById(id);

  if (req.user?.role !== 'admin') {
    if (submission.respondentId !== userId) {
      throw new AppError('You can only delete your own submissions', 403);
    }
    if (submission.status !== 'draft') {
      throw new AppError('Only draft submissions can be deleted', 400);
    }
  }

  await formBuilderService.deleteFormSubmission(id, userId);

  console.log('✅ [Controller] Form submission deleted:', id);

  sendResponse(res, 200, null, 'Form submission deleted successfully');
});

// ============================================================
// GET FORM STATISTICS (Admin only)
// ============================================================
export const getFormStatistics = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  if (req.user?.role !== 'admin') {
    throw new AppError('Only administrators can view form statistics', 403);
  }

  const validatedParams = req.validatedParams || req.params;
  const formId = validatedParams.formId;

  if (!formId) {
    throw new AppError('Form ID is required', 400);
  }

  console.log('🔍 [Controller] getFormStatistics:', formId);

  const stats = await formBuilderService.getFormStatistics(formId);

  console.log('✅ [Controller] Form statistics retrieved:', {
    totalSubmissions: stats.totalSubmissions,
    submittedCount: stats.submittedCount,
    gradedCount: stats.gradedCount,
  });

  sendResponse(res, 200, { stats }, 'Form statistics retrieved successfully');
});

// ============================================================
// GET FORM ANALYTICS (Admin only)
// ============================================================
export const getFormAnalytics = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  if (req.user?.role !== 'admin') {
    throw new AppError('Only administrators can view form analytics', 403);
  }

  const validatedParams = req.validatedParams || req.params;
  const validatedQuery = req.validatedQuery || req.query;
  const formId = validatedParams.formId;

  if (!formId) {
    throw new AppError('Form ID is required', 400);
  }

  console.log('🔍 [Controller] getFormAnalytics:', {
    formId,
    fromDate: validatedQuery.fromDate,
    toDate: validatedQuery.toDate,
  });

  const analytics = await formBuilderService.getFormAnalytics(formId, {
    fromDate: validatedQuery.fromDate as string | undefined,
    toDate: validatedQuery.toDate as string | undefined,
  });

  console.log('✅ [Controller] Form analytics retrieved:', {
    totalViews: analytics.totalViews,
    totalSubmissions: analytics.totalSubmissions,
    completionRate: analytics.completionRate,
  });

  sendResponse(res, 200, { analytics }, 'Form analytics retrieved successfully');
});

// ============================================================
// EXPORT SUBMISSIONS (Admin only)
// ============================================================
export const exportSubmissions = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  if (req.user?.role !== 'admin') {
    throw new AppError('Only administrators can export submissions', 403);
  }

  const validatedParams = req.validatedParams || req.params;
  const validatedQuery = req.validatedQuery || req.query;
  const formId = validatedParams.formId;

  if (!formId) {
    throw new AppError('Form ID is required', 400);
  }

  console.log('🔍 [Controller] exportSubmissions:', {
    formId,
    format: validatedQuery.format,
    fromDate: validatedQuery.fromDate,
    toDate: validatedQuery.toDate,
  });

  const exportData = await formBuilderService.exportSubmissions(formId, {
    format: validatedQuery.format as 'csv' | 'excel' | 'pdf' | 'json' || 'csv',
    fromDate: validatedQuery.fromDate as string | undefined,
    toDate: validatedQuery.toDate as string | undefined,
    status: validatedQuery.status as 'draft' | 'submitted' | 'edited' | 'deleted' | undefined,
  });

  console.log('✅ [Controller] Submissions exported:', {
    formId,
    format: exportData.format,
    filename: exportData.filename,
  });

  sendResponse(res, 200, exportData, 'Submissions exported successfully');
});

// ============================================================
// ADD QUESTION TO SECTION (Admin only)
// ============================================================
export const addQuestion = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  if (req.user?.role !== 'admin') {
    throw new AppError('Only administrators can add questions', 403);
  }

  const validatedParams = req.validatedParams || req.params;
  const validatedBody = req.validatedBody || req.body;
  const formId = validatedParams.formId;
  const sectionId = validatedParams.sectionId;
  const userId = req.user?.id;

  if (!formId) {
    throw new AppError('Form ID is required', 400);
  }
  if (!sectionId) {
    throw new AppError('Section ID is required', 400);
  }
  if (!userId) {
    throw new AppError('User not authenticated', 401);
  }

  console.log('🔍 [Controller] addQuestion:', {
    formId,
    sectionId,
    questionTitle: validatedBody.question?.title,
    userId,
  });

  const question = await formBuilderService.addQuestion(
    formId,
    sectionId,
    validatedBody.question,
    validatedBody.position,
    userId
  );

  console.log('✅ [Controller] Question added:', {
    id: question.id,
    title: question.title,
    type: question.type,
  });

  sendResponse(res, 201, { question }, 'Question added successfully');
});

// ============================================================
// UPDATE QUESTION (Admin only)
// ============================================================
export const updateQuestion = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  if (req.user?.role !== 'admin') {
    throw new AppError('Only administrators can update questions', 403);
  }

  const validatedParams = req.validatedParams || req.params;
  const validatedBody = req.validatedBody || req.body;
  const formId = validatedParams.formId;
  const sectionId = validatedParams.sectionId;
  const questionId = validatedParams.questionId;
  const userId = req.user?.id;

  if (!formId) {
    throw new AppError('Form ID is required', 400);
  }
  if (!sectionId) {
    throw new AppError('Section ID is required', 400);
  }
  if (!questionId) {
    throw new AppError('Question ID is required', 400);
  }
  if (!userId) {
    throw new AppError('User not authenticated', 401);
  }

  console.log('🔍 [Controller] updateQuestion:', {
    formId,
    sectionId,
    questionId,
    userId,
  });

  const question = await formBuilderService.updateQuestion(
    formId,
    sectionId,
    questionId,
    validatedBody,
    userId
  );

  console.log('✅ [Controller] Question updated:', {
    id: question.id,
    title: question.title,
    type: question.type,
  });

  sendResponse(res, 200, { question }, 'Question updated successfully');
});

// ============================================================
// DELETE QUESTION (Admin only)
// ============================================================
export const deleteQuestion = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  if (req.user?.role !== 'admin') {
    throw new AppError('Only administrators can delete questions', 403);
  }

  const validatedParams = req.validatedParams || req.params;
  const formId = validatedParams.formId;
  const sectionId = validatedParams.sectionId;
  const questionId = validatedParams.questionId;
  const userId = req.user?.id;

  if (!formId) {
    throw new AppError('Form ID is required', 400);
  }
  if (!sectionId) {
    throw new AppError('Section ID is required', 400);
  }
  if (!questionId) {
    throw new AppError('Question ID is required', 400);
  }
  if (!userId) {
    throw new AppError('User not authenticated', 401);
  }

  console.log('🔍 [Controller] deleteQuestion:', {
    formId,
    sectionId,
    questionId,
    userId,
  });

  await formBuilderService.deleteQuestion(formId, sectionId, questionId, userId);

  console.log('✅ [Controller] Question deleted:', questionId);

  sendResponse(res, 200, null, 'Question deleted successfully');
});

// ============================================================
// ADD SECTION TO FORM (Admin only)
// ============================================================
export const addSection = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  if (req.user?.role !== 'admin') {
    throw new AppError('Only administrators can add sections', 403);
  }

  const validatedParams = req.validatedParams || req.params;
  const validatedBody = req.validatedBody || req.body;
  const formId = validatedParams.formId;
  const userId = req.user?.id;

  if (!formId) {
    throw new AppError('Form ID is required', 400);
  }
  if (!userId) {
    throw new AppError('User not authenticated', 401);
  }

  console.log('🔍 [Controller] addSection:', {
    formId,
    sectionTitle: validatedBody.title,
    userId,
  });

  const section = await formBuilderService.addSection(
    formId,
    validatedBody,
    userId
  );

  console.log('✅ [Controller] Section added:', {
    id: section.id,
    title: section.title,
    order: section.order,
  });

  sendResponse(res, 201, { section }, 'Section added successfully');
});

// ============================================================
// DELETE SECTION (Admin only)
// ============================================================
export const deleteSection = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  if (req.user?.role !== 'admin') {
    throw new AppError('Only administrators can delete sections', 403);
  }

  const validatedParams = req.validatedParams || req.params;
  const formId = validatedParams.formId;
  const sectionId = validatedParams.sectionId;
  const userId = req.user?.id;

  if (!formId) {
    throw new AppError('Form ID is required', 400);
  }
  if (!sectionId) {
    throw new AppError('Section ID is required', 400);
  }
  if (!userId) {
    throw new AppError('User not authenticated', 401);
  }

  console.log('🔍 [Controller] deleteSection:', {
    formId,
    sectionId,
    userId,
  });

  await formBuilderService.deleteSection(formId, sectionId, userId);

  console.log('✅ [Controller] Section deleted:', sectionId);

  sendResponse(res, 200, null, 'Section deleted successfully');
});

// ============================================================
// REORDER SECTIONS (Admin only)
// ============================================================
export const reorderSections = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  if (req.user?.role !== 'admin') {
    throw new AppError('Only administrators can reorder sections', 403);
  }

  const validatedParams = req.validatedParams || req.params;
  const validatedBody = req.validatedBody || req.body;
  const formId = validatedParams.formId;
  const userId = req.user?.id;

  if (!formId) {
    throw new AppError('Form ID is required', 400);
  }
  if (!userId) {
    throw new AppError('User not authenticated', 401);
  }

  const sectionOrders = validatedBody.sectionOrders || [];

  if (!Array.isArray(sectionOrders) || sectionOrders.length === 0) {
    throw new AppError('sectionOrders array is required', 400);
  }

  console.log('🔍 [Controller] reorderSections:', {
    formId,
    sectionCount: sectionOrders.length,
    userId,
  });

  const form = await formBuilderService.reorderSections(
    formId,
    sectionOrders,
    userId
  );

  console.log('✅ [Controller] Sections reordered:', {
    formId: form.id,
    sectionCount: form.sections.length,
  });

  sendResponse(res, 200, { form }, 'Sections reordered successfully');
});

// ============================================================
// DUPLICATE FORM (Admin only)
// ============================================================
export const duplicateForm = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  if (req.user?.role !== 'admin') {
    throw new AppError('Only administrators can duplicate forms', 403);
  }

  const validatedParams = req.validatedParams || req.params;
  const validatedBody = req.validatedBody || req.body;
  const formId = validatedParams.formId;
  const userId = req.user?.id;

  if (!formId) {
    throw new AppError('Form ID is required', 400);
  }
  if (!userId) {
    throw new AppError('User not authenticated', 401);
  }

  const newTitle = validatedBody.title || `Copy of ${formId}`;

  console.log('🔍 [Controller] duplicateForm:', {
    formId,
    newTitle,
    userId,
  });

  const duplicatedForm = await formBuilderService.duplicateForm(
    formId,
    newTitle,
    userId
  );

  console.log('✅ [Controller] Form duplicated:', {
    originalId: formId,
    newId: duplicatedForm.id,
    newTitle: duplicatedForm.title,
  });

  sendResponse(res, 201, { form: duplicatedForm }, 'Form duplicated successfully');
});

// ============================================================
// GET FORM TEMPLATES (Admin only)
// ============================================================
export const getFormTemplates = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  if (req.user?.role !== 'admin') {
    throw new AppError('Only administrators can view templates', 403);
  }

  const validatedQuery = req.validatedQuery || req.query;

  console.log('🔍 [Controller] getFormTemplates:', {
    category: validatedQuery.category,
    search: validatedQuery.search,
  });

  const templates = await formBuilderService.getFormTemplates({
    category: validatedQuery.category as string | undefined,
    search: validatedQuery.search as string | undefined,
    limit: validatedQuery.limit ? parseInt(validatedQuery.limit, 10) : 50,
  });

  console.log('✅ [Controller] Form templates retrieved:', {
    count: templates.length,
  });

  sendResponse(res, 200, { templates }, 'Form templates retrieved successfully');
});

// ============================================================
// CREATE FORM FROM TEMPLATE (Admin only)
// ============================================================
export const createFormFromTemplate = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  if (req.user?.role !== 'admin') {
    throw new AppError('Only administrators can create forms from templates', 403);
  }

  const validatedParams = req.validatedParams || req.params;
  const validatedBody = req.validatedBody || req.body;
  const templateId = validatedParams.templateId;
  const userId = req.user?.id;

  if (!templateId) {
    throw new AppError('Template ID is required', 400);
  }
  if (!userId) {
    throw new AppError('User not authenticated', 401);
  }

  const formTitle = validatedBody.title || `New Form from Template`;

  console.log('🔍 [Controller] createFormFromTemplate:', {
    templateId,
    formTitle,
    userId,
  });

  const form = await formBuilderService.createFormFromTemplate(
    templateId,
    formTitle,
    userId,
    validatedBody.settings
  );

  console.log('✅ [Controller] Form created from template:', {
    formId: form.id,
    templateId,
    title: form.title,
  });

  sendResponse(res, 201, { form }, 'Form created from template successfully');
});

// ============================================================
// EXPORT
// ============================================================
export default {
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
};