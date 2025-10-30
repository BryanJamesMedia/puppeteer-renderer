// index.js
const express = require("express");
const puppeteer = require("puppeteer");

const app = express();
const PORT = process.env.PORT || 3000;

// health check
app.get("/", (req, res) => {
  res.send("Puppeteer render service is running.");
});

// main endpoint: /render?url=https://example.com
app.get("/render", async (req, res) => {
  const url = req.query.url;
  if (!url) {
    return res.status(400).json({ error: "Missing ?url=" });
  }

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--no-zygote",
      ],
    });

    const page = await browser.newPage();

    // pretend to be Googlebot
    await page.setUserAgent(
      "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)"
    );

    await page.goto(url, {
    waitUntil: "networkidle2", // less strict
    timeout: 60000, // 60 seconds
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
    console.error(err);
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
