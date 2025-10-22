import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import passport from './config/passport';
import { config } from './config/env';
import authRoutes from './routes/auth.routes';
import documentRoutes from './routes/document.routes';
// import documentSearchRoutes from './routes/documentSearch.routes';
import folderRoutes from './routes/folder.routes';
import tagRoutes from './routes/tag.routes';
import userRoutes from './routes/user.routes';
import chatRoutes from './routes/chat.routes';
import notificationRoutes from './routes/notification.routes';
import ragRoutes from './routes/rag.routes';
import securityRoutes from './routes/security.routes';
import rbacRoutes from './routes/rbac.routes';
import dataProtectionRoutes from './routes/dataProtection.routes';
import documentGenerationRoutes from './routes/documentGeneration.routes';
import documentEditingRoutes from './routes/documentEditing.routes';
import chatDocumentAnalysisRoutes from './routes/chatDocumentAnalysis.routes';
import chatDocumentRoutes from './routes/chatDocument.routes';
import { apiLimiter } from './middleware/rateLimit.middleware';
import { errorHandler } from './middleware/error.middleware';
import { auditLog } from './middleware/auditLog.middleware';
import { initSentry, sentryErrorHandler } from './config/sentry.config';

const app: Application = express();

// Initialize Sentry (MUST be first, before other middleware)
initSentry(app);

// Trust proxy - needed for ngrok and other proxies
app.set('trust proxy', 1);

// Security middleware - Relaxed for ngrok development
if (process.env.NODE_ENV === 'production') {
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
  }));

  // Enhanced security headers for production
  app.use((req, res, next) => {
    // Prevent MIME type sniffing
    res.setHeader('X-Content-Type-Options', 'nosniff');

    // Prevent clickjacking
    res.setHeader('X-Frame-Options', 'DENY');

    // XSS Protection (legacy browsers)
    res.setHeader('X-XSS-Protection', '1; mode=block');

    // HSTS with preload (force HTTPS for 2 years)
    res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');

    // Referrer policy (privacy)
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

    // Permissions Policy (restrict browser features)
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');

    // Expect-CT (Certificate Transparency)
    res.setHeader('Expect-CT', 'max-age=86400, enforce');

    next();
  });
} else {
  // Development mode - Apply security headers but allow ngrok/CORS flexibility
  app.use((req, res, next) => {
    // Prevent MIME type sniffing
    res.setHeader('X-Content-Type-Options', 'nosniff');

    // Prevent clickjacking
    res.setHeader('X-Frame-Options', 'SAMEORIGIN'); // Allow same-origin for dev tools

    // XSS Protection (legacy browsers)
    res.setHeader('X-XSS-Protection', '1; mode=block');

    // Referrer policy (privacy)
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

    // Permissions Policy (restrict browser features)
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');

    next();
  });
}

// CORS configuration - Specific origin for ngrok with credentials support
const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean | string) => void) => {
    // Allow configured frontend URL and ngrok domains
    const allowedOrigins = [
      'https://koda-frontend.ngrok.app',
      'http://localhost:3000', // Development frontend
      config.FRONTEND_URL
    ];

    // Check if origin is allowed or if it's an ngrok domain
    const isNgrokDomain = origin && (origin.includes('.ngrok.app') || origin.includes('.ngrok-free.dev'));

    console.log(`🔍 CORS Check - Origin: ${origin}, isNgrokDomain: ${isNgrokDomain}, allowed: ${!origin || allowedOrigins.includes(origin || '') || isNgrokDomain}`);

    if (!origin) {
      // No origin (same-origin requests)
      callback(null, true);
    } else if (allowedOrigins.includes(origin) || isNgrokDomain) {
      // Return the actual origin to set proper Access-Control-Allow-Origin header
      callback(null, origin);
    } else {
      console.error(`❌ CORS BLOCKED - Origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true, // Allow credentials (cookies, authorization headers)
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'Accept',
    'Origin',
    'Access-Control-Request-Method',
    'Access-Control-Request-Headers'
  ],
  exposedHeaders: ['RateLimit-Limit', 'RateLimit-Remaining', 'RateLimit-Reset', 'Set-Cookie'],
  preflightContinue: false,
  optionsSuccessStatus: 204,
  maxAge: 86400 // Cache preflight requests for 24 hours
};

app.use(cors(corsOptions));

// Security audit logging (after CORS, skips OPTIONS requests internally)
app.use(auditLog);

// General API rate limiter
app.use('/api/', apiLimiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Initialize Passport
app.use(passport.initialize());

// Health check route
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({ status: 'OK', message: 'Server is running' });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/documents', documentGenerationRoutes); // Advanced: Document generation and comparison
app.use('/api/documents', documentEditingRoutes); // Advanced: AI-powered document editing
// app.use('/api/documents', documentSearchRoutes); // Entity search routes
app.use('/api/folders', folderRoutes);
app.use('/api/tags', tagRoutes);
app.use('/api/users', userRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/chat', chatDocumentAnalysisRoutes); // Advanced: Chat-based document analysis (temporary documents)
app.use('/api/chat-documents', chatDocumentRoutes); // Chat document generation and export (PDF/DOCX/MD)
app.use('/api/notifications', notificationRoutes);
app.use('/api/rag', ragRoutes);
app.use('/api/security', securityRoutes); // Security monitoring endpoints
app.use('/api/rbac', rbacRoutes); // RBAC and access control endpoints
app.use('/api/data-protection', dataProtectionRoutes); // Data protection and privacy endpoints

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({ error: 'Route not found' });
});

// Sentry error handler (MUST be before other error handlers)
app.use(sentryErrorHandler());

// Global error handler
app.use(errorHandler);

export default app;

