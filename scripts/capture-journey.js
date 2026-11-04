const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

const edgePath = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";

async function run() {
  const profileDir = path.resolve(".edge-temp-profile");
  if (fs.existsSync(profileDir)) {
    try {
      fs.rmSync(profileDir, { recursive: true, force: true });
    } catch {}
  }

  const edge = spawn(edgePath, [
    "--headless=new",
    "--remote-debugging-port=9222",
    "--disable-gpu",
    "--user-data-dir=" + profileDir,
    "about:blank",
  ]);

  await new Promise((r) => setTimeout(r, 1200));

  try {
    const listRes = await fetch("http://127.0.0.1:9222/json/list");
    const targets = await listRes.json();
    const wsUrl = targets[0]?.webSocketDebuggerUrl;
    if (!wsUrl) throw new Error("No webSocketDebuggerUrl found");

    const ws = new WebSocket(wsUrl);
    await new Promise((resolve) => (ws.onopen = resolve));

    let msgId = 1;
    const send = (method, params = {}) =>
      new Promise((resolve, reject) => {
        const id = msgId++;
        const timeout = setTimeout(() => {
          ws.removeEventListener("message", handler);
          reject(new Error(`Timeout waiting for ${method}`));
        }, 8000);

        const handler = (evt) => {
          const data = JSON.parse(evt.data);
          if (data.id === id) {
            clearTimeout(timeout);
            ws.removeEventListener("message", handler);
            resolve(data.result);
          }
        };
        ws.addEventListener("message", handler);
        ws.send(JSON.stringify({ id, method, params }));
      });

    await send("Page.enable");
    await send("DOM.enable");

    // 1. Capture at 1440x900
    console.log("Setting device metrics 1440x900...");
    await send("Emulation.setDeviceMetricsOverride", {
      width: 1440,
      height: 900,
      deviceScaleFactor: 2,
      mobile: false,
    });

    await send("Page.navigate", { url: "http://localhost:3000/?nopreload=1" });
    await new Promise((r) => setTimeout(r, 1200));

    // Scroll directly to journey section
    await send("Runtime.evaluate", {
      expression: `
        const journey = document.getElementById('journey');
        if (journey) {
          journey.scrollIntoView({ behavior: 'instant', block: 'center' });
        }
      `,
    });

    await new Promise((r) => setTimeout(r, 1500));

    console.log("Capturing 1440x900 screenshot...");
    const snap1440 = await send("Page.captureScreenshot", { format: "png" });
    fs.writeFileSync(
      "screenshot-journey-1440.png",
      Buffer.from(snap1440.data, "base64")
    );
    console.log(
      "Saved screenshot-journey-1440.png, size:",
      fs.statSync("screenshot-journey-1440.png").size
    );

    // 2. Capture at 375x812 (Mobile)
    console.log("Setting device metrics 375x812...");
    await send("Emulation.setDeviceMetricsOverride", {
      width: 375,
      height: 812,
      deviceScaleFactor: 2,
      mobile: true,
      hasTouch: true,
    });

    await send("Runtime.evaluate", {
      expression: `
        const journey = document.getElementById('journey');
        if (journey) {
          journey.scrollIntoView({ behavior: 'instant', block: 'center' });
        }
      `,
    });

    await new Promise((r) => setTimeout(r, 1500));

    console.log("Capturing 375x812 screenshot...");
    const snap375 = await send("Page.captureScreenshot", { format: "png" });
    fs.writeFileSync(
      "screenshot-journey-375.png",
      Buffer.from(snap375.data, "base64")
    );
    console.log(
      "Saved screenshot-journey-375.png, size:",
      fs.statSync("screenshot-journey-375.png").size
    );

    ws.close();
  } finally {
    edge.kill();
  }
}

run()
  .then(() => console.log("Capture completed!"))
  .catch((e) => console.error(e));
