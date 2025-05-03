import jwt from "jsonwebtoken";
import { JWT_SECRET } from '../config/config.js';

// Base authentication middleware
const verifyToken = (req, res, next) => {
  const token = req.cookies.authToken;

  if (!token) {
    return res.status(401).json({ error: "Unauthorized: No token provided" });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    return true;
  } catch (error) {
    console.error("Token verification failed:", error.message);
    res.status(403).json({ error: "Forbidden: Invalid or expired token" });
    return false;
  }
};

// Regular user authentication
export const userProtected = (req, res, next) => {
  if (verifyToken(req, res, next)) {
    next();
  }
};

// Admin authentication
export const adminProtected = (req, res, next) => {
  if (verifyToken(req, res, next)) {
    // Check if the user has the admin role
    if (req.user.role !== 'admin') {
      console.error("Access denied: User is not an admin");
      return res.status(403).json({ error: "Forbidden: Admin access required" });
    }
    next();
  }
};