import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { UserLogin } from "../models/index.js";
import { JWT_SECRET, TOKEN_EXPIRY } from "../config/config.js";

export const loginService = async (uid, pass) => {
  const record = await UserLogin.findOne({ where: { Uid: uid } });

  if (!record) {
    const error = new Error("Invalid credentials");
    error.status = 401;
    throw error;
  }

  const isMatch = await bcrypt.compare(pass, record.Pass);

  if (!isMatch) {
    const error = new Error("Invalid credentials");
    error.status = 401;
    throw error;
  }

  const token = jwt.sign(
    {
      uid: record.Uid,
      role: record.Role, // Include role in the token
    },
    JWT_SECRET,
    {
      expiresIn: TOKEN_EXPIRY, // Token expires in 3 days
    }
  );

  const userData = {
    uid: record.Uid,
    name: record.Name,
    email: record.Email,
    phoneNumber: record.PhoneNumber,
    role: record.Role,
    active: record.Active,
  };

  return { token, userData };
};

export const registerService = async (name, email, phoneNumber, uid, pass) => {
  // Validate input
  if (!name || !email || !phoneNumber || !uid || !pass) {
    const error = new Error("All fields are required");
    error.status = 400;
    throw error;
  }

  // Check if the user already exists
  const existingUser = await UserLogin.findOne({ where: { Uid: uid } });
  if (existingUser) {
    const error = new Error("User ID already exists");
    error.status = 409;
    throw error;
  }

  // Hash the password
  const hashedPassword = await bcrypt.hash(pass, 10);

  // Create a new user record
  const newUser = await UserLogin.create({
    Name: name,
    Email: email,
    PhoneNumber: phoneNumber,
    Uid: uid,
    Pass: hashedPassword,
    Role: "evaluator", // Default role
    Active: true, // Default active status
  });

  // Generate a token for the new user
  const token = jwt.sign(
    { 
      uid: newUser.Uid,
      role: newUser.Role
    }, 
    JWT_SECRET, 
    {
      expiresIn: TOKEN_EXPIRY,
    }
  );

  // Prepare user data to return
  const userData = {
    uid: newUser.Uid,
    name: newUser.Name,
    email: newUser.Email,
    phoneNumber: newUser.PhoneNumber,
    role: newUser.Role,
    active: newUser.Active,
  };

  return { token, userData };
};


//* This is temporary, we will use a better way to generate UID later */
/**
 * Service to generate a new unique UID by finding the last one and incrementing
 * @returns {Promise<string>} The new UID
 */
export const generateNewUID = async () => {
  try {
    // Fetch the last record based on the numeric part of the Uid
    const lastRecord = await UserLogin.findOne({
      order: [
        [sequelize.literal("CAST(SUBSTRING(Uid, 4, LEN(Uid)) AS INT)"), "DESC"],
      ],
      limit: 1,
    });

    let newUID = "UID001"; // Default UID

    if (lastRecord) {
      // Extract the last UID and increment it
      const lastUID = lastRecord.Uid;
      const uidNumber = parseInt(lastUID.replace("UID", ""));
      newUID = `UID${String(uidNumber + 1).padStart(3, "0")}`; // Increment UID and format it
    }

    return newUID;
  } catch (error) {
    console.error("Error generating new UID:", error.message);
    throw error; // Rethrow the error to be handled by the controller
  }
};