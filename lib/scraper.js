const axios = require("axios");
const xml2js = require("xml2js");
const config = require("./config");

function getTodayString() {
  return new Date().toISOString().split("T")[0];
}

function isToday(dateStr) {
  if (!dateStr) return false;
  try {
    const postDate = new Date(dateStr).toISOString().split("T")[0];
    return postDate === getTodayString();
  } catch {
    return false;
  }
}

async function fetchRSS(site, logs) {
  try {
    logs.push(`[SCRAPER] Fetching RSS: ${site.rss}`);
    const res = await axios.get(site.rss, {
      timeout: 15000,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; BanglaTollyBot/1.0)" },
    });
    const parsed = await xml2js.parseStringPromise(res.data, { explicitArray: false });
    const items = parsed?.rss?.channel?.item || [];
    const itemList = Array.isArray(items) ? items : [items];
    const todayItems = itemList.filter((item) => isToday(item.pubDate || item["dc:date"] || ""));
    logs.push(`[SCRAPER] RSS ${site.name}: ${itemList.length} total → ${todayItems.length} today`);
    return todayItems.map((item) => ({
      url: item.link || "",
      title: item.title || "",
      date: item.pubDate || "",
      source: site.name,
    }));
  } catch (err) {
    logs.push(`[SCRAPER] RSS failed for ${site.name}: ${err.message}`);
    return null;
  }
}

async function fetchSitemap(site, logs) {
  try {
    logs.push(`[SCRAPER] Fetching Sitemap: ${site.sitemap}`);
    const res = await axios.get(site.sitemap, {
      timeout: 15000,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; BanglaTollyBot/1.0)" },
    });
    const parsed = await xml2js.parseStringPromise(res.data, { explicitArray: false });
    const urls = parsed?.urlset?.url || [];
    const urlList = Array.isArray(urls) ? urls : [urls];
    const todayUrls = urlList.filter((u) => isToday(u.lastmod || ""));
    logs.push(`[SCRAPER] Sitemap ${site.name}: ${urlList.length} total → ${todayUrls.length} today`);
    return todayUrls.map((u) => ({
      url: u.loc || "",
      title: "",
      date: u.lastmod || "",
      source: site.name,
    }));
  } catch (err) {
    logs.push(`[SCRAPER] Sitemap failed for ${site.name}: ${err.message}`);
    return null;
  }
}

async function getTodayArticles(logs) {
  const allArticles = [];
  for (const site of config.SITES) {
    logs.push(`\n[SCRAPER] ── ${site.name} ──`);
    let articles = await fetchRSS(site, logs);
    if (!articles || articles.length === 0) {
      logs.push(`[SCRAPER] RSS empty, trying sitemap...`);
      articles = await fetchSitemap(site, logs);
    }
    if (articles && articles.length > 0) {
      allArticles.push(...articles);
      logs.push(`[SCRAPER] ✅ ${articles.length} articles from ${site.name}`);
    } else {
      logs.push(`[SCRAPER] ⚠️ No articles today from ${site.name}`);
    }
  }
  logs.push(`\n[SCRAPER] Total today: ${allArticles.length} articles`);
  return allArticles;
}

module.exports = { getTodayArticles };
