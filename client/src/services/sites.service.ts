import http from './http';

export const sitesAPI: any = {
  list: () => http.get('/sites')
};
