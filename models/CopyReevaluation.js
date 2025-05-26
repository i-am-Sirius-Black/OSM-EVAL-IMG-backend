import { DataTypes, Sequelize } from "sequelize";

const defineReevaluationRequest = (sequelize) => {
  const CopyReevaluation = sequelize.define(
    "tbl_reevaluation_requests",
    {
      RequestID: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      CopyID: {
        type: DataTypes.STRING(50),
        allowNull: false,
      },
      Reason: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      Status: {
        type: DataTypes.STRING(20),
        allowNull: true,
      },
      AssignedEvaluatorID: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      ReevaluatedMarks: {
        type: DataTypes.FLOAT,
        allowNull: true,
      },
      Remarks: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      IsChecked: {
        type: DataTypes.BOOLEAN,
      },
      SubmittedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      AssignedAt: {
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
