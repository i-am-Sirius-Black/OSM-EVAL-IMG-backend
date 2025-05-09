import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import path from 'path';
import { fileURLToPath } from 'url';

// Import database initialization
import { initializeDatabases } from './config/db.js';

// Import routes
import { setupAssociations } from './models/index.js';
import { adminRoutes, annotationRoutes, authRoutes, copyRoutes, documentRoutes, evaluationRoutes, examRoutes,  } from './routes/index.js';

// Initialize environment variables
dotenv.config();

// Get current file directory (ES Module equivalent of __dirname)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Express app
const app = express();
app.use(cors({
  origin: "http://localhost:5173",
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());
// Serve static files from the public directory
app.use(express.static(path.join(__dirname, "public")));

// Setup model associations
setupAssociations();

// Use routes
app.use('/auth', authRoutes);
app.use('/api/copies', copyRoutes);
app.use('/api/annotations', annotationRoutes);
app.use('/api/evaluations', evaluationRoutes);  
app.use('/api/exams', examRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/admin', adminRoutes);


// Initialize databases and start server
const startServer = async () => {
  try {
    const dbInitialized = await initializeDatabases();
    
    if (dbInitialized) {
      const PORT = process.env.PORT || 3000;
      app.listen(PORT, () => {
        console.log(`Server running on http://localhost:${PORT}`);
      });
    } else {
      console.error("Failed to initialize databases. Server not started.");
      process.exit(1);
    }
  } catch (error) {
    console.error("Error starting server:", error);
    process.exit(1);
  }
};

startServer();