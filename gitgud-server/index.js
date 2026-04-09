const express = require("express");
const cors = require("cors");
const path = require('path');
const uploadPath =  require('./routes/upload');
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

//image upload code
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('api/upload', uploadPath);

app.get("/api/health", (req, res) => {
  res.json({ status: "Server is running" });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));