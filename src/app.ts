// app.ts
import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { notFound } from './middleware/notfound.middleware';
import { errorHandler } from './middleware/error.middleware';
import authRouter from "./features/auth/auth.routes";
import stationRequirementsRoutes from "./features/station-requirements/stationrequirements.routes";
import userRoutes from "./features/users/users.routes"
import pendingProceedingsRoutes from "./features/builder/pendingProceedings.routes"
import { env } from './config/env';

const app: Application = express();

// Body parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Define allowed origins list
const allowedOrigins = env.CLIENT_ORIGIN
  ? env.CLIENT_ORIGIN.split(',').map((origin) => origin.trim())
  : ['http://localhost:5173', 'http://localhost:3000'];

// CORS Setup for Multiple Domains
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g., Postman, mobile apps, curl)
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      } else {
        return callback(new Error(`CORS policy: ${origin} is not allowed by CORS`));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Cookie'],
  })
);

// Health Check Route
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'success',
    message: 'Server is healthy',
    timestamp: new Date().toISOString(),
  });
});

// Routes
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/station-requirements', stationRequirementsRoutes);
app.use('/api/v1/pending-proceedings', pendingProceedingsRoutes);
app.use('/api/v1/users', userRoutes);

// Error handlers
app.use(notFound);
app.use(errorHandler);

export default app;