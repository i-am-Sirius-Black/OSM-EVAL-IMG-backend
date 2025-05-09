import { DataTypes, Sequelize } from 'sequelize';

const defineCopyAssignment = (sequelize) => {

const CopyAssignment = sequelize.define("tbl_copy_assignments", {
    AssignmentID: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    CopyBarcode: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    EvaluatorID: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    AssignedBy: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    AssignedAt: {
      type: DataTypes.DATE,
      defaultValue: Sequelize.NOW,
    },
    IsChecked: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    CheckedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  }, {
    tableName: "tbl_copy_assignments",
    timestamps: false,
  });

  
  return CopyAssignment;
};

export default defineCopyAssignment;