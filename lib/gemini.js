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

  // openrouter/free auto-selects from all available free models
  const models = [
    "openrouter/free",
    "dots-studio/dots3-note-preview:free",
    "nvidia/llama-3.1-nemotron-ultra-253b-v1:free",
  ];

  for (const model of models) {
    try {
      logs.push(`[AI] Trying: ${model}`);
      const res = await axios.post(
        "https://openrouter.ai/api/v1/chat/completions",
        {
          model,
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

      const text = res.data?.choices?.[0]?.message?.content || "";
      if (text && text.length > 50) {
        const usedModel = res.data?.model || model;
        logs.push(`[AI] ✅ Success with: ${usedModel} (~${text.split(" ").length} words)`);
        return text;
      }
      logs.push(`[AI] ⚠️ Empty from ${model}`);
      logs.push(`[AI] Raw: ${JSON.stringify(res.data).slice(0, 200)}`);
    } catch (err) {
      const errMsg = err.response?.data?.error?.message || err.message;
      logs.push(`[AI] ❌ ${model}: ${errMsg}`);
    }
  }

  logs.push(`[AI] ❌ All models failed`);
  return null;
}

module.exports = { rewriteArticle };
