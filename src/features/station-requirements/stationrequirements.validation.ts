// stationrequirements.validation.ts

import { z } from 'zod';
import { CASE_CATEGORIES, CaseCategory } from './stationrequirements.types';

// ============================================================
// HELPER: Get all valid category names
// ============================================================
const validCategories = Object.keys(CASE_CATEGORIES);

// ============================================================
// HELPER: Check if a division is a valid category
// ============================================================
const isValidCategory = (division: string): division is CaseCategory => {
  return validCategories.includes(division);
};

// ============================================================
// HELPER: Check if a name belongs to a category
// ============================================================
const isValidNameForCategory = (division: string, name: string): boolean => {
  if (!isValidCategory(division)) return false;
  const validNames = CASE_CATEGORIES[division as CaseCategory] as readonly string[];
  return validNames.includes(name);
};

// ============================================================
// HELPER: Get valid names for a category
// ============================================================
const getValidNames = (division: string): string[] => {
  if (!isValidCategory(division)) return [];
  return CASE_CATEGORIES[division as CaseCategory] as unknown as string[];
};

// ============================================================
// Item schema for a single requirement item with validation against CASE_CATEGORIES
// ============================================================
export const stationRequirementItemSchema = z.object({
  division: z
    .string()
    .min(1, 'Division is required')
    .refine(
      (val: string) => isValidCategory(val),
      {
        message: `Division must be one of: ${validCategories.join(', ')}`,
      }
    ),
  name: z
    .string()
    .min(1, 'Item name is required'),
  quantity: z
    .number()
    .int()
    .min(0, 'Quantity must be 0 or greater'),
}).superRefine((data, ctx) => {
  // Validate that the name belongs to the division category
  if (!isValidNameForCategory(data.division, data.name)) {
    const validNames = getValidNames(data.division);
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `"${data.name}" is not valid for category "${data.division}". Valid names: ${validNames.join(', ') || 'N/A'}`,
      path: ['name'],
    });
  }
});

// ============================================================
// Create submission schema
// (quarter removed — a DR only submits a station)
// ============================================================
export const createSubmissionSchema = z.object({
  station: z.string().min(1, 'Station name is required'),
  fileFolders: z.array(stationRequirementItemSchema).optional().default([]),
  registers: z.array(stationRequirementItemSchema).optional().default([]),
}).superRefine((data, ctx) => {
  const totalFileFolders = data.fileFolders.reduce((sum: number, item: { quantity: number }) => sum + item.quantity, 0);
  const totalRegisters = data.registers.reduce((sum: number, item: { quantity: number }) => sum + item.quantity, 0);

  if (totalFileFolders === 0 && totalRegisters === 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'At least one item with quantity greater than 0 is required',
      path: ['fileFolders'],
    });
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'At least one item with quantity greater than 0 is required',
      path: ['registers'],
    });
  }
});

// ============================================================
// Get submissions query schema
// (quarter removed)
// ============================================================
export const getSubmissionsSchema = z.object({
  station: z.string().optional(),
  fromDate: z.string().optional().refine(
    (val: string | undefined) => !val || !isNaN(Date.parse(val)),
    { message: 'Invalid fromDate format' }
  ),
  toDate: z.string().optional().refine(
    (val: string | undefined) => !val || !isNaN(Date.parse(val)),
    { message: 'Invalid toDate format' }
  ),
  page: z.string().optional().transform((val: string | undefined) => val ? Number(val) : 1).pipe(
    z.number().int().min(1)
  ),
  limit: z.string().optional().transform((val: string | undefined) => val ? Number(val) : 20).pipe(
    z.number().int().min(1).max(100)
  ),
});

// ============================================================
// Get single submission schema
// ============================================================
export const getSubmissionSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid submission ID format'),
  }),
});

// ============================================================
// Update submission schema
// (quarter removed)
// ============================================================
export const updateSubmissionSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid submission ID format'),
  }),
  body: z.object({
    station: z.string().min(1, 'Station name is required').optional(),
    fileFolders: z.array(stationRequirementItemSchema).optional(),
    registers: z.array(stationRequirementItemSchema).optional(),
  }).superRefine((data, ctx) => {
    // At least one field to update
    if (!data.station && !data.fileFolders && !data.registers) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'At least one field must be provided for update',
        path: ['body'],
      });
    }
  }),
});

// ============================================================
// Delete submission schema
// ============================================================
export const deleteSubmissionSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid submission ID format'),
  }),
});

// ============================================================
// Export types
// ============================================================
export type CreateSubmissionInput = z.infer<typeof createSubmissionSchema>;
export type GetSubmissionsQuery = z.infer<typeof getSubmissionsSchema>;
export type GetSubmissionParams = z.infer<typeof getSubmissionSchema>['params'];
export type UpdateSubmissionInput = z.infer<typeof updateSubmissionSchema>['body'];
export type UpdateSubmissionParams = z.infer<typeof updateSubmissionSchema>['params'];
export type DeleteSubmissionParams = z.infer<typeof deleteSubmissionSchema>['params'];

// ============================================================
// NEW: Schema for validating a single category's cases
// ============================================================
export const categoryCasesSchema = z.object({
  category: z
    .string()
    .refine(
      (val: string) => isValidCategory(val),
      {
        message: `Category must be one of: ${validCategories.join(', ')}`,
      }
    ),
});

// ============================================================
// NEW: Schema for validating a single case name
// ============================================================
export const caseNameSchema = z.object({
  category: z
    .string()
    .refine(
      (val: string) => isValidCategory(val),
      {
        message: `Category must be one of: ${validCategories.join(', ')}`,
      }
    ),
  name: z
    .string()
    .min(1, 'Case name is required'),
}).superRefine((data, ctx) => {
  if (!isValidNameForCategory(data.category, data.name)) {
    const validNames = getValidNames(data.category);
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `"${data.name}" is not valid for category "${data.category}". Valid names: ${validNames.join(', ') || 'N/A'}`,
      path: ['name'],
    });
  }
});

// ============================================================
// NEW: Schema for validating multiple case names
// ============================================================
export const caseNamesSchema = z.object({
  category: z
    .string()
    .refine(
      (val: string) => isValidCategory(val),
      {
        message: `Category must be one of: ${validCategories.join(', ')}`,
      }
    ),
  names: z.array(z.string().min(1, 'Case name is required')),
}).superRefine((data, ctx) => {
  const validNames = getValidNames(data.category);
  const invalidNames = data.names.filter((name: string) => !validNames.includes(name));

  if (invalidNames.length > 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `Invalid names for category "${data.category}": ${invalidNames.join(', ')}. Valid names: ${validNames.join(', ')}`,
      path: ['names'],
    });
  }
});

// ============================================================
// Helper function to get all valid categories (for frontend use)
// ============================================================
export const getValidCategories = (): string[] => {
  return validCategories;
};

// ============================================================
// Helper function to get valid names for a category (for frontend use)
// ============================================================
export const getValidNamesForCategory = (category: string): string[] => {
  if (!isValidCategory(category)) return [];
  return CASE_CATEGORIES[category as CaseCategory] as unknown as string[];
};

// ============================================================
// Helper function to get all valid cases (for frontend use)
// ============================================================
export const getAllValidCases = (): { category: string; names: string[] }[] => {
  return Object.entries(CASE_CATEGORIES).map(([category, names]) => ({
    category,
    names: names as unknown as string[],
  }));
};