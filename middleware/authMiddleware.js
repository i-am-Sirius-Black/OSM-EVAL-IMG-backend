// import jwt from "jsonwebtoken";
// import { JWT_SECRET } from '../config/config.js';

// // Base authentication middleware
// const verifyToken = (req, res, next) => {
//   const token = req.cookies.authToken;
  
//   if (!token) {
//     return res.status(401).json({ error: "Unauthorized: No token provided" });
//   }

//   try {
//     const decoded = jwt.verify(token, JWT_SECRET);
//     req.user = decoded;
//     return true;
//   } catch (error) {
//     console.error("Token verification failed:", error.message);
//     res.status(403).json({ error: "Forbidden: Invalid or expired token" });
//     return false;
//   }
// };

// // Admin authentication middleware
// const verifyAdminToken = (req, res, next) => {
//   const token = req.cookies.adminAuthToken;

//   if (!token) {
//     return res.status(401).json({ error: "Unauthorized: No token provided" });
//   }

//   try {
//     const decoded = jwt.verify(token, JWT_SECRET);
//     req.user = decoded;
//     return true;
//   } catch (error) {
//     console.error("Token verification failed:", error.message);
//     res.status(403).json({ error: "Forbidden: Invalid or expired token" });
//     return false;
//   }
// };

// // Regular user authentication
// export const userProtected = (req, res, next) => {
//   if (verifyToken(req, res, next)) {
//     next();
//   }
// };

// // Admin authentication
// export const adminProtected = (req, res, next) => {
//   if (verifyAdminToken(req, res, next)) {
//     // Check if the user has the admin role
//     if (req.user.role !== 'admin') {
//       console.error("Access denied: User is not an admin");
//       return res.status(403).json({ error: "Forbidden: Admin access required" });
//     }
//     next();
//   }
// };





import jwt from "jsonwebtoken";
import { JWT_SECRET } from '../config/config.js';

/**
 * Base token verification function
 * @param {string} tokenName - Name of the cookie containing the token
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object|boolean} - Decoded token payload or false if verification fails
 */
const verifyToken = (tokenName, req, res) => {
  const token = req.cookies[tokenName];
  
  if (!token) {
    res.status(401).json({ error: "Unauthorized: No token provided" });
    return false;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    return decoded;
  } catch (error) {
    console.error(`Token verification failed for ${tokenName}:`, error.message);
    res.status(403).json({ error: "Forbidden: Invalid or expired token" });
    return false;
  }
};

/**
 * Regular user authentication middleware
 */
export const userProtected = (req, res, next) => {
  const decoded = verifyToken('authToken', req, res);
  if (decoded) {
    next();
  }
};

/**
 * Admin authentication middleware
 */
export const adminProtected = (req, res, next) => {
  const decoded = verifyToken('adminAuthToken', req, res);
  if (decoded) {
    // Check if the user has the admin role
    if (decoded.role !== 'admin') {
      console.error("Access denied: User is not an admin");
      return res.status(403).json({ error: "Forbidden: Admin access required" });
    }
    next();
  }
};
