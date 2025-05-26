import { DataTypes } from "sequelize";

const defineCopyEval = (sequelize) => {
  const CopyEval = sequelize.define(
    "CopyEval",
    {
      sno: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      copyid: {
        type: DataTypes.STRING(20),
        allowNull: false,
      },
      obt_mark: {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: true,
      },
      obt_mark2: {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: true,
      },
      max_mark: {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: true,
      },
      status: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: "Not-Evaluated",
      },
      eval_time: {
        type: DataTypes.STRING(50),
        allowNull: true,
      },
      eval_time2: {
        type: DataTypes.STRING(50),
        allowNull: true,
      },
      eval_id: {
        type: DataTypes.STRING(20),
        allowNull: true,
      },
      eval_id2: {
        type: DataTypes.STRING(20),
        allowNull: true,
      },
      reject_reason: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      bag_id: {
        type: DataTypes.STRING(20),
        allowNull: false,
      },
      del: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      createdat: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: sequelize.literal("GETDATE()"),
      },
      updatedat: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: sequelize.literal("GETDATE()"),
      },
    },
    {
      tableName: "copy_eval",
      timestamps: false,
    }
  );

  return CopyEval;
};

export default defineCopyEval;
