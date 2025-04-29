const jwt = require("jsonwebtoken");

const authenticateToken = (req, res, next) => {
  const token = req.cookies.authToken; // Get token from cookies

  if (!token) {
    return res.status(401).json({ error: "Unauthorized: No token provided" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET); // Verify the token
    req.user = decoded; // Attach the decoded token payload (e.g., uid) to the request object
    next(); // Proceed to the next middleware or route handler
  } catch (error) {
    console.error("Token verification failed:", error.message);
    return res.status(403).json({ error: "Forbidden: Invalid or expired token" });
  }
};



const adminProtected = (req, res, next) => {
  const token = req.cookies.authToken; // Get token from cookies

  if (!token) {
    return res.status(401).json({ error: "Unauthorized: No token provided" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET); // Verify the token
    
    req.user = decoded; // Attach the decoded token payload (e.g., uid) to the request object
    if (req.user.uid!== 'UID001') { // Check if the user is an admin (replace 'UID001' with the actual admin UID)
      console.error("Access denied: User is not an admin"); // Log the error for debugging
      return res.status(403).json({ error: "Forbidden: Admin access required" });
    }
    next(); // Proceed to the next middleware or route handler
  } catch (error) {
    console.error("Token verification failed:", error.message);
    return res.status(403).json({ error: "Forbidden: Invalid or expired token" });
  }
};

module.exports = {authenticateToken, adminProtected};