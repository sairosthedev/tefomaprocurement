const { Department } = require('../../models');

const getDepartments = async (req, res) => {
  try {
    const { status } = req.query;
    
    const query = { isDeleted: false };
    if (status) query.status = status;

    const departments = await Department.find(query)
      .populate('head', 'firstName lastName email')
      .sort({ name: 1 });

    res.status(200).json({
      success: true,
      data: departments
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

