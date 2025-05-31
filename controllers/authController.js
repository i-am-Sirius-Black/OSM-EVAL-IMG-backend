import { COOKIE_MAX_AGE, JWT_SECRET } from '../config/config.js';
import {changePasswordService, loginService} from '../services/authService.js';
import jwt from "jsonwebtoken";

export const checkAuth = (req, res) => {
  const token = req.cookies.authToken;
  if (!token) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    res.status(200).json({ user: decoded });
  } catch (err) {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}



export const login = async (req, res) => {
  const { uid, pass } = req.body;
  

  if (!uid || !pass) {
    return res.status(400).json({ error: "User ID or Password missing" });
  }

  try {
    const { token, userData } = await loginService(uid, pass);

    // Set the token as an HTTP-only cookie
    res.cookie("authToken", token, {
      httpOnly: true, // Prevent access via JavaScript
      secure: process.env.NODE_ENV === "production", // Use HTTPS in production
      sameSite: "strict", // Prevent CSRF
      maxAge: COOKIE_MAX_AGE, // Set cookie expiration time
    });

    console.log("Login successful, token set in cookie");
    return res.status(200).json({ message: "Login successful", userData });
  } catch (error) {
    console.error(error.message);
    if (error.status) {
      return res.status(error.status).json({ error: error.message });
    }
    return res.status(500).json({ error: "Internal server error" });
  }
};


export const logout = async (req, res) => {
  res.clearCookie("authToken", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
  });
  return res.status(200).json({ message: "Logged out successfully" });
};




export const changePassword = async (req, res) => {
  const { oldPassword, newPassword } = req.body;
  const userId = req.user.uid; 
  console.log("Password change request for user:", userId, "oldPassword:", oldPassword, "newPassword:", newPassword);
  
  if (!oldPassword || !newPassword) {
    return res.status(400).json({ error: "Old password or new password missing" });
  }

  try {
    await changePasswordService(userId, oldPassword, newPassword);
    return res.status(200).json({ message: "Password changed successfully" });
  } catch (error) {
    console.error("Error changing password:", error.message);
    if (error.status) {
      return res.status(error.status).json({ error: error.message });
    }
    return res.status(500).json({ error: "Internal server error" });
  }
}