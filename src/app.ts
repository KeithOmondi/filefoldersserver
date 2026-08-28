// app.ts
import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { notFound } from './middleware/notfound.middleware';
import { errorHandler } from './middleware/error.middleware';
import authRouter from "./features/auth/auth.routes";
import stationRequirementsRoutes from "./features/station-requirements/stationrequirements.routes";
import userRoutes from "./features/users/users.routes"
import { env } from './config/env';

const app: Application = express();

// Body parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// CORS
app.use(
  cors({
    origin: env.CLIENT_ORIGIN || 'http://localhost:5173',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Cookie'],
  })
);

// ✅ REMOVE this line - it's causing the error
// app.options('*', cors(corsOptions));

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
app.use('/api/v1/users', userRoutes);

// Error handlers
app.use(notFound);
app.use(errorHandler);

export default app;