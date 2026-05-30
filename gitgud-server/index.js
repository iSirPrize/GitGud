const express = require("express");
const cors = require("cors");
const path = require('path');
const uploadRoute = require('./routes/imageUpload');
const schedule = require('node-schedule');
const admin = require('firebase-admin'); //qm Added for checking notification state
require("dotenv").config();


const serviceAccount = require("./serviceAccountKey.json"); 
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
const db = admin.firestore();

const app = express();

app.use(cors({
  origin: 'http://localhost:5173',
  allowedHeaders: ['Content-Type', 'useriddata']
}));

app.use(express.json());

// active tracker for emails
const activeServerJobs = {};


// 5 minute delayed notification email
app.post('/api/notifications/schedule-notification', async (req, res) => {
    try {
        const { userId, notificationId, chatId, type, senderName, messageSnippet } = req.body;
        res.status(202).json({ success: true, message: "Countdown initiated on server." });

        const jobKey = chatId || notificationId;
        if (!jobKey || !userId) return;

        if (activeServerJobs[jobKey]) {
            activeServerJobs[jobKey].cancel();
            console.log(`[Server Scheduler] Overwriting existing active timer for key: ${jobKey}`);
        }
        //will change this if we reaching our email limit, make it longer, or shorter for Nathan
        const runTime = new Date(Date.now() + 5 * 60 * 1000); 
        console.log(`[Server Scheduler] Email scheduled for user ${userId} in 5 minutes (Key: ${jobKey})`);

        const job = schedule.scheduleJob(runTime, async () => {
            try {
                console.log(`[Server Scheduler] 5 minutes up! Verifying Firestore status for Key: ${jobKey}...`);

                let shouldSendEmail = true;

                if (notificationId) {
                    const notifSnap = await db
                        .doc(`users/${userId}/notifications/${notificationId}`)
                        .get();

                    if (!notifSnap.exists || notifSnap.data()?.isRead === true) {
                        shouldSendEmail = false;
                    }
                }

                if (!shouldSendEmail) {
                    console.log(`[Server Scheduler] Target user read their alerts. Aborting email delivery!`);
                    delete activeServerJobs[jobKey];
                    return;
                }

                // get user email
                const userSnap = await db.doc(`users/${userId}`).get();
                const targetEmail = userSnap.data()?.email;
                const targetName = userSnap.data()?.username || "Gamer";

                if (!targetEmail) {
                    console.log(`[Server Scheduler] No valid email found for user ${userId}. Aborting.`);
                    delete activeServerJobs[jobKey];
                    return;
                }

                // sending rest api
                const emailjsResponse = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        service_id: process.env.EMAILJS_SERVICE_ID,
                        template_id: process.env.EMAILJS_TEMPLATE_ID,
                        user_id: process.env.EMAILJS_PUBLIC_KEY,
                        accessToken: process.env.EMAILJS_PRIVATE_KEY,
                        template_params: {
                            to_email: targetEmail,
                            recipient_name: targetName,
                            email_subject: type === "friend_request" 
                                ? "New Friend Request on GitGud!"
                                : type === "comment_reply"
                                ?`New reply to your comment from ${senderName}`
                                : `New message from ${senderName}`,

                            email_body: messageSnippet?.trim()
                            ? `Message: ${messageSnippet}`
                            : "You have unread updates waiting on GitGud!",
                            
                            action_url: type === "friend_request"
                            ? `http://localhost:5173/profile/${userId}`
                            : type === "comment_reply"
                            ? `http://localhost:5173/posts/${quizId || chatId}`
                            : `http://localhost:5173/messages/${chatId}`
                        }
                    })
                });

                if (emailjsResponse.ok) {
                    console.log(`[Server Scheduler] Backend email successfully sent to ${targetEmail}`);
                } else {
                    const errText = await emailjsResponse.text();
                    console.error(`[Server Scheduler] EmailJS server returned an error:`, errText);
                }

            } catch (jobErr) {
                console.error("[Server Scheduler] Error executing background task:", jobErr);
            }
            // remove job on compelte
            delete activeServerJobs[jobKey];
        });
        // Store job to cancel if needed
        activeServerJobs[jobKey] = job;
    } catch (err) {
        console.error("Scheduling route error:", err);
    }
});

//Instantly cancel a pending email countdown
app.post('/api/notifications/cancel-notification', (req, res) => {
    const { jobKey } = req.body; 

    if (activeServerJobs[jobKey]) {
        activeServerJobs[jobKey].cancel(); // Halts the countdown immediately
        delete activeServerJobs[jobKey];
        console.log(`[Server Scheduler] Cancelled active email clock for key: ${jobKey}`);
        return res.json({ cancelled: true, message: "Countdown aborted successfully." });
    }

    res.json({ cancelled: false, message: "No active timer found." });
});

app.get("/api/health", (req, res) => {
  res.json({ status: "Server is running" });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));