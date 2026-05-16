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
    getDoc
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

    // 1. Clear unread count for the logged user
    useEffect(() => {
        if (!chatId || !user?.uid) return;

        const clearUnreadCount = async () => {
            try {
                const chatDocRef = doc(db, "chats", chatId);
                await updateDoc(chatDocRef, {
                    [`unreadCounts.${user.uid}`]: 0
                });
            } catch (err) {
                console.error("Error clearing unread counts: ", err);
            }
        };

        clearUnreadCount();
    }, [chatId, user?.uid, messages.length]);

    // Listener for messages to update in real time
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

            // Scroll to last message
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

            await addDoc(messagesSubcollectionRef, {
                senderId: user.uid,
                senderName: user.displayName || "Anonymous",
                senderPhoto: user.photoURL || "",
                text: currentText,
                timestamp: serverTimestamp()
            });

            const updates = {
                lastMessage: currentText,
                updatedAt: serverTimestamp(),
            };

            participants.forEach(memberId => {
                if (memberId !== user.uid) {
                    updates[`unreadCounts.${memberId}`] = increment(1);
                }
            });

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