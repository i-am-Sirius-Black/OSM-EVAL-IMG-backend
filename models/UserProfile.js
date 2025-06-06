import { DataTypes } from "sequelize";

const defineUserProfile = (sequelize) => {
  const UserProfile = sequelize.define("UserProfile", {
    profile_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    uid: {
      type: DataTypes.STRING(50),
      allowNull: false,
      references: {
        model: "UserLogin",
        key: "uid",
      },
    },
    adhaar_number: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    address: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    institute_name: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    institute_code: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    faculty_id: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    phone_number: {
      type: DataTypes.STRING(15),
      allowNull: true,
    },
  }, {
    tableName: "UserProfile", // Explicitly set the table name
    timestamps: false,
  });

  return UserProfile;
};

export default defineUserProfile;