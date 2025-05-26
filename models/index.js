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
import defineCopyBatchAssignment from './CopyBatchAssignment.js';
import defineSubjectAssignment from './SubjectAssignments.js';
import defineSubjectData from './SubjectData.js';
import defineVwSubjectData from './VwSubjectData.js';
import defineReevaluationRequest from './CopyReevaluation.js';

// Initialize Export DB models
export const UserLogin = defineUserLogin(sequelize);
export const CopyEval = defineCopyEval(sequelize);
export const CopyPage = defineCopyPage(sequelize);
export const CopyAssignments = defineCopyAssignments(sequelize);
export const CopyAnnotation = defineCopyAnnotation(sequelize);
export const Questions = defineQuestions(sequelize);
export const EvaluationAutosave = defineEvaluationAutosave(sequelize);
export const CopyBatchAssignment = defineCopyBatchAssignment(sequelize);
export const SubjectAssignment = defineSubjectAssignment(sequelize);
export const SubjectData = defineSubjectData(sequelize);
export const CopyReevaluation = defineReevaluationRequest(sequelize);

export const Bagging = defineBagging(evalSequelize);
export const CopyGunning = defineCopyGunning(evalSequelize);
export const Scanning = defineScanning(evalSequelize);
export const CenterPackingSlip = defineCenterPackingSlip(evalSequelize);



//* Define associations
export const setupAssociations = () => {
  // Example: Bagging has many CopyGunning records
  Bagging.hasMany(CopyGunning, { foreignKey: "BagID", sourceKey: "BagID" });
  CopyGunning.belongsTo(Bagging, { foreignKey: "BagID", targetKey: "BagID" });

  SubjectAssignment.hasMany(CopyBatchAssignment, {
  foreignKey: 'SubjectCode',
  sourceKey: 'SubjectCode',
  constraints: false
});

CopyBatchAssignment.belongsTo(SubjectAssignment, {
  foreignKey: 'SubjectCode',
  targetKey: 'SubjectCode',
  constraints: false
});

// New association: SubjectAssignment belongs to UserLogin
  SubjectAssignment.belongsTo(UserLogin, {
    foreignKey: 'EvaluatorID', // The column in tbl_subject_assignments
    targetKey: 'Uid', // The column in UserLogin
    constraints: false // Set to true if you have a foreign key constraint in the database
  });

  // Add association between CopyBatchAssignment and UserLogin
CopyBatchAssignment.belongsTo(UserLogin, {
  foreignKey: 'EvaluatorID',
  targetKey: 'Uid',
  constraints: false
});

// association between CopyAssignments and UserLogin
CopyAssignments.belongsTo(UserLogin, {
  foreignKey: 'EvaluatorID',
  targetKey: 'Uid',
  constraints: false
});

// association bw copyreevaluation and subjectdata
CopyReevaluation.belongsTo(SubjectData, {
  foreignKey: 'CopyID',
  targetKey: 'barcode', 
  as: 'CopyDetails'
});



// Association: CopyEval belongs to SubjectData
CopyEval.belongsTo(SubjectData, {
  foreignKey: 'copyid',
  targetKey: 'barcode',
  as: 'subjectData'
});

// Association: SubjectData hasOne CopyEval
SubjectData.hasOne(CopyEval, {
  foreignKey: 'copyid',
  sourceKey: 'barcode',
  as: 'copyEval'
});


};

