const express = require("express");
const cors = require("cors");
const path = require('path');
const uploadRoute = require('./routes/imageUpload');
require("dotenv").config();

const app = express();

app.use(cors({
  origin: 'http://localhost:5173',
  allowedHeaders: ['Content-Type', 'useriddata']
}));

app.use(express.json());

//image upload code
app.use('/api/upload', uploadRoute);
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.get("/api/health", (req, res) => {
  res.json({ status: "Server is running" });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));