import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { errorHandler } from './middleware/error-handler';
import videosRouter from './routes/videos';
import foldersRouter from './routes/folders';
import schemaRouter from './routes/schema';
import placementsRouter from './routes/placements';
import livestreamsRouter from './routes/livestreams';
import analyticsRouter from './routes/analytics';
import modulesRouter from './routes/modules';
import qaRouter from './routes/qa';

const app = express();

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(morgan('short'));

// Health check
app.get('/api/v1/health', (_req, res) => {
  res.json({ success: true, data: { status: 'ok', timestamp: new Date().toISOString() } });
});

// Routes
app.use('/api/v1/videos', videosRouter);
app.use('/api/v1/folders', foldersRouter);
app.use('/api/v1/schema', schemaRouter);
app.use('/api/v1/placements', placementsRouter);
app.use('/api/v1/livestreams', livestreamsRouter);
app.use('/api/v1/analytics', analyticsRouter);
app.use('/api/v1/modules', modulesRouter);
app.use('/api/v1/qa', qaRouter);

// Error handling
app.use(errorHandler);

export default app;
