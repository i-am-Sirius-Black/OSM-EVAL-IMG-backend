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
    return false;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    return decoded;
  } catch (error) {
    console.error(`Token verification failed for ${tokenName}:`, error.message);
    return false;
  }
};

/**
 * Regular user authentication middleware
 * Allows both regular users and admins to access
 */
export const userProtected = (req, res, next) => {
  // Try user token first
  let decoded = verifyToken('authToken', req, res);
  
  // If no user token or invalid, try admin token
  if (!decoded) {
    decoded = verifyToken('adminAuthToken', req, res);
    
    // If admin token exists and valid, check role
    if (decoded && decoded.role === 'admin') {
      // Admin can access user routes
      return next();
    }
    
    // If we get here, we had neither a valid user token nor a valid admin token
    return res.status(401).json({ error: "Unauthorized: Valid authentication required" });
  }
  
  // User token was valid
  next();
};

/**
 * Admin authentication middleware
 * Only allows users with admin role
 */
export const adminProtected = (req, res, next) => {
  const decoded = verifyToken('adminAuthToken', req, res);
  
  if (!decoded) {
    return res.status(401).json({ error: "Unauthorized: No valid admin token provided" });
  }
  
  // Check if the user has the admin role
  if (decoded.role !== 'admin') {
    console.error("Access denied: User is not an admin");
    return res.status(403).json({ error: "Forbidden: Admin access required" });
  }
  
  next();
};
