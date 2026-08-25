import http from "node:http";
import { createProxyServer } from "http-proxy-3";

const PORT = 3000;
const DEFAULT_TARGET = "wss://shellshock.io";

const ALLOWED_PREFIXES = [
  "/services/",
  "/matchmaker/",
  "/game/",
];

const proxy = createProxyServer({
  ws: true,
  changeOrigin: true,
  secure: true,
  xfwd: true,
});
const getUpstreamTarget = (region) => {
  if (!region) {
    return DEFAULT_TARGET;
  }

  if (!/^egs-static-live-[a-z0-9-]+$/i.test(region)) {
    console.log("Invalid EGS region:", region);
    return DEFAULT_TARGET;
  }

  return `wss://${region}.shellshock.io`;
};

proxy.on("proxyReqWs", (proxyReq, req) => {
  console.log("→ UPSTREAM WS REQUEST");
  console.log("  client host:", req.headers.host);
  console.log("  path:", req.url);
  console.log("  host:", proxyReq.getHeader("host"));
});

proxy.on("open", () => {
  console.log("UPSTREAM WS OPEN");
});

proxy.on("close", () => {
  console.log("UPSTREAM WS CLOSE");
});

proxy.on("error", (err, req, socket) => {
  console.error("PROXY ERROR:", err.message);

  if (socket && !socket.destroyed) {
    socket.destroy();
  }
});

const server = http.createServer((req, res) => {
  res.writeHead(404);
  res.end("WebSocket proxy only");
});

server.on("upgrade", (req, socket, head) => {
  const url = new URL(
    req.url || "/",
    "http://localhost"
  );

  console.log("WS UPGRADE");
  console.log("Host:", req.headers.host);
  console.log("URL:", req.url);
  console.log("Origin:", req.headers.origin);

  const allowed = ALLOWED_PREFIXES.some((prefix) =>
    url.pathname.startsWith(prefix)
  );

  if (!allowed) {
    console.log("Rejecting:", url.pathname);

    socket.write(
      "HTTP/1.1 403 Forbidden\r\n" +
      "Connection: close\r\n" +
      "\r\n"
    );

    socket.destroy();
    return;
  }

  // extract the region added by eggpatcher.
  const region = url.searchParams.get("egs_region");

  console.log(
    "EGS region:",
    region || "(none)"
  );

  // pick the actual upstream based on the region.
  const upstreamTarget = getUpstreamTarget(region);

  // remove our internal parameter before forwarding.
  url.searchParams.delete("egs_region");

  // rebuild the original ws path.
  req.url =
    url.pathname +
    (url.searchParams.toString()
      ? `?${url.searchParams.toString()}`
      : "");

  console.log(
    "Upstream target:",
    upstreamTarget
  );

  console.log(
    "Upstream path:",
    req.url
  );

  proxy.ws(req, socket, head, {
    target: upstreamTarget,
    changeOrigin: true,
    secure: true,
    ws: true,
  });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(
    `ws proxy on ws://0.0.0.0:${PORT}`
  );
});