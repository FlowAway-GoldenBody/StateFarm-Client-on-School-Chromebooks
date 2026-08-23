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

  if (!cleanedHost || cleanedHost === "localhost") {
    return TARGET;
  }

  if (cleanedHost.endsWith(".localhost")) {
    const subdomain = cleanedHost.replace(/\.localhost$/, "");
    if (subdomain && subdomain !== "localhost") {
      return `wss://${subdomain}.shellshock.io`;
    }
  }

  return TARGET;
};

const isAllowedRoute = (url, host) => {
  const pathname = url.pathname || "/";
  const cleanedHost = normalizeHost(host);
  const isLocalhostHost =
    cleanedHost === "localhost" ||
    cleanedHost.endsWith(".localhost");

  return (
    ALLOWED_PREFIXES.some((prefix) => pathname.startsWith(prefix)) ||
    (isLocalhostHost && (pathname === "/game" || pathname.startsWith("/game/")))
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
  const target = new URL(getUpstreamTarget(req.headers.host || ""));
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
  const url = new URL(req.url || "/", "http://localhost");
  const upstreamTarget = getUpstreamTarget(req.headers.host || "");
  ensureSocketCompatibility(socket);

  console.log("\n========== WS UPGRADE ==========");
  console.log("URL:", req.url);
  console.log("Host:", req.headers.host);
  console.log("Origin:", req.headers.origin);
  console.log("Connection:", req.headers.connection);
  console.log("Upgrade:", req.headers.upgrade);

  if (!isAllowedRoute(url, req.headers.host || "")) {
    console.log("❌ Rejecting:", url.pathname, "host:", req.headers.host);
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

server.listen(PORT, () => {
  console.log(`WS proxy listening on ws://localhost:${PORT}`);
});