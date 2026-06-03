import http from './http';

export const adminAPI = {
  getUsers: (params) => http.get('/admin/users', { params }),
  createUser: (data) => http.post('/admin/users', data),
  updateUser: (id, data) => http.put(`/admin/users/${id}`, data),
  deleteUser: (id) => http.delete(`/admin/users/${id}`),
  getDepartments: () => http.get('/admin/departments'),
  createDepartment: (data) => http.post('/admin/departments', data),
  getSites: (params) => http.get('/admin/sites', { params }),
  createSite: (data) => http.post('/admin/sites', data),
  updateSite: (id, data) => http.put(`/admin/sites/${id}`, data),
  deleteSite: (id) => http.delete(`/admin/sites/${id}`)
};
