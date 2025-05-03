import { DataTypes } from 'sequelize';

const defineCenterPackingSlip = (sequelize) => {
  const CenterPackingSlip = sequelize.define('tbl_centerpackingslip', {
    PackingID: {
      type: DataTypes.STRING,
      primaryKey: true,
    },
    CenterCode: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    ExamDate: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    Course: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    SubjectID: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    Subject: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    PaperCode: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    RegisteredStudents: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    PresentCount: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    AbsentCount: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    UFMCount: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    PackCopiesCount: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
  }, {
    tableName: 'tbl_centerpackingslip',
    timestamps: false,
  });
  
  return CenterPackingSlip;
};

export default defineCenterPackingSlip;