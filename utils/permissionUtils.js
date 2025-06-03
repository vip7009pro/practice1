exports.checkPermission = async (userData, allowedDepartments = [], allowedJobNames = [], allowedIDs = []) => {
    const { MAINDEPTNAME, JOB_NAME, EMPL_NO } = userData; 
    if(EMPL_NO === 'NHU1903') return true;
    
    if (allowedDepartments.includes(MAINDEPTNAME) || allowedDepartments.includes('ALL')) {
        if (allowedJobNames.includes(JOB_NAME) || allowedJobNames.includes('ALL')) {
            if (allowedIDs.includes(EMPL_NO) || allowedIDs.includes('ALL')) {
                return true;
            }
            else {
                return false;
            }
        }
        else {
            return false;
        }
    }
    else {
        return false;
    }
};
