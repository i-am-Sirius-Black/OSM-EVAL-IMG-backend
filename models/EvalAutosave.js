import { DataTypes } from 'sequelize';

const defineEvaluationAutosave = (sequelize) => {
  const EvaluationAutosave = sequelize.define('tbl_evaluation_autosaves', {
    AutoSaveID: { 
      type: DataTypes.INTEGER, 
      primaryKey: true, 
      autoIncrement: true 
    },
    EvaluatorID: { 
      type: DataTypes.STRING(50), 
      allowNull: false 
    },
    CopyID: { 
      type: DataTypes.STRING(50), 
      allowNull: false 
    },
    Annotations: { 
      type: DataTypes.TEXT,  // Store as JSON string, TEXT is a good choice for large JSON
      allowNull: false 
    },
    Marks: { 
      type: DataTypes.TEXT,  // Store as JSON string
      allowNull: false 
    },
    LastUpdatedAt: { 
      type: DataTypes.DATE, 
      defaultValue: DataTypes.NOW 
    }
  }, { 
    tableName: 'tbl_evaluation_autosaves', 
    timestamps: false 
  });

  return EvaluationAutosave;
};

export default defineEvaluationAutosave;
