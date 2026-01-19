const { Department, User } = require('../../models');

const getDepartments = async (req, res) => {
  try {
    const { status } = req.query;
    
    const query = { isDeleted: false };
    if (status) query.status = status;

    const departments = await Department.find(query)
      .populate('head', 'firstName lastName email')
      .sort({ name: 1 });

    // Calculate user count for each department
    const departmentsWithCounts = await Promise.all(
      departments.map(async (dept) => {
        const userCount = await User.countDocuments({
          department: dept._id,
          isDeleted: false
        });

        return {
          ...dept.toObject(),
          userCount
        };
      })
    );

    res.status(200).json({
      success: true,
      data: departmentsWithCounts
    });
  } catch (error) {
    console.error('Get departments error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

module.exports = getDepartments;

