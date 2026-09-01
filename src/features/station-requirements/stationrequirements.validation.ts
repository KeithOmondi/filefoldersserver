// stationrequirements.validation.ts

import { z } from 'zod';
import { 
  CASE_CATEGORIES, 
  CASE_REGISTERS,
  ADDITIONAL_REGISTERS,
  CaseCategory, 
  RegisterCategory,
  SubmissionStatus, 
  StationStatus,
  ReviewStatus 
} from './stationrequirements.types';

// ============================================================
// HELPER: Get all valid category names (File Folders)
// ============================================================
const validCategories = Object.keys(CASE_CATEGORIES);

// ============================================================
// HELPER: Get all valid register categories
// ============================================================
const validRegisterCategories = Object.keys(CASE_REGISTERS);

// ============================================================
// HELPER: Get all valid register names (including additional)
// ============================================================
const getAllValidRegisterNames = (): string[] => {
  const allRegisters: string[] = [];
  
  // Get registers from each category
  for (const category of validRegisterCategories) {
    const registers = CASE_REGISTERS[category as RegisterCategory] as readonly string[];
    allRegisters.push(...registers);
  }
  
  // Add additional registers
  allRegisters.push(...ADDITIONAL_REGISTERS);
  
  return allRegisters;
};

const allValidRegisterNames = getAllValidRegisterNames();

// ============================================================
// HELPER: Check if a division is a valid file folder category
// ============================================================
const isValidCategory = (division: string): division is CaseCategory => {
  return validCategories.includes(division);
};

// ============================================================
// HELPER: Check if a division is a valid register category
// ============================================================
const isValidRegisterCategory = (division: string): division is RegisterCategory => {
  return validRegisterCategories.includes(division) || division === 'Additional';
};

// ============================================================
// HELPER: Check if a name belongs to a file folder category
// ============================================================
const isValidNameForCategory = (division: string, name: string): boolean => {
  if (!isValidCategory(division)) return false;
  const validNames = CASE_CATEGORIES[division as CaseCategory] as readonly string[];
  return validNames.includes(name);
};

// ============================================================
// HELPER: Check if a name belongs to a register category
// ============================================================
const isValidRegisterNameForCategory = (division: string, name: string): boolean => {
  if (division === 'Additional') {
    return ADDITIONAL_REGISTERS.includes(name as any);
  }
  
  if (!isValidRegisterCategory(division)) return false;
  const validNames = CASE_REGISTERS[division as RegisterCategory] as readonly string[];
  return validNames.includes(name);
};

// ============================================================
// HELPER: Get valid names for a file folder category
// ============================================================
const getValidNames = (division: string): string[] => {
  if (!isValidCategory(division)) return [];
  return CASE_CATEGORIES[division as CaseCategory] as unknown as string[];
};

// ============================================================
// HELPER: Get valid names for a register category
// ============================================================
const getValidRegisterNames = (division: string): string[] => {
  if (division === 'Additional') {
    return [...ADDITIONAL_REGISTERS];
  }
  
  if (!isValidRegisterCategory(division)) return [];
  return CASE_REGISTERS[division as RegisterCategory] as unknown as string[];
};

// ============================================================
// Item schema for a single file folder item
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
// Item schema for a single register item
// ============================================================
export const stationRegisterItemSchema = z.object({
  division: z
    .string()
    .min(1, 'Division is required')
    .refine(
      (val: string) => isValidRegisterCategory(val),
      {
        message: `Division must be one of: ${[...validRegisterCategories, 'Additional'].join(', ')}`,
      }
    ),
  name: z
    .string()
    .min(1, 'Register name is required'),
  quantity: z
    .number()
    .int()
    .min(0, 'Quantity must be 0 or greater'),
}).superRefine((data, ctx) => {
  // Validate that the name belongs to the division category
  if (!isValidRegisterNameForCategory(data.division, data.name)) {
    const validNames = getValidRegisterNames(data.division);
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `"${data.name}" is not valid for category "${data.division}". Valid names: ${validNames.join(', ') || 'N/A'}`,
      path: ['name'],
    });
  }
});

// ============================================================
// Submission status validation
// ============================================================
const submissionStatusSchema = z.enum(['draft', 'submitted'] as const);

// ============================================================
// Review status validation
// ============================================================
const reviewStatusSchema = z.enum(['pending', 'approved', 'needs_revision'] as const);

// ============================================================
// Create submission schema
// ============================================================
export const createSubmissionSchema = z.object({
  station: z.string().min(1, 'Station name is required'),
  fileFolders: z.array(stationRequirementItemSchema).optional().default([]),
  registers: z.array(stationRegisterItemSchema).optional().default([]),
  status: submissionStatusSchema.optional().default('draft'),
}).superRefine((data, ctx) => {
  const totalFileFolders = data.fileFolders.reduce((sum: number, item: { quantity: number }) => sum + item.quantity, 0);
  const totalRegisters = data.registers.reduce((sum: number, item: { quantity: number }) => sum + item.quantity, 0);

  // If status is 'submitted', require at least one item
  if (data.status === 'submitted' && totalFileFolders === 0 && totalRegisters === 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'At least one item with quantity greater than 0 is required for submission',
      path: ['fileFolders'],
    });
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'At least one item with quantity greater than 0 is required for submission',
      path: ['registers'],
    });
  }
});

// ============================================================
// Update submission schema
// ============================================================
export const updateSubmissionSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid submission ID format'),
  }),
  body: z.object({
    station: z.string().min(1, 'Station name is required').optional(),
    fileFolders: z.array(stationRequirementItemSchema).optional(),
    registers: z.array(stationRegisterItemSchema).optional(),
    status: submissionStatusSchema.optional(),
    reviewStatus: reviewStatusSchema.optional(),
    adminNotes: z.string().max(2000, 'Admin notes must be less than 2000 characters').optional(),
  }).superRefine((data, ctx) => {
    // At least one field to update
    if (!data.station && !data.fileFolders && !data.registers && !data.status && !data.reviewStatus && !data.adminNotes) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'At least one field must be provided for update',
        path: ['body'],
      });
    }
  }),
});

// ============================================================
// Submit draft schema
// ============================================================
export const submitDraftSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid draft ID format'),
  }),
  body: z.object({
    sendEmail: z.boolean().optional().default(true),
  }),
});

// ============================================================
// Get submissions query schema
// ============================================================
export const getSubmissionsSchema = z.object({
  station: z.string().optional(),
  status: z.enum(['draft', 'submitted']).optional(),
  reviewStatus: z.enum(['pending', 'approved', 'needs_revision']).optional(),
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
  page: z.string().optional().default('1').transform((val) => {
    const num = parseInt(val, 10);
    return isNaN(num) ? 1 : num;
  }).pipe(z.number().int().min(1)),
  limit: z.string().optional().default('20').transform((val) => {
    const num = parseInt(val, 10);
    return isNaN(num) ? 20 : num;
  }).pipe(z.number().int().min(1).max(100)),
  sortBy: z.string().optional().default('updatedAt').pipe(
    z.enum(['updatedAt', 'submittedAt', 'station'])
  ),
  sortOrder: z.string().optional().default('desc').pipe(
    z.enum(['asc', 'desc'])
  ),
  adminView: z.string().optional().default('false').transform((val) => {
    return val === 'true' || val === '1';
  }).pipe(z.boolean()),
});

// ============================================================
// Get station report query schema
// ============================================================
export const getStationReportSchema = z.object({
  status: z.enum(['not_started', 'in_progress', 'submitted', 'pending_review', 'approved', 'needs_revision'] as const).optional(),
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
  page: z.string().optional().default('1').transform((val) => {
    const num = parseInt(val, 10);
    return isNaN(num) ? 1 : num;
  }).pipe(z.number().int().min(1)),
  limit: z.string().optional().default('50').transform((val) => {
    const num = parseInt(val, 10);
    return isNaN(num) ? 50 : num;
  }).pipe(z.number().int().min(1).max(200)),
  region: z.string().optional(),
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
// Delete submission schema
// ============================================================
export const deleteSubmissionSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid submission ID format'),
  }),
});

// ============================================================
// Bulk action schema
// ============================================================
export const bulkActionSchema = z.object({
  body: z.object({
    action: z.enum(['delete', 'archive', 'submit', 'approve', 'reject']),
    ids: z.array(z.string().uuid('Invalid submission ID format')).min(1, 'At least one ID is required'),
    notes: z.string().max(2000, 'Notes must be less than 2000 characters').optional(),
  }),
});

// ============================================================
// Admin review schema
// ============================================================
export const adminReviewSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid submission ID format'),
  }),
  body: z.object({
    reviewStatus: reviewStatusSchema,
    adminNotes: z.string().max(2000, 'Admin notes must be less than 2000 characters').optional(),
    sendNotification: z.boolean().optional().default(true),
  }),
});

// ============================================================
// Export types
// ============================================================
export type CreateSubmissionInput = z.infer<typeof createSubmissionSchema>;
export type UpdateSubmissionInput = z.infer<typeof updateSubmissionSchema>['body'];
export type UpdateSubmissionParams = z.infer<typeof updateSubmissionSchema>['params'];
export type SubmitDraftInput = z.infer<typeof submitDraftSchema>['body'];
export type SubmitDraftParams = z.infer<typeof submitDraftSchema>['params'];
export type GetSubmissionsQuery = z.infer<typeof getSubmissionsSchema>;
export type GetStationReportQuery = z.infer<typeof getStationReportSchema>;
export type GetSubmissionParams = z.infer<typeof getSubmissionSchema>['params'];
export type DeleteSubmissionParams = z.infer<typeof deleteSubmissionSchema>['params'];
export type BulkActionInput = z.infer<typeof bulkActionSchema>['body'];
export type AdminReviewInput = z.infer<typeof adminReviewSchema>['body'];
export type AdminReviewParams = z.infer<typeof adminReviewSchema>['params'];

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

// ============================================================
// Helper function to get all valid register categories (for frontend use)
// ============================================================
export const getValidRegisterCategories = (): string[] => {
  return [...validRegisterCategories, 'Additional'];
};

// ============================================================
// Helper function to get valid register names for a category (for frontend use)
// ============================================================
export const getValidRegisterNamesForCategory = (category: string): string[] => {
  if (category === 'Additional') {
    return [...ADDITIONAL_REGISTERS];
  }
  
  if (!isValidRegisterCategory(category)) return [];
  return CASE_REGISTERS[category as RegisterCategory] as unknown as string[];
};

// ============================================================
// Helper function to get all valid registers (for frontend use)
// ============================================================
export const getAllValidRegisters = (): { category: string; names: string[] }[] => {
  const result: { category: string; names: string[] }[] = [];
  
  for (const category of validRegisterCategories) {
    result.push({
      category,
      names: CASE_REGISTERS[category as RegisterCategory] as unknown as string[],
    });
  }
  
  result.push({
    category: 'Additional',
    names: [...ADDITIONAL_REGISTERS],
  });
  
  return result;
};

// ============================================================
// Helper: Validate station requirements for submission
// ============================================================
export const validateStationRequirements = (
  fileFolders: Array<{ division: string; name: string; quantity: number }>,
  registers: Array<{ division: string; name: string; quantity: number }>
): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];
  
  // Check file folders
  fileFolders.forEach((item, index) => {
    if (!isValidCategory(item.division)) {
      errors.push(`File folder ${index + 1}: Invalid division "${item.division}"`);
    }
    if (!isValidNameForCategory(item.division, item.name)) {
      const validNames = getValidNames(item.division);
      errors.push(`File folder ${index + 1}: "${item.name}" is not valid for category "${item.division}". Valid: ${validNames.join(', ')}`);
    }
    if (item.quantity < 0) {
      errors.push(`File folder ${index + 1}: Quantity cannot be negative`);
    }
  });

  // Check registers
  registers.forEach((item, index) => {
    // Check if division is valid register category
    if (!isValidRegisterCategory(item.division)) {
      errors.push(`Register ${index + 1}: Invalid division "${item.division}". Valid categories: ${[...validRegisterCategories, 'Additional'].join(', ')}`);
    }
    
    // Check if name is valid for the division
    if (!isValidRegisterNameForCategory(item.division, item.name)) {
      const validNames = getValidRegisterNames(item.division);
      errors.push(`Register ${index + 1}: "${item.name}" is not valid for category "${item.division}". Valid: ${validNames.join(', ')}`);
    }
    
    if (item.quantity < 0) {
      errors.push(`Register ${index + 1}: Quantity cannot be negative`);
    }
  });

  return {
    valid: errors.length === 0,
    errors,
  };
};

// ============================================================
// Helper: Validate submission status transition
// ============================================================
export const validateStatusTransition = (
  currentStatus: SubmissionStatus,
  newStatus: SubmissionStatus
): { valid: boolean; message: string } => {
  const transitions: Record<SubmissionStatus, SubmissionStatus[]> = {
    'draft': ['draft', 'submitted'],
    'submitted': ['submitted'],
  };

  const allowed = transitions[currentStatus] || [];
  if (!allowed.includes(newStatus)) {
    return {
      valid: false,
      message: `Cannot transition from "${currentStatus}" to "${newStatus}". Allowed transitions: ${allowed.join(', ')}`,
    };
  }

  return { valid: true, message: 'Valid transition' };
};

// ============================================================
// Helper: Check if station submission is complete
// ============================================================
export const isStationSubmissionComplete = (
  submission: { fileFolders: any[]; registers: any[] }
): boolean => {
  const hasFileFolders = submission.fileFolders.length > 0;
  const hasRegisters = submission.registers.length > 0;
  const hasQuantities = [...submission.fileFolders, ...submission.registers]
    .some(item => item.quantity > 0);
  
  return (hasFileFolders || hasRegisters) && hasQuantities;
};

// ============================================================
// Schema for validating a single category's cases
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
// Schema for validating a single case name
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
// Schema for validating multiple case names
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
// Schema for validating a single register category
// ============================================================
export const registerCategorySchema = z.object({
  category: z
    .string()
    .refine(
      (val: string) => isValidRegisterCategory(val),
      {
        message: `Category must be one of: ${[...validRegisterCategories, 'Additional'].join(', ')}`,
      }
    ),
});

// ============================================================
// Schema for validating a single register name
// ============================================================
export const registerNameSchema = z.object({
  category: z
    .string()
    .refine(
      (val: string) => isValidRegisterCategory(val),
      {
        message: `Category must be one of: ${[...validRegisterCategories, 'Additional'].join(', ')}`,
      }
    ),
  name: z
    .string()
    .min(1, 'Register name is required'),
}).superRefine((data, ctx) => {
  if (!isValidRegisterNameForCategory(data.category, data.name)) {
    const validNames = getValidRegisterNames(data.category);
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `"${data.name}" is not valid for category "${data.category}". Valid names: ${validNames.join(', ') || 'N/A'}`,
      path: ['name'],
    });
  }
});