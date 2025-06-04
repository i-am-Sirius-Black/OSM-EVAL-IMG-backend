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
    },
    {
      tableName: "tbl_questions",
      timestamps: false,
    }
  );

  return Questions;
};

export default defineQuestions;
