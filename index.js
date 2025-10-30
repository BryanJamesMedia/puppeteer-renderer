const express = require("express");
const puppeteer = require("puppeteer-core"); // Ensure this is puppeteer-core
const app = express();
const PORT = process.env.PORT || 3000;

// The standard path to the Chromium executable on Render's general Node image
const RENDER_CHROME_PATH = "/usr/bin/chromium-browser"; 

// Use the environment variable set on Render, or fall back to the standard path
const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH || RENDER_CHROME_PATH;

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
    console.log("Attempting to launch with path:", executablePath);

    browser = await puppeteer.launch({
      executablePath: executablePath, // Explicitly set the path
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--no-zygote",
        "--single-process", 
      ],
      timeout: 120000, // Long timeout for first launch
    });

    const page = await browser.newPage();
    
    // Set timeouts and user agent
    await page.setDefaultNavigationTimeout(60000);
    await page.setDefaultTimeout(60000);
    await page.setUserAgent(
      "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)"
    );

    // Navigate and wait for network to be idle
    await page.goto(url, {
      waitUntil: "networkidle2",
      timeout: 60000,
    });
    
    // Extract content
    const html = await page.content();
    const title = await page.title();
    const text = await page.evaluate(
      () => document.body.innerText.slice(0, 2000)
    );

    // Respond with JSON
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
