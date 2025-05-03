import dotenv from 'dotenv';

// Initialize environment variables
dotenv.config();

// Export the JWT secret for use in other files
export const JWT_SECRET = process.env.JWT_SECRET || 'your-fallback-secret-key';

// You can export other configuration values as needed
export const TOKEN_EXPIRY = '3d';
export const COOKIE_MAX_AGE = 3 * 24 * 60 * 60 * 1000; // 3 days in milliseconds