const express = require("express");
const cors = require("cors");
const { Sequelize, DataTypes } = require("sequelize");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const authenticateToken = require("./middleware/authMiddleware");
require("dotenv").config();
const cookieParser = require("cookie-parser");

const JWT_SECRET = process.env.JWT_SECRET;

const app = express();
app.use(cors({
  origin: "http://localhost:5173", // Replace with your frontend URL
  credentials: true, // Allow credentials (cookies, authorization headers, etc.)
}));
app.use(express.json());
app.use(cookieParser()); // Add this line to parse cookies

// Sequelize MS SQL Connection
const sequelize = new Sequelize("Testing", "ttspl", "admin", {
  host: "localhost",
  dialect: "mssql",
  dialectOptions: {
    options: {
      encrypt: false,
      trustServerCertificate: true,
    },
  },
  pool: {
    max: 10,
    min: 0,
    acquire: 30000,
    idle: 10000,
  },
  logging: false,
});

// Define Sequelize Model for tbl_copy_pages
const CopyPage = sequelize.define(
  "CopyPage",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    copy_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    page_number: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    image_data: {
      type: DataTypes.BLOB("long"), // VARBINARY(MAX) maps to BLOB in Sequelize
      allowNull: false,
    },
  },
  {
    tableName: "tbl_copy_pages",
    timestamps: false,
  }
);

//userlogin in test db

const UserLogin = sequelize.define(
  "UserLogin",
  {
    Sno: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true, // Auto-incrementing serial number
    },
    Name: {
      type: DataTypes.STRING(100),
      allowNull: false, // User's name cannot be null
    },
    Email: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true, // User's email must be unique
    },
    PhoneNumber: {
      type: DataTypes.STRING(15),
      allowNull: false, // User's phone number cannot be null
    },
    Uid: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true, // User ID must be unique
    },
    Pass: {
      type: DataTypes.STRING(255),
      allowNull: false, // User's password cannot be null
    },
    Role: {
      type: DataTypes.STRING(50),
      defaultValue: "evaluator", // Default role
    },
    Active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true, // Default active status
    },
  },
  {
    tableName: "UserLogin", // Specify the table name
    timestamps: false, // Set to true if you want Sequelize to manage createdAt and updatedAt fields
  }
);


// Define Sequelize Model for copy_annotations
const CopyAnnotation = sequelize.define(
  "CopyAnnotation",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true, // Auto-incrementing primary key
    },
    copy_id: {
      type: DataTypes.STRING(50),
      allowNull: false, // Copy ID cannot be null
      unique: true, // Copy ID must be unique
    },
    annotations: {
      type: DataTypes.TEXT, // Use TEXT for JSON data
      allowNull: true, // Allow null if no annotations are provided
    },
    draw_annotations: {
      type: DataTypes.TEXT, // Use TEXT for JSON data
      allowNull: true, // Allow null if no drawing annotations are provided
    },
    created_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW, // Default to current date and time
    },
    updated_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW, // Default to current date and time
    },
  },
  {
    tableName: "copy_annotations", // Specify the table name
    timestamps: false, // Disable automatic timestamps
  }
);



// Sync the model with the database
sequelize
  .authenticate()
  .then(() => {
    console.log("Database connection established");
    return sequelize.sync({ force: false });
  })
  .then(() => {
    console.log("Database synced");
  })
  .catch((err) => {
    console.error("Error connecting to database:", err.message);
  });


  // Example backend route to check authentication

app.get('/auth/check', (req, res) => {
  const token = req.cookies.authToken;

  if (!token) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    res.status(200).json({ user: decoded });
  } catch (err) {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
});



// app.post("/login", async (req, res) => {
//   const { uid, pass } = req.body;
//   console.log("uid pass", uid, pass);

//   if (!uid || !pass) {
//     console.log("Missing user login or password");
//     return res.status(400).json({ error: "User Id or Password missing" });
//   }

//   try {
//     const record = await UserLogin.findOne({ where: { uid: uid } });

//     if (!record) {
//       return res
//         .status(401)
//         .json({ error: "Invalid credentials , no record found" });
//     }

//     const isMatch = await bcrypt.compare(pass, record.Pass); // Pass is the hashed password

//     if (!isMatch) {
//       return res.status(401).json({ error: "Invalid credentials" });
//     }

//     const token = jwt.sign({ uid: record.Uid }, JWT_SECRET, {
//       expiresIn: "1d",
//     });

//     // Prepare user data to send in the response
//     const userData = {
//       uid: record.Uid,
//       name: record.Name,
//       email: record.Email,
//       phoneNumber: record.PhoneNumber,
//       role: record.Role,
//       active: record.Active,
//     };

//     return res
//       .status(200)
//       .json({ message: "Login successful", token, userData });
//   } catch (error) {
//     console.error(error);
//     return res.status(500).json({ error: "Internal server error" });
//   }
// });

// Register API

//?login- sending token in cookies.....

app.post("/login", async (req, res) => {
  const { uid, pass } = req.body;

  if (!uid || !pass) {
    return res.status(400).json({ error: "User ID or Password missing" });
  }

  try {
    const record = await UserLogin.findOne({ where: { Uid: uid } });

    if (!record) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const isMatch = await bcrypt.compare(pass, record.Pass);

    if (!isMatch) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const token = jwt.sign(
      { uid: record.Uid },
      JWT_SECRET,
      { expiresIn: "1d" }
    );

    const userData = {
      uid: record.Uid,
      name: record.Name,
      email: record.Email,
      phoneNumber: record.PhoneNumber,
      role: record.Role,
      active: record.Active,
    };

    // Set the token as an HTTP-only cookie
    res.cookie("authToken", token, {
      httpOnly: true, // Prevent access via JavaScript
      secure: process.env.NODE_ENV === "production", // Use HTTPS in production
      sameSite: "strict", // Prevent CSRF
      maxAge: 24 * 60 * 60 * 1000, // 1 day
    });

    return res.status(200).json({ message: "Login successful", userData });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/logout", (req, res) => {
  res.clearCookie("authToken", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
  });
  return res.status(200).json({ message: "Logged out successfully" });
});

app.post("/register", async (req, res) => {
  const { name, email, phoneNumber, uid, pass } = req.body;

  // Validate input
  if (!name || !email || !phoneNumber || !uid || !pass) {
    console.log("Missing required fields");
    return res.status(400).json({ error: "All fields are required" });
  }

  try {
    // Check if the user already exists
    const existingUser = await UserLogin.findOne({ where: { Uid: uid } });
    if (existingUser) {
      return res.status(409).json({ error: "User ID already exists" });
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
    const token = jwt.sign({ uid: newUser.Uid }, JWT_SECRET, {
      expiresIn: "1d", // Token valid for 1 day
    });

    // Set the token as an HTTP-only cookie
    res.cookie("authToken", token, {
      httpOnly: true, // Prevent access via JavaScript
      secure: process.env.NODE_ENV === "production", // Use HTTPS in production
      sameSite: "strict", // Prevent CSRF
      maxAge: 24 * 60 * 60 * 1000, // 1 day
    });

    // Return success response with user data
    const userData = {
      uid: newUser.Uid,
      name: newUser.Name,
      email: newUser.Email,
      phoneNumber: newUser.PhoneNumber,
      role: newUser.Role,
      active: newUser.Active,
    };

    return res.status(201).json({
      message: "User registered successfully",
      userData,
    });
  } catch (error) {
    console.error("Error during registration:", error.message);
    return res.status(500).json({ error: "Internal server error" });
  }
});



// API to stream image data for a specific page
app.get("/api/copies/image",authenticateToken, async (req, res) => {
  console.log("Received request for /api/copies/image with query:", req.query);
  const { copyId, page } = req.query;

  if (!copyId || !page) {
    console.log("Missing copyId or page");
    return res.status(400).json({ error: "copyId and page are required" });
  }

  try {
    const pageRecord = await CopyPage.findOne({
      where: {
        copy_id: parseInt(copyId),
        page_number: parseInt(page),
      },
      attributes: ["image_data"],
    });

    if (!pageRecord || !pageRecord.image_data) {
      console.log(`No image found for copyId: ${copyId}, page: ${page}`);
      return res.status(404).json({ error: "Image not found" });
    }

    // Set response headers for image
    res.setHeader("Content-Type", "image/jpeg"); // Adjust to image/png if needed
    res.setHeader("Content-Length", pageRecord.image_data.length);

    // Send binary image data
    res.send(pageRecord.image_data);
  } catch (error) {
    console.error("Error streaming image:", error.message);
    res.status(500).json({
      error: "Error streaming image",
      message: error.message,
    });
  }
});


// Save annotations
app.post('/api/annotations/save', authenticateToken,  async (req, res) => {
  try {
    const { copyId, annotations, drawAnnotations } = req.body;
    console.log("Received request to save annotations:", req.body);
    
    // Validate required data
    if (!copyId) {
      return res.status(400).json({ error: 'Copy ID is required' });
    }

    // Check if a record already exists for the given copyId
    const existingRecord = await CopyAnnotation.findOne({
      where: { copy_id: copyId },
    });

    if (existingRecord) {
      // Update existing annotations
      await existingRecord.update({
        annotations: JSON.stringify(annotations || []),
        draw_annotations: JSON.stringify(drawAnnotations || []),
      });

      return res.status(200).json({
        success: true,
        message: 'Annotations updated successfully',
      });
    }

    // If no record exists, create a new one
    await CopyAnnotation.create({
      copy_id: copyId,
      annotations: JSON.stringify(annotations || []),
      draw_annotations: JSON.stringify(drawAnnotations || []),
    });

    return res.status(201).json({
      success: true,
      message: 'Annotations saved successfully',
    });
  } catch (error) {
    console.error('Error saving annotations:', error);
    res.status(500).json({ error: 'Failed to save annotations' });
  }
});





// Get annotations
app.get('/api/annotations/:copyId', authenticateToken, async (req, res) => {
  try {
    const { copyId } = req.params;

    // Fetch the record for the given copyId using Sequelize
    const record = await CopyAnnotation.findOne({
      where: { copy_id: copyId },
      attributes: ['annotations', 'draw_annotations'], // Fetch only the required fields
    });

    if (!record) {
      // If no record is found, return empty annotations
      return res.status(200).json({ annotations: [], drawAnnotations: [] });
    }

    // Parse the JSON fields and return the response
    res.status(200).json({
      annotations: JSON.parse(record.annotations || '[]'),
      drawAnnotations: JSON.parse(record.draw_annotations || '[]'),
    });
  } catch (error) {
    console.error('Error fetching annotations:', error);
    res.status(500).json({ error: 'Failed to fetch annotations' });
  }
});


const PORT = process.env.PORT;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
