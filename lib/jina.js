const axios = require("axios");

async function scrapeArticle(url, logs) {
  logs.push(`[JINA] Scraping: ${url}`);
  try {
    const jinaUrl = `https://r.jina.ai/${url}`;
    const res = await axios.get(jinaUrl, {
      timeout: 25000,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; BanglaTollyBot/1.0)",
        "Accept": "text/markdown, text/plain, */*",
        "X-Return-Format": "markdown",
      },
    });

    const markdown = res.data || "";
    logs.push(`[JINA] Raw response: ${markdown.length} chars`);

    // ── Title ──────────────────────────────────────────────
    let title = "";
    const titleMetaMatch = markdown.match(/^Title:\s*(.+)/m);
    if (titleMetaMatch) title = titleMetaMatch[1].trim();
    if (!title) {
      const h1Match = markdown.match(/^#\s+(.+)/m);
      if (h1Match) title = h1Match[1].trim();
    }
    title = title.replace(/\*\*/g, "").replace(/\*/g, "").trim();
    logs.push(`[JINA] Title: ${title || "NONE"}`);

    // ── Thumbnail: OG image from meta or first real image ──
    // Jina exposes og:image in metadata as "Image: url"
    let image = "";
    const imgMeta = markdown.match(/^Image:\s*(https?:\/\/.+)/m);
    if (imgMeta) image = imgMeta[1].trim();

    // Fallback: first markdown image
    if (!image) {
      const imgMatches = [...markdown.matchAll(/!\[.*?\]\((https?:\/\/[^)]+)\)/g)];
      for (const m of imgMatches) {
        const src = m[1];
        if (!src.includes("logo") && !src.includes("icon") && !src.includes("avatar") && !src.includes("favicon")) {
          image = src;
          break;
        }
      }
    }
    logs.push(`[JINA] Image: ${image || "NONE"}`);

    // ── Video iframe ───────────────────────────────────────
    let videoEmbed = "";

    // Raw iframe tag in markdown
    const iframeMatch = markdown.match(/<iframe[^>]+src=["']([^"']+)["'][^>]*>/i);
    if (iframeMatch) {
      const src = iframeMatch[1];
      if (src.includes("youtube") || src.includes("youtu.be") || src.includes("facebook") || src.includes("dailymotion")) {
        videoEmbed = `<iframe width="100%" height="400" src="${src}" frameborder="0" allowfullscreen style="border-radius:8px;margin:12px 0;"></iframe>`;
      }
    }

    // YouTube embed or watch URL
    if (!videoEmbed) {
      const ytMatch = markdown.match(/https?:\/\/(?:www\.)?(?:youtube\.com\/embed\/|youtube\.com\/watch\?v=|youtu\.be\/)([A-Za-z0-9_-]{11})/);
      if (ytMatch) {
        videoEmbed = `<iframe width="100%" height="400" src="https://www.youtube.com/embed/${ytMatch[1]}" frameborder="0" allowfullscreen style="border-radius:8px;margin:12px 0;"></iframe>`;
      }
    }

    // Facebook video
    if (!videoEmbed) {
      const fbMatch = markdown.match(/https?:\/\/(?:www\.)?facebook\.com\/[^\s\)"']+\/videos\/[^\s\)"']+/);
      if (fbMatch) {
        const fbUrl = encodeURIComponent(fbMatch[0]);
        videoEmbed = `<iframe width="100%" height="400" src="https://www.facebook.com/plugins/video.php?href=${fbUrl}&show_text=0" frameborder="0" allowfullscreen style="border-radius:8px;margin:12px 0;"></iframe>`;
      }
    }

    logs.push(`[JINA] Video: ${videoEmbed ? "FOUND" : "NONE"}`);

    // ── Body text ──────────────────────────────────────────
    let bodyText = markdown
      .replace(/^(Title|URL|Published|Description|Author|Source|Image|Warning):.*$/gm, "")
      .replace(/!\[.*?\]\(.*?\)/g, "")
      .replace(/\[.*?\]\(.*?\)/g, "")
      .replace(/#{1,6}\s/g, "")
      .replace(/\*\*/g, "")
      .replace(/\*/g, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
      .slice(0, 3000);

    logs.push(`[JINA] Body: ${bodyText.length} chars`);

    // Debug: if no title, show first 300 chars
    if (!title) {
      logs.push(`[JINA] ⚠️ No title — raw preview: ${markdown.slice(0, 300)}`);
    }

    return { title, image, videoEmbed, bodyText, url };
  } catch (err) {
    logs.push(`[JINA] ❌ Error: ${err.message}`);
    return null;
  }
}

module.exports = { scrapeArticle };
