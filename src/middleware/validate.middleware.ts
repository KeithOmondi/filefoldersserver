// src/middleware/validate.middleware.ts
import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodObject } from 'zod';
import { AppError } from '../utils/Apperror';

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      validatedData?: any;
      validatedQuery?: any;
      validatedBody?: any;
      validatedParams?: any;
    }
  }
}

export const validate = (schema: ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    let dataToValidate: any = {};
    let validationTarget: 'body' | 'query' | 'params' | 'all' = 'body';

    // Check if the schema has a shape (it's a ZodObject)
    const isZodObject = (schema as any)?._def?.typeName === 'ZodObject' || schema instanceof ZodObject;
    const schemaShape = isZodObject ? (schema as ZodObject<any>).shape : null;
    
    const expectsParams = schemaShape?.params !== undefined;
    const expectsBody = schemaShape?.body !== undefined;
    
    console.log(`🔍 Validating ${req.method} ${req.path}`);
    console.log(`📋 Schema shape:`, schemaShape ? Object.keys(schemaShape) : 'not a ZodObject');
    console.log(`📋 Expects params: ${expectsParams}, expects body: ${expectsBody}`);

    if (expectsParams && expectsBody) {
      // Schema expects both params and body (updateSubmissionSchema, adminReviewSchema, submitDraftSchema)
      dataToValidate = {
        params: req.params,
        body: req.body
      };
      validationTarget = 'all';
      console.log(`📦 Validating both params and body`);
    } else if (expectsParams) {
      // Schema only expects params (getSubmissionSchema, deleteSubmissionSchema)
      // ✅ FIX: Wrap req.params in a params object to match the schema
      dataToValidate = {
        params: req.params
      };
      validationTarget = 'params';
      console.log(`📦 Validating params wrapped:`, dataToValidate);
    } else if (req.method === 'GET') {
      // For GET requests without params validation (getSubmissionsSchema, getStationReportSchema)
      dataToValidate = req.query;
      validationTarget = 'query';
      console.log(`📦 Validating query:`, req.query);
    } else {
      // For POST, PUT, PATCH requests without params validation (createSubmissionSchema)
      dataToValidate = req.body;
      validationTarget = 'body';
      console.log(`📦 Validating body`);
    }

    // If dataToValidate is undefined or null, use an empty object
    if (!dataToValidate || typeof dataToValidate !== 'object') {
      console.warn(`⚠️ Data to validate is ${dataToValidate}, using empty object`);
      dataToValidate = {};
    }

    const result = schema.safeParse(dataToValidate);

    if (!result.success) {
      console.error(`❌ Validation failed:`, result.error.issues);
      const message = result.error.issues[0]?.message || 'Invalid request data.';
      return next(new AppError(message, 400));
    }

    console.log(`✅ Validation successful`);

    // Type assertion - we know result.data is valid because safeParse succeeded
    const validatedData = result.data as any;

    // Store validated data on custom properties
    if (validationTarget === 'all') {
      req.validatedParams = validatedData.params;
      req.validatedBody = validatedData.body;
    } else if (validationTarget === 'params') {
      req.validatedParams = validatedData.params;
    } else if (validationTarget === 'query') {
      req.validatedQuery = validatedData;
    } else {
      req.validatedBody = validatedData;
    }
    
    req.validatedData = validatedData;
    next();
  };
};