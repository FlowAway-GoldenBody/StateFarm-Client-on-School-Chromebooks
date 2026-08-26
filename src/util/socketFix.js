// config
let codespaceEdition = false;
let cftunnelEdition = true;
if (window.location.hostname === "sfc.mathvariables.xyz") cftunnelEdition = true;
const CODESPACE_WS_HOST = "curly-halibut-q7gpj56p99wq36j5-3000.app.github.dev";

// logic
if (cftunnelEdition) {
  console.log("%c[EggPatcher] %cWebSocket patcher initialized", "color: magenta; font-weight: bold", "color: white");

  (() => {
    const NativeWebSocket = window.WebSocket;

    class EggPatchedWebSocket extends NativeWebSocket {
      constructor(url, protocols) {
        let t = String(url);

        const c = window.top.origin.split("/")[2];

        // Original local-origin replacement
        if (t.includes(c)) {
          t = t.replace(c, window.location.host);
        }

        // region ws
        //
        // local:
        //   ws://egs-static-live-useast-1u265wed.localhost/game/
        //
        // JSON Kapalka (egg):
        //   wss://egs-static-live-useast-1u265wed.shellshock.io/game/

        const egsMatch = t.match(/^wss?:\/\/(?:(egs-static-live-[^.]+)|sfc)\.mathvariables\.xyz(\/.*)?$/i);

        if (egsMatch && t.includes("egs-static-live")) {
          const urlObj = new URL(t);
          const regionHost = urlObj.searchParams.get("server") ||
            (egsMatch[1] && egsMatch[1] !== "sfc" ? egsMatch[1] : "egs-static-live-useast");
          const path = urlObj.pathname || "/";
          const query = new URLSearchParams(urlObj.search);
          query.delete("server");
          const pathWithQuery = `${path}${query.toString() ? `?${query.toString()}` : ""}`;
          const separator = pathWithQuery.includes("?") ? "&" : "?";

          t = `wss://sfcws.mathvariables.xyz${pathWithQuery}${separator}server=${encodeURIComponent(regionHost)}`;

          console.log(`%c[EggPatcher] %cEGS region:`, "color: magenta; font-weight: bold", "color: white", regionHost);

          console.log(`%c[EggPatcher] %cConnecting through:`, "color: magenta; font-weight: bold", "color: white", t);
        }

        // services
        if (t.includes("ser")) {
          t = "wss://sfcws.mathvariables.xyz/services/";
        }

        // matchmaker
        if (t.includes("matchmaker")) {
          t = "wss://sfcws.mathvariables.xyz/matchmaker/";
        }

        console.log(`%c[WS Connect] %cConnecting to: ${t}`, "color: cyan; font-weight: bold", "color: white");

        if (protocols !== undefined) {
          super(t, protocols);
        } else {
          super(t);
        }

        this.addEventListener("open", () => {
          console.log(`%c[WS Open] %cSuccessfully connected to ${this.url}`, "color: green; font-weight: bold", "color: white");
        });

        this.addEventListener("error", (err) => {
          console.error(`[WS Error] Connection failed to ${this.url}`, err);
        });
      }
    }

    // Preserve WebSocket constants, useless tho
    EggPatchedWebSocket.CONNECTING = NativeWebSocket.CONNECTING;
    EggPatchedWebSocket.OPEN = NativeWebSocket.OPEN;
    EggPatchedWebSocket.CLOSING = NativeWebSocket.CLOSING;
    EggPatchedWebSocket.CLOSED = NativeWebSocket.CLOSED;

    window.WebSocket = EggPatchedWebSocket;

    Object.defineProperty(window, "WebSocket", {
      configurable: true,
      enumerable: true,
      writable: true,
      value: EggPatchedWebSocket,
    });
  })();
}
else if (codespaceEdition) {
  (() => {
    const NativeWebSocket = window.WebSocket;

    class EggPatchedWebSocket extends NativeWebSocket {
      constructor(url, protocols) {
        let t = String(url);

        const c = window.top.origin.split("/")[2];

        if (t.includes(c)) {
          t = t.replace(c, window.location.host);
        }

        // region ws
        // local:
        //   ws://egs-static-live-useast-1u265wed.localhost/game/
        // JSON Kapalka (egg):
        //   wss://egs-static-live-useast-1u265wed.shellshock.io/game/

        const egsMatch = t.match(/^wss?:\/\/(egs-static-live-[^.]+)\.github\.dev(\/.*)?$/i);

        if (egsMatch) {
          const regionHost = egsMatch[1];
          const path = egsMatch[2] || "/";

          const separator = path.includes("?") ? "&" : "?";

          t = `wss://${CODESPACE_WS_HOST}${path}` + `${separator}egs_region=${encodeURIComponent(regionHost)}`;

          console.log("[EggPatcher] EGS region:", regionHost);
          console.log("[EggPatcher] Connecting through:", t);
        }

        // services
        if (t.includes("ser")) {
          t = `wss://${CODESPACE_WS_HOST}/services/`;
        }

        // matchmaker
        if (t.includes("matchmaker")) {
          t = `wss://${CODESPACE_WS_HOST}/matchmaker/`;
        }

        console.log(`%c[WS Connect] %cConnecting to: ${t}`, "color: cyan; font-weight: bold", "color: white");

        if (protocols !== undefined) {
          super(t, protocols);
        } else {
          super(t);
        }

        this.addEventListener("open", () => {
          console.log(`%c[WS Open] %cSuccessfully connected to ${this.url}`, "color: green; font-weight: bold", "color: white");
        });

        this.addEventListener("error", (err) => {
          console.error(`[WS Error] Connection failed to ${this.url}`, err);
        });
      }
    }

    // Preserve WebSocket constants, useless tho
    EggPatchedWebSocket.CONNECTING = NativeWebSocket.CONNECTING;
    EggPatchedWebSocket.OPEN = NativeWebSocket.OPEN;
    EggPatchedWebSocket.CLOSING = NativeWebSocket.CLOSING;
    EggPatchedWebSocket.CLOSED = NativeWebSocket.CLOSED;

    window.WebSocket = EggPatchedWebSocket;

    Object.defineProperty(window, "WebSocket", {
      configurable: true,
      enumerable: true,
      writable: true,
      value: EggPatchedWebSocket,
    });
  })();
} else {
  console.log("%c[EggPatcher] %cWebSocket patcher initialized", "color: magenta; font-weight: bold", "color: white");

  (() => {
    const NativeWebSocket = window.WebSocket;

    class EggPatchedWebSocket extends NativeWebSocket {
      constructor(url, protocols) {
        let t = String(url);

        const c = window.top.origin.split("/")[2];

        // Original local-origin replacement
        if (t.includes(c)) {
          t = t.replace(c, window.location.host);
        }

        // region ws
        //
        // local:
        //   ws://egs-static-live-useast-1u265wed.localhost/game/
        //
        // JSON Kapalka (egg):
        //   wss://egs-static-live-useast-1u265wed.shellshock.io/game/

        const egsMatch = t.match(/^ws:\/\/(egs-static-live-[^.]+)\.localhost(\/.*)?$/i);

        if (egsMatch) {
          const regionHost = egsMatch[1];
          const path = egsMatch[2] || "/";

          const separator = path.includes("?") ? "&" : "?";

          t = `ws://localhost:3000${path}${separator}server=${encodeURIComponent(regionHost)}`;

          console.log(`%c[EggPatcher] %cEGS region:`, "color: magenta; font-weight: bold", "color: white", regionHost);

          console.log(`%c[EggPatcher] %cConnecting through:`, "color: magenta; font-weight: bold", "color: white", t);
        }

        // services
        if (t.includes("ser")) {
          t = "ws://localhost:3000/services/";
        }

        // matchmaker
        if (t.includes("matchmaker")) {
          t = "ws://localhost:3000/matchmaker/";
        }

        console.log(`%c[WS Connect] %cConnecting to: ${t}`, "color: cyan; font-weight: bold", "color: white");

        if (protocols !== undefined) {
          super(t, protocols);
        } else {
          super(t);
        }

        this.addEventListener("open", () => {
          console.log(`%c[WS Open] %cSuccessfully connected to ${this.url}`, "color: green; font-weight: bold", "color: white");
        });

        this.addEventListener("error", (err) => {
          console.error(`[WS Error] Connection failed to ${this.url}`, err);
        });
      }
    }

    // Preserve WebSocket constants, useless tho
    EggPatchedWebSocket.CONNECTING = NativeWebSocket.CONNECTING;
    EggPatchedWebSocket.OPEN = NativeWebSocket.OPEN;
    EggPatchedWebSocket.CLOSING = NativeWebSocket.CLOSING;
    EggPatchedWebSocket.CLOSED = NativeWebSocket.CLOSED;

    window.WebSocket = EggPatchedWebSocket;

    Object.defineProperty(window, "WebSocket", {
      configurable: true,
      enumerable: true,
      writable: true,
      value: EggPatchedWebSocket,
    });
  })();
}