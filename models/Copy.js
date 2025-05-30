import { DataTypes } from "sequelize";

// models/Copy.js
const defineCopy = (sequelize) => {
  const Copy = sequelize.define(
    "Copy",
    {
      copyid: {
        type: DataTypes.STRING(50),
        primaryKey: true,
        allowNull: false
      },
      bag_id: {
        type: DataTypes.STRING(20),
        allowNull: false
      },
      pack_id: {
        type: DataTypes.STRING(50),
        allowNull: true
      },
      is_assigned: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
      },
      is_evaluated: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
      },
      is_reevaluated: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
      },
      evaluation_status: {
        type: DataTypes.STRING(20),
        defaultValue: 'Not-Evaluated'
      },
      current_evaluator_id: {
        type: DataTypes.STRING(50),
        allowNull: true
      },
      created_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      updated_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      subjectdata_id: {
        type: DataTypes.STRING(50),
        allowNull: true
      },
      del:{
        type: DataTypes.BOOLEAN,
        defaultValue: false
      }
    },
    {
      tableName: "tbl_copies",
      timestamps: false
    }
  );

  return Copy;
};

export default defineCopy;