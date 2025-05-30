import { DataTypes, Sequelize } from "sequelize";

const defineReevaluationRequest = (sequelize) => {
  const CopyReevaluation = sequelize.define(
    "tbl_reevaluation_requests",
    {
      request_id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      copyid: {
        type: DataTypes.STRING(50),
        allowNull: false,
      },
      reason: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      status: {
        type: DataTypes.STRING(20),
        allowNull: true,
      },
      assigned_evaluator_id: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      reevaluated_marks: {
        type: DataTypes.FLOAT,
        allowNull: true,
      },
      remarks: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      is_checked: {
        type: DataTypes.BOOLEAN,
      },
      submitted_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      assigned_at: {
        type: DataTypes.DATE,
        defaultValue: Sequelize.NOW,
      },
    },
    {
      tableName: "tbl_reevaluation_requests",
      timestamps: false,
    }
  );

  return CopyReevaluation;
};

export default defineReevaluationRequest;