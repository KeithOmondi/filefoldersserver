// validators/pendingProceedings.validation.ts

import { z } from 'zod';
import type { 
  PendingProceedingItem, 
  PendingProceedingCategory,
  PendingProceedingName,
} from './pendingProceedings.types';

import { PENDING_PROCEEDINGS_CATEGORIES } from './pendingProceedings.types';

// ============================================================
// 1. ENUM SCHEMAS & COMPILE-TIME CHECKS
// ============================================================

const submissionStatusSchema = z.enum(['submitted']);

const stationStatusSchema = z.enum([
  'not_started',
  'submitted'
]);

// ✅ Added 'json' to report format
const reportFormatSchema = z.enum(['pdf', 'docx', 'json']);

// ============================================================
// 2. PENDING PROCEEDING ITEM SCHEMA
// ============================================================

const pendingProceedingItemSchema = z.object({
  division: z.string().min(1, 'Division is required'),
  name: z.string().min(1, 'Name is required'),
  quantity: z.number().int().min(0, 'Quantity must be 0 or greater'),
});

// ============================================================
// 3. CREATE SUBMISSION SCHEMA
// ============================================================

const validatePendingProceedings = (
  data: { courtOfAppeal: PendingProceedingItem[]; subordinateCourts: PendingProceedingItem[] },
  ctx: z.RefinementCtx
) => {
  // Check that at least one proceeding item exists
  if (data.courtOfAppeal.length === 0 && data.subordinateCourts.length === 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'At least one proceeding item must be provided',
      path: ['courtOfAppeal'],
    });
  }
};

export const createSubmissionSchema = z.object({
  body: z
    .object({
      station: z.string().min(1, 'Station is required'),
      courtOfAppeal: z.array(pendingProceedingItemSchema).default([]),
      subordinateCourts: z.array(pendingProceedingItemSchema).default([]),
    })
    .superRefine(validatePendingProceedings),
});

// ============================================================
// 4. UPDATE SUBMISSION SCHEMA
// ============================================================

export const updateSubmissionSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid submission ID format'),
  }),
  body: z
    .object({
      station: z.string().min(1, 'Station is required').optional(),
      courtOfAppeal: z.array(pendingProceedingItemSchema).optional(),
      subordinateCourts: z.array(pendingProceedingItemSchema).optional(),
    })
    .superRefine((data, ctx) => {
      if (!data.station && !data.courtOfAppeal && !data.subordinateCourts) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'At least one field must be provided for update',
          path: ['body'],
        });
      }
      if (data.courtOfAppeal !== undefined && data.courtOfAppeal.length === 0 && 
          data.subordinateCourts !== undefined && data.subordinateCourts.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'At least one proceeding item must be provided',
          path: ['courtOfAppeal'],
        });
      }
    }),
});

// ============================================================
// 5. GET SUBMISSION SCHEMA
// ============================================================

export const getSubmissionSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid submission ID format'),
  }),
});

// ============================================================
// 6. DELETE SUBMISSION SCHEMA
// ============================================================

export const deleteSubmissionSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid submission ID format'),
  }),
});

// ============================================================
// 7. GET SUBMISSIONS LIST SCHEMA
// ============================================================

export const getSubmissionsSchema = z.object({
  query: z.object({
    station: z.string().optional(),
    fromDate: z.string().datetime().optional(),
    toDate: z.string().datetime().optional(),
    page: z
      .string()
      .optional()
      .default('1')
      .transform((val) => {
        const num = parseInt(val, 10);
        return isNaN(num) ? 1 : num;
      })
      .pipe(z.number().int().min(1)),
    limit: z
      .string()
      .optional()
      .default('20')
      .transform((val) => {
        const num = parseInt(val, 10);
        return isNaN(num) ? 20 : num;
      })
      .pipe(z.number().int().min(1).max(100)),
    sortBy: z.string().optional().default('updatedAt').pipe(z.enum(['updatedAt', 'submittedAt', 'station'])),
    sortOrder: z.string().optional().default('desc').pipe(z.enum(['asc', 'desc'])),
  }),
});

// ============================================================
// 8. GET STATION REPORT SCHEMA
// ============================================================

export const getStationReportSchema = z.object({
  query: z.object({
    status: stationStatusSchema.optional(),
    fromDate: z.string().datetime().optional(),
    toDate: z.string().datetime().optional(),
    page: z
      .string()
      .optional()
      .default('1')
      .transform((val) => {
        const num = parseInt(val, 10);
        return isNaN(num) ? 1 : num;
      })
      .pipe(z.number().int().min(1)),
    limit: z
      .string()
      .optional()
      .default('20')
      .transform((val) => {
        const num = parseInt(val, 10);
        return isNaN(num) ? 20 : num;
      })
      .pipe(z.number().int().min(1).max(100)),
  }),
});

// ============================================================
// 9. DOWNLOAD REPORT SCHEMA
// ============================================================

export const downloadReportSchema = z.object({
  query: z.object({
    format: reportFormatSchema.optional().default('pdf'),
    fromDate: z.string().datetime().optional(),
    toDate: z.string().datetime().optional(),
  }),
});

// ============================================================
// 10. GET ADMIN DASHBOARD SCHEMA
// ============================================================

export const getAdminDashboardSchema = z.object({
  query: z.object({
    fromDate: z.string().datetime().optional(),
    toDate: z.string().datetime().optional(),
  }),
});

// ============================================================
// 11. DOMAIN VALIDATION HELPERS
// ============================================================

// ✅ Valid category names - appeal "to", subordinate "from"
const VALID_CATEGORIES = [
  'Pending Proceedings to Court of Appeal',
  'Pending Proceedings from Subordinate Courts'
] as const;

type ValidCategory = typeof VALID_CATEGORIES[number];

/**
 * Validates that a proceeding item belongs to a valid category
 */
export const validateProceedingCategory = (
  category: string,
  itemName: string
): { valid: boolean; error?: string } => {
  // ✅ Check if category is valid
  if (!VALID_CATEGORIES.includes(category as ValidCategory)) {
    return {
      valid: false,
      error: `Invalid category: "${category}". Must be one of: ${VALID_CATEGORIES.join(', ')}`,
    };
  }

  // ✅ Get valid items for this category
  const validItems = PENDING_PROCEEDINGS_CATEGORIES[category as PendingProceedingCategory];
  
  if (!validItems) {
    return {
      valid: false,
      error: `Invalid category: "${category}"`,
    };
  }

  if (!validItems.includes(itemName as PendingProceedingName)) {
    return {
      valid: false,
      error: `Invalid item "${itemName}" for category "${category}". Must be one of: ${validItems.join(', ')}`,
    };
  }

  return { valid: true };
};

/**
 * Validates all proceeding items in a submission
 */
export const validateAllProceedingItems = (
  items: PendingProceedingItem[],
  category: PendingProceedingCategory
): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];
  
  for (const item of items) {
    const result = validateProceedingCategory(category, item.name);
    if (!result.valid && result.error) {
      errors.push(result.error);
    }
  }

  return { valid: errors.length === 0, errors };
};

/**
 * Validates that a station name is valid (to be implemented with station service)
 */
export const validateStation = (station: string): boolean => {
  return station.length > 0;
};

// ============================================================
// 12. HELPER - Check if submission is nil return
// ============================================================

/**
 * Checks if a submission is a nil return (all quantities are 0)
 */
export const isNilReturn = (
  courtOfAppeal: PendingProceedingItem[],
  subordinateCourts: PendingProceedingItem[]
): boolean => {
  const courtTotal = courtOfAppeal.reduce((sum, item) => sum + item.quantity, 0);
  const subTotal = subordinateCourts.reduce((sum, item) => sum + item.quantity, 0);
  return courtTotal === 0 && subTotal === 0;
};

/**
 * Validates that a submission has at least one non-zero quantity
 * (nil returns are allowed but tracked)
 */
export const validateNonNilSubmission = (
  courtOfAppeal: PendingProceedingItem[],
  subordinateCourts: PendingProceedingItem[]
): { valid: boolean; message?: string } => {
  const courtTotal = courtOfAppeal.reduce((sum, item) => sum + item.quantity, 0);
  const subTotal = subordinateCourts.reduce((sum, item) => sum + item.quantity, 0);
  
  if (courtTotal === 0 && subTotal === 0) {
    return {
      valid: true,
      message: 'Nil return submitted (all quantities are zero)',
    };
  }
  
  return { valid: true };
};

// ============================================================
// 13. EXPORT INFERRED TYPES
// ============================================================

export type CreateSubmissionPayload = z.infer<typeof createSubmissionSchema>['body'];
export type UpdateSubmissionPayload = z.infer<typeof updateSubmissionSchema>['body'];
export type UpdateSubmissionParams = z.infer<typeof updateSubmissionSchema>['params'];
export type GetSubmissionParams = z.infer<typeof getSubmissionSchema>['params'];
export type DeleteSubmissionParams = z.infer<typeof deleteSubmissionSchema>['params'];
export type GetSubmissionsQuery = z.infer<typeof getSubmissionsSchema>['query'];
export type GetStationReportQuery = z.infer<typeof getStationReportSchema>['query'];
export type DownloadReportQuery = z.infer<typeof downloadReportSchema>['query'];
export type GetAdminDashboardQuery = z.infer<typeof getAdminDashboardSchema>['query'];