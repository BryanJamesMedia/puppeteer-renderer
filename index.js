const express = require("express");
const puppeteer = require("puppeteer");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// helper to guess chrome path on Render
function getChromePath() {
  // 1) env override (we can set this in Render later if we want)
  if (process.env.CHROME_PATH) {
    return process.env.CHROME_PATH;
  }

  // 2) common Render path for Puppeteer
  //   based on the error message you got
  const renderPath = "/opt/render/.cache/puppeteer/chrome/linux-142.0.7444.59/chrome-linux64/chrome";

  return renderPath;
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
    const executablePath = getChromePath();

    browser = await puppeteer.launch({
      headless: true,
      executablePath, // 👈 force puppeteer to use Render’s chrome
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--no-zygote",
      ],
    });

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
