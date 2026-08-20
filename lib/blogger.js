const axios = require("axios");
const config = require("./config");

async function getAccessToken(logs) {
  logs.push(`[BLOGGER] Getting access token...`);
  try {
    const res = await axios.post("https://oauth2.googleapis.com/token", {
      client_id: config.GOOGLE_CLIENT_ID,
      client_secret: config.GOOGLE_CLIENT_SECRET,
      refresh_token: config.GOOGLE_REFRESH_TOKEN,
      grant_type: "refresh_token",
    });
    logs.push(`[BLOGGER] ✅ Access token obtained`);
    return res.data.access_token;
  } catch (err) {
    logs.push(`[BLOGGER] ❌ Token error: ${err.response?.data?.error || err.message}`);
    return null;
  }
}

async function publishPost({ title, content, imageUrl }, logs) {
  logs.push(`[BLOGGER] Publishing: "${title}"`);
  const accessToken = await getAccessToken(logs);
  if (!accessToken) return null;

  const postBody = { title, content };
  if (imageUrl) {
    postBody.images = [{ url: imageUrl }];
    logs.push(`[BLOGGER] Thumbnail: ${imageUrl}`);
  }

  try {
    const res = await axios.post(
      `https://www.googleapis.com/blogger/v3/blogs/${config.BLOGGER_BLOG_ID}/posts/`,
      postBody,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        timeout: 30000,
      }
    );
    const postUrl = res.data?.url || "";
    logs.push(`[BLOGGER] ✅ Published: ${postUrl}`);
    return { url: postUrl, title };
  } catch (err) {
    logs.push(`[BLOGGER] ❌ Publish error: ${err.response?.data?.error?.message || err.message}`);
    return null;
  }
}

module.exports = { publishPost };
