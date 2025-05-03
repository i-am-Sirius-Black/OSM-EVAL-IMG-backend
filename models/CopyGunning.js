import { DataTypes } from 'sequelize';

const defineCopyGunning = (sequelize) => {
  const CopyGunning = sequelize.define('tbl_gunning', {
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
  
  return CopyGunning;
};

export default defineCopyGunning;