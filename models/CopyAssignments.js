import { DataTypes, Sequelize } from 'sequelize';

const defineCopyAssignment = (sequelize) => {
  const CopyAssignment = sequelize.define("tbl_copy_assignments", {
    assignment_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    copyid: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    evaluator_id: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    batch_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    assigned_by: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    assigned_at: {
      type: DataTypes.DATE,
      defaultValue: Sequelize.NOW,
    },
    is_checked: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    checked_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  }, {
    tableName: "tbl_copy_assignments",
    timestamps: false,
  });

  return CopyAssignment;
};

export default defineCopyAssignment;