// --- START OF FILE qr.js ---

import express from "express";
import fsPromises from "fs/promises";
import fs from "fs";
import pino from "pino";
import makeWASocket, {
    useMultiFileAuthState,
    delay,
    makeCacheableSignalKeyStore,
    Browsers,
    jidNormalizedUser,
    fetchLatestBaileysVersion
} from "gifted-baileys"; 
import QRCode from "qrcode";

const router = express.Router();

// 🚦 SERVER BUSY / TRAFFIC CONTROLLER
let activeQrRequests = 0;
const MAX_QR_CONCURRENT = 3; // Hard limit to protect RAM

/**
 * 🧹 ASYNC FILE CLEANUP
 * Prevents storage exhaustion on cloud platforms
 */
async function removeFile(FilePath) {
    try {
        if (fs.existsSync(FilePath)) {
            await fsPromises.rm(FilePath, { recursive: true, force: true });
        }
    } catch (e) {
        console.error("QR Cleanup Error:", e.message);
    }
}

router.get("/", async (req, res) => {
    
    // 🚦 Traffic Guard for QR
    if (activeQrRequests >= MAX_QR_CONCURRENT) {
        return res.status(503).send({ code: "⚠️ Server is busy generating QR codes. Please try again later." });
    }

    activeQrRequests++;
    
    const sessionId = `qr_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const dirs = `./temp_sessions/${sessionId}`;

    async function initiateSession() {
        const { state, saveCreds } = await useMultiFileAuthState(dirs);
        const { version } = await fetchLatestBaileysVersion();
        
        let responseSent = false;
        let isSessionActive = true;

        try {
            const KnightBot = makeWASocket({
                version,
                auth: {
                    creds: state.creds,
                    keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "silent" })),
                },
                printQRInTerminal: false,
                logger: pino({ level: "silent" }),
                
                // 🚀 BROWSER ENGINE: Chrome Ubuntu (Best for 2026 Protocol)
                browser: Browsers.ubuntu('Chrome'),
                
                // 🔥 EXTREME RAM SAVER FLAGS
                markOnlineOnConnect: false, 
                syncFullHistory: false,
                shouldSyncHistoryMessage: () => false, 
                generateHighQualityLinkPreview: false,
                keepAliveIntervalMs: 30000,
                
                getMessage: async () => undefined
            });

            KnightBot.ev.on("connection.update", async (update) => {
                const { connection, lastDisconnect, qr } = update;

                // 🖼️ QR CODE GENERATION & TRANSMISSION
                if (qr && !responseSent) {
                    try {
                        const qrDataURL = await QRCode.toDataURL(qr, { margin: 1 });
                        responseSent = true;
                        res.send({ qr: qrDataURL, message: "Scan QR with WhatsApp Linked Devices." });
                    } catch (qrErr) {
                        console.error("QR Image Generation Failed:", qrErr);
                    }
                }

                if (connection === "open") {
                    console.log("✅ [QR Link] Success!");
                    
                    try {
                        // 🚀 5-SECOND STABILITY SNAPSHOT
                        await delay(5000); 
                        
                        const credsPath = dirs + "/creds.json";
                        const credsBuffer = await fsPromises.readFile(credsPath);
                        
                        // 🔐 ASCII-SAFE PREFIX (CRITICAL FIX)
                        const sessionString = "RANUX PRO ~" + credsBuffer.toString("base64");
                        
                        const userJid = jidNormalizedUser(KnightBot.user.id);
                        const num = userJid.split(":")[0].split("@")[0]; // Clean LID handling
                        
                        // ✅ SUCCESS MESSAGE (SEND TO INBOX)
                        await KnightBot.sendMessage(userJid, {
                            image: { url: "https://raw.githubusercontent.com/ransara-devnath-ofc/-Bot-Accent-/refs/heads/main/King%20RANUX%20PRO%20Bot%20Images/king-ranux-pro-main-logo.png" },
                            caption: `╭━━━〔 👑 *𝐊𝐈𝐍𝐆 𝐑𝐀𝐍𝐔𝐗 𝐏𝐑𝐎* 〕━━━┈
┃
┃ *🎉 හෙලෝ යාළුවා!*
┃ ඔයා සාර්ථකව QR හරහා අපේ බොට් 
┃ සිස්ටම් එකට සම්බන්ධ වුණා. ✨
┃
┃ *🟢 Status:* Linked Successfully!
┃ *🪪 Phone:* ${num}
┃ *💻 Platform:* Chrome (Ubuntu)
┃
╰━━━━━━━━━━━━━━━━━━━━━━┈

> 💡 _ඔයාගේ Session ID එක පහළින් එවා ඇත. එය Copy කරගෙන Bot ගේ .env එකට හෝ config එකට ඇතුළත් කරන්න._

> 👨‍💻 Developed By — MR Ransara Devnath`,
                        });

                        await delay(1000);

                        // 🔑 SEND THE EXACT SESSION ID STRING SEPARATELY FOR EASY COPYING
                        await KnightBot.sendMessage(userJid, {
                            text: sessionString
                        });

                        await delay(1000);

                        // ⚠️ SECURITY WARNING MESSAGE
                        await KnightBot.sendMessage(userJid, {
                            text: `⚠️ *DO NOT SHARE THIS SESSION ID WITH ANYONE!* ⚠️\n\nමෙම Session කේතය කිසිවෙකුටත් ලබා නොදෙන්න. මෙය ඔබගේ WhatsApp ගිණුමට සම්පූර්ණ ප්‍රවේශය ලබා දෙයි.`
                        });

                        // 🔥 RESOURCE RELEASE (ZERO DATABASE STORAGE)
                        isSessionActive = false;
                        KnightBot.ev.removeAllListeners();
                        KnightBot.end(undefined);
                        await removeFile(dirs);
                        activeQrRequests--;

                    } catch (error) {
                        console.error("QR Capturing Failed:", error.message);
                        isSessionActive = false;
                        KnightBot.end(undefined);
                        await removeFile(dirs);
                        activeQrRequests--;
                    }
                }

                if (connection === "close") {
                    const statusCode = lastDisconnect?.error?.output?.statusCode;
                    
                    if (isSessionActive && statusCode !== 401) {
                        initiateSession();
                    } else {
                        isSessionActive = false;
                        KnightBot.ev.removeAllListeners();
                        await removeFile(dirs);
                        activeQrRequests--;
                    }
                }
            });

            KnightBot.ev.on("creds.update", saveCreds);

            // ⏳ HTTP RESPONSE TIMEOUT
            setTimeout(() => {
                if (!responseSent) {
                    if (!res.headersSent) {
                        res.status(408).send({ code: "🚨 WhatsApp Servers are busy generating QR. Try again shortly." });
                    }
                    isSessionActive = false;
                    KnightBot.end(undefined);
                    removeFile(dirs);
                    activeQrRequests--;
                }
            }, 50000);

            // 🔒 ZOMBIE SOCKET CLEANUP: Kill if scan takes too long (>2 mins)
            setTimeout(async () => {
                if (isSessionActive) {
                    isSessionActive = false;
                    KnightBot.ev.removeAllListeners();
                    KnightBot.end(undefined);
                    await removeFile(dirs);
                    activeQrRequests--;
                    console.log(`🔒 QR Socket Cleaned (Idle Timeout)`);
                }
            }, 120000);

        } catch (err) {
            console.error("QR Logic Execution Error:", err.message);
            isSessionActive = false;
            await removeFile(dirs);
            activeQrRequests--;
        }
    }

    // Start Execution
    await initiateSession();
});

export default router;

// --- END OF FILE qr.js ---