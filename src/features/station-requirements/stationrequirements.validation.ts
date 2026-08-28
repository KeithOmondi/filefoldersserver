// stationrequirements.validation.ts

import { z } from 'zod';

// Item schema for a single requirement item
export const stationRequirementItemSchema = z.object({
  division: z.string().min(1, 'Division is required'),
  name: z.string().min(1, 'Item name is required'),
  quantity: z.number().int().min(0, 'Quantity must be 0 or greater'),
});

// ✅ FIXED: Create submission schema - validates data directly
export const createSubmissionSchema = z.object({
  station: z.string().min(1, 'Station name is required'),
  quarter: z.string().min(1, 'Quarter is required'),
  fileFolders: z.array(stationRequirementItemSchema).optional().default([]),
  registers: z.array(stationRequirementItemSchema).optional().default([]),
}).refine(
  (data) => {
    const totalFileFolders = data.fileFolders.reduce((sum, item) => sum + item.quantity, 0);
    const totalRegisters = data.registers.reduce((sum, item) => sum + item.quantity, 0);
    return totalFileFolders > 0 || totalRegisters > 0;
  },
  {
    message: 'At least one item with quantity greater than 0 is required',
    path: ['fileFolders', 'registers'],
  }
);

// ✅ FIXED: Get submissions query schema - validates query params directly
export const getSubmissionsSchema = z.object({
  station: z.string().optional(),
  quarter: z.string().optional(),
  fromDate: z.string().optional().refine(
    (val) => !val || !isNaN(Date.parse(val)),
    { message: 'Invalid fromDate format' }
  ),
  toDate: z.string().optional().refine(
    (val) => !val || !isNaN(Date.parse(val)),
    { message: 'Invalid toDate format' }
  ),
  page: z.string().optional().transform((val) => val ? Number(val) : 1).pipe(
    z.number().int().min(1)
  ),
  limit: z.string().optional().transform((val) => val ? Number(val) : 20).pipe(
    z.number().int().min(1).max(100)
  ),
});

// Get single submission schema
export const getSubmissionSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid submission ID format'),
  }),
});

// Update submission schema
export const updateSubmissionSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid submission ID format'),
  }),
  body: z.object({
    station: z.string().min(1, 'Station name is required').optional(),
    quarter: z.string().min(1, 'Quarter is required').optional(),
    fileFolders: z.array(stationRequirementItemSchema).optional(),
    registers: z.array(stationRequirementItemSchema).optional(),
  }).refine(
    (data) => {
      // At least one field to update
      return data.station || data.quarter || data.fileFolders || data.registers;
    },
    {
      message: 'At least one field must be provided for update',
      path: ['body'],
    }
  ),
});

// Delete submission schema
export const deleteSubmissionSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid submission ID format'),
  }),
});

// Export types
export type CreateSubmissionInput = z.infer<typeof createSubmissionSchema>;
export type GetSubmissionsQuery = z.infer<typeof getSubmissionsSchema>;
export type GetSubmissionParams = z.infer<typeof getSubmissionSchema>['params'];
export type UpdateSubmissionInput = z.infer<typeof updateSubmissionSchema>['body'];
export type UpdateSubmissionParams = z.infer<typeof updateSubmissionSchema>['params'];
export type DeleteSubmissionParams = z.infer<typeof deleteSubmissionSchema>['params'];