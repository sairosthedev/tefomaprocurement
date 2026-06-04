import http from './http';

export const sitesAPI = {
  list: () => http.get('/sites')
};
