import { DataTypes } from 'sequelize';

const defineCopyPage = (sequelize) => {
  const CopyPage = sequelize.define(
    "tbl_copy_pages",
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      copyid: {
        type: DataTypes.STRING(50),
        allowNull: false,
      },
      page_number: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      image_data: {
        type: DataTypes.BLOB("long"),
        allowNull: false,
      },
    },
    {
      tableName: "tbl_copy_pages",
      timestamps: false,
    }
  );
  
  return CopyPage;
};

export default defineCopyPage;