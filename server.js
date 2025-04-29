const express = require("express");
const cors = require("cors");
const { Sequelize, DataTypes } = require("sequelize");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const {authenticateToken, adminProtected} = require("./middleware/authMiddleware");
require("dotenv").config();
const cookieParser = require("cookie-parser");
const PDFDocument = require("pdfkit");
const fs = require("fs-extra");
const path = require("path");
const sharp = require("sharp");
const os = require("os"); // Import os module for temp directory

const JWT_SECRET = process.env.JWT_SECRET;

const app = express();
app.use(
  cors({
    origin: "http://localhost:5173", // Replace with your frontend URL
    credentials: true, // Allow credentials (cookies, authorization headers, etc.)
  })
);
app.use(express.json());
app.use(cookieParser()); // Add this line to parse cookies
// Serve static files from the public directory
app.use(express.static(path.join(__dirname, "public")));

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



// Second Sequelize MS SQL Connection for TTSPL_EVAL database
const evalSequelize = new Sequelize("TTSPL_EVAL", "ttspl", "admin", {
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


// Models for the TTSPL_EVAL database
const Bagging = evalSequelize.define('tbl_bagging', {
  BagID: { 
    type: DataTypes.STRING, 
    primaryKey: true 
  },
  PackingID: { 
    type: DataTypes.STRING 
  },
  CopiesCount: { 
    type: DataTypes.INTEGER 
  },
  IsScanned: { 
    type: DataTypes.BOOLEAN 
  },
  IsUploaded: { 
    type: DataTypes.BOOLEAN 
  },
}, { 
  tableName: 'tbl_bagging', 
  timestamps: false 
});

const CopyGunning = evalSequelize.define('tbl_gunning', {
  CopyBarcode: { 
    type: DataTypes.STRING, 
    primaryKey: true 
  },
  BagID: { 
    type: DataTypes.STRING 
  },
  PackingID: { 
    type: DataTypes.STRING 
  },
  GID: { 
    type: DataTypes.STRING 
  },
  GunTS: { 
    type: DataTypes.DATE 
  },
  IsScanned: { 
    type: DataTypes.BOOLEAN 
  },
}, { 
  tableName: 'tbl_gunning', 
  timestamps: false 
});

const Scanning = evalSequelize.define('tbl_scanning', {
  sno: { 
    type: DataTypes.INTEGER, 
    primaryKey: true, 
    autoIncrement: true 
  },
  ScanId: { 
    type: DataTypes.STRING 
  },
  scannedAt: { 
    type: DataTypes.DATE 
  },
  copy_barcode: { 
    type: DataTypes.STRING 
  },
  copypdf: { 
    type: DataTypes.BLOB 
  },
  page_count: { 
    type: DataTypes.INTEGER 
  },
}, { 
  tableName: 'tbl_scanning', 
  timestamps: false 
});

const CenterPackingSlip = evalSequelize.define('tbl_centerpackingslip', {
  PackingID: {
    type: DataTypes.STRING,
    primaryKey: true,
  },
  CenterCode: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  ExamDate: {
    type: DataTypes.DATEONLY,
    allowNull: true,
  },
  Course: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  SubjectID: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  Subject: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  PaperCode: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  RegisteredStudents: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  PresentCount: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  AbsentCount: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  UFMCount: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  PackCopiesCount: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
}, {
  tableName: 'tbl_centerpackingslip',
  timestamps: false,
});
// Define associations between models
Bagging.hasMany(CopyGunning, { foreignKey: "BagID", sourceKey: "BagID" });
CopyGunning.belongsTo(Bagging, { foreignKey: "BagID", targetKey: "BagID" });







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
      type: DataTypes.STRING(50), // Changed from INTEGER to STRING for consistency
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
  },
  {
    tableName: "copy_annotations", // Specify the table name
    timestamps: false, // disable automatic timestamps   
  }
);

// Sync the models with the databases
Promise.all([
  // Connect and sync Testing database
  sequelize.authenticate()
    .then(() => {
      console.log("Testing database connection established");
      return sequelize.sync({ force: false });
    })
    .then(() => {
      console.log("Testing database synced");
    }),
  
  // Connect and sync TTSPL_EVAL database
  evalSequelize.authenticate()
    .then(() => {
      console.log("TTSPL_EVAL database connection established");
      return evalSequelize.sync({ force: false });
    })
    .then(() => {
      console.log("TTSPL_EVAL database synced");
    })
])
.catch((err) => {
  console.error("Error connecting to databases:", err.message);
});





// Example backend route to check authentication

app.get("/auth/check", (req, res) => {
  const token = req.cookies.authToken;

  if (!token) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    res.status(200).json({ user: decoded });
  } catch (err) {
    res.status(401).json({ error: "Invalid or expired token" });
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

    const token = jwt.sign({ uid: record.Uid}, JWT_SECRET, {
      expiresIn: "1d",
    });

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

app.get("/getNewUID", async (req, res) => {
  try {
    // Fetch the last record based on the numeric part of the Uid
    const lastRecord = await UserLogin.findOne({
      order: [
        [sequelize.literal("CAST(SUBSTRING(Uid, 4, LEN(Uid)) AS INT)"), "DESC"],
      ], // Order by the numeric part of Uid in descending order
      limit: 1, // Limit to 1 record
    });

    console.log("lastRecord", lastRecord);

    let newUID = "UID001"; // Default UID

    if (lastRecord) {
      // Extract the last UID and increment it
      const lastUID = lastRecord.Uid;
      const uidNumber = parseInt(lastUID.replace("UID", ""));
      newUID = `UID${String(uidNumber + 1).padStart(3, "0")}`; // Increment UID and format it
    }

    res.status(200).json({ newUID });
  } catch (error) {
    console.error("Error fetching new UID:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

// API to stream image data for a specific page
// app.get("/api/copies/image", authenticateToken, async (req, res) => {
//   console.log("Received request for /api/copies/image with query:", req.query);
//   const { copyId, page } = req.query;

//   if (!copyId || !page) {
//     console.log("Missing copyId or page");
//     return res.status(400).json({ error: "copyId and page are required" });
//   }

//   try {
//     const pageRecord = await CopyPage.findOne({
//       where: {
//         copy_id: parseInt(copyId),
//         page_number: parseInt(page),
//       },
//       attributes: ["image_data"],
//     });

//     if (!pageRecord || !pageRecord.image_data) {
//       console.log(`No image found for copyId: ${copyId}, page: ${page}`);
//       return res.status(404).json({ error: "Image not found" });
//     }

//     // Set response headers for image
//     res.setHeader("Content-Type", "image/jpeg"); // Adjust to image/png if needed
//     res.setHeader("Content-Length", pageRecord.image_data.length);

//     // Send binary image data
//     res.send(pageRecord.image_data);
//   } catch (error) {
//     console.error("Error streaming image:", error.message);
//     res.status(500).json({
//       error: "Error streaming image",
//       message: error.message,
//     });
//   }
// });

//?api stream image data for a specific page with lower img size
app.get("/api/copies/image", authenticateToken, async (req, res) => {
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

    const imageBuffer = pageRecord.image_data;
    const optimizedImage = await sharp(imageBuffer)
    .resize({ width: 800 }) // Resize to container width
    .jpeg({ quality: 90 }) // Compress to reduce file size
    .toBuffer();

    // Set response headers for image
    res.setHeader("Content-Type", "image/jpeg"); // Adjust to image/png if needed
    res.setHeader("Content-Length", optimizedImage.length);

    // Send binary image data
    res.send(optimizedImage);
  } catch (error) {
    console.error("Error streaming image:", error.message);
    res.status(500).json({
      error: "Error streaming image",
      message: error.message,
    });
  }
});



// Save annotations
app.post("/api/annotations/save", authenticateToken, async (req, res) => {
  try {
    const { copyId, annotations, drawAnnotations } = req.body;
    console.log("Received request to save annotations:", req.body);

    // Validate required data
    if (!copyId) {
      return res.status(400).json({ error: "Copy ID is required" });
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
        message: "Annotations updated successfully",
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
      message: "Annotations saved successfully",
    });
  } catch (error) {
    console.error("Error saving annotations:", error);
    res.status(500).json({ error: "Failed to save annotations" });
  }
});

// Get annotations
app.get("/api/annotations/:copyId", authenticateToken, async (req, res) => {
  try {
    const { copyId } = req.params;

    // Fetch the record for the given copyId using Sequelize
    const record = await CopyAnnotation.findOne({
      where: { copy_id: copyId },
      attributes: ["annotations", "draw_annotations"], // Fetch only the required fields
    });

    if (!record) {
      // If no record is found, return empty annotations
      return res.status(200).json({ annotations: [], drawAnnotations: [] });
    }

    // Parse the JSON fields and return the response
    res.status(200).json({
      annotations: JSON.parse(record.annotations || "[]"),
      drawAnnotations: JSON.parse(record.draw_annotations || "[]"),
    });
  } catch (error) {
    console.error("Error fetching annotations:", error);
    res.status(500).json({ error: "Failed to fetch annotations" });
  }
});

// API to download copy as PDF with annotations (in backend)
// app.get("/api/copies/download-pdf/:copyId", async (req, res) => {
//   try {
//     const { copyId } = req.params;

//     if (!copyId) {
//       return res.status(400).json({ error: "Copy ID is required" });
//     }

//     console.log(`Generating PDF for copyId: ${copyId}`);

//     // Create the directory if it doesn't exist
//     const outputDir = "C:\\Onscreen_Evaluation";
//     await fs.ensureDir(outputDir);

//     const outputPath = path.join(outputDir, `${copyId}.pdf`);

//     // Define paths to annotation images - matching exactly what your frontend uses
//     const checkImagePath = path.join(
//       __dirname,
//       "public/images/annotations/check.png"
//     );
//     const crossImagePath = path.join(
//       __dirname,
//       "public/images/annotations/cross.png"
//     ); // Note: renamed to 'cancel.png' to match frontend

//     // Check if annotation images exist
//     const useImageAnnotations =
//       fs.existsSync(checkImagePath) && fs.existsSync(crossImagePath);

//     console.log(`Using image annotations: ${useImageAnnotations}`);

//     // Fetch annotations for this copy
//     const annotationRecord = await CopyAnnotation.findOne({
//       where: { copy_id: copyId },
//       attributes: ["annotations", "draw_annotations"],
//     });

//     let annotations = [];
//     let drawAnnotations = [];

//     if (annotationRecord) {
//       annotations = JSON.parse(annotationRecord.annotations || "[]");
//       drawAnnotations = JSON.parse(annotationRecord.draw_annotations || "[]");
//       console.log("Found annotations:", annotations.length);
//       console.log("Found draw annotations:", drawAnnotations.length);
//     }

//     // Fetch all pages for this copy
//     const pages = await CopyPage.findAll({
//       where: { copy_id: copyId },
//       order: [["page_number", "ASC"]],
//       attributes: ["page_number", "image_data"],
//     });

//     if (!pages || pages.length === 0) {
//       return res.status(404).json({ error: "No pages found for this copy" });
//     }

//     console.log(`Found ${pages.length} pages for copyId: ${copyId}`);

//     // Create a new PDF document
//     const doc = new PDFDocument({ autoFirstPage: false });
//     const stream = fs.createWriteStream(outputPath);

//     // Pipe the PDF output to the file
//     doc.pipe(stream);


//     // Process each page
//     for (const page of pages) {
//       const pageNumber = page.page_number;
//       console.log(`Processing page ${pageNumber}`);

//       // Create a temporary image file for this page
//       const tempImagePath = path.join(
//         outputDir,
//         `temp_${copyId}_${pageNumber}.jpg`
//       );
//       await fs.writeFile(tempImagePath, page.image_data);

//       try {
//         // Add a new page to the PDF
//         const img = doc.openImage(tempImagePath);
//         doc.addPage({ size: [img.width, img.height] });
//         doc.image(img, 0, 0);

//         // Add annotations for this page
//         const pageAnnotations = annotations.filter(
//           (a) => a.page === pageNumber
//         );
//         const pageDrawAnnotations = drawAnnotations.filter(
//           (a) => a.page === pageNumber
//         );

//         console.log(
//           `Adding ${pageAnnotations.length} annotations for page ${pageNumber}`
//         );
//         console.log(
//           `Adding ${pageDrawAnnotations.length} draw annotations for page ${pageNumber}`
//         );

//         // Draw point annotations (checks, comments, etc.)
//         for (const annotation of pageAnnotations) {
//           const x = (annotation.position.x * img.width) / 100;
//           const y = (annotation.position.y * img.height) / 100;

//           // Draw different annotations based on type - matching frontend rendering
//           if (annotation.type === "check") {
//             if (useImageAnnotations) {
//               // Use the check.png image - same as frontend
//               try {
//                 const checkImg = doc.openImage(checkImagePath);
//                 const imgSize = 75;
//                 // Center the image like frontend's transform: "translate(-50%, -50%)"
//                 doc.image(checkImg, x - imgSize / 2, y - imgSize / 2, {
//                   width: imgSize,
//                   height: imgSize,
//                 });
//               } catch (imgErr) {
//                 console.error("Error loading check image:", imgErr);
//                 // Fallback to drawing a circle if image fails
//                 doc
//                   .circle(x, y, 18)
//                   .lineWidth(3)
//                   .fillOpacity(0.5)
//                   .fillAndStroke("green", "#008800");
//               }
//             } else {
//               // Fallback to drawing a circle
//               doc
//                 .circle(x, y, 18)
//                 .lineWidth(3)
//                 .fillOpacity(0.5)
//                 .fillAndStroke("green", "#008800");
//             }
//           } else if (annotation.type === "cancel") {
//             if (useImageAnnotations) {
//               // Use the cancel.png image - same as frontend
//               try {
//                 const crossImg = doc.openImage(crossImagePath);
//                 const imgSize = 75;
//                 // Center the image like frontend's transform: "translate(-50%, -50%)"
//                 doc.image(crossImg, x - imgSize / 2, y - imgSize / 2, {
//                   width: imgSize,
//                   height: imgSize,
//                 });
//               } catch (imgErr) {
//                 console.error("Error loading cancel image:", imgErr);
//                 // Fallback to drawing a circle if image fails
//                 doc
//                   .circle(x, y, 18)
//                   .lineWidth(3)
//                   .fillOpacity(0.5)
//                   .fillAndStroke("red", "#880000");
//               }
//             } else {
//               // Fallback to drawing a circle
//               doc
//                 .circle(x, y, 18)
//                 .lineWidth(3)
//                 .fillOpacity(0.5)
//                 .fillAndStroke("red", "#880000");
//             }
//           } else if (annotation.type === "comment") {
//             // For comments, match the frontend's text rendering with increased size

//             // Add the comment text with increased size
//             doc
//               .font("Helvetica-Oblique") // Use italic font
//               .fontSize(50) // 50 for better visibility
//               .fillColor("#EF4444") // text-red-500
//               .text(annotation.text || "", x, y, {
//                 width: 800, // 800 for longer text
//                 align: "left",
//                 lineBreak: true,
//               });
//           }
//         }

//         // Draw path annotations
//         for (const drawAnnotation of pageDrawAnnotations) {
//           // Match the SVG rendering in frontend
//           if (
//             drawAnnotation.position &&
//             drawAnnotation.position.path &&
//             drawAnnotation.position.path.length > 1
//           ) {
//             // Match "stroke="red" strokeWidth="0.2" fill="none""
//             doc
//               .lineWidth(4) // Making it slightly thicker in PDF for better visibility (0.2 is very thin)
//               .strokeColor("red")
//               .fillOpacity(0);

//             // Start the path at the first point
//             const startX =
//               (drawAnnotation.position.path[0].x * img.width) / 100;
//             const startY =
//               (drawAnnotation.position.path[0].y * img.height) / 100;
//             doc.moveTo(startX, startY);

//             // Add the rest of the points to the path
//             for (let i = 1; i < drawAnnotation.position.path.length; i++) {
//               const pointX =
//                 (drawAnnotation.position.path[i].x * img.width) / 100;
//               const pointY =
//                 (drawAnnotation.position.path[i].y * img.height) / 100;
//               doc.lineTo(pointX, pointY);
//             }

//             // Stroke the path
//             doc.stroke();
//           }
//         }
//       } catch (imgError) {
//         console.error(
//           `Error processing image for page ${pageNumber}:`,
//           imgError
//         );
//         // Continue with the next page if there's an error with the current one
//       }

//       // Clean up the temporary image file
//       await fs
//         .remove(tempImagePath)
//         .catch((err) =>
//           console.warn(
//             `Warning: Could not remove temp file ${tempImagePath}: ${err.message}`
//           )
//         );
//     }

//     // Finalize the PDF
//     doc.end();

//     // Wait for the PDF to finish writing
//     stream.on("finish", () => {
//       console.log(`PDF generated successfully at ${outputPath}`);
//       res.status(200).json({
//         success: true,
//         message: "PDF generated successfully",
//         path: outputPath,
//       });
//     });

//     stream.on("error", (err) => {
//       console.error("Error writing PDF:", err);
//       res.status(500).json({ error: "Failed to generate PDF" });
//     });
//   } catch (error) {
//     console.error("Error generating PDF:", error);
//     res
//       .status(500)
//       .json({ error: "Failed to generate PDF", details: error.message });
//   }
// });



//?v2- (client side) API to download copy as PDF with annotations (streaming to client)
app.get("/api/copies/download-pdf/:copyId", adminProtected, async (req, res) => {
  // Create a temp directory path for processing
  const tempDir = path.join(os.tmpdir(), `pdf-${Date.now()}`);
  
  try {
    const { copyId } = req.params;

    if (!copyId) {
      return res.status(400).json({ error: "Copy ID is required" });
    }

    console.log(`Generating PDF for copyId: ${copyId}`);

    // Create temp directory for processing images
    await fs.ensureDir(tempDir);

    // Define paths to annotation images - matching exactly what your frontend uses
    const checkImagePath = path.join(
      __dirname,
      "public/images/annotations/check.png"
    );
    const crossImagePath = path.join(
      __dirname,
      "public/images/annotations/cross.png"
    );

    // Check if annotation images exist
    const useImageAnnotations =
      fs.existsSync(checkImagePath) && fs.existsSync(crossImagePath);

    console.log(`Using image annotations: ${useImageAnnotations}`);

    // Fetch annotations for this copy
    const annotationRecord = await CopyAnnotation.findOne({
      where: { copy_id: copyId },
      attributes: ["annotations", "draw_annotations"],
    });

    let annotations = [];
    let drawAnnotations = [];

    if (annotationRecord) {
      annotations = JSON.parse(annotationRecord.annotations || "[]");
      drawAnnotations = JSON.parse(annotationRecord.draw_annotations || "[]");
      console.log("Found annotations:", annotations.length);
      console.log("Found draw annotations:", drawAnnotations.length);
    }

    // Fetch all pages for this copy
    const pages = await CopyPage.findAll({
      where: { copy_id: copyId },
      order: [["page_number", "ASC"]],
      attributes: ["page_number", "image_data"],
    });

    if (!pages || pages.length === 0) {
      return res.status(404).json({ error: "No pages found for this copy" });
    }

    console.log(`Found ${pages.length} pages for copyId: ${copyId}`);

    // Create a new PDF document
    const doc = new PDFDocument({ autoFirstPage: false });
    
    // Set response headers for PDF download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=${copyId}.pdf`);
    
    // Pipe the PDF directly to the response instead of a file
    doc.pipe(res);


    //?v2 Process each page (Scale to A4 Size)
    // Process each page
for (const page of pages) {
  const pageNumber = page.page_number;
  console.log(`Processing page ${pageNumber}`);

  // Create a temporary image file for this page
  const tempImagePath = path.join(
    tempDir,
    `temp_${copyId}_${pageNumber}.jpg`
  );
  await fs.writeFile(tempImagePath, page.image_data);

  try {
    // Add a new page to the PDF (standard A4 size)
    const A4_WIDTH = 595.28;
    const A4_HEIGHT = 841.89;
    doc.addPage({ size: [A4_WIDTH, A4_HEIGHT] });
    
    // Open image and calculate scaling to fit A4 while preserving aspect ratio
    const img = doc.openImage(tempImagePath);
    const imgAspectRatio = img.width / img.height;
    const pageAspectRatio = A4_WIDTH / A4_HEIGHT;
    
    let scaledWidth, scaledHeight, x, y;
    
    if (imgAspectRatio > pageAspectRatio) {
      // Image is wider than page (relative to height)
      scaledWidth = A4_WIDTH - 40; // 20pt margin on each side
      scaledHeight = scaledWidth / imgAspectRatio;
      x = 20; // 20pt from left edge
      y = (A4_HEIGHT - scaledHeight) / 2; // Center vertically
    } else {
      // Image is taller than page (relative to width)
      scaledHeight = A4_HEIGHT - 40; // 20pt margin top and bottom
      scaledWidth = scaledHeight * imgAspectRatio;
      x = (A4_WIDTH - scaledWidth) / 2; // Center horizontally
      y = 20; // 20pt from top
    }
    
    // Draw the image scaled to fit A4
    doc.image(img, x, y, { width: scaledWidth, height: scaledHeight });

    // We need to adjust annotations to match the new scale
    const pageAnnotations = annotations.filter(a => a.page === pageNumber);
    const pageDrawAnnotations = drawAnnotations.filter(a => a.page === pageNumber);
    
    // Calculate scaling factors for annotations
    const xScaleFactor = scaledWidth / img.width;
    const yScaleFactor = scaledHeight / img.height;
    
    // Draw annotations with adjusted positions
    for (const annotation of pageAnnotations) {
      // Convert percentage position to actual pixels on original image
      const originalX = (annotation.position.x * img.width) / 100;
      const originalY = (annotation.position.y * img.height) / 100;
      
      // Apply scaling to get position on the new scaled image
      const scaledX = x + (originalX * xScaleFactor);
      const scaledY = y + (originalY * yScaleFactor);
      
      // Adjust size for annotations based on scaling
      const annotationScale = Math.min(xScaleFactor, yScaleFactor);
      
      if (annotation.type === "check") {
        if (useImageAnnotations) {
          try {
            const checkImg = doc.openImage(checkImagePath);
            const imgSize = 75 * annotationScale; // Reduced from 75 to fit A4 better
            doc.image(checkImg, scaledX - imgSize / 2, scaledY - imgSize / 2, {
              width: imgSize,
              height: imgSize,
            });
          } catch (imgErr) {
            console.error("Error loading check image:", imgErr);
            doc
              .circle(scaledX, scaledY, 10 * annotationScale)
              .lineWidth(2 * annotationScale)
              .fillOpacity(0.5)
              .fillAndStroke("green", "#008800");
          }
        } else {
          doc
            .circle(scaledX, scaledY, 10 * annotationScale)
            .lineWidth(2 * annotationScale)
            .fillOpacity(0.5)
            .fillAndStroke("green", "#008800");
        }
      } else if (annotation.type === "cancel") {
        if (useImageAnnotations) {
          try {
            const crossImg = doc.openImage(crossImagePath);
            const imgSize = 75 * annotationScale; // Reduced from 75 to fit A4 better
            doc.image(crossImg, scaledX - imgSize / 2, scaledY - imgSize / 2, {
              width: imgSize,
              height: imgSize,
            });
          } catch (imgErr) {
            console.error("Error loading cancel image:", imgErr);
            doc
              .circle(scaledX, scaledY, 10 * annotationScale)
              .lineWidth(2 * annotationScale)
              .fillOpacity(0.5)
              .fillAndStroke("red", "#880000");
          }
        } else {
          doc
            .circle(scaledX, scaledY, 10 * annotationScale)
            .lineWidth(2 * annotationScale)
            .fillOpacity(0.5)
            .fillAndStroke("red", "#880000");
        }
      } else if (annotation.type === "comment") {
        doc
          .font("Helvetica-Oblique")
          .fontSize(50 * annotationScale) // 50 to fit A4 better
          .fillColor("#EF4444")
          .text(annotation.text || "", scaledX, scaledY, {
            width: 400 * annotationScale, // Reduced from 800 to fit A4 better
            align: "left",
            lineBreak: true,
          });
      }
    }

    // Draw path annotations with adjusted positions
    for (const drawAnnotation of pageDrawAnnotations) {
      if (
        drawAnnotation.position &&
        drawAnnotation.position.path &&
        drawAnnotation.position.path.length > 1
      ) {
        doc
          .lineWidth(4 * Math.min(xScaleFactor, yScaleFactor)) // Reduced from 4 to fit A4 better
          .strokeColor("red")
          .fillOpacity(0);

        // Scale all points in the path
        if (drawAnnotation.position.path.length > 0) {
          const firstPoint = drawAnnotation.position.path[0];
          const originalX = (firstPoint.x * img.width) / 100;
          const originalY = (firstPoint.y * img.height) / 100;
          const scaledX = x + (originalX * xScaleFactor);
          const scaledY = y + (originalY * yScaleFactor);
          
          doc.moveTo(scaledX, scaledY);

          for (let i = 1; i < drawAnnotation.position.path.length; i++) {
            const point = drawAnnotation.position.path[i];
            const pointOriginalX = (point.x * img.width) / 100;
            const pointOriginalY = (point.y * img.height) / 100;
            const pointScaledX = x + (pointOriginalX * xScaleFactor);
            const pointScaledY = y + (pointOriginalY * yScaleFactor);
            
            doc.lineTo(pointScaledX, pointScaledY);
          }
          
          doc.stroke();
        }
      }
    }
  } catch (imgError) {
    console.error(`Error processing image for page ${pageNumber}:`, imgError);
  }

  // Clean up the temporary image file
  await fs.remove(tempImagePath).catch((err) =>
    console.warn(`Warning: Could not remove temp file ${tempImagePath}: ${err.message}`)
  );
}

    // // Process each page
    // for (const page of pages) {
    //   const pageNumber = page.page_number;
    //   console.log(`Processing page ${pageNumber}`);

    //   // Create a temporary image file for this page
    //   const tempImagePath = path.join(
    //     tempDir,
    //     `temp_${copyId}_${pageNumber}.jpg`
    //   );
    //   await fs.writeFile(tempImagePath, page.image_data);

    //   try {
    //     // Add a new page to the PDF
    //     const img = doc.openImage(tempImagePath);
    //     doc.addPage({ size: [img.width, img.height] });
    //     doc.image(img, 0, 0);

    //     // Add annotations for this page
    //     const pageAnnotations = annotations.filter(
    //       (a) => a.page === pageNumber
    //     );
    //     const pageDrawAnnotations = drawAnnotations.filter(
    //       (a) => a.page === pageNumber
    //     );

    //     console.log(
    //       `Adding ${pageAnnotations.length} annotations for page ${pageNumber}`
    //     );
    //     console.log(
    //       `Adding ${pageDrawAnnotations.length} draw annotations for page ${pageNumber}`
    //     );

    //     // Draw point annotations (checks, comments, etc.)
    //     for (const annotation of pageAnnotations) {
    //       const x = (annotation.position.x * img.width) / 100;
    //       const y = (annotation.position.y * img.height) / 100;

    //       // Draw different annotations based on type - matching frontend rendering
    //       if (annotation.type === "check") {
    //         if (useImageAnnotations) {
    //           // Use the check.png image - same as frontend
    //           try {
    //             const checkImg = doc.openImage(checkImagePath);
    //             const imgSize = 75;
    //             // Center the image like frontend's transform: "translate(-50%, -50%)"
    //             doc.image(checkImg, x - imgSize / 2, y - imgSize / 2, {
    //               width: imgSize,
    //               height: imgSize,
    //             });
    //           } catch (imgErr) {
    //             console.error("Error loading check image:", imgErr);
    //             // Fallback to drawing a circle if image fails
    //             doc
    //               .circle(x, y, 18)
    //               .lineWidth(3)
    //               .fillOpacity(0.5)
    //               .fillAndStroke("green", "#008800");
    //           }
    //         } else {
    //           // Fallback to drawing a circle
    //           doc
    //             .circle(x, y, 18)
    //             .lineWidth(3)
    //             .fillOpacity(0.5)
    //             .fillAndStroke("green", "#008800");
    //         }
    //       } else if (annotation.type === "cancel") {
    //         if (useImageAnnotations) {
    //           // Use the cancel.png image - same as frontend
    //           try {
    //             const crossImg = doc.openImage(crossImagePath);
    //             const imgSize = 75;
    //             // Center the image like frontend's transform: "translate(-50%, -50%)"
    //             doc.image(crossImg, x - imgSize / 2, y - imgSize / 2, {
    //               width: imgSize,
    //               height: imgSize,
    //             });
    //           } catch (imgErr) {
    //             console.error("Error loading cancel image:", imgErr);
    //             // Fallback to drawing a circle if image fails
    //             doc
    //               .circle(x, y, 18)
    //               .lineWidth(3)
    //               .fillOpacity(0.5)
    //               .fillAndStroke("red", "#880000");
    //           }
    //         } else {
    //           // Fallback to drawing a circle
    //           doc
    //             .circle(x, y, 18)
    //             .lineWidth(3)
    //             .fillOpacity(0.5)
    //             .fillAndStroke("red", "#880000");
    //         }
    //       } else if (annotation.type === "comment") {
    //         // For comments, match the frontend's text rendering with increased size

    //         // Add the comment text with increased size
    //         doc
    //           .font("Helvetica-Oblique") // Use italic font
    //           .fontSize(50) // 50 for better visibility
    //           .fillColor("#EF4444") // text-red-500
    //           .text(annotation.text || "", x, y, {
    //             width: 800, // 800 for longer text
    //             align: "left",
    //             lineBreak: true,
    //           });
    //       }
    //     }

    //     // Draw path annotations
    //     for (const drawAnnotation of pageDrawAnnotations) {
    //       // Match the SVG rendering in frontend
    //       if (
    //         drawAnnotation.position &&
    //         drawAnnotation.position.path &&
    //         drawAnnotation.position.path.length > 1
    //       ) {
    //         // Match "stroke="red" strokeWidth="0.2" fill="none""
    //         doc
    //           .lineWidth(4) // Making it slightly thicker in PDF for better visibility (0.2 is very thin)
    //           .strokeColor("red")
    //           .fillOpacity(0);

    //         // Start the path at the first point
    //         const startX =
    //           (drawAnnotation.position.path[0].x * img.width) / 100;
    //         const startY =
    //           (drawAnnotation.position.path[0].y * img.height) / 100;
    //         doc.moveTo(startX, startY);

    //         // Add the rest of the points to the path
    //         for (let i = 1; i < drawAnnotation.position.path.length; i++) {
    //           const pointX =
    //             (drawAnnotation.position.path[i].x * img.width) / 100;
    //           const pointY =
    //             (drawAnnotation.position.path[i].y * img.height) / 100;
    //           doc.lineTo(pointX, pointY);
    //         }

    //         // Stroke the path
    //         doc.stroke();
    //       }
    //     }
    //   } catch (imgError) {
    //     console.error(
    //       `Error processing image for page ${pageNumber}:`,
    //       imgError
    //     );
    //     // Continue with the next page if there's an error with the current one
    //   }

    //   // Clean up the temporary image file
    //   await fs
    //     .remove(tempImagePath)
    //     .catch((err) =>
    //       console.warn(
    //         `Warning: Could not remove temp file ${tempImagePath}: ${err.message}`
    //       )
    //     );
    // }

    // Finalize the PDF - this will send the complete PDF to the client
    doc.end();
    
    // Clean up the temp directory
    fs.remove(tempDir).catch(err => {
      console.warn(`Warning: Could not remove temp directory ${tempDir}: ${err.message}`);
    });
    
  } catch (error) {
    console.error("Error generating PDF:", error);
    
    // Clean up temp directory on error
    fs.remove(tempDir).catch(() => {});
    
    // Only send error if headers haven't been sent
    if (!res.headersSent) {
      res.status(500).json({ error: "Failed to generate PDF", details: error.message });
    }
  }
});


//TTSPL_EVAL APIS
// Fetch distinct exams
app.get("/api/exams", async (req, res) => {
  try {
    const exams = await CenterPackingSlip.findAll({
      attributes: [
        [sequelize.fn("DISTINCT", sequelize.col("Course")), "examName"], // Distinct exam names
        [sequelize.col("Course"), "examId"], // Alias Course as examId
      ],
      raw: true, // Return plain objects
    });

    res.status(200).json(
      exams.map((exam) => ({
        examName: exam.examName,
        examId: exam.examId,
      }))
    );
  } catch (error) {
    console.error("Error fetching exams:", error.message);
    res.status(500).json({ error: "Failed to fetch exams" });
  }
});

// Fetch subjects by exam
app.get("/api/subjects/:examId", async (req, res) => {
  try {
    const { examId } = req.params;

    const subjects = await CenterPackingSlip.findAll({
      where: { Course: examId }, // Filter by examId (Course)
      attributes: [
        [sequelize.fn("DISTINCT", sequelize.col("Subject")), "subject"], // Distinct subjects
        [sequelize.col("SubjectID"), "subjectId"], // Alias SubjectID as subjectId
        [sequelize.col("PackingID"), "packingId"], // Include PackingID for the subject
      ],
      raw: true, // Return plain objects
    });

    res.status(200).json(
      subjects.map((subject) => ({
        subject: subject.subject,
        subjectId: subject.subjectId,
        packingId: subject.packingId, // Include PackingID for frontend tracking
      }))
    );
  } catch (error) {
    console.error("Error fetching subjects:", error.message);
    res.status(500).json({ error: "Failed to fetch subjects" });
  }
});

// Fetch BagIDs by PackingID
app.get("/api/bags/:packingId", async (req, res) => {
  try {
    const { packingId } = req.params;

    const baggingRecords = await Bagging.findAll({
      where: { PackingID: packingId }, // Filter by PackingID
      attributes: ["BagID"], // Only fetch BagID
      raw: true, // Return plain objects
    });

    if (!baggingRecords || baggingRecords.length === 0) {
      return res.status(404).json({ error: "No BagIDs found for the given PackingID" });
    }

    const bagIds = baggingRecords.map((record) => record.BagID);

    res.status(200).json(bagIds);
  } catch (error) {
    console.error("Error fetching BagIDs:", error.message);
    res.status(500).json({ error: "Failed to fetch BagIDs" });
  }
});


// Fetch copies by SubjectID
app.post("/api/copies/subject", async (req, res) => {
  try {
    const { subjectId, packingId } = req.body;

    
    // // Step 1: Find all PackingIDs for the given SubjectID
    // const packingRecords = await CenterPackingSlip.findAll({
    //   where: { SubjectID: subjectId },
    //   attributes: ["PackingID"], // Only fetch PackingID
    //   raw: true, // Return plain objects
    // });

    // if (!packingRecords || packingRecords.length === 0) {
    //   return res.status(404).json({ error: "No PackingIDs found for the given SubjectID" });
    // }

    // const packingIds = packingRecords.map((record) => record.PackingID);

    // Step 2: Find all BagIDs for the PackingIDs
    const baggingRecords = await Bagging.findAll({
      where: { PackingID: packingId }, // Match PackingIDs
      attributes: ["BagID"], // Only fetch BagID
      raw: true, // Return plain objects
    });

    if (!baggingRecords || baggingRecords.length === 0) {
      return res.status(404).json({ error: "No BagIDs found for the given PackingIDs" });
    }

    const bagIds = baggingRecords.map((record) => record.BagID);

    // Step 3: Find all CopyBarcodes for the BagIDs
    const gunningRecords = await CopyGunning.findAll({
      where: { BagID: bagIds, IsScanned: 1 }, // Match BagIDs
      attributes: ["CopyBarcode"], // Only fetch CopyBarcode
      raw: true, // Return plain objects
    });

    if (!gunningRecords || gunningRecords.length === 0) {
      return res.status(404).json({ error: "No copies found for the given BagIDs" });
    }

    const copyList = gunningRecords.map((record) => record.CopyBarcode);

    // Return the list of copies
    res.status(200).json(copyList);
  } catch (error) {
    console.error("Error fetching copies by subject:", error.message);
    res.status(500).json({ error: "Failed to fetch copies by subject" });
  }
});
// Search and filter copies
app.get("/api/copies/search", async (req, res) => {
  try {
    const { bagId, searchTerm, sortOrder } = req.query;

    const gunningRecords = await CopyGunning.findAll({
      where: { BagID: bagId }, // Filter by BagID
      attributes: ["CopyBarcode"], // Only fetch CopyBarcode
      raw: true, // Return plain objects
    });

    let copyList = gunningRecords.map((record) => record.CopyBarcode);

    // Filter by search term
    if (searchTerm) {
      copyList = copyList.filter((copy) =>
        copy.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Sort copies
    if (sortOrder === "asc") {
      copyList.sort((a, b) => a.localeCompare(b));
    } else if (sortOrder === "desc") {
      copyList.sort((a, b) => b.localeCompare(a));
    }

    res.status(200).json(copyList);
  } catch (error) {
    console.error("Error searching copies:", error.message);
    res.status(500).json({ error: "Failed to search copies" });
  }
});





// Get all annotated copies (copies that have been checked/evaluated)
app.get("/api/copies/annotated", authenticateToken, async (req, res) => {
  try {
    // Find all records in the CopyAnnotation table
    const annotatedCopies = await CopyAnnotation.findAll({
      attributes: ['copy_id'], // Only fetch the copy_id field
      raw: true, // Return plain objects
    });

    if (!annotatedCopies || annotatedCopies.length === 0) {
      return res.status(404).json({ 
        message: "No annotated copies found",
        copies: [] 
      });
    }

    // Extract just the copy_id values into an array
    const copyIds = annotatedCopies.map(record => record.copy_id);

    res.status(200).json({
      count: copyIds.length,
      copies: copyIds
    });
  } catch (error) {
    console.error("Error fetching annotated copies:", error.message);
    res.status(500).json({ error: "Failed to fetch annotated copies" });
  }
});


const PORT = process.env.PORT;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
