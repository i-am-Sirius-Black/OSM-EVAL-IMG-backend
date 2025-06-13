import { DataTypes } from 'sequelize';

const defineQuestionImages = (sequelize) => {
  const QuestionImages = sequelize.define(
    "tbl_question_images",
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      paper_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'tbl_papers',
          key: 'paper_id'
        }
      },
      question_number: {
        type: DataTypes.STRING(10),
        allowNull: false,
      },
      part_letter: {
        type: DataTypes.STRING(1),
        allowNull: true,
      },
      image_data: {
        type: DataTypes.BLOB, // Sequelize will map this to VARBINARY(MAX) in SQL Server
        allowNull: true, // Allow null for questions without images
      },
    },
    {
      tableName: "tbl_question_images",
      timestamps: false,
      indexes: [
        {
          unique: true,
          fields: ['paper_id', 'question_number', 'part_letter']
        }
      ]
    }
  );

  return QuestionImages;
};

export default defineQuestionImages;