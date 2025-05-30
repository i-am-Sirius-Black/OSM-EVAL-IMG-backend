import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';
import { DB_CONFIG } from './config.js';

dotenv.config();

const { HOST, DIALECT, DB_MAIN, PASSWORD, USER } = DB_CONFIG;

// Main Database Connection
export const sequelize = new Sequelize(DB_MAIN, USER, PASSWORD, {
  host: HOST,
  dialect: DIALECT,
  dialectOptions: {
    options: {
      encrypt: false,
      trustServerCertificate: true,
    },
  },
  define: {
    synOnAssociation: false,
  },
  pool: {
    max: 10,
    min: 0,
    acquire: 30000,
    idle: 10000,
  },
  logging: false,
});

// Database initialization function
export const initializeDatabases = async () => {
  try {
    // Test connection
    await sequelize.authenticate();
    console.log("Database connection established");

    // Sync models
    await sequelize.sync({ force: false });
    console.log("Database synced");

    return true;
  } catch (error) {
    console.error("Error connecting to database:", error.message);
    return false;
  }
};