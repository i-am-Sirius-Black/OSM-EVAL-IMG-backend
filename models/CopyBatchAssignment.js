import { DataTypes, Sequelize } from 'sequelize';

const defineCopyBatchAssignment = (sequelize) => {
  const CopyBatchAssignment = sequelize.define("tbl_copy_batch_assignments", {
    batch_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    evaluator_id: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    subject_code: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    exam_name: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    assigned_at: {
      type: DataTypes.DATE,
      defaultValue: Sequelize.NOW,
      allowNull: false,
    },
    expires_at: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    completed_at: {
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