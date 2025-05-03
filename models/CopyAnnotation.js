import { DataTypes } from 'sequelize';

const defineCopyAnnotation = (sequelize) => {
  const CopyAnnotation = sequelize.define(
    "CopyAnnotation",
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true, // Auto-incrementing primary key
      },
      copy_id: {
        type: DataTypes.STRING(50),
        allowNull: false, // Copy ID cannot be null
        unique: true, // Copy ID must be unique
      },
      annotations: {
        type: DataTypes.TEXT, // Use TEXT for JSON data
        allowNull: true, // Allow null if no annotations are provided
      },
      draw_annotations: {
        type: DataTypes.TEXT, // Use TEXT for JSON data
        allowNull: true, // Allow null if no drawing annotations are provided
      },
    },
    {
      tableName: "copy_annotations", // Specify the table name
      timestamps: false, // disable automatic timestamps   
    }
  );
  
  return CopyAnnotation;
};

export default defineCopyAnnotation;