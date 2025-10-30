const express = require("express");
const puppeteer = require("puppeteer");
const fs = require("fs"); // 👈 Added 'fs' module for file system operations
const path = require("path"); // 👈 Added 'path' module
const app = express();
const PORT = process.env.PORT || 3000;

function resolveChromePath() {
  // 1) if user set it in env, prefer that (CHROME_PATH)
  if (process.env.CHROME_PATH) {
    return process.env.CHROME_PATH;
  }

  // 2) try to discover it in Render's cache
  const baseDir = "/opt/render/.cache/puppeteer";
  const chromeRoot = path.join(baseDir, "chrome");

  try {
    // Read the version folders inside /opt/render/.cache/puppeteer/chrome
    const versionDirs = fs.readdirSync(chromeRoot, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => d.name); // e.g., ['linux-142.0.7444.59']

    // pick the first version we find
    if (versionDirs.length > 0) {
      const versionDirName = versionDirs[0]; // e.g. 'linux-142.0.7444.59'
      
      // The path to the executable is likely: 
      // /opt/render/.cache/puppeteer/chrome/linux-142.0.7444.59/chrome-linux64/chrome
      // (This is the most common correct path for Puppeteer on Linux containers)
      const candidate = path.join(
        chromeRoot,
        versionDirName,
        "chrome-linux64",
        "chrome"
      );
      
      // Check if the file actually exists before returning the path
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }
  } catch (err) {
    // This logs if the base directory doesn't exist, which is fine if Puppeteer
    // is configured to use a different cache, but helpful for debugging.
    console.log("Could not scan Render puppeteer dir:", err.message);
  }

  // 3) fallback: let Puppeteer decide (or fail cleanly)
  return null;
}

app.get("/", (req, res) => {
  res.send("Puppeteer render service is running.");
});

app.get("/render", async (req, res) => {
  const url = req.query.url;
  if (!url) {
    return res.status(400).json({ error: "Missing ?url=" });
  }

  let browser;
  try {
    const chromePath = resolveChromePath();
    console.log("Using chrome path:", chromePath); // 👈 Helpful logging!

    const launchOpts = {
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--no-zygote",
      ],
      // Add a higher timeout for Render's first-launch
      timeout: 120000, 
    };

    // only set executablePath if we actually found one
    if (chromePath) {
      launchOpts.executablePath = chromePath;
    }

    browser = await puppeteer.launch(launchOpts);

    const page = await browser.newPage();

    // Keep your existing timeouts and user agent settings...
    await page.setDefaultNavigationTimeout(60000);
    await page.setDefaultTimeout(60000);

    await page.setUserAgent(
      "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)"
    );

    await page.goto(url, {
      waitUntil: "networkidle2",
      timeout: 60000,
    });
    // ... (rest of the page content retrieval and response)

    const html = await page.content();
    const title = await page.title();
    const text = await page.evaluate(
      () => document.body.innerText.slice(0, 2000)
    );

    res.json({
      ok: true,
      url,
      title,
      text,
      html,
    });
  } catch (err) {
    console.error("RENDER PUPPETEER ERROR →", err);
    res.status(500).json({ ok: false, error: err.message });
  } finally {
    if (browser) {
      await browser.close();
    }
  }
});

app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});
