import http from './http';

export const adminAPI = {
  getUsers: (params?: any) => http.get('/admin/users', { params }),
  createUser: (data: any) => http.post('/admin/users', data),
  updateUser: (id: any, data: any) => http.put(`/admin/users/${id}`, data),
  deleteUser: (id: any) => http.delete(`/admin/users/${id}`),
  getDepartments: () => http.get('/admin/departments'),
  createDepartment: (data: any) => http.post('/admin/departments', data),
  getSites: (params?: any) => http.get('/admin/sites', { params }),
  createSite: (data: any) => http.post('/admin/sites', data),
  updateSite: (id: any, data: any) => http.put(`/admin/sites/${id}`, data),
  deleteSite: (id: any) => http.delete(`/admin/sites/${id}`)
};
