const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const edgePath = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";

function capture(url, outputFile, width, height) {
  const fullOut = path.resolve(outputFile);
  console.log(`Capturing ${url} at ${width}x${height} to ${fullOut}...`);
  
  const args = [
    "--headless",
    `--screenshot=${fullOut}`,
    `--window-size=${width},${height}`,
    "--hide-scrollbars",
    "--disable-gpu",
    url,
  ];

  const res = spawnSync(edgePath, args, { stdio: "inherit" });
  if (fs.existsSync(fullOut)) {
    console.log(`Success! File size: ${fs.statSync(fullOut).size} bytes`);
  } else {
    console.error(`Failed to create ${fullOut}. Status: ${res.status}`);
  }
}

capture("http://localhost:3000/#journey", "screenshot-journey-1440.png", 1440, 900);
capture("http://localhost:3000/#journey", "screenshot-journey-375.png", 375, 812);
