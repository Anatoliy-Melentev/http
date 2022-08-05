const { createServer } = require('http');
const host = 'localhost';
const port = 8000;
const { readdirSync, writeFileSync, unlinkSync } = require('fs');
const { join } = require('path');

const requestListener = ({ method, url }, res) => {
  let code = 200, text = 'success';

  const methods = {
    GET: {
      get: () => {
        text = readdirSync(join(__dirname, 'files'))
      },
      redirect: () => {
        code = 301;
        text = 'ресурс теперь постоянно доступен по адресу /redirected';
      },
    },
    POST: {
      post: () => {
        writeFileSync(`${join(__dirname, 'files')}\\file${Date.now()}.txt`, 'Some content!', () => {
          if (err) throw err;
          console.log('File created!');
        });
      }
    },
    DELETE: {
      delete: () => {
        const files = readdirSync(join(__dirname, 'files'))

        unlinkSync(`${join(__dirname, 'files')}\\${files[0]}`, () => {
          if (err) throw err;
          console.log('File deleted!');
        });
      }
    },
  }

  if (methods[method]) {
    if (methods[method][url.slice(1)]) {
      methods[method][url.slice(1)]();
    } else {
      code = 404;
      text = 'not found';
    }
  } else {
    code = 405;
    text = 'HTTP method not allowed';
  }

  res.writeHead(code);
  res.end(text);
};

const server = createServer(requestListener);

server.listen(port, host, () => {
  console.log(`Server is running on http://${host}:${port}`);
});
