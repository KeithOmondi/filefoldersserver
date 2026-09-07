// types/adminFormBuilder.types.ts

// ============================================
// Core Types for Dynamic Form Builder
// ============================================

// ============================================
// 1. Question Types
// ============================================

export type QuestionType =
  | 'short_answer'
  | 'paragraph'
  | 'multiple_choice'
  | 'checkboxes'
  | 'dropdown'
  | 'linear_scale'
  | 'multiple_choice_grid'
  | 'checkbox_grid'
  | 'date'
  | 'time'
  | 'datetime'
  | 'file_upload'
  | 'section_header'
  | 'image'
  | 'video'
  | 'page_break';

// ============================================
// 2. Conditional Logic
// ============================================

export type ConditionOperator =
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'greater_than'
  | 'less_than'
  | 'is_empty'
  | 'is_not_empty';

export interface ConditionalLogic {
  dependsOnQuestion: string;
  condition: ConditionOperator;
  value?: string | number | boolean | string[];
  showIfConditionMet: boolean;
}

// ============================================
// 3. Question Components
// ============================================

export interface QuestionOption {
  id: string;
  label: string;
  value: string;
  isCorrect?: boolean;
  imageUrl?: string;
  goToSection?: string;
}

export interface QuestionGridRow {
  id: string;
  label: string;
}

export interface QuestionGridColumn {
  id: string;
  label: string;
}

// ============================================
// 4. Question (Full Runtime Type)
// ============================================

export interface Question {
  id: string;
  type: QuestionType;
  title: string;
  description?: string;
  required: boolean;

  // Validation
  validation?: {
    minLength?: number;
    maxLength?: number;
    min?: number;
    max?: number;
    pattern?: string;
    patternMessage?: string;
    customError?: string;
    fileTypes?: string[];
    maxFileSize?: number;
    maxFiles?: number;
  };

  // Options (for multiple_choice, checkboxes, dropdown)
  options?: QuestionOption[];

  // Grid (for multiple_choice_grid, checkbox_grid)
  gridRows?: QuestionGridRow[];
  gridColumns?: QuestionGridColumn[];
  gridRowSelection?: 'single' | 'multiple';

  // Linear Scale
  scaleMin?: number;
  scaleMax?: number;
  scaleMinLabel?: string;
  scaleMaxLabel?: string;

  // General
  placeholder?: string;
  defaultValue?: string | number | boolean | string[];
  imageUrl?: string;
  videoUrl?: string;
  helpText?: string;

  // Conditional
  conditionalLogic?: ConditionalLogic;

  // Quiz
  isQuizQuestion?: boolean;
  points?: number;

  // Other
  shuffleOptions?: boolean;

  // Data Validation
  dataValidation?: {
    type: 'number' | 'text' | 'email' | 'url' | 'regex';
    min?: number;
    max?: number;
    pattern?: string;
    customMessage?: string;
  };
}

// ============================================
// 5. Section
// ============================================

export interface FormSection {
  id: string;
  title: string;
  description?: string;
  questions: Question[];
  order: number;
  type: 'section' | 'page';
  imageUrl?: string;
  videoUrl?: string;
  conditionalLogic?: ConditionalLogic;
}

// ============================================
// 6. Form Settings
// ============================================

export interface FormTheme {
  headerColor?: string;
  backgroundColor?: string;
  fontFamily?: string;
  buttonColor?: string;
  buttonTextColor?: string;
  logoUrl?: string;
  bannerUrl?: string;
  textColor?: string;
  linkColor?: string;
}

export interface FormSettings {
  // Access
  isPublished: boolean;
  isPublic: boolean;
  requireLogin: boolean;
  collectEmail: boolean;
  restrictToDomain?: string;

  // Submissions
  allowEditing: boolean;
  limitResponses: boolean;
  maxResponses?: number;
  responseDeadline?: string;

  // UI
  showProgressBar: 'top' | 'bottom' | 'none';
  showQuestionNumbers: boolean;
  confirmationMessage?: string;
  redirectUrl?: string;

  // Notifications
  sendEmailConfirmation: boolean;
  emailConfirmationSubject?: string;
  emailConfirmationBody?: string;
  notificationEmails?: string[];

  // Quiz
  isQuiz: boolean;
  showScoreImmediately?: boolean;
  showCorrectAnswers?: boolean;

  // Security
  captcha: boolean;
  passwordProtection?: string;

  // Theme
  theme?: FormTheme;
}

// ============================================
// 7. Dynamic Form
// ============================================

export type FormStatus = 'draft' | 'published' | 'archived' | 'closed';

export interface DynamicForm {
  id: string;
  title: string;
  description?: string;
  sections: FormSection[];
  settings: FormSettings;
  status: FormStatus;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
  closedAt?: string;
  responseCount: number;
  averageTimeToComplete?: number;
  tags?: string[];
  collaborators?: string[];
}

// ============================================
// 8. Response Types
// ============================================

export interface GridResponse {
  [rowId: string]: string | string[];
}

export interface FileResponse {
  fileId: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  fileUrl: string;
}

export type ResponseValue =
  | string
  | number
  | boolean
  | string[]
  | FileResponse[]
  | GridResponse;

export interface QuestionResponse {
  questionId: string;
  value: ResponseValue;
  timestamp?: string;
  isCorrect?: boolean;
  pointsAwarded?: number;
  pointsPossible?: number;
}

export interface SectionResponse {
  sectionId: string;
  responses: QuestionResponse[];
  startedAt?: string;
  completedAt?: string;
  timeSpent?: number;
}

export type SubmissionStatus = 'draft' | 'submitted' | 'edited' | 'deleted';

export interface FormSubmission {
  id?: string;
  formId: string;
  formTitle: string;
  submissionId: string;
  respondentId?: string;
  respondentEmail?: string;
  respondentName?: string;
  isLoggedIn: boolean;
  sections: SectionResponse[];
  totalTimeSpent?: number;
  status: SubmissionStatus;
  submittedAt?: string;
  updatedAt: string;

  // Grading
  score?: number;
  maxScore?: number;
  passed?: boolean;
  gradedBy?: string;
  gradedAt?: string;
  feedback?: string;
  correctAnswers?: {
    [questionId: string]: string | number | boolean | string[];
  };

  // Metadata
  ipAddress?: string;
  userAgent?: string;
  location?: {
    country?: string;
    city?: string;
    lat?: number;
    lng?: number;
  };
}

// ============================================
// 9. Analytics Types
// ============================================

export interface QuestionAnalytics {
  questionId: string;
  totalResponses: number;
  skippedResponses: number;
  averageValue?: number;
  responseDistribution?: {
    [value: string]: number;
  };
  averageTimeToAnswer?: number;
}

export interface FormAnalytics {
  formId: string;
  totalViews: number;
  totalStarts: number;
  totalSubmissions: number;
  completionRate: number;
  averageTime: number;
  dailyStats: {
    date: string;
    views: number;
    starts: number;
    submissions: number;
  }[];
  questionAnalytics: QuestionAnalytics[];
  countries: {
    [country: string]: number;
  };
}

// ============================================
// 10. Creation Input Types (without IDs)
// ============================================

// Optional ID variants for creation
export type CreateQuestionOptionInput = Omit<QuestionOption, 'id'> & { id?: string };
export type CreateGridRowInput = Omit<QuestionGridRow, 'id'> & { id?: string };
export type CreateGridColumnInput = Omit<QuestionGridColumn, 'id'> & { id?: string };

export type CreateQuestionInput = Omit<Question, 'id' | 'options' | 'gridRows' | 'gridColumns'> & {
  options?: CreateQuestionOptionInput[];
  gridRows?: CreateGridRowInput[];
  gridColumns?: CreateGridColumnInput[];
};

export interface CreateSectionInput {
  title: string;
  description?: string;
  questions: CreateQuestionInput[];
  order: number;
  type: 'section' | 'page';
  imageUrl?: string;
  videoUrl?: string;
  conditionalLogic?: ConditionalLogic;
}

export interface CreateFormInput {
  title: string;
  description?: string;
  sections: CreateSectionInput[];
  settings?: Partial<FormSettings>;
  template?: string;
}

// ============================================
// 11. Update Input Types
// ============================================

export interface UpdateFormInput {
  title?: string;
  description?: string;
  sections?: CreateSectionInput[];
  settings?: Partial<FormSettings>;
  status?: FormStatus;
}

export interface AddQuestionInput {
  sectionId: string;
  question: CreateQuestionInput;
  position?: number;
}

export interface UpdateQuestionInput {
  questionId: string;
  question: Partial<Question>;
}

export interface AddSectionInput {
  title: string;
  description?: string;
  questions?: CreateQuestionInput[];
  order?: number;
  type?: 'section' | 'page';
}

// ============================================
// 12. Submit Response Input
// ============================================

export interface SubmitFormResponseInput {
  formId: string;
  respondentEmail?: string;
  respondentName?: string;
  sections: Omit<SectionResponse, 'sectionId'>[];
  status?: 'draft' | 'submitted';
}

// ============================================
// 13. Template Types
// ============================================

export interface FormTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  icon?: string;
  thumbnailUrl?: string;
  sections: CreateSectionInput[];
  settings: Partial<FormSettings>;
  estimatedTime: number;
  popularity: number;
  isPremium: boolean;
}

// ============================================
// 14. API Response Types
// ============================================

export interface FormResponse {
  form: DynamicForm;
  message?: string;
}

export interface FormSubmissionResponse {
  submission: FormSubmission;
  message?: string;
  shareableLink?: string;
}

export interface FormsListResponse {
  forms: DynamicForm[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface SubmissionsListResponse {
  submissions: FormSubmission[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
  filters?: {
    status?: string;
    dateFrom?: string;
    dateTo?: string;
    respondentEmail?: string;
  };
}

export interface AnalyticsResponse {
  analytics: FormAnalytics;
  message?: string;
}

export interface ExportResponse {
  url: string;
  format: 'csv' | 'excel' | 'pdf' | 'json';
  filename: string;
}

// ============================================
// 15. Utility Functions
// ============================================

export function generateId(): string {
  return Math.random().toString(36).substring(2, 11) + Date.now().toString(36);
}

export function createQuestion(input: CreateQuestionInput): Question {
  return {
    ...input,
    id: generateId(),
    options: input.options?.map(opt => ({
      ...opt,
      id: opt.id || generateId()
    })),
    gridRows: input.gridRows?.map(row => ({
      ...row,
      id: row.id || generateId()
    })),
    gridColumns: input.gridColumns?.map(col => ({
      ...col,
      id: col.id || generateId()
    })),
    scaleMin: input.scaleMin ?? 1,
    scaleMax: input.scaleMax ?? 5,
  };
}

export function createSection(input: CreateSectionInput): FormSection {
  return {
    ...input,
    id: generateId(),
    questions: input.questions.map(q => createQuestion(q))
  };
}

// ============================================
// 16. Example Data
// ============================================

export const PENDING_PROCESSINGS_SECTION: CreateSectionInput = {
  title: 'Pending Processings to Court of Appeal',
  description: 'Enter the number of pending processings for each category. Only numbers 0 or greater are accepted.',
  type: 'section',
  order: 1,
  questions: [
    {
      type: 'short_answer',
      title: 'Criminal',
      description: 'Number of pending criminal cases',
      required: true,
      dataValidation: {
        type: 'number',
        min: 0,
        customMessage: 'Number must be 0 or greater'
      }
    },
    {
      type: 'short_answer',
      title: 'Civil',
      description: 'Number of pending civil cases',
      required: true,
      dataValidation: {
        type: 'number',
        min: 0,
        customMessage: 'Number must be 0 or greater'
      }
    },
    {
      type: 'short_answer',
      title: 'Family',
      description: 'Number of pending family cases',
      required: true,
      dataValidation: {
        type: 'number',
        min: 0,
        customMessage: 'Number must be 0 or greater'
      }
    },
    {
      type: 'short_answer',
      title: 'Commercial',
      description: 'Number of pending commercial cases',
      required: true,
      dataValidation: {
        type: 'number',
        min: 0,
        customMessage: 'Number must be 0 or greater'
      }
    }
  ]
};

export const FORM_TEMPLATES: FormTemplate[] = [
  {
    id: 'court-pending-cases',
    name: 'Pending Cases Report',
    description: 'Report pending cases by category for court reporting',
    category: 'Legal',
    estimatedTime: 5,
    popularity: 4.5,
    isPremium: false,
    sections: [PENDING_PROCESSINGS_SECTION],
    settings: {
      isPublished: false,
      isPublic: false,
      collectEmail: true,
      requireLogin: true,
      allowEditing: true,
      showProgressBar: 'top',
      showQuestionNumbers: true,
      sendEmailConfirmation: false,
      limitResponses: false,
      isQuiz: false,
      captcha: false
    }
  }
];