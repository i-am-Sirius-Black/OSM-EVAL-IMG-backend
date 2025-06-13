import { sequelize } from '../config/db.js';
import defineCopyAnnotation from './CopyAnnotation.js';
import defineCopyEval from './CopyEval.js';
import defineCopyPage from './CopyPage.js';
import defineScanning from './Scanning.js';
import defineUserLogin from './UserLogin.js';
import defineQuestions from './Questions.js';
import defineCopyAssignments from './CopyAssignments.js';
import defineCopyBatchAssignment from './CopyBatchAssignment.js';
import defineSubjectAssignment from './SubjectAssignments.js';
import defineSubjectData from './SubjectData.js';
import defineReevaluationRequest from './CopyReevaluation.js';
import defineCopy from './Copy.js';
import defineExamPapers from './ExamPapers.js';
import defineUserProfile from './UserProfile.js';
import defineQuestionImages from './QuestionImages.js';

// Initialize Export DB models
export const UserLogin = defineUserLogin(sequelize);
export const CopyEval = defineCopyEval(sequelize);
export const CopyPage = defineCopyPage(sequelize);
export const CopyAssignments = defineCopyAssignments(sequelize);
export const CopyAnnotation = defineCopyAnnotation(sequelize);
export const Questions = defineQuestions(sequelize);
export const CopyBatchAssignment = defineCopyBatchAssignment(sequelize);
export const SubjectAssignment = defineSubjectAssignment(sequelize);
export const SubjectData =  defineSubjectData(sequelize);
export const CopyReevaluation = defineReevaluationRequest(sequelize);
export const Copy = defineCopy(sequelize);
export const Scanning = defineScanning(sequelize);
export const ExamPapers = defineExamPapers(sequelize);
export const UserProfile = defineUserProfile(sequelize);
export const QuestionImages = defineQuestionImages(sequelize);


export const setupAssociations = () => {
  // tbl_copies <-> tbl_subjectdata (Many copies belong to one subjectdata)
  Copy.belongsTo(SubjectData, {
    foreignKey: 'subjectdata_id',
    targetKey: 'subjectdata_id',
    as: 'subjectData'
  });
  
  SubjectData.hasMany(Copy, {
    foreignKey: 'subjectdata_id',
    sourceKey: 'subjectdata_id',
    as: 'copies'
  });

  // tbl_copy_pages <-> tbl_copies (Many pages belong to one copy)
  CopyPage.belongsTo(Copy, {
    foreignKey: 'copyid',
    targetKey: 'copyid',
    as: 'copy'
  });
  Copy.hasMany(CopyPage, {
    foreignKey: 'copyid',
    sourceKey: 'copyid',
    as: 'pages'
  });

  // copy_eval <-> tbl_copies (One eval per copy)
  CopyEval.belongsTo(Copy, {
    foreignKey: 'copyid',
    targetKey: 'copyid',
    as: 'copy'
  });
  Copy.hasOne(CopyEval, {
    foreignKey: 'copyid',
    sourceKey: 'copyid',
    as: 'eval'
  });

  // tbl_copy_assignments <-> tbl_copies (Many assignments per copy)
  CopyAssignments.belongsTo(Copy, {
    foreignKey: 'copyid',
    targetKey: 'copyid',
    as: 'copy'
  });
  Copy.hasMany(CopyAssignments, {
    foreignKey: 'copyid',
    sourceKey: 'copyid',
    as: 'assignments'
  });

  // tbl_scanning <-> tbl_copies (Many scans per copy)
  Scanning.belongsTo(Copy, {
    foreignKey: 'copyid',
    targetKey: 'copyid',
    as: 'copy'
  });
  Copy.hasMany(Scanning, {
    foreignKey: 'copyid',
    sourceKey: 'copyid',
    as: 'scans'
  });

  // tbl_reevaluation_requests <-> tbl_copies (Many reevaluations per copy)
  CopyReevaluation.belongsTo(Copy, {
    foreignKey: 'copyid',
    targetKey: 'copyid',
    as: 'copy'
  });
  Copy.hasMany(CopyReevaluation, {
    foreignKey: 'copyid',
    sourceKey: 'copyid',
    as: 'reevaluations'
  });

  // copy_annotations <-> tbl_copies (Many annotations per copy)
  CopyAnnotation.belongsTo(Copy, {
    foreignKey: 'copyid',
    targetKey: 'copyid',
    as: 'copy'
  });
  Copy.hasMany(CopyAnnotation, {
    foreignKey: 'copyid',
    sourceKey: 'copyid',
    as: 'annotations'
  });

    SubjectAssignment.belongsTo(UserLogin, {
    foreignKey: 'evaluator_id',
    targetKey: 'uid',
    as: 'evaluator'
  });
  UserLogin.hasMany(SubjectAssignment, {
    foreignKey: 'evaluator_id',
    sourceKey: 'uid',
    as: 'subjectAssignments'
  });

// Associate ExamPapers with SubjectData
ExamPapers.belongsTo(SubjectData, {
  foreignKey: 'subject_id',
  targetKey: 'SubjectID',
  as: 'subject'
});

ExamPapers.hasMany(Questions, {
  foreignKey: 'paper_id',
  as: 'questions'
});

Questions.belongsTo(ExamPapers, {
  foreignKey: 'paper_id',
  as: 'paper'
});


// Associate ExamPapers with QuestionImages
ExamPapers.hasMany(QuestionImages, { 
  foreignKey: 'paper_id', 
  as: 'questionImages' 
});

QuestionImages.belongsTo(ExamPapers, {
  foreignKey: 'paper_id',
  as: 'paper'
});




UserLogin.hasOne(UserProfile, { foreignKey: 'uid', as: 'userProfile' });
UserProfile.belongsTo(UserLogin, { foreignKey: 'uid' });



  // If you want to link tbl_copies to tbl_bag (bag_id)
  // Copy.belongsTo(Bag, {
  //   foreignKey: 'bag_id',
  //   targetKey: 'bagid',
  //   as: 'bag'
  // });

  // Add other associations as needed (e.g., assignments to evaluators, batches, etc.)
};

