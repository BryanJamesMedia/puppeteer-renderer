// index.js
const express = require("express");
const puppeteer = require("puppeteer-core");
const chromium = require("@sparticuz/chromium");

const app = express();
const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.send("Puppeteer render service is running.");
});

app.get("/render", async (req, res) => {
  const url = req.query.url;
  if (!url) {
    return res.status(400).json({ ok: false, error: "Missing ?url=" });
  }

  let browser;
  try {
    // get path from sparticuz/chromium (this is the key difference)
    const executablePath = await chromium.executablePath();

    console.log("Using chromium path:", executablePath);

    browser = await puppeteer.launch({
      executablePath,
      headless: chromium.headless,
      args: chromium.args,
      // chromium gives us the right args for containers
      defaultViewport: chromium.defaultViewport,
      ignoreHTTPSErrors: true,
      timeout: 120000
    });

    const page = await browser.newPage();

    // nice-to-have timeouts
    await page.setDefaultNavigationTimeout(60000);
    await page.setDefaultTimeout(60000);

    // pretend to be Googlebot
    await page.setUserAgent(
      "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)"
    );

    await page.goto(url, {
      waitUntil: "networkidle2",
      timeout: 60000
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
      html
    });
  } catch (err) {
    console.error("RENDER PUPPETEER ERROR →", err);
    res
      .status(500)
      .json({ ok: false, error: err.message || "Unknown puppeteer error" });
  } finally {
    if (browser) {
      await browser.close();
    }
  }
});

app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});
