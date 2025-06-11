// Modified Questions.js model
import { DataTypes } from 'sequelize';

const defineQuestions = (sequelize) => {
  const Questions = sequelize.define(
    "tbl_questions",
    {
      sno: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      paper_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      q_no: {
        type: DataTypes.STRING(10),
        allowNull: false,
      },
      max_mark: {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: false,
      },
      // New fields for the enhanced question structure
      has_parts: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        allowNull: false,
      },
      parts_count: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      part_marks: {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: true,
      },
      is_choice_based: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        allowNull: false,
      },
      choice_attempt_count: {
        type: DataTypes.INTEGER,
        allowNull: true,
      }
      // Removed choice_total_count
    },
    {
      tableName: "tbl_questions",
      timestamps: false,
    }
  );

  return Questions;
};

export default defineQuestions;