import { DataTypes } from 'sequelize';

const defineExamPapers = (sequelize) => {
  const ExamPapers = sequelize.define(
    "tbl_exam_papers",
    {
      paper_id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      paper_code: {
        type: DataTypes.STRING(50),
        allowNull: false,
      },
      subject_id: {
        type: DataTypes.STRING(50), 
        allowNull: false,
      },
      title: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      max_marks: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 100,
      },
      file_path: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      fragmentation: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      created_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
      },
      updated_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
      }
    },
    {
      tableName: "tbl_exam_papers",
      timestamps: false,
    }
  );

  // Define associations in models/index.js
  return ExamPapers;
};

export default defineExamPapers;