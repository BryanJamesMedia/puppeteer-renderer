const express = require("express");
const puppeteer = require("puppeteer");
const fs = require("fs"); // Make sure fs is required
const path = require("path"); // Make sure path is required
const app = express();
const PORT = process.env.PORT || 3000;

function resolveChromePath() {
  // 1) if user set it in env, prefer that (CHROME_PATH)
  if (process.env.CHROME_PATH) {
    return process.env.CHROME_PATH;
  }

  // Define the base cache directory
  const baseDir = "/opt/render/.cache/puppeteer";
  const chromeRoot = path.join(baseDir, "chrome");

  console.log("--- START RENDER CACHE LOG ---");
  try {
    // TEMPORARY LOGGING: List the contents of the chrome cache directory
    console.log("Scanning directory:", chromeRoot);

    // List contents of /opt/render/.cache/puppeteer/chrome
    const versionDirs = fs.readdirSync(chromeRoot, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => d.name); 

    console.log("Found version folders:", versionDirs);

    if (versionDirs.length > 0) {
      const versionDirName = versionDirs[0]; // e.g. 'linux-142.0.7444.59'
      const installDir = path.join(chromeRoot, versionDirName);

      // TEMPORARY LOGGING: List the contents of the *version* directory
      console.log("Scanning version directory:", installDir);
      const installContents = fs.readdirSync(installDir);
      console.log("Contents of version folder:", installContents);
      
      // Based on the previous errors, the correct path is likely:
      // /opt/render/.cache/puppeteer/chrome/<VERSION_DIR>/chrome-linux64/chrome
      const candidate = path.join(
        installDir,
        "chrome-linux64",
        "chrome"
      );
      
      if (fs.existsSync(candidate)) {
        console.log("SUCCESS: Found Chrome at:", candidate);
        console.log("--- END RENDER CACHE LOG ---");
        return candidate;
      } else {
         console.log("FAILED: Candidate path did not exist:", candidate);
      }
    }
  } catch (err) {
    console.error("ERROR: Could not scan Render puppeteer dir:", err.message);
  }

  console.log("FALLBACK: No valid Chrome path found in cache.");
  console.log("--- END RENDER CACHE LOG ---");
  
  // 3) fallback: let Puppeteer decide (which will fail with your current error)
  return null;
}

// ... (rest of your express logic remains the same)
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
    console.log("Attempting to launch with path:", chromePath); // Log the final path

    const launchOpts = {
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--no-zygote",
      ],
      timeout: 120000, 
    };

    if (chromePath) {
      launchOpts.executablePath = chromePath;
    }

    browser = await puppeteer.launch(launchOpts);
    // ... (rest of the page logic: newPage, goto, content, res.json)
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
