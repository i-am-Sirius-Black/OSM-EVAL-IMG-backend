import { DataTypes } from 'sequelize';

const defineUserLogin = (sequelize) => {
  const UserLogin = sequelize.define(
    "UserLogin",
    {
      Sno: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true, // Auto-incrementing serial number
      },
      Name: {
        type: DataTypes.STRING(100),
        allowNull: false, // User's name cannot be null
      },
      Email: {
        type: DataTypes.STRING(255),
        allowNull: false,
        unique: true, // User's email must be unique
      },
      PhoneNumber: {
        type: DataTypes.STRING(15),
        allowNull: false, // User's phone number cannot be null
      },
      Uid: {
        type: DataTypes.STRING(50),
        allowNull: false,
        unique: true, // User ID must be unique
      },
      Pass: {
        type: DataTypes.STRING(255),
        allowNull: false, // User's password cannot be null
      },
      Role: {
        type: DataTypes.STRING(50),
        defaultValue: "evaluator", // Default role
      },
      Active: {
        type: DataTypes.BOOLEAN,
        defaultValue: true, // Default active status
      },
    },
    {
      tableName: "UserLogin", // Specify the table name
      timestamps: false, // Set to true if you want Sequelize to manage createdAt and updatedAt fields
    }
  );
  
  return UserLogin;
};

export default defineUserLogin;