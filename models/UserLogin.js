import { DataTypes } from "sequelize";

const defineUserLogin = (sequelize) => {
  const UserLogin = sequelize.define("UserLogin", {
    sno: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    phone_number: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    uid: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    pass: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    role: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
  }, {
    tableName: "UserLogin",
    timestamps: false,
  });

  return UserLogin;
};

export default defineUserLogin;