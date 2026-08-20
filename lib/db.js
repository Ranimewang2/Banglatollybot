const axios = require("axios");
const config = require("./config");

const HEADERS = {
  "X-Master-Key": config.JSONBIN_API_KEY,
  "Content-Type": "application/json",
};

// ─── PROCESSED URLs ───────────────────────────────────────

async function getProcessedUrls() {
  try {
    const res = await axios.get(
      `https://api.jsonbin.io/v3/b/${config.JSONBIN_BIN_ID}/latest`,
      { headers: HEADERS }
    );
    return res.data.record.processedUrls || [];
  } catch (err) {
    console.error("[DB] Error fetching processed URLs:", err.message);
    return [];
  }
}

async function saveProcessedUrls(urls) {
  try {
    await axios.put(
      `https://api.jsonbin.io/v3/b/${config.JSONBIN_BIN_ID}`,
      { processedUrls: urls },
      { headers: HEADERS }
    );
  } catch (err) {
    console.error("[DB] Error saving processed URLs:", err.message);
  }
}

// ─── RUNS HISTORY + LOGS ──────────────────────────────────

async function getRuns() {
  try {
    const res = await axios.get(
      `https://api.jsonbin.io/v3/b/${config.JSONBIN_LOGS_BIN_ID}/latest`,
      { headers: HEADERS }
    );
    return res.data.record.runs || [];
  } catch (err) {
    console.error("[DB] Error fetching runs:", err.message);
    return [];
  }
}

async function saveRun(runData) {
  try {
    const runs = await getRuns();
    // Keep only last 10 runs
    runs.unshift(runData);
    const trimmed = runs.slice(0, 10);
    await axios.put(
      `https://api.jsonbin.io/v3/b/${config.JSONBIN_LOGS_BIN_ID}`,
      { runs: trimmed },
      { headers: HEADERS }
    );
  } catch (err) {
    console.error("[DB] Error saving run:", err.message);
  }
}

module.exports = { getProcessedUrls, saveProcessedUrls, getRuns, saveRun };
