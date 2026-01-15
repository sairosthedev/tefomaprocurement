const createUser = require('./createUser.controller');
const getUsers = require('./getUsers.controller');
const updateUser = require('./updateUser.controller');
const deleteUser = require('./deleteUser.controller');
const createDepartment = require('./createDepartment.controller');
const getDepartments = require('./getDepartments.controller');

module.exports = {
  createUser,
  getUsers,
  updateUser,
  deleteUser,
  createDepartment,
  getDepartments
};

