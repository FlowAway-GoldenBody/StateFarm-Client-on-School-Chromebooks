import http from 'node:http';
import { startWsProxy } from './wsproxy.js';

const server = http.createServer((req, res) => {
  res.writeHead(404);
  res.end('WebSocket proxy only');
});

startWsProxy(server);

server.listen(6603, () => console.log('wsproxy -> http://localhost:6603'));
