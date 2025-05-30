import { DataTypes, Sequelize } from 'sequelize';

const defineSubjectAssignment = (sequelize) => {
  const SubjectAssignment = sequelize.define("tbl_subject_assignments", {
    assignment_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    subject_code: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    exam_name: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    evaluator_id: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    assigned_by: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    assigned_at: {
      type: DataTypes.DATE,
      defaultValue: Sequelize.NOW,
    },
    active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
  }, {
    tableName: "tbl_subject_assignments",
    timestamps: false,
  });
  
  return SubjectAssignment;
};

export default defineSubjectAssignment;