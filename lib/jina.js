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
    logs.push(`[JINA] Raw response length: ${markdown.length} chars`);

    // ── Title ──────────────────────────────────────────────
    // Jina markdown starts with: Title: Some Title\n or # Some Title
    let title = "";

    const titleMetaMatch = markdown.match(/^Title:\s*(.+)/m);
    if (titleMetaMatch) title = titleMetaMatch[1].trim();

    if (!title) {
      const h1Match = markdown.match(/^#\s+(.+)/m);
      if (h1Match) title = h1Match[1].trim();
    }

    // Clean markdown bold/italic from title
    title = title.replace(/\*\*/g, "").replace(/\*/g, "").trim();
    logs.push(`[JINA] Title: ${title || "NONE"}`);

    // ── Image ──────────────────────────────────────────────
    // Jina markdown images: ![alt](url)
    let image = "";
    const imgMatches = [...markdown.matchAll(/!\[.*?\]\((https?:\/\/[^)]+)\)/g)];
    for (const m of imgMatches) {
      const src = m[1];
      if (!src.includes("logo") && !src.includes("icon") && !src.includes("avatar") && !src.includes("favicon")) {
        image = src;
        break;
      }
    }

    // Also try Jina metadata: Image: url
    if (!image) {
      const imgMeta = markdown.match(/^Image:\s*(https?:\/\/.+)/m);
      if (imgMeta) image = imgMeta[1].trim();
    }

    logs.push(`[JINA] Image: ${image || "NONE"}`);

    // ── Video iframe ───────────────────────────────────────
    // Jina renders iframes as markdown or keeps raw iframe tags
    let videoEmbed = "";

    // Check for raw iframe in markdown output
    const iframeMatch = markdown.match(/<iframe[^>]+src=["']([^"']+)["'][^>]*>/i);
    if (iframeMatch) {
      const src = iframeMatch[1];
      if (src.includes("youtube") || src.includes("youtu.be") || src.includes("facebook") || src.includes("dailymotion")) {
        videoEmbed = `<iframe width="100%" height="400" src="${src}" frameborder="0" allowfullscreen style="border-radius:8px;margin:12px 0;"></iframe>`;
      }
    }

    // Check for YouTube links in markdown [text](url) or bare URLs
    if (!videoEmbed) {
      const ytMatch = markdown.match(/https?:\/\/(?:www\.)?(?:youtube\.com\/embed\/|youtube\.com\/watch\?v=|youtu\.be\/)([A-Za-z0-9_-]{11})/);
      if (ytMatch) {
        const videoId = ytMatch[1];
        videoEmbed = `<iframe width="100%" height="400" src="https://www.youtube.com/embed/${videoId}" frameborder="0" allowfullscreen style="border-radius:8px;margin:12px 0;"></iframe>`;
      }
    }

    // Check for Facebook video
    if (!videoEmbed) {
      const fbMatch = markdown.match(/https?:\/\/(?:www\.)?facebook\.com\/[^\s\)\"\']+\/videos\/[^\s\)\"\']+/);
      if (fbMatch) {
        const fbUrl = encodeURIComponent(fbMatch[0]);
        videoEmbed = `<iframe width="100%" height="400" src="https://www.facebook.com/plugins/video.php?href=${fbUrl}&show_text=0" frameborder="0" allowfullscreen style="border-radius:8px;margin:12px 0;"></iframe>`;
      }
    }

    logs.push(`[JINA] Video: ${videoEmbed ? "FOUND" : "NONE"}`);

    // ── Body text ──────────────────────────────────────────
    // Remove metadata lines at top (Title:, URL:, Published:, etc.)
    let bodyText = markdown
      .replace(/^(Title|URL|Published|Description|Author|Source|Image):.*$/gm, "")
      .replace(/!\[.*?\]\(.*?\)/g, "") // remove image markdown
      .replace(/\[.*?\]\(.*?\)/g, "")  // remove links
      .replace(/#{1,6}\s/g, "")        // remove heading markers
      .replace(/\*\*/g, "")            // remove bold
      .replace(/\*/g, "")              // remove italic
      .replace(/\n{3,}/g, "\n\n")      // collapse blank lines
      .trim()
      .slice(0, 3000);

    logs.push(`[JINA] Body text: ${bodyText.length} chars`);

    if (!title) {
      logs.push(`[JINA] ⚠️ No title found in markdown — dumping first 300 chars for debug:`);
      logs.push(markdown.slice(0, 300));
    }

    return { title, image, videoEmbed, bodyText, url };
  } catch (err) {
    logs.push(`[JINA] ❌ Error: ${err.message}`);
    return null;
  }
}

module.exports = { scrapeArticle };
