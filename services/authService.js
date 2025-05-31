import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { UserLogin } from "../models/index.js";
import { JWT_SECRET, TOKEN_EXPIRY } from "../config/config.js";

export const loginService = async (uid, pass) => {
  const record = await UserLogin.findOne({ where: { uid: uid, role: "evaluator" } });

  if (!record) {
    const error = new Error("Invalid credentials");
    error.status = 401;
    throw error;
  }

  const isMatch = await bcrypt.compare(pass, record.pass);

  if (!isMatch) {
    const error = new Error("Invalid credentials");
    error.status = 401;
    throw error;
  }

  const token = jwt.sign(
    {
      uid: record.uid,
      role: record.role, // Include role in the token
    },
    JWT_SECRET,
    {
      expiresIn: TOKEN_EXPIRY, // Token expires in 3 days
    }
  );

  const userData = {
    uid: record.uid,
    name: record.name,
    email: record.email,
    phoneNumber: record.phone_number,
    role: record.role,
    active: record.active,
  };

  return { token, userData };
};



/**
 * Change user password
 * @param {string} uid - User ID
 * @param {string} oldPassword - Current password
 * @param {string} newPassword - New password to set
 * @returns {Promise<void>}
 * @throws {Error} If validation fails or database error occurs
 */
export const changePasswordService = async (uid, oldPassword, newPassword) => {
  // Input validation
  if (!uid || !oldPassword || !newPassword) {
    const error = new Error('Missing required parameters');
    error.status = 400;
    throw error;
  }

  // Password strength validation
  if (newPassword.length < 6) {
    const error = new Error('New password must be at least 6 characters long');
    error.status = 400;
    throw error;
  }
  
  // Find the user
  const user = await UserLogin.findOne({ where: { uid: uid } });
  if (!user) {
    const error = new Error('User not found');
    error.status = 404;
    throw error;
  }

  // Verify old password
  const isPasswordValid = await bcrypt.compare(oldPassword, user.pass);
  if (!isPasswordValid) {
    const error = new Error('Current password is incorrect');
    error.status = 401;
    throw error;
  }

  // Check if new password is different from old password
  if (oldPassword === newPassword) {
    const error = new Error('New password must be different from current password');
    error.status = 400;
    throw error;
  }

  // Hash the new password
  const saltRounds = 10;
  const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

// Update the password in the database
  try {
    await user.update({ pass: hashedPassword });
  } catch (error) {
    console.error('Database error during password update:', error);
    const serviceError = new Error('Failed to update password');
    serviceError.status = 500;
    throw serviceError;
  }
};