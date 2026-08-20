const { getRuns } = require("../lib/db");

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  try {
    const runs = await getRuns();
    return res.status(200).json({ success: true, runs });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};
