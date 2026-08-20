const axios = require("axios");
const config = require("./config");

function getTodayString() {
  return new Date().toISOString().split("T")[0];
}

function isToday(dateStr) {
  if (!dateStr) return false;
  try {
    return new Date(dateStr).toISOString().split("T")[0] === getTodayString();
  } catch { return false; }
}

// Extract iframe/video from HTML content
function extractVideo(htmlContent) {
  if (!htmlContent) return "";

  // Blogger native video
  const bloggerMatch = htmlContent.match(/<iframe[^>]+src=['"]([^'"]*blogger\.com\/video\.g[^'"]*)['"]/i);
  if (bloggerMatch) {
    return `<iframe width="100%" height="400" src="${bloggerMatch[1]}" frameborder="0" allowfullscreen style="border-radius:8px;margin:12px 0;"></iframe>`;
  }

  // Rumble embed
  const rumbleMatch = htmlContent.match(/<iframe[^>]+src=['"]([^'"]*rumble\.com\/embed[^'"]*)['"]/i);
  if (rumbleMatch) {
    return `<iframe width="100%" height="400" src="${rumbleMatch[1]}" frameborder="0" allowfullscreen style="border-radius:8px;margin:12px 0;"></iframe>`;
  }

  // YouTube embed
  const ytMatch = htmlContent.match(/https?:\/\/(?:www\.)?youtube\.com\/embed\/([A-Za-z0-9_-]{11})/);
  if (ytMatch) {
    return `<iframe width="100%" height="400" src="https://www.youtube.com/embed/${ytMatch[1]}" frameborder="0" allowfullscreen style="border-radius:8px;margin:12px 0;"></iframe>`;
  }

  // Facebook video
  const fbMatch = htmlContent.match(/https?:\/\/(?:www\.)?facebook\.com\/[^\s"']+\/videos\/[^\s"']+/);
  if (fbMatch) {
    return `<iframe width="100%" height="400" src="https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(fbMatch[0])}&show_text=0" frameborder="0" allowfullscreen style="border-radius:8px;margin:12px 0;"></iframe>`;
  }

  // Any other iframe
  const anyIframe = htmlContent.match(/<iframe[^>]+src=['"]([^'"]+)['"]/i);
  if (anyIframe) {
    return `<iframe width="100%" height="400" src="${anyIframe[1]}" frameborder="0" allowfullscreen style="border-radius:8px;margin:12px 0;"></iframe>`;
  }

  return "";
}

// Get thumbnail URL at full size
function extractThumbnail(thumbnailUrl) {
  if (!thumbnailUrl) return "";
  // Replace s72-c (72px) with s1080 (full size)
  return thumbnailUrl.replace(/\/s\d+-c\//, "/s1080/").replace(/\/s\d+\//, "/s1080/");
}

// Strip HTML to plain text for Groq
function htmlToText(html) {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 2000);
}

async function fetchBloggerFeed(site, logs) {
  try {
    const feedUrl = `https://www.blogger.com/feeds/${site.blogId}/posts/default?alt=json&max-results=50&orderby=published`;
    logs.push(`[SCRAPER] Fetching Blogger feed: ${site.name}`);
    const res = await axios.get(feedUrl, { timeout: 15000 });
    const entries = res.data?.feed?.entry || [];
    logs.push(`[SCRAPER] ${site.name}: ${entries.length} total posts`);

    const todayPosts = [];
    for (const entry of entries) {
      const published = entry.published?.$t || "";
      if (!isToday(published)) continue;

      const title = entry.title?.$t || "";
      const htmlContent = entry.content?.$t || "";
      const url = entry.link?.find(l => l.rel === "alternate")?.href || "";
      const thumbnailUrl = entry["media$thumbnail"]?.url || "";

      const videoEmbed = extractVideo(htmlContent);
      const image = extractThumbnail(thumbnailUrl);
      const bodyText = htmlToText(htmlContent);

      todayPosts.push({
        url,
        title,
        source: site.name,
        videoEmbed,
        image,
        bodyText,
        published,
      });
    }

    logs.push(`[SCRAPER] ✅ ${site.name}: ${todayPosts.length} posts today`);
    return todayPosts;
  } catch (err) {
    logs.push(`[SCRAPER] ❌ ${site.name} feed error: ${err.message}`);
    return [];
  }
}

async function getTodayArticles(logs) {
  const allArticles = [];

  for (const site of config.SITES) {
    logs.push(`\n[SCRAPER] ── ${site.name} ──`);
    const posts = await fetchBloggerFeed(site, logs);
    allArticles.push(...posts);
  }

  logs.push(`\n[SCRAPER] Total today: ${allArticles.length} articles`);
  return allArticles;
}

module.exports = { getTodayArticles };
