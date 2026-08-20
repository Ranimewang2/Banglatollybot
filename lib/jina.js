const axios = require("axios");
const cheerio = require("cheerio");

async function scrapeArticle(url, logs) {
  logs.push(`[JINA] Scraping: ${url}`);
  try {
    const jinaUrl = `https://r.jina.ai/${url}`;
    const res = await axios.get(jinaUrl, {
      timeout: 25000,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; BanglaTollyBot/1.0)" },
    });

    const $ = cheerio.load(res.data);

    // Title
    let title = $("h1").first().text().trim() || $("title").text().trim() || "";
    logs.push(`[JINA] Title: ${title}`);

    // Image
    let image = "";
    $("img").each((i, el) => {
      if (!image) {
        const src = $(el).attr("src") || $(el).attr("data-src") || "";
        if (src && src.startsWith("http") && !src.includes("logo") && !src.includes("icon") && !src.includes("avatar")) {
          image = src;
        }
      }
    });
    logs.push(`[JINA] Image: ${image || "NONE"}`);

    // Video iframe
    let videoEmbed = "";
    $("iframe").each((i, el) => {
      if (!videoEmbed) {
        const src = $(el).attr("src") || "";
        if (src && (src.includes("youtube") || src.includes("youtu.be") || src.includes("facebook") || src.includes("dailymotion"))) {
          videoEmbed = `<iframe width="100%" height="400" src="${src}" frameborder="0" allowfullscreen style="border-radius:8px;margin:12px 0;"></iframe>`;
        }
      }
    });
    logs.push(`[JINA] Video: ${videoEmbed ? "FOUND" : "NONE"}`);

    // Body text
    $("script, style, nav, footer, header, .ads, #comments").remove();
    const bodyText = $("article, .post-content, .entry-content, .content, main, body")
      .first()
      .text()
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 3000);

    logs.push(`[JINA] Body text: ${bodyText.length} chars`);
    return { title, image, videoEmbed, bodyText, url };
  } catch (err) {
    logs.push(`[JINA] ❌ Error: ${err.message}`);
    return null;
  }
}

module.exports = { scrapeArticle };
