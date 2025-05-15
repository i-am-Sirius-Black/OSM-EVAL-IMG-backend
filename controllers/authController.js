import { COOKIE_MAX_AGE, JWT_SECRET } from '../config/config.js';
import {changePasswordService, generateNewUID, loginService, registerService} from '../services/authService.js';
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



//* This is temporary, we will use a better way to generate UID later
export const getNewUID = async (req, res) => {
  try {
    const newUID = await generateNewUID();
    console.log("Generated new UID:", newUID);
    res.status(200).json({ newUID });
  } catch (error) {
    console.error("Error fetching new UID:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};


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


export const register = async (req, res) => {
  const { name, email, phoneNumber, uid, pass } = req.body;

  try {
    // Call the register service
    const { token, userData } = await registerService(name, email, phoneNumber, uid, pass);
    
    // Set the token as an HTTP-only cookie
    res.cookie("authToken", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: COOKIE_MAX_AGE,
    });

    return res.status(201).json({
      message: "User registered successfully",
      userData,
    });
  } catch (error) {
    console.error("Error during registration:", error.message);
    if (error.status) {
      return res.status(error.status).json({ error: error.message });
    }
    return res.status(500).json({ error: "Internal server error" });
  }
};



export const changePassword = async (req, res) => {
  const { oldPassword, newPassword } = req.body;
  const userId = req.user.uid; // Assuming you have the user ID from the token
  console.log("Password change request for user:", userId, "oldPassword:", oldPassword, "newPassword:", newPassword);
  
  if (!oldPassword || !newPassword) {
    return res.status(400).json({ error: "Old password or new password missing" });
  }

  try {
    // Call the change password service
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