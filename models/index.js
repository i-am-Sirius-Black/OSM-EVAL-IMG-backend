import { sequelize, evalSequelize } from '../config/db.js';
import defineBagging from './Bagging.js';
import defineCenterPackingSlip from './CenterPackingSlip.js';
import defineCopyAnnotation from './CopyAnnotation.js';
import defineCopyEval from './CopyEval.js';
import defineCopyGunning from './CopyGunning.js';
import defineCopyPage from './copyPage.js';
import defineScanning from './Scanning.js';
import defineUserLogin from './UserLogin.js';
import defineQuestions from './Questions.js';
import defineCopyAssignments from './CopyAssignments.js';
import defineEvaluationAutosave from './EvalAutosave.js';

// Initialize Export DB models
export const UserLogin = defineUserLogin(sequelize);
export const CopyEval = defineCopyEval(sequelize);
export const CopyPage = defineCopyPage(sequelize);
export const CopyAssignments = defineCopyAssignments(sequelize);
export const CopyAnnotation = defineCopyAnnotation(sequelize);
export const Questions = defineQuestions(sequelize);
export const EvaluationAutosave = defineEvaluationAutosave(sequelize);

export const Bagging = defineBagging(evalSequelize);
export const CopyGunning = defineCopyGunning(evalSequelize);
export const Scanning = defineScanning(evalSequelize);
export const CenterPackingSlip = defineCenterPackingSlip(evalSequelize);



//* Define associations
export const setupAssociations = () => {
  // Example: Bagging has many CopyGunning records
  Bagging.hasMany(CopyGunning, { foreignKey: "BagID", sourceKey: "BagID" });
  CopyGunning.belongsTo(Bagging, { foreignKey: "BagID", targetKey: "BagID" });
  
};