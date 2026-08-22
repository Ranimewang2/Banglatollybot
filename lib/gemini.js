const axios = require("axios");
const config = require("./config");

async function rewriteArticle({ title, bodyText, source }, logs) {
  logs.push(`[AI] Rewriting: "${title}"`);

  const showName = title.split(/[\d(|।]/)[0].trim();
  const channel = source.includes("Jalsha") ? "Star Jalsha" : "Zee Bangla";

  const prompt = `You are a Bengali serial blog writer. Write a blog article in English with neutral news reporter tone. The article must be strictly between 200-300 words total.

Serial show: "${showName}"
Channel: "${channel}"
Article title: "${title}"
Source content (use as reference, rewrite completely): "${bodyText.slice(0, 1000)}"

Write the article in this EXACT HTML structure:

<p><strong>${showName}</strong> is one of the most popular Bengali serials airing on ${channel}, loved by millions of fans for its emotional and gripping storyline.</p>

[VIDEOPLACEHOLDER]

<h2>Today's Episode Highlights</h2>
<p>Write 2-3 sentences about today's key events based on source content.</p>

<h2>Key Clues & Moments</h2>
<ul>
<li>Highlight point 1</li>
<li>Highlight point 2</li>
<li>Highlight point 3</li>
</ul>

<h2>Character & Story Analysis</h2>
<p>Write 2-3 sentences analyzing characters and story direction.</p>

<h2>Ending & What To Expect Next</h2>
<p>Write 2 sentences about episode ending and what viewers can expect next.</p>

<h2>FAQ</h2>
<p><strong>When does ${showName} air?</strong> Every day on ${channel}.</p>
<p><strong>Where to watch?</strong> On ${channel} TV and its official OTT platform.</p>

RULES:
- Total words must be 200-300
- Use only HTML tags shown above, no markdown
- Keep [VIDEOPLACEHOLDER] exactly as written
- No intro or extra text outside the structure`;

  // Retry openrouter/free up to 5 times — it picks a random free model each time
  // so a bad pick (content-safety, coding) will get a different model on retry
  const MAX_RETRIES = 5;

  for (let i = 1; i <= MAX_RETRIES; i++) {
    try {
      logs.push(`[AI] Attempt ${i}/${MAX_RETRIES} via openrouter/free`);
      const res = await axios.post(
        "https://openrouter.ai/api/v1/chat/completions",
        {
          model: "openrouter/free",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.7,
          max_tokens: 1024,
        },
        {
          headers: {
            Authorization: `Bearer ${config.OPENROUTER_API_KEY}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "https://banglatolly.onrender.com",
            "X-Title": "BanglaTolly Bot",
          },
          timeout: 40000,
        }
      );

      const usedModel = res.data?.model || "unknown";
      const text = res.data?.choices?.[0]?.message?.content || "";

      if (text && text.length > 50) {
        logs.push(`[AI] ✅ Success! Model: ${usedModel} (~${text.split(" ").length} words)`);
        return text;
      }

      // Content safety / coding models return empty — retry for a different model
      logs.push(`[AI] ⚠️ Empty response from ${usedModel} — retrying for different model...`);

    } catch (err) {
      const errMsg = err.response?.data?.error?.message || err.message;
      logs.push(`[AI] ❌ Attempt ${i} error: ${errMsg}`);
    }

    // Small delay before retry
    await new Promise((r) => setTimeout(r, 1500));
  }

  logs.push(`[AI] ❌ Failed after ${MAX_RETRIES} attempts`);
  return null;
}

module.exports = { rewriteArticle };
