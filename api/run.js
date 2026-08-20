const { getTodayArticles } = require("../lib/scraper");
const { scrapeArticle } = require("../lib/jina");
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

    // Step 2: Get today's articles
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
      logs.push(`[BOT] Will process max: ${config.ARTICLES_PER_RUN}`);

      const newlyProcessed = [];
      let successCount = 0;

      // Step 4: Process articles — stop after ARTICLES_PER_RUN successes
      for (const article of newArticles) {
        if (successCount >= config.ARTICLES_PER_RUN) {
          logs.push(`[BOT] ✅ Reached limit of ${config.ARTICLES_PER_RUN} article(s) per run`);
          break;
        }

        logs.push(`\n[BOT] ── Processing: ${article.url}`);

        // Always mark as processed so we don't retry failed/no-video articles
        newlyProcessed.push(article.url);

        try {
          // Jina scrape
          const scraped = await scrapeArticle(article.url, logs);
          if (!scraped) {
            logs.push(`[BOT] ❌ Jina scrape failed`);
            stats.failed++;
            continue;
          }

          // Use RSS title if jina didn't find one
          if (!scraped.title && article.title) scraped.title = article.title;

          // Fallback: build title from URL slug
          if (!scraped.title) {
            try {
              const urlPath = new URL(article.url).pathname;
              const slug = urlPath.replace(/\//g, " ").replace(/[-_]/g, " ").replace(/\.html?$/i, "").trim();
              if (slug.length > 3) {
                scraped.title = slug.replace(/\b\w/g, c => c.toUpperCase());
                logs.push(`[BOT] ⚠️ Using slug as title: ${scraped.title}`);
              }
            } catch(e) {}
          }

          if (!scraped.title) {
            logs.push(`[BOT] ❌ No title found, skipping`);
            stats.failed++;
            continue;
          }

          // SKIP if no video — video is required
          if (!scraped.videoEmbed) {
            logs.push(`[BOT] ⏭️ SKIP — no video found in article (video required)`);
            stats.noVideo++;
            continue;
          }

          // SKIP if no image — thumbnail is required
          if (!scraped.image) {
            logs.push(`[BOT] ⏭️ SKIP — no thumbnail image found`);
            stats.failed++;
            continue;
          }

          // Groq rewrite
          const articleHtml = await rewriteArticle(
            { title: scraped.title, bodyText: scraped.bodyText, source: article.source },
            logs
          );
          if (!articleHtml) {
            stats.failed++;
            continue;
          }

          // Insert video embed
          const finalContent = articleHtml.replace("[VIDEOPLACEHOLDER]", scraped.videoEmbed);

          // Publish to Blogger
          const result = await publishPost(
            { title: scraped.title, content: finalContent, imageUrl: scraped.image },
            logs
          );

          if (result) {
            publishedPosts.push({ title: scraped.title, url: result.url });
            stats.published++;
            successCount++;
            logs.push(`[BOT] ✅ Success! ${successCount}/${config.ARTICLES_PER_RUN} published`);
          } else {
            stats.failed++;
          }

          await new Promise((r) => setTimeout(r, 2000));

        } catch (err) {
          logs.push(`[BOT] ❌ Unexpected error: ${err.message}`);
          stats.failed++;
        }
      }

      // Step 5: Save all processed URLs (including skipped ones)
      if (newlyProcessed.length > 0) {
        await saveProcessedUrls([...processedUrls, ...newlyProcessed]);
        logs.push(`[DB] ✅ Saved ${newlyProcessed.length} URLs to processed list`);
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

// Render / Express compatible handler
module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  try {
    const result = await runBot();
    return res.status(200).json({ success: true, ...result });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};
