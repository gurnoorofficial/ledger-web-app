const express = require("express");
const cors = require("cors");

const app = express();

app.use(
  cors({
    origin: "https://ledger-web-app-1.onrender.com",
  })
);

app.get("/", (req, res) => {
  res.send("Backend is running!");
});

app.get("/api/hello", (req, res) => {
  res.json({
    message: "Hello from Express backend 🚀"
  });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});