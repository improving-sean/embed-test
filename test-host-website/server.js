const express = require("express");
const path = require("path");

const app = express();
const port = 8000; // You can use any port number

// Serve static files from the 'public' folder
app.use(express.static("public"));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "parent.html"));
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}/`);
});
