// --- START OF FILE index.js ---

import express from "express";
import bodyParser from "body-parser";
import { fileURLToPath } from "url";
import path from "path";
import "dotenv/config";

// 🚀 අලුත් අප්ඩේට් එකට අනුව MongoDB ඉවත් කර ඇත (Zero Database Storage)
// import "./mongo.js"; 

import pairRouter from "./pair.js";
import qrRouter from "./qr.js";

const app = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 8000;

// Baileys සඳහා අවශ්‍ය වන Event Listeners ප්‍රමාණය වැඩි කිරීම (Memory leak warnings වැලැක්වීමට)
import("events").then((events) => {
    events.EventEmitter.defaultMaxListeners = 500;
});

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(__dirname));

// ප්‍රධාන වෙබ් පිටුව (pair.html) ලෝඩ් කිරීම
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "pair.html"));
});

// අදාළ මාර්ග (Routes) සම්බන්ධ කිරීම
app.use("/pair", pairRouter);
app.use("/qr", qrRouter);

app.listen(PORT, () => {
    console.log(`🚀 KING RANUX PRO Server running on http://localhost:${PORT}`);
    console.log(`✅ MongoDB has been completely removed (Direct Inbox Delivery Active)`);
});

export default app;

// --- END OF FILE index.js ---