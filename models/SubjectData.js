import { DataTypes } from "sequelize";

const defineSubjectData = (sequelize) => {
  const SubjectData = sequelize.define("tbl_subjectdata", {
    subjectdata_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    packid: {
      type: DataTypes.STRING(50),
      allowNull: true
    },
    CenterCode: {
      type: DataTypes.STRING(50),
      allowNull: true
    },
    ExamDate: {
      type: DataTypes.DATEONLY,
      allowNull: true
    },
    Course: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    SubjectID: {
      type: DataTypes.STRING(50),
      allowNull: true
    },
    Subject: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    PaperCode: {
      type: DataTypes.STRING(50),
      allowNull: true
    }
  }, {
    tableName: "tbl_subjectdata",
    schema: "dbo",
    freezeTableName: true,
    timestamps: false
  });

  return SubjectData;
};

export default defineSubjectData;