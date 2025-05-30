import dotenv from "dotenv";

// Initialize environment variables
dotenv.config();

// Export the JWT secret for use in other files
export const JWT_SECRET = process.env.JWT_SECRET || "your-fallback-secret-key";

// You can export other configuration values as needed
export const TOKEN_EXPIRY = "3d";
export const COOKIE_MAX_AGE = 3 * 24 * 60 * 60 * 1000; // 3 days in milliseconds

export const COPY_BATCH_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours

export const DB_CONFIG = {
  HOST: process.env.DB_HOST,
  USER: process.env.DB_USER,
  PASSWORD: process.env.DB_PASSWORD,
  DB_MAIN: process.env.DB_NAME_MAIN,
  DB1: process.env.DB_NAME,
  DB2: process.env.DB_NAME2,
  DIALECT: process.env.DB_DIALECT,
};

// Add this to your existing config.js file
export const EMAIL_CONFIG = {
  HOST: process.env.EMAIL_HOST || "smtp.gmail.com",
  PORT: parseInt(process.env.EMAIL_PORT || "587", 10),
  SECURE: process.env.EMAIL_SECURE === "true",
  USER: process.env.EMAIL_USER || "your-email@gmail.com",
  PASSWORD: process.env.EMAIL_PASSWORD || "your-app-password",
};
