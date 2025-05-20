import { DataTypes } from 'sequelize';

const defineVwSubjectData = (sequelize) => {
  const VwSubjectData = sequelize.define("vw_subjectdata", {
    barcode: {
      type: DataTypes.STRING(50),
      primaryKey: true
    },
    bagid: {
      type: DataTypes.STRING(50)
    },
    packid: {
      type: DataTypes.STRING(50)
    },
    course: {
      type: DataTypes.STRING(100)
    },
    SubjectID: {
      type: DataTypes.STRING(50)
    },
    Subject: {
      type: DataTypes.STRING(100)
    },
    PaperCode: {
      type: DataTypes.STRING(50)
    }
  }, {
    tableName: "vw_subjectdata",
    schema: "dbo",
    freezeTableName: true,
    timestamps: false,
    // Add these options for a view
    syncable: false,  // Don't try to create this table during sync
    viewDefinition: false  // Not trying to create the view
  });
  
  // Views are typically read-only
  VwSubjectData.removeAttribute('id');
  
  return VwSubjectData;
};

export default defineVwSubjectData;