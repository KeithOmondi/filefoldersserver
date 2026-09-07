// validators/formBuilder.validation.ts

import { z } from 'zod';
import {
  DynamicForm,
  FormSection,
  Question,
  QuestionType,
  ConditionOperator,
  ConditionalLogic,
} from './adminFormBuilder.types';

// ============================================================
// 1. ENUM SCHEMAS - Use literal arrays instead of type aliases
// ============================================================

const questionTypeSchema = z.enum([
  'short_answer',
  'paragraph',
  'multiple_choice',
  'checkboxes',
  'dropdown',
  'linear_scale',
  'multiple_choice_grid',
  'checkbox_grid',
  'date',
  'time',
  'datetime',
  'file_upload',
  'section_header',
  'image',
  'video',
  'page_break'
]);

const conditionOperatorSchema = z.enum([
  'equals',
  'not_equals',
  'contains',
  'greater_than',
  'less_than',
  'is_empty',
  'is_not_empty'
]);

// ============================================================
// 2. CONDITIONAL LOGIC SCHEMA
// ============================================================

const conditionalLogicSchema = z.object({
  dependsOnQuestion: z.string().min(1, 'Depends on question is required'),
  condition: conditionOperatorSchema,
  value: z.union([z.string(), z.number(), z.boolean(), z.array(z.string())]).optional(),
  showIfConditionMet: z.boolean().default(true),
});

// ============================================================
// 3. QUESTION COMPONENT SCHEMAS
// ============================================================

const questionOptionSchema = z.object({
  id: z.string().optional(),
  label: z.string().min(1, 'Option label is required'),
  value: z.string().min(1, 'Option value is required'),
  isCorrect: z.boolean().optional(),
  imageUrl: z.string().url('Invalid image URL').optional(),
  goToSection: z.string().optional(),
});

const gridRowSchema = z.object({
  id: z.string().optional(),
  label: z.string().min(1, 'Row label is required'),
});

const gridColumnSchema = z.object({
  id: z.string().optional(),
  label: z.string().min(1, 'Column label is required'),
});

// ============================================================
// 4. QUESTION VALIDATION SCHEMA
// ============================================================

export const createQuestionSchema = z.object({
  type: questionTypeSchema,
  title: z.string().min(1, 'Question title is required'),
  description: z.string().optional(),
  required: z.boolean().default(false),

  // Validation
  validation: z.object({
    minLength: z.number().int().min(0).optional(),
    maxLength: z.number().int().min(0).optional(),
    min: z.number().optional(),
    max: z.number().optional(),
    pattern: z.string().optional(),
    patternMessage: z.string().optional(),
    customError: z.string().optional(),
    fileTypes: z.array(z.string()).optional(),
    maxFileSize: z.number().min(0).optional(),
    maxFiles: z.number().int().min(0).optional(),
  }).optional(),

  // Options
  options: z.array(questionOptionSchema).optional(),

  // Grid
  gridRows: z.array(gridRowSchema).optional(),
  gridColumns: z.array(gridColumnSchema).optional(),
  gridRowSelection: z.enum(['single', 'multiple']).optional(),

  // Linear Scale
  scaleMin: z.number().int().min(0).optional(),
  scaleMax: z.number().int().min(1).optional(),
  scaleMinLabel: z.string().optional(),
  scaleMaxLabel: z.string().optional(),

  // General
  placeholder: z.string().optional(),
  defaultValue: z.union([z.string(), z.number(), z.boolean(), z.array(z.string())]).optional(),
  imageUrl: z.string().url('Invalid image URL').optional(),
  videoUrl: z.string().url('Invalid video URL').optional(),
  helpText: z.string().optional(),

  // Conditional
  conditionalLogic: conditionalLogicSchema.optional(),

  // Quiz
  isQuizQuestion: z.boolean().optional(),
  points: z.number().min(0).optional(),

  // Other
  shuffleOptions: z.boolean().optional(),

  // Data Validation
  dataValidation: z.object({
    type: z.enum(['number', 'text', 'email', 'url', 'regex']),
    min: z.number().optional(),
    max: z.number().optional(),
    pattern: z.string().optional(),
    customMessage: z.string().optional(),
  }).optional(),
});

// ============================================================
// 5. SECTION VALIDATION SCHEMA
// ============================================================

export const createSectionSchema = z.object({
  title: z.string().min(1, 'Section title is required'),
  description: z.string().optional(),
  questions: z.array(createQuestionSchema).min(1, 'At least one question is required per section'),
  order: z.number().int().min(0).default(0),
  type: z.enum(['section', 'page']).default('section'),
  imageUrl: z.string().url('Invalid image URL').optional(),
  videoUrl: z.string().url('Invalid video URL').optional(),
  conditionalLogic: conditionalLogicSchema.optional(),
});

// ============================================================
// FORM SETTINGS SCHEMA
// ============================================================
const formSettingsSchema = z.object({
  isPublished: z.boolean().default(false),
  isPublic: z.boolean().default(false),
  requireLogin: z.boolean().default(false),
  collectEmail: z.boolean().default(false),
  restrictToDomain: z.string().optional(),

  allowEditing: z.boolean().default(true),
  limitResponses: z.boolean().default(false),
  maxResponses: z.number().int().min(1).optional(),
  responseDeadline: z.string().datetime().optional(),

  showProgressBar: z.enum(['top', 'bottom', 'none']).default('top'),
  showQuestionNumbers: z.boolean().default(true),
  confirmationMessage: z.string().optional(),
  redirectUrl: z.string().url('Invalid redirect URL').optional(),

  sendEmailConfirmation: z.boolean().default(false),
  emailConfirmationSubject: z.string().optional(),
  emailConfirmationBody: z.string().optional(),
  notificationEmails: z.array(z.string().email('Invalid email format')).optional(),

  isQuiz: z.boolean().default(false),
  showScoreImmediately: z.boolean().optional(),
  showCorrectAnswers: z.boolean().optional(),

  captcha: z.boolean().default(false),
  passwordProtection: z.string().optional(),

  theme: z.object({
    headerColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid hex color').optional(),
    backgroundColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid hex color').optional(),
    fontFamily: z.string().optional(),
    buttonColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid hex color').optional(),
    buttonTextColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid hex color').optional(),
    logoUrl: z.string().url('Invalid logo URL').optional(),
    bannerUrl: z.string().url('Invalid banner URL').optional(),
    textColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid hex color').optional(),
    linkColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid hex color').optional(),
  }).optional(),
});

// ============================================================
// CREATE FORM SCHEMA
// ============================================================
export const createFormSchema = z.object({
  body: z.object({
    title: z.string().min(1, 'Form title is required').max(200, 'Title must be less than 200 characters'),
    description: z.string().max(1000, 'Description must be less than 1000 characters').optional(),
    sections: z.array(createSectionSchema).min(1, 'At least one section is required'),
    settings: formSettingsSchema.optional(),
    template: z.string().optional(),
  }),
});


// ============================================================
// 8. UPDATE FORM SCHEMA
// ============================================================

// ============================================================
// UPDATE FORM SCHEMA
// ============================================================
export const updateFormSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid form ID format'),
  }),
  body: z.object({
    title: z.string().min(1, 'Form title is required').max(200, 'Title must be less than 200 characters').optional(),
    description: z.string().max(1000, 'Description must be less than 1000 characters').optional(),
    sections: z.array(createSectionSchema).optional(),
    settings: formSettingsSchema.partial().optional(),
    status: z.enum(['draft', 'published', 'archived', 'closed']).optional(),
  }).superRefine((data, ctx) => {
    if (!data.title && !data.description && !data.sections && !data.settings && !data.status) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'At least one field must be provided for update',
        path: ['body'],
      });
    }
  }),
});


// ============================================================
// 9. QUESTION MANAGEMENT SCHEMAS
// ============================================================

export const addQuestionSchema = z.object({
  params: z.object({
    formId: z.string().uuid('Invalid form ID format'),
    sectionId: z.string().uuid('Invalid section ID format'),
  }),
  body: z.object({
    question: createQuestionSchema,
    position: z.number().int().min(0).optional(),
  }),
});

export const updateQuestionSchema = z.object({
  params: z.object({
    formId: z.string().uuid('Invalid form ID format'),
    sectionId: z.string().uuid('Invalid section ID format'),
    questionId: z.string().uuid('Invalid question ID format'),
  }),
  body: createQuestionSchema.partial(),
});

export const deleteQuestionSchema = z.object({
  params: z.object({
    formId: z.string().uuid('Invalid form ID format'),
    sectionId: z.string().uuid('Invalid section ID format'),
    questionId: z.string().uuid('Invalid question ID format'),
  }),
});

// ============================================================
// 10. SECTION MANAGEMENT SCHEMAS
// ============================================================

export const addSectionSchema = z.object({
  params: z.object({
    formId: z.string().uuid('Invalid form ID format'),
  }),
  body: createSectionSchema,
});

export const deleteSectionSchema = z.object({
  params: z.object({
    formId: z.string().uuid('Invalid form ID format'),
    sectionId: z.string().uuid('Invalid section ID format'),
  }),
});

// ============================================================
// 11. SUBMIT RESPONSE SCHEMA
// ============================================================

const questionResponseSchema = z.object({
  questionId: z.string().uuid('Invalid question ID format'),
  value: z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.array(z.string()),
    z.record(z.string(), z.union([z.string(), z.array(z.string())])),
  ]),
});

const sectionResponseSchema = z.object({
  sectionId: z.string().uuid('Invalid section ID format'),
  responses: z.array(questionResponseSchema).min(1, 'At least one question response is required'),
});

export const submitFormResponseSchema = z.object({
  params: z.object({
    formId: z.string().uuid('Invalid form ID format'),
  }),
  body: z.object({
    respondentEmail: z.string().email('Invalid email format').optional(),
    respondentName: z.string().optional(),
    sections: z.array(sectionResponseSchema).min(1, 'At least one section response is required'),
    status: z.enum(['draft', 'submitted']).optional().default('draft'),
  }),
});

// ============================================================
// 12. QUERY SCHEMAS
// ============================================================

export const getFormsSchema = z.object({
  status: z.enum(['draft', 'published', 'archived', 'closed']).optional(),
  isActive: z.string().optional().transform((val) => {
    if (val === undefined) return undefined;
    return val === 'true' || val === '1';
  }).pipe(z.boolean().optional()),
  search: z.string().optional(),
  tags: z.string().optional().transform((val) => {
    if (!val) return [];
    return val.split(',').map(t => t.trim()).filter(Boolean);
  }).pipe(z.array(z.string())),
  page: z.string().optional().default('1').transform((val) => {
    const num = parseInt(val, 10);
    return isNaN(num) ? 1 : num;
  }).pipe(z.number().int().min(1)),
  limit: z.string().optional().default('20').transform((val) => {
    const num = parseInt(val, 10);
    return isNaN(num) ? 20 : num;
  }).pipe(z.number().int().min(1).max(100)),
  sortBy: z.string().optional().default('createdAt').pipe(
    z.enum(['createdAt', 'updatedAt', 'title', 'status', 'responseCount'])
  ),
  sortOrder: z.string().optional().default('desc').pipe(
    z.enum(['asc', 'desc'])
  ),
});

export const getFormSubmissionsSchema = z.object({
  params: z.object({
    formId: z.string().uuid('Invalid form ID format'),
  }),
  query: z.object({
    respondentEmail: z.string().email('Invalid email format').optional(),
    respondentName: z.string().optional(),
    status: z.enum(['draft', 'submitted', 'edited', 'deleted']).optional(),
    fromDate: z.string().datetime().optional(),
    toDate: z.string().datetime().optional(),
    graded: z.string().optional().transform((val) => {
      if (val === undefined) return undefined;
      return val === 'true' || val === '1';
    }).pipe(z.boolean().optional()),
    page: z.string().optional().default('1').transform((val) => {
      const num = parseInt(val, 10);
      return isNaN(num) ? 1 : num;
    }).pipe(z.number().int().min(1)),
    limit: z.string().optional().default('20').transform((val) => {
      const num = parseInt(val, 10);
      return isNaN(num) ? 20 : num;
    }).pipe(z.number().int().min(1).max(100)),
  }),
});

// ============================================================
// 13. SINGLE RESOURCE SCHEMAS
// ============================================================

export const getFormSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid form ID format'),
  }),
});

export const deleteFormSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid form ID format'),
  }),
});

export const getFormSubmissionSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid submission ID format'),
  }),
});

// ============================================================
// 14. REVIEW SUBMISSION SCHEMA
// ============================================================

export const reviewFormSubmissionSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid submission ID format'),
  }),
  body: z.object({
    feedback: z.string().max(2000, 'Feedback must be less than 2000 characters').optional(),
    score: z.number().min(0).optional(),
    passed: z.boolean().optional(),
    questionScores: z.record(z.string(), z.object({
      isCorrect: z.boolean().optional(),
      pointsAwarded: z.number().min(0).optional(),
    })).optional(),
  }),
});

// ============================================================
// 15. EXPORT SCHEMA
// ============================================================

export const exportSubmissionsSchema = z.object({
  params: z.object({
    formId: z.string().uuid('Invalid form ID format'),
  }),
  query: z.object({
    format: z.enum(['csv', 'excel', 'pdf', 'json']).default('csv'),
    fromDate: z.string().datetime().optional(),
    toDate: z.string().datetime().optional(),
    status: z.enum(['draft', 'submitted', 'edited', 'deleted']).optional(),
  }),
});

// ============================================================
// 16. ANALYTICS SCHEMA
// ============================================================

export const getFormAnalyticsSchema = z.object({
  params: z.object({
    formId: z.string().uuid('Invalid form ID format'),
  }),
  query: z.object({
    fromDate: z.string().datetime().optional(),
    toDate: z.string().datetime().optional(),
  }),
});

// ============================================================
// 17. VALIDATE RESPONSE AGAINST FORM
// ============================================================

export const validateResponseAgainstForm = (
  form: DynamicForm,
  sections: Array<{ sectionId: string; responses: Array<{ questionId: string; value: any }> }>
): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];

  const sectionMap = new Map<string, FormSection>();
  form.sections.forEach(section => {
    sectionMap.set(section.id, section);
  });

  const questionMap = new Map<string, Question>();
  form.sections.forEach(section => {
    section.questions.forEach(question => {
      questionMap.set(question.id, question);
    });
  });

  sections.forEach((sectionResponse, sectionIndex) => {
    const section = sectionMap.get(sectionResponse.sectionId);
    if (!section) {
      errors.push(`Section ${sectionIndex + 1}: Invalid section ID "${sectionResponse.sectionId}"`);
      return;
    }

    const answeredQuestionIds = new Set<string>();

    sectionResponse.responses.forEach((questionResponse, questionIndex) => {
      const question = questionMap.get(questionResponse.questionId);
      if (!question) {
        errors.push(`Section "${section.title}" Question ${questionIndex + 1}: Invalid question ID "${questionResponse.questionId}"`);
        return;
      }

      answeredQuestionIds.add(questionResponse.questionId);

      // Required validation
      if (question.required) {
        const value = questionResponse.value;
        const isEmpty = value === undefined ||
          value === null ||
          value === '' ||
          (Array.isArray(value) && value.length === 0) ||
          (typeof value === 'object' && Object.keys(value).length === 0);

        if (isEmpty) {
          errors.push(`Section "${section.title}" Question "${question.title}": This question is required`);
        }
      }

      // Type-specific validation
      if (questionResponse.value !== undefined && questionResponse.value !== null && questionResponse.value !== '') {
        const value = questionResponse.value;

        // Short answer / paragraph
        if (['short_answer', 'paragraph'].includes(question.type)) {
          if (question.dataValidation?.type === 'number') {
            const numValue = typeof value === 'number' ? value : Number(value);
            if (value === '' || isNaN(numValue)) {
              errors.push(`Section "${section.title}" Question "${question.title}": Must be a valid number`);
            } else {
              const min = question.dataValidation?.min ?? question.validation?.min;
              const max = question.dataValidation?.max ?? question.validation?.max;
              if (min !== undefined && numValue < min) {
                errors.push(`Section "${section.title}" Question "${question.title}": ${question.dataValidation?.customMessage || question.validation?.customError || `Must be at least ${min}`}`);
              }
              if (max !== undefined && numValue > max) {
                errors.push(`Section "${section.title}" Question "${question.title}": ${question.dataValidation?.customMessage || question.validation?.customError || `Must be at most ${max}`}`);
              }
            }
          } else if (typeof value !== 'string') {
            errors.push(`Section "${section.title}" Question "${question.title}": Must be text`);
          } else {
            if (question.validation?.minLength && value.length < question.validation.minLength) {
              errors.push(`Section "${section.title}" Question "${question.title}": Must be at least ${question.validation.minLength} characters`);
            }
            if (question.validation?.maxLength && value.length > question.validation.maxLength) {
              errors.push(`Section "${section.title}" Question "${question.title}": Must be at most ${question.validation.maxLength} characters`);
            }

            const pattern = question.validation?.pattern || (question.dataValidation?.type === 'regex' ? question.dataValidation.pattern : undefined);
            if (pattern) {
              const regex = new RegExp(pattern);
              if (!regex.test(value)) {
                errors.push(`Section "${section.title}" Question "${question.title}": ${question.validation?.patternMessage || question.dataValidation?.customMessage || 'Invalid format'}`);
              }
            }

            if (question.dataValidation?.type === 'email') {
              const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
              if (!emailRegex.test(value)) {
                errors.push(`Section "${section.title}" Question "${question.title}": ${question.dataValidation.customMessage || 'Invalid email format'}`);
              }
            }
            if (question.dataValidation?.type === 'url') {
              try {
                new URL(value);
              } catch {
                errors.push(`Section "${section.title}" Question "${question.title}": ${question.dataValidation.customMessage || 'Invalid URL format'}`);
              }
            }
          }
        }

        // Linear scale
        if (question.type === 'linear_scale') {
          const numValue = typeof value === 'number' ? value : Number(value);
          if (isNaN(numValue)) {
            errors.push(`Section "${section.title}" Question "${question.title}": Must be a number`);
          } else {
            const min = question.scaleMin ?? 1;
            const max = question.scaleMax ?? 5;
            if (numValue < min || numValue > max) {
              errors.push(`Section "${section.title}" Question "${question.title}": Must be between ${min} and ${max}`);
            }
          }
        }

        // Multiple choice / dropdown
        if (['multiple_choice', 'dropdown'].includes(question.type)) {
          const validValues = question.options?.map(opt => opt.value) || [];
          if (!validValues.includes(String(value))) {
            errors.push(`Section "${section.title}" Question "${question.title}": Invalid option selected`);
          }
        }

        // Checkboxes
        if (question.type === 'checkboxes') {
          if (!Array.isArray(value)) {
            errors.push(`Section "${section.title}" Question "${question.title}": Must be an array of selected options`);
          } else {
            const validValues = question.options?.map(opt => opt.value) || [];
            const invalidValues = value.filter(v => !validValues.includes(String(v)));
            if (invalidValues.length > 0) {
              errors.push(`Section "${section.title}" Question "${question.title}": Invalid option(s) selected: ${invalidValues.join(', ')}`);
            }
          }
        }

        // Grid
        if (['multiple_choice_grid', 'checkbox_grid'].includes(question.type)) {
          if (typeof value !== 'object' || Array.isArray(value)) {
            errors.push(`Section "${section.title}" Question "${question.title}": Must be a row-keyed grid response`);
          } else {
            const validRowIds = new Set((question.gridRows || []).map(r => r.id));
            const validColumnValues = new Set((question.gridColumns || []).map(c => c.id));
            const expectMultiple = question.gridRowSelection === 'multiple' || question.type === 'checkbox_grid';

            Object.entries(value as Record<string, string | string[]>).forEach(([rowId, cellValue]) => {
              if (!validRowIds.has(rowId)) {
                errors.push(`Section "${section.title}" Question "${question.title}": Unknown grid row "${rowId}"`);
                return;
              }
              const cellValues = Array.isArray(cellValue) ? cellValue : [cellValue];
              if (!expectMultiple && cellValues.length > 1) {
                errors.push(`Section "${section.title}" Question "${question.title}": Row "${rowId}" allows only one selection`);
              }
              cellValues.forEach(v => {
                if (!validColumnValues.has(String(v))) {
                  errors.push(`Section "${section.title}" Question "${question.title}": Row "${rowId}" has invalid column "${v}"`);
                }
              });
            });

            if (question.required) {
              const answeredRows = Object.keys(value as Record<string, unknown>);
              const missingRows = [...validRowIds].filter(id => !answeredRows.includes(id));
              if (missingRows.length > 0) {
                errors.push(`Section "${section.title}" Question "${question.title}": Missing responses for ${missingRows.length} row(s)`);
              }
            }
          }
        }

        // Date
        if (question.type === 'date' || question.type === 'datetime') {
          const dateValue = new Date(String(value));
          if (isNaN(dateValue.getTime())) {
            errors.push(`Section "${section.title}" Question "${question.title}": Invalid date format`);
          }
        }

        // File upload
        if (question.type === 'file_upload') {
          const files = Array.isArray(value) ? value : [value];
          if (question.validation?.maxFiles && files.length > question.validation.maxFiles) {
            errors.push(`Section "${section.title}" Question "${question.title}": At most ${question.validation.maxFiles} file(s) allowed`);
          }
          files.forEach((file: any) => {
            const fileType = file?.fileType;
            if (question.validation?.fileTypes?.length && fileType && !question.validation.fileTypes.includes(fileType)) {
              errors.push(`Section "${section.title}" Question "${question.title}": File type "${fileType}" not allowed`);
            }
            const fileSize = file?.fileSize;
            if (question.validation?.maxFileSize && typeof fileSize === 'number' && fileSize > question.validation.maxFileSize) {
              errors.push(`Section "${section.title}" Question "${question.title}": File exceeds maximum size`);
            }
          });
        }
      }
    });

    // Check for unanswered required questions
    section.questions.forEach(question => {
      if (question.required && !answeredQuestionIds.has(question.id)) {
        errors.push(`Section "${section.title}" Question "${question.title}": This question is required`);
      }
    });
  });

  return { valid: errors.length === 0, errors };
};

// ============================================================
// 18. EXPORT TYPES
// ============================================================

export type CreateFormPayload = z.infer<typeof createFormSchema>['body'];
export type UpdateFormPayload = z.infer<typeof updateFormSchema>['body'];
export type UpdateFormParams = z.infer<typeof updateFormSchema>['params'];
export type AddQuestionPayload = z.infer<typeof addQuestionSchema>['body'];
export type AddQuestionParams = z.infer<typeof addQuestionSchema>['params'];
export type UpdateQuestionPayload = z.infer<typeof updateQuestionSchema>['body'];
export type UpdateQuestionParams = z.infer<typeof updateQuestionSchema>['params'];
export type DeleteQuestionParams = z.infer<typeof deleteQuestionSchema>['params'];
export type AddSectionPayload = z.infer<typeof addSectionSchema>['body'];
export type AddSectionParams = z.infer<typeof addSectionSchema>['params'];
export type DeleteSectionParams = z.infer<typeof deleteSectionSchema>['params'];
export type SubmitFormResponsePayload = z.infer<typeof submitFormResponseSchema>['body'];
export type SubmitFormResponseParams = z.infer<typeof submitFormResponseSchema>['params'];
export type GetFormsQuery = z.infer<typeof getFormsSchema>;
export type GetFormSubmissionsQuery = z.infer<typeof getFormSubmissionsSchema>['query'];
export type GetFormSubmissionsParams = z.infer<typeof getFormSubmissionsSchema>['params'];
export type GetFormParams = z.infer<typeof getFormSchema>['params'];
export type DeleteFormParams = z.infer<typeof deleteFormSchema>['params'];
export type GetFormSubmissionParams = z.infer<typeof getFormSubmissionSchema>['params'];
export type ReviewFormSubmissionPayload = z.infer<typeof reviewFormSubmissionSchema>['body'];
export type ReviewFormSubmissionParams = z.infer<typeof reviewFormSubmissionSchema>['params'];
export type ExportSubmissionsQuery = z.infer<typeof exportSubmissionsSchema>['query'];
export type ExportSubmissionsParams = z.infer<typeof exportSubmissionsSchema>['params'];
export type GetFormAnalyticsQuery = z.infer<typeof getFormAnalyticsSchema>['query'];
export type GetFormAnalyticsParams = z.infer<typeof getFormAnalyticsSchema>['params'];