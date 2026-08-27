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
  xfwd: false,
});

const WS_OPCODE_NAMES = {
  0x0: "CONTINUATION",
  0x1: "TEXT",
  0x2: "BINARY",
  0x8: "CLOSE",
  0x9: "PING",
  0xa: "PONG",
};

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

const getWebSocketFrameInfo = (chunk) => {
  const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);

  if (buffer.length < 2) {
    return { opcode: "SHORT", length: buffer.length, payload: buffer.toString("hex") };
  }

  const firstByte = buffer[0];
  const secondByte = buffer[1];
  const fin = (firstByte & 0x80) !== 0;
  const opcode = firstByte & 0x0f;
  const masked = (secondByte & 0x80) !== 0;

  let offset = 2;
  let payloadLength = secondByte & 0x7f;

  if (payloadLength === 126) {
    if (buffer.length < 4) {
      return { opcode: "SHORT", length: buffer.length, payload: buffer.toString("hex") };
    }

    payloadLength = buffer.readUInt16BE(2);
    offset = 4;
  } else if (payloadLength === 127) {
    if (buffer.length < 10) {
      return { opcode: "SHORT", length: buffer.length, payload: buffer.toString("hex") };
    }

    payloadLength = Number(buffer.readBigUInt64BE(2));
    offset = 10;
  }

  const hasMask = masked ? 4 : 0;
  const payloadStart = offset + hasMask;
  const payloadEnd = payloadStart + payloadLength;

  if (payloadEnd > buffer.length) {
    return {
      fin,
      opcode: WS_OPCODE_NAMES[opcode] || `0x${opcode.toString(16)}`,
      masked,
      length: payloadLength,
      payload: buffer.subarray(payloadStart, buffer.length).toString("hex"),
    };
  }

  const rawPayload = buffer.subarray(payloadStart, payloadEnd);
  const payload = masked
    ? Buffer.from(rawPayload.map((byte, idx) => byte ^ buffer[offset + (idx % 4)]))
    : rawPayload;

  let decoded = "";
  if (opcode === 0x1) {
    decoded = payload.toString("utf8");
  } else if (opcode === 0x2) {
    decoded = payload.toString("hex");
  } else if (opcode === 0x8) {
    decoded = "close-frame";
  } else if (opcode === 0x9) {
    decoded = "ping-frame";
  } else if (opcode === 0xa) {
    decoded = "pong-frame";
  } else if (payload.length > 0) {
    decoded = payload.toString("utf8");
  }

  return {
    fin,
    opcode: WS_OPCODE_NAMES[opcode] || `0x${opcode.toString(16)}`,
    masked,
    length: payloadLength,
    payload: decoded || payload.toString("hex"),
  };
};

const logClientToServer = (chunk) => {
  const frame = getWebSocketFrameInfo(chunk);
  const summary = typeof frame.payload === "string" ? frame.payload : JSON.stringify(frame.payload);

  console.log(
    "[WS CLIENT -> SERVER]",
    `opcode=${frame.opcode}`,
    `len=${frame.length}`,
    `masked=${frame.masked}`,
    `fin=${frame.fin}`,
    summary.slice(0, 220),
  );
};

const logServerToClient = (chunk) => {
  const frame = getWebSocketFrameInfo(chunk);
  const summary = typeof frame.payload === "string" ? frame.payload : JSON.stringify(frame.payload);

  console.log(
    "[WS SERVER -> CLIENT]",
    `opcode=${frame.opcode}`,
    `len=${frame.length}`,
    `masked=${frame.masked}`,
    `fin=${frame.fin}`,
    summary.slice(0, 220),
  );
};

proxy.on("proxyReqWs", (proxyReq, req) => {
  console.log("→ UPSTREAM WS REQUEST");
  console.log("  client host:", req.headers.host);
  console.log("  path:", req.url);
  console.log("  host:", proxyReq.getHeader("host"));
});

proxy.on("open", (proxySocket) => {
  console.log("UPSTREAM WS OPEN");
  proxySocket.on("data", (chunk) => {
    logServerToClient(chunk);
  });
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

  socket.on("data", (chunk) => {
    const frame = getWebSocketFrameInfo(chunk);
    if (frame.masked) {
      logClientToServer(chunk);
    }
  });

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