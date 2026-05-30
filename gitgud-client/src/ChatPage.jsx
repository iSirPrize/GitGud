import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { db } from "./firebase";
import {
    doc,
    collection,
    addDoc,
    updateDoc,
    query,
    orderBy,
    onSnapshot,
    serverTimestamp,
    increment,
    getDoc,
    where,
    getDocs,
    writeBatch
} from 'firebase/firestore';
import { useTheme } from "./context/ThemeContext";
import './chatPage.css';

function ChatPage({ user }) {
    const { chatId } = useParams();
    const { theme } = useTheme();
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState("");
    const dummySpace = useRef(null);
    const navigate = useNavigate();

    // Clear unread count for the logged-in user and cancel any server countdowns
    useEffect(() => {
        if (!chatId || !user?.uid) return;

        const clearUnreadCount = async () => {
            try {
                const chatDocRef = doc(db, "chats", chatId);
                await updateDoc(chatDocRef, {
                    [`unreadCounts.${user.uid}`]: 0
                });

                // Find any existing notifications for this specific chat in the user's bell center
                const myNotifsRef = collection(db, "users", user.uid, "notifications");
                const q = query(myNotifsRef, where("chatId", "==", chatId));
                const snap = await getDocs(q);

                if (!snap.empty) {
                    const batch = writeBatch(db);
                    
                    snap.docs.forEach((d) => {
                        // Cancel the exact notification job key on the backend
                        const jobKey = d.id;
                        fetch("http://localhost:3001/api/notifications/cancel-notification", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ jobKey })
                        }).catch(err => console.error("Express cancellation notice dropped:", err));

                        // Hard delete from the bell database to keep it clean
                        batch.delete(d.ref);
                    });

                    await batch.commit();
                }

            } catch (err) {
                console.error("Error clearing unread counts: ", err);
            }
        };

        clearUnreadCount();
    }, [chatId, user?.uid]);

    // real time message listener
    useEffect(() => {
        if (!chatId) return;

        const messageRef = collection(db, "chats", chatId, "messages");
        const q = query(messageRef, orderBy("timestamp", "asc"));

        const unsubscribe = onSnapshot(q, { includeMetadataChanges: true }, (snapshot) => {
            const msgs = snapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    ...data,
                    timestamp: data.timestamp ? data.timestamp.toDate() : new Date()
                };
            });

            setMessages(msgs);

            setTimeout(() => {
                dummySpace.current?.scrollIntoView({ behavior: 'smooth' });
            }, 60);
        }, (err) => {
            console.error("Snapshot error: ", err);
        });

        return () => unsubscribe();
    }, [chatId]);

    const handleSendMessage = async (e) => {
        if (e) e.preventDefault();
        if (!newMessage.trim() || !user) return;

        const currentText = newMessage;
        setNewMessage("");

        try {
            const chatDocRef = doc(db, "chats", chatId);
            const messagesSubcollectionRef = collection(chatDocRef, "messages");

            const chatSnapshot = await getDoc(chatDocRef);
            const chatData = chatSnapshot.data();
            const participants = chatData?.participants || [];

            // commit doc to subcollection
            await addDoc(messagesSubcollectionRef, {
                senderId: user.uid,
                senderName: user.displayName || "Anonymous",
                senderPhoto: user.photoURL || "",
                text: currentText,
                timestamp: serverTimestamp()
            });

            // prep tracking for email
            const updates = {
                lastMessage: currentText,
                updatedAt: serverTimestamp(),
            };

            //checking all particpant id
            for (const participantId of participants) {
                if (participantId !== user.uid) {
                    const currentUnread = chatData?.unreadCounts?.[participantId] || 0;

                    // Increment structural counter parameters mapping directly to participant IDs
                    updates[`unreadCounts.${participantId}`] = increment(1);

                    // sedn push notif if unread msg
                    if (currentUnread === 0) {
                        let newNotifId = "";
                        try {
                            const newNotifRef = await addDoc(collection(db, "users", participantId, "notifications"), {
                                type: "unread_message",
                                senderName: user.displayName || "Someone",
                                chatId: chatId,
                                messageSnippet: currentText.length > 60 ? `${currentText.slice(0, 60)}...` : currentText,
                                isRead: false,
                                timestamp: serverTimestamp()
                            });
                            newNotifId = newNotifRef.id;
                        } catch (notifErr) {
                            console.error("Failed to push to notification center:", notifErr);
                        }

                        // send msg to jobs for email
                        if (newNotifId) {
                            fetch("http://localhost:3001/api/notifications/schedule-notification", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({
                                    userId: participantId,
                                    notificationId: newNotifId,
                                    chatId: chatId,
                                    type: "unread_message",
                                    senderName: user.displayName || "Someone",
                                    messageSnippet: currentText
                                })
                            }).catch(err => console.error("Failed to alert Express scheduler:", err));
                        }
                    }
                }
            }
            // Update parent chat document counters globally
            await updateDoc(chatDocRef, updates);

        } catch (err) {
            console.error("message route failure: ", err);
            setNewMessage(currentText);
        }
    };

    return (
        <div className={`chat-page-wrapper quiz-carousel dark ${theme}`}>
            <div className="chat-container">
                <div className="chat-interface-header">
                    <button 
                        type="button"
                        className="chat-back-nav-btn"
                        onClick={() => navigate("/messages")}
                    >
                        <span>Back to chat select</span>
                    </button>
                </div>

                <div className="messages-box">
                    {messages.map((msg) => {
                        const isMe = msg.senderId === user?.uid;
                        return (
                            <div key={msg.id} className={`message-bubble ${isMe ? "sent" : "received"}`}>
                                <div className="message-sender-header">
                                    {msg.senderPhoto ? (
                                        <img src={msg.senderPhoto} alt={msg.senderName} className="sender-avatar-img" />
                                    ) : (
                                        <img
                                            src="https://res.cloudinary.com/dyis0klmz/image/upload/v1778881220/Escanor-2442723100_pyogt4.jpg"
                                            alt="User Profile"
                                            className="sender-avatar-img"
                                        />
                                    )}
                                    <span className="sender-tag">
                                        {isMe ? "Me" : msg.senderName}
                                    </span>
                                </div>

                                <p className="message-text">{msg.text}</p>
                            </div>
                        );
                    })}
                    <div ref={dummySpace} />
                </div>

                <form onSubmit={handleSendMessage} className="chat-input-form">
                    <input
                        className="chat-input"
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder="Type a message..."
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleSendMessage(e);
                            }
                        }}
                    />
                    <button className="chat-send-btn" type="submit">Send</button>
                </form>
            </div>
        </div>
    );
}

export default ChatPage;