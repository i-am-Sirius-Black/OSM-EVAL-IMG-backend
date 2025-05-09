import { DataTypes } from 'sequelize';

const defineQuestions = (sequelize) => {
  const Questions = sequelize.define(
    "Questions",
    {
      Sno: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      PaperID: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      QNo: {
        type: DataTypes.STRING(10),
        allowNull: false,
      },
      MaxMark: {
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
