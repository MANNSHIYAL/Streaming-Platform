import { HttpInterceptorFn } from '@angular/common/http';

export const appendHeaderInterceptor: HttpInterceptorFn = (req, next) => {
  if (req.url.includes('X-Amz-Signature')) return next(req);
  const isAuth = (req.url.includes('login') || req.url.includes('login'));
  const modifiedRequest = req.clone({
    setHeaders: {
      "X-Client-Id": generateRandomID(),
      "Authorization": isAuth ? '' : "Bearer " + localStorage.getItem("token")
    }
  })
  return next(modifiedRequest);
};

function generateRandomID(): string {
  const MAX = 99999;
  const MIN = 10000;
  return (Math.floor(Math.random() * (MAX - MIN + 1)) + MIN).toString();
}

