import { DataTypes } from "sequelize";

const defineBag = (sequelize) => {
  const Bag = sequelize.define("tbl_bag", {
    bagid: {
      type: DataTypes.STRING(50),
      primaryKey: true,
      allowNull: false
    },
    packid: {
      type: DataTypes.STRING(50),
      allowNull: true
    },
    subjectdata_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: "tbl_subjectdata",
        key: "subjectdata_id"
      }
    }
  }, {
    tableName: "tbl_bag",
    schema: "dbo",
    freezeTableName: true,
    timestamps: false
  });

  return Bag;
};

export default defineBag;
