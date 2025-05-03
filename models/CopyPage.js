import { DataTypes } from 'sequelize';

const defineCopyPage = (sequelize) => {
  const CopyPage = sequelize.define(
    "CopyPage",
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      copy_id: {
        type: DataTypes.STRING(50), // Changed from INTEGER to STRING for consistency
        allowNull: false,
      },
      page_number: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      image_data: {
        type: DataTypes.BLOB("long"), // VARBINARY(MAX) maps to BLOB in Sequelize
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