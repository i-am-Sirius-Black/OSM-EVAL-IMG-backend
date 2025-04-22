const express = require('express');
const cors = require('cors');
const { Sequelize, DataTypes } = require('sequelize');

const app = express();
app.use(cors());
app.use(express.json());

// Sequelize MS SQL Connection
const sequelize = new Sequelize('Testing', 'ttspl', 'admin', {
  host: 'localhost',
  dialect: 'mssql',
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
const CopyPage = sequelize.define('CopyPage', {
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
    type: DataTypes.BLOB('long'), // VARBINARY(MAX) maps to BLOB in Sequelize
    allowNull: false,
  },
}, {
  tableName: 'tbl_copy_pages',
  timestamps: false,
});

// Sync the model with the database
sequelize.authenticate()
  .then(() => {
    console.log('Database connection established');
    return sequelize.sync({ force: false });
  })
  .then(() => {
    console.log('Database synced');
  })
  .catch((err) => {
    console.error('Error connecting to database:', err.message);
  });



// API to stream image data for a specific page
app.get('/api/copies/image', async (req, res) => {
  console.log('Received request for /api/copies/image with query:', req.query);
  const { copyId, page } = req.query;

  if (!copyId || !page) {
    console.log('Missing copyId or page');
    return res.status(400).json({ error: 'copyId and page are required' });
  }

  try {
    const pageRecord = await CopyPage.findOne({
      where: {
        copy_id: parseInt(copyId),
        page_number: parseInt(page),
      },
      attributes: ['image_data'],
    });

    if (!pageRecord || !pageRecord.image_data) {
      console.log(`No image found for copyId: ${copyId}, page: ${page}`);
      return res.status(404).json({ error: 'Image not found' });
    }

    // Set response headers for image
    res.setHeader('Content-Type', 'image/jpeg'); // Adjust to image/png if needed
    res.setHeader('Content-Length', pageRecord.image_data.length);

    // Send binary image data
    res.send(pageRecord.image_data);
  } catch (error) {
    console.error('Error streaming image:', error.message);
    res.status(500).json({
      error: 'Error streaming image',
      message: error.message,
    });
  }
});

// Basic route to test server
app.get('/', (req, res) => {
  res.send('Server is running');
});

const PORT =3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});