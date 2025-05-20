import { DataTypes, Sequelize } from 'sequelize';

const defineSubjectAssignment = (sequelize) => {
  const SubjectAssignment = sequelize.define("tbl_subject_assignments", {
    AssignmentID: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    SubjectCode: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    ExamName: {
      type: DataTypes.STRING(100),
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
    Active: {
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