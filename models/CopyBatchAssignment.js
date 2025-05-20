import { DataTypes, Sequelize } from 'sequelize';

const defineCopyBatchAssignment = (sequelize) => {
  const CopyBatchAssignment = sequelize.define("tbl_copy_batch_assignments", {
    BatchID: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    EvaluatorID: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    SubjectCode: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    ExamName: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    AssignedAt: {
      type: DataTypes.DATE,
      defaultValue: Sequelize.NOW,
    },
    ExpiresAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    IsActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    CompletedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  }, {
    tableName: "tbl_copy_batch_assignments",
    timestamps: false,
  });
  
  return CopyBatchAssignment;
};

export default defineCopyBatchAssignment;