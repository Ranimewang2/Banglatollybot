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
  logs.push(`[BOT] Target: ${config.ARTICLES_PER_RUN} posts per trigger`);

  try {
    // Step 1: Get processed URLs
    const processedUrls = await getProcessedUrls();
    logs.push(`[DB] Already processed: ${processedUrls.length} URLs`);

    // Step 2: Get today's articles
    const todayArticles = await getTodayArticles(logs);
    stats.found = todayArticles.length;

    if (todayArticles.length === 0) {
      logs.push(`[BOT] ⚠️ No articles found today`);
    } else {

      // Step 3: Filter duplicates first
      const newArticles = todayArticles.filter((a) => {
        if (!a.url || processedUrls.includes(a.url)) {
          stats.skipped++;
          return false;
        }
        return true;
      });
      logs.push(`[BOT] After duplicate filter: ${newArticles.length} new articles`);

      // Step 4: Filter only publishable articles (must have video AND image)
      const publishable = newArticles.filter((a) => {
        if (!a.videoEmbed) {
          logs.push(`[BOT] ⏭️ NO VIDEO — ignored: ${a.title}`);
          stats.noVideo++;
          return false;
        }
        if (!a.image) {
          logs.push(`[BOT] ⏭️ NO IMAGE — ignored: ${a.title}`);
          stats.failed++;
          return false;
        }
        return true;
      });

      logs.push(`[BOT] Publishable (have video+image): ${publishable.length}`);

      // Step 5: Pick exactly ARTICLES_PER_RUN from publishable only
      const toProcess = publishable.slice(0, config.ARTICLES_PER_RUN);
      logs.push(`[BOT] Will publish: ${toProcess.length}`);

      const newlyProcessed = [];

      for (const article of toProcess) {
        logs.push(`\n[BOT] ── Publishing: ${article.title}`);

        // Groq rewrite
        const articleHtml = await rewriteArticle(
          { title: article.title, bodyText: article.bodyText, source: article.source },
          logs
        );

        if (!articleHtml) {
          stats.failed++;
          // Don't save URL — retry next trigger
          continue;
        }

        // Insert video + thumbnail image at top of content
        const thumbnail = `<div style="text-align:center;margin-bottom:12px;"><img src="${article.image}" alt="${article.title}" style="max-width:100%;border-radius:8px;" /></div>`;
        const finalContent = thumbnail + articleHtml.replace("[VIDEOPLACEHOLDER]", article.videoEmbed);

        // Publish to Blogger
        const result = await publishPost(
          { title: article.title, content: finalContent },
          logs
        );

        if (result) {
          publishedPosts.push({ title: article.title, url: result.url });
          stats.published++;
          // Only save URL after successful publish
          newlyProcessed.push(article.url);
          logs.push(`[BOT] ✅ Published! (${stats.published}/${toProcess.length})`);
        } else {
          stats.failed++;
          // Don't save — retry next trigger
        }

        await new Promise((r) => setTimeout(r, 2000));
      }

      // Step 6: Save only published URLs
      if (newlyProcessed.length > 0) {
        await saveProcessedUrls([...processedUrls, ...newlyProcessed]);
        logs.push(`[DB] ✅ Saved ${newlyProcessed.length} published URLs`);
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
