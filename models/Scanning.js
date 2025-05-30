import { DataTypes } from 'sequelize';

const defineScanning = (sequelize) => {
  const Scanning = sequelize.define('tbl_scanning', {
    sno: { 
      type: DataTypes.INTEGER, 
      primaryKey: true, 
      autoIncrement: true 
    },
    scan_id: { 
      type: DataTypes.STRING 
    },
    scanned_at: { 
      type: DataTypes.DATE 
    },
    copyid: { 
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
  
  return Scanning;
};

export default defineScanning;