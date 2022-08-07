const { createServer } = require('http');
const { parse } = require('url');
const host = 'localhost', port = 8000;
const { readdirSync, writeFileSync, unlinkSync } = require('fs');
const { join } = require('path');

const user = {
  id: 123,
  username: 'testuser',
  password: 'qwerty'
};

const requestListener = ({ method, url, headers }, res) => {
  const sendRequest = (code, text) => {
    res.writeHead(code);
    res.end(text);
  };

  const dir = `${join(__dirname, 'files')}\\`;
  const { query, pathname } = parse(url, true);

  const setCookie = (cookies, clear) => {
    const maxAge = clear ? 0 : 2 * 24 * 60 * 60 * 1000;
    const expires = (new Date(Date.now() + maxAge)).toUTCString();

    let cookieArr = [];
    if (cookies) {
      for (let key in cookies) {
        cookieArr.push(`${key}=${cookies[key]}; expires=${expires}; max_age=${maxAge} domain=localhost; path=/;`);
      }

      res.setHeader('Set-Cookie', cookieArr);
    }
  };

  const findCookie = cookie => {
    const regex = new RegExp(`${cookie}=((.*);|(.*)$)`, 'mi');
    if (!headers.cookie || !regex.exec(headers.cookie)) {
      return false;
    }

    const [,,value] = regex.exec(headers.cookie).filter(Boolean);

    return value || false;
  }

  const userId = findCookie('userId');
  const authorized = findCookie('authorized');

  const checkCookie = () => {
    if (!userId || !authorized || authorized.toString() !== 'true') {
      return [401, 'Получение запрашиваемого ресурса доступно только авторизованным пользователям'];
    }

    if (+userId !== +user.id) {
      return [403, 'Не хватает прав для получения запрашиваемого ресурса'];
    }

    return false;
  }

  const cookieError = checkCookie();

  const checkParams = (...args) => {
    if (!query || !query.data) {
      return 'Не переданы параметры';
    }

    if (!args.every(arg => JSON.parse(query.data)[arg])) {
      return 'Не переданы необходимые параметры';
    }

    return false;
  }

  const methods = {
    GET: {
      get: {
        fn: () => {
          methods.GET.get.success[1] = readdirSync(dir).join(', ') || 'Файлы не найдены';
        },
        success: [200, ''],
        failure: e => `Ошибка получения списка файлов: ${e}`,
      },
      redirect: {
        fn: () => res.setHeader('Location', '/redirected'),
        success: [301, 'Ресурс теперь постоянно доступен по адресу /redirected'],
        failure: e => [500, `Ошибка получения ресурса: ${e}`],
      },
    },
    POST: {
      post: {
        fn: () => {
          if (cookieError) {
            return cookieError;
          }

          const paramsError = checkParams('filename', 'content');
          if (paramsError) {
            return paramsError;
          }

          const { filename, content } = JSON.parse(query.data);
          writeFileSync(dir + filename, content);
        },
        failure: e => [500, `Ошибка создания файла: ${e}`],
      },
      auth: {
        fn: () => {
          const paramsError = checkParams('username', 'password');
          if (paramsError) {
            return paramsError;
          }

          const { username, password } = JSON.parse(query.data);
          if (user.username !== username || user.password !== password) {
            return 'Неверный логин или пароль';
          }

          setCookie({ userId: user.id, authorized: true });
        },
        failure: e => [400, `Ошибка авторизации: ${e}`],
      },
      unauth: {
        fn: () => setCookie({ userId: user.id, authorized: true }, true),
      },
    },
    DELETE: {
      delete: {
        fn: () => {
          if (cookieError) {
            return cookieError;
          }

          const paramsError = checkParams('filename');
          if (paramsError) {
            return paramsError;
          }

          const { filename } = JSON.parse(query.data);
          unlinkSync(dir + filename);
        },
        failure: e => [500, `Ошибка удаления файла: ${e}`],
      },
    },
  };

  if (!methods[method]) {
    sendRequest(404, 'not found');
    return;
  }

  if (!methods[method][pathname.slice(1)]) {
    sendRequest(405, 'HTTP method not allowed');
    return;
  }

  const { fn, success, failure } = methods[method][pathname.slice(1)];

  try {
    readdirSync(dir);
    const error = fn();
    if (error) throw error;
    sendRequest(...(success || [200, 'success']));
  } catch (e) {
    sendRequest(...(Array.isArray(e) ? e : failure(e)));
  }
};

const server = createServer(requestListener);

server.listen(port, host, () => console.log(`Server is running on http://${host}:${port}`));
