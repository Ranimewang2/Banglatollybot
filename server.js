const express = require("express");
const path = require("path");
const runHandler = require("./api/run");
const logsHandler = require("./api/logs");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// Bot trigger endpoint
app.get("/api/run", runHandler);

// Logs endpoint
app.get("/api/logs", logsHandler);

// Dashboard
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`[SERVER] BanglaTolly running on port ${PORT}`);
  console.log(`[SERVER] Dashboard: http://localhost:${PORT}`);
  console.log(`[SERVER] Trigger: http://localhost:${PORT}/api/run`);
});
