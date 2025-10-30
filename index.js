const express = require("express");
const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

function resolveChromePath() {
  // 1) if user set it in env, prefer that
  if (process.env.CHROME_PATH) {
    return process.env.CHROME_PATH;
  }

  // 2) try to discover it in Render's cache
  const baseDir = "/opt/render/.cache/puppeteer";
  const chromeRoot = path.join(baseDir, "chrome");

  try {
    // e.g. /opt/render/.cache/puppeteer/chrome
    const versions = fs.readdirSync(chromeRoot, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => d.name);

    // pick the first version we find
    if (versions.length > 0) {
      const versionDir = versions[0]; // e.g. linux-142.0.7444.59
      const candidate = path.join(
        chromeRoot,
        versionDir,
        "chrome-linux64",
        "chrome"
      );
      return candidate;
    }
  } catch (err) {
    console.log("Could not scan Render puppeteer dir:", err.message);
  }

  // 3) fallback: let Puppeteer decide
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
    console.log("Using chrome path:", chromePath);

    const launchOpts = {
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--no-zygote",
      ],
    };

    // only set executablePath if we actually found one
    if (chromePath) {
      launchOpts.executablePath = chromePath;
    }

    browser = await puppeteer.launch(launchOpts);

    const page = await browser.newPage();

    await page.setDefaultNavigationTimeout(60000);
    await page.setDefaultTimeout(60000);

    await page.setUserAgent(
      "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)"
    );

    await page.goto(url, {
      waitUntil: "networkidle2",
      timeout: 60000,
    });

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
