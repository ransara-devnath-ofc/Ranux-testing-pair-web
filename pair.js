// --- START OF FILE pair.js ---

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
import { parsePhoneNumber } from "awesome-phonenumber"; 

const router = express.Router();

// 🚦 SERVER BUSY / TRAFFIC CONTROLLER (Optimized for 512MB Render/Heroku RAM)
let activeRequests = 0;
const MAX_CONCURRENT = 3; // Hard limit to prevent RAM crashes during mass pairings

/**
 * 🧹 ASYNC FILE CLEANUP
 * Prevents Render/Heroku disk space issues by cleaning temp sessions instantly
 */
async function removeFile(FilePath) {
    try {
        if (fs.existsSync(FilePath)) {
            await fsPromises.rm(FilePath, { recursive: true, force: true });
        }
    } catch (e) {
        console.error("Cleanup Error:", e.message);
    }
}

router.get("/", async (req, res) => {
    let num = req.query.number;
    
    // 1. Initial Validation
    if (!num) return res.status(400).send({ code: "Number is required" });

    // 🚦 Traffic Guard: Reject if server is overloaded
    if (activeRequests >= MAX_CONCURRENT) {
        return res.status(503).send({ code: "⚠️ Server is currently busy to protect RAM. Please wait 1 minute." });
    }

    activeRequests++; // Increment active request counter
    
    const sessionID = `pair_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const dirs = `./temp_sessions/${sessionID}`;
    
    // 2. Number Sanitization & International Format Check (V7 Fixes applied)
    num = num.replace(/[^0-9]/g, "");
    const phone = parsePhoneNumber("+" + num);
    
    if (!phone.valid) { 
        activeRequests--;
        return res.status(400).send({ code: "Invalid international phone number format." });
    }
    
    num = phone.number.e164.replace("+", "");

    async function initiateSession() {
        const { state, saveCreds } = await useMultiFileAuthState(dirs);
        const { version } = await fetchLatestBaileysVersion();
        
        /**
         * 🛡️ SESSION STATUS FLAG
         * Prevents infinite loops and ensures proper resource disposal
         */
        let isSessionActive = true;

        try {
            let KnightBot = makeWASocket({
                version,
                auth: {
                    creds: state.creds,
                    keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "silent" })),
                },
                printQRInTerminal: false,
                logger: pino({ level: "silent" }),
                
                // 🚀 2026 STABILITY ENGINE: Ubuntu Chrome Signature (Official v7)
                browser: Browsers.ubuntu('Chrome'),
                
                // 🔥 EXTREME RAM SAVING FLAGS FOR PAIR SITE
                markOnlineOnConnect: false, 
                syncFullHistory: false, 
                shouldSyncHistoryMessage: () => false, 
                generateHighQualityLinkPreview: false, // Prevents link fetching during boot
                
                connectTimeoutMs: 60000,
                defaultQueryTimeoutMs: 60000,
                keepAliveIntervalMs: 30000,
                
                // 🔥 Spam preventer: Stops Baileys from buffering fake messages
                getMessage: async () => undefined 
            });

            KnightBot.ev.on("connection.update", async (update) => {
                const { connection, lastDisconnect } = update;

                if (connection === "open") {
                    console.log(`✅ [Pair Success] Phone: ${num}`);
                    
                    try {
                        // 🚀 5-SECOND STABILITY SNAPSHOT
                        // Delay ensures WhatsApp syncs all LID native keys before we compress it to Base64
                        await delay(5000); 
                        
                        const credsPath = dirs + "/creds.json";
                        const credsBuffer = await fsPromises.readFile(credsPath);
                        
                        // 🔐 CUSTOM ASCII-SAFE PREFIX (CRITICAL FIX FOR BOT INDEX.JS)
                        // Removed unicode characters to prevent Base64 corruption
                        const sessionString = "RANUX PRO ~" + credsBuffer.toString("base64");

                        const userJid = jidNormalizedUser(KnightBot.user.id);
                        
                        // 🎨 PREMIUM SUCCESS THEME (SEND TO INBOX)
                        await KnightBot.sendMessage(userJid, {
                            image: { url: "https://raw.githubusercontent.com/ransara-devnath-ofc/-Bot-Accent-/refs/heads/main/King%20RANUX%20PRO%20Bot%20Images/king-ranux-pro-main-logo.png" },
                            caption: `╭━━━〔 👑 *𝐊𝐈𝐍𝐆 𝐑𝐀𝐍𝐔𝐗 𝐏𝐑𝐎* 〕━━━┈
┃
┃ *🎉 හෙලෝ යාළුවා!*
┃ ඔයා සාර්ථකව අපේ බොට් සිස්ටම් එකට
┃ සම්බන්ධ වුණා. ✨
┃
┃ *🟢 Status:* Connected Successfully!
┃ *🪪 Phone:* ${num}
┃ *💻 Platform:* Chrome (Ubuntu)
┃
╰━━━━━━━━━━━━━━━━━━━━━━┈

> 💡 _ඔයාගේ Session ID එක පහළින් එවා ඇත. එය Copy කරගෙන Bot ගේ .env එකට හෝ config එකට ඇතුළත් කරන්න._

*🚨 අලුත්ම Updates සහ හැමදේම දැනගන්න අපේ Official Channel එකට දැන්ම Join වෙන්න:*
🔗 https://whatsapp.com/channel/0029Vb8QGLwBvvsgIhaSN00Z

*❤️ Thank you for choosing us!*
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
                        
                        // 🔥 AGGRESSIVE MEMORY CLEANUP (ZERO DATABASE STORAGE)
                        isSessionActive = false;
                        KnightBot.ev.removeAllListeners();
                        KnightBot.end(undefined);
                        await removeFile(dirs);
                        activeRequests--; // Decrease traffic counter

                    } catch (error) {
                        console.error("Session Capture Failed:", error.message);
                        isSessionActive = false;
                        KnightBot.end(undefined);
                        await removeFile(dirs);
                        activeRequests--;
                    }
                }

                if (connection === "close") {
                    const statusCode = lastDisconnect?.error?.output?.statusCode;
                    
                    /**
                     * 🔄 RETRY LOGIC
                     * Only retries if not logged out (401) and session is still intended to be active
                     */
                    if (isSessionActive && statusCode !== 401) {
                        initiateSession();
                    } else {
                        isSessionActive = false;
                        KnightBot.ev.removeAllListeners();
                        await removeFile(dirs);
                        activeRequests--; // Ensure counter goes down on fail
                    }
                }
            });

            // 🔑 PAIRING CODE GENERATION
            if (!KnightBot.authState.creds.registered) {
                await delay(2500); // Protocol delay for socket stability
                try {
                    let code = await KnightBot.requestPairingCode(num);
                    code = code?.match(/.{1,4}/g)?.join("-") || code;
                    
                    if (!res.headersSent) {
                        res.send({ code });
                    }

                    // 🔒 ANTI-SPAM LOCK: Auto-kill socket if not linked within 60s
                    setTimeout(async () => {
                        if (isSessionActive) {
                            isSessionActive = false;
                            KnightBot.ev.removeAllListeners();
                            KnightBot.end(undefined);
                            await removeFile(dirs);
                            activeRequests--;
                            console.log(`🔒 Pair Socket Closed: ${num} (Expired)`);
                        }
                    }, 60000);

                } catch (error) {
                    console.error("Pair Code Request Error:", error.message);
                    
                    // 🚦 Smart Rate Limit Handler
                    let errorMsg = "WhatsApp Server Refused Request";
                    if (error.message?.includes("rate-overlimit") || error.message?.includes("429")) {
                        errorMsg = "🚨 WhatsApp Servers are busy. Try again shortly.";
                    }

                    if (!res.headersSent) {
                        res.status(503).send({ code: errorMsg });
                    }
                    isSessionActive = false;
                    await removeFile(dirs);
                    activeRequests--;
                }
            }

            KnightBot.ev.on("creds.update", saveCreds);

        } catch (err) {
            console.error("Core Pairing Execution Error:", err.message);
            isSessionActive = false;
            await removeFile(dirs);
            activeRequests--;
        }
    }

    // Start Execution
    await initiateSession();
});

export default router;

// --- END OF FILE pair.js ---