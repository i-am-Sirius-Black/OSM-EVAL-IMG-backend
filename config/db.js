import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';
import { DB_CONFIG } from './config.js';

dotenv.config();

const {HOST, DIALECT, DB1, DB2,PASSWORD, USER} = DB_CONFIG;


// Testing Database Connection
export const sequelize = new Sequelize(DB2, USER, PASSWORD, {
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

// TTSPL_EVAL Database Connection
export const evalSequelize = new Sequelize(DB1, USER, PASSWORD, {
  host: HOST,
  dialect: DIALECT,
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

// Database initialization function
export const initializeDatabases = async () => {
  try {
    // Test connections
    await sequelize.authenticate();
    console.log("Testing database connection established");
    
    await evalSequelize.authenticate();
    console.log("TTSPL_EVAL database connection established");
    
    // Sync models
    await sequelize.sync({ force: false });
    console.log("Testing database synced");
    
    await evalSequelize.sync({ force: false });
    console.log("TTSPL_EVAL database synced");
    
    return true;
  } catch (error) {
    console.error("Error connecting to databases:", error.message);
    return false;
  }
};