import http from "node:http";
import { createProxyServer } from "http-proxy-3";

const PORT = 3000;
const TARGET = "wss://shellshock.io";

const ALLOWED_PREFIXES = ["/services/", "/matchmaker/", "/game/"];

const normalizeHost = (host = "") => {
  if (!host) return "";
  return host.split(":")[0];
};

const getUpstreamTarget = (host = "") => {
  const cleanedHost = normalizeHost(host);

  if (!cleanedHost) {
    return TARGET;
  }

  return TARGET;
};

const isAllowedRoute = (url) => {
  const pathname = url.pathname || "/";

  return ALLOWED_PREFIXES.some((prefix) =>
    pathname.startsWith(prefix)
  );
};

const ensureSocketCompatibility = (socket) => {
  if (socket && typeof socket.destroySoon !== "function") {
    socket.destroySoon = () => socket.destroy();
  }

  return socket;
};

const proxy = createProxyServer({
  ws: true,
  changeOrigin: true,
  secure: true,
  xfwd: true,
});

proxy.on("proxyReqWs", (proxyReq, req) => {
  const target = new URL(TARGET);
  const origin = req.headers.origin || `https://${target.host}`;

  proxyReq.setHeader("Origin", origin);
  proxyReq.setHeader("Host", target.host);

  console.log("→ UPSTREAM WS REQUEST");
  console.log("  path:", req.url);
  console.log("  origin:", origin);
  console.log("  host:", proxyReq.getHeader("host"));
});

proxy.on("open", () => {
  console.log("← UPSTREAM WS OPEN");
});

proxy.on("close", () => {
  console.log("← UPSTREAM WS CLOSE");
});

proxy.on("error", (err, req, socket) => {
  console.error("❌ PROXY ERROR:", err.message);

  if (socket && !socket.destroyed) {
    socket.write("HTTP/1.1 502 Bad Gateway\r\n\r\n");
    socket.destroy();
  }
});

const server = http.createServer((req, res) => {
  res.writeHead(404);
  res.end("WebSocket proxy only");
});

server.on("upgrade", (req, socket, head) => {
  ensureSocketCompatibility(socket);

  // Change 6602 to 3000 anywhere it appears in the incoming URL.
  if (req.url) {
    req.url = req.url.replace(/6602/g, "3000");
  }

  const url = new URL(req.url || "/", "http://proxy");

  const upstreamTarget = getUpstreamTarget(
    req.headers.host || ""
  );

  console.log("\n========== WS UPGRADE ==========");
  console.log("URL:", req.url);
  console.log("Host:", req.headers.host);
  console.log("Origin:", req.headers.origin);
  console.log("Connection:", req.headers.connection);
  console.log("Upgrade:", req.headers.upgrade);

  if (!isAllowedRoute(url)) {
    console.log("❌ Rejecting:", url.pathname);

    socket.write("HTTP/1.1 403 Forbidden\r\n\r\n");
    socket.destroy();

    return;
  }

  console.log("→ Proxying to:", upstreamTarget);
  console.log("→ Path:", req.url);

  proxy.ws(req, socket, head, {
    target: upstreamTarget,
    changeOrigin: true,
    secure: true,
    xfwd: true,
    ws: true,
  });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`WS proxy listening on port ${PORT}`);
});