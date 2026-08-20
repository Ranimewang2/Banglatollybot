const { getTodayArticles } = require("../lib/scraper");
const { rewriteArticle } = require("../lib/gemini");
const { publishPost } = require("../lib/blogger");
const { getProcessedUrls, saveProcessedUrls, saveRun } = require("../lib/db");
const config = require("../lib/config");

async function runBot() {
  const startTime = Date.now();
  const logs = [];
  const publishedPosts = [];
  const stats = { found: 0, skipped: 0, published: 0, failed: 0, noVideo: 0 };

  logs.push(`[BOT] 🚀 BanglaTolly Bot Started`);
  logs.push(`[BOT] Time: ${new Date().toISOString()}`);
  logs.push(`[BOT] Articles per run: ${config.ARTICLES_PER_RUN}`);

  try {
    // Step 1: Get processed URLs
    const processedUrls = await getProcessedUrls();
    logs.push(`[DB] Already processed: ${processedUrls.length} URLs`);

    // Step 2: Get today's articles from Blogger feeds
    const todayArticles = await getTodayArticles(logs);
    stats.found = todayArticles.length;

    if (todayArticles.length === 0) {
      logs.push(`[BOT] ⚠️ No articles found today from either site`);
    } else {
      // Step 3: Filter duplicates
      const newArticles = todayArticles.filter((a) => {
        if (!a.url || processedUrls.includes(a.url)) {
          logs.push(`[BOT] ⏭️ SKIP (duplicate): ${a.url}`);
          stats.skipped++;
          return false;
        }
        return true;
      });

      logs.push(`[BOT] New articles available: ${newArticles.length}`);

      const newlyProcessed = [];
      let successCount = 0;

      for (const article of newArticles) {
        if (successCount >= config.ARTICLES_PER_RUN) {
          logs.push(`[BOT] ✅ Reached limit of ${config.ARTICLES_PER_RUN} per run`);
          break;
        }

        logs.push(`\n[BOT] ── Processing: ${article.title}`);
        logs.push(`[BOT] URL: ${article.url}`);

        // Mark as processed immediately to avoid reprocessing
        newlyProcessed.push(article.url);

        // Skip if no video
        if (!article.videoEmbed) {
          logs.push(`[BOT] ⏭️ SKIP — no video found`);
          stats.noVideo++;
          continue;
        }

        // Skip if no thumbnail
        if (!article.image) {
          logs.push(`[BOT] ⏭️ SKIP — no thumbnail found`);
          stats.failed++;
          continue;
        }

        logs.push(`[BOT] ✅ Video: FOUND`);
        logs.push(`[BOT] ✅ Image: ${article.image.slice(0, 80)}...`);

        // Groq rewrite
        const articleHtml = await rewriteArticle(
          { title: article.title, bodyText: article.bodyText, source: article.source },
          logs
        );

        if (!articleHtml) {
          stats.failed++;
          continue;
        }

        // Insert video embed into placeholder
        const finalContent = articleHtml.replace("[VIDEOPLACEHOLDER]", article.videoEmbed);

        // Publish to Blogger
        const result = await publishPost(
          { title: article.title, content: finalContent, imageUrl: article.image },
          logs
        );

        if (result) {
          publishedPosts.push({ title: article.title, url: result.url });
          stats.published++;
          successCount++;
          logs.push(`[BOT] ✅ Published! ${successCount}/${config.ARTICLES_PER_RUN}`);
        } else {
          stats.failed++;
        }

        await new Promise((r) => setTimeout(r, 2000));
      }

      // Save processed URLs
      if (newlyProcessed.length > 0) {
        await saveProcessedUrls([...processedUrls, ...newlyProcessed]);
        logs.push(`[DB] ✅ Saved ${newlyProcessed.length} URLs`);
      }
    }

  } catch (err) {
    logs.push(`[BOT] ❌ Fatal error: ${err.message}`);
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  logs.push(`\n[BOT] ✅ Done in ${duration}s`);
  logs.push(`[BOT] Found:${stats.found} | Skipped:${stats.skipped} | NoVideo:${stats.noVideo} | Published:${stats.published} | Failed:${stats.failed}`);

  const runData = {
    timestamp: new Date().toISOString(),
    duration: `${duration}s`,
    stats,
    publishedPosts,
    logs,
  };
  await saveRun(runData);
  return runData;
}

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  try {
    const result = await runBot();
    return res.status(200).json({ success: true, ...result });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};
