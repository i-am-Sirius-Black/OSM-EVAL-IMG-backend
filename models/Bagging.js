import { DataTypes } from 'sequelize';

const defineBagging = (sequelize) => {
  const Bagging = sequelize.define('tbl_bagging', {
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
  
  return Bagging;
};

export default defineBagging;