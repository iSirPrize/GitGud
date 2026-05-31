import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { db, auth } from "./firebase";
import {
    collection,
    query,
    where,
    orderBy,
    onSnapshot,
    addDoc,
    serverTimestamp
} from 'firebase/firestore';
import { useTheme } from "./context/ThemeContext";
import './ChatDashboard.css';
import GroupPicUpload from "./GroupPicUpload";
import {TITLES} from "./titles";

function ChatDashboard({ user }) {
    const { theme } = useTheme();
    const navigate = useNavigate();
    const [chats, setChats] = useState([]);
    const [friends, setFriends] = useState([]);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [groupName, setGroupName] = useState("");
    const [selectedFriends, setSelectedFriends] = useState([]);
    const [groupPicUrl, setGroupPicUrl] = useState("");

    useEffect(() => {
        if (!user?.uid) return;
        let q;
        try {
            q = query(
                collection(db, "chats"),
                where("participants", "array-contains", user.uid),
                orderBy("updatedAt", "desc")
            );
        } catch (setupError) {
            console.error("Query building failed:", setupError);
            return;
        }

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const chatList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setChats(chatList);
        }, (err) => {
            console.warn("Firestore era:", err);

            const fallbackQ = query(
                collection(db, "chats"),
                where("participants", "array-contains", user.uid)
            );
            onSnapshot(fallbackQ, (fallbackSnapshot) => {
                const fallbackList = fallbackSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setChats(fallbackList);
            });
        });

        return () => unsubscribe();
    }, [user?.uid]);

    useEffect(() => {
        if (!user?.uid) return;

        const q = query(collection(db, "users", user.uid, "friends"));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setFriends(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        }, (err) => {
            console.error("Error fetching friends:", err);
        });

        return () => unsubscribe();
    }, [user?.uid]);

    const handleToggleFriend = (friendId) => {
        setSelectedFriends(prev =>
            prev.includes(friendId)
                ? prev.filter(id => id !== friendId)
                : [...prev, friendId]
        );
    };

    const handleCreateGroupSubmit = async (e) => {
        e.preventDefault();

        if (!groupPicUrl) {
            alert("Please upload a group picture before creating the group chat.");
            return;
        }

        if (!groupName.trim() || selectedFriends.length === 0) {
            alert("Please enter a group name and select at least one friend.");
            return;
        }

        try {
            const participantsRoster = [user.uid, ...selectedFriends];

            const newChatRef = await addDoc(collection(db, "chats"), {
                groupName: groupName.trim(),
                groupAvatar: groupPicUrl,
                isGroup: true,
                participants: participantsRoster,
                createdBy: user.uid,
                updatedAt: serverTimestamp(),
                lastMessage: `${user.displayName || "Someone"} created a message group.`,
                titles: {},
                unreadCounts: {}
            });

            setGroupName("");
            setSelectedFriends([]);
            setGroupPicUrl("");
            setShowCreateModal(false);

            navigate(`/messages/${newChatRef.id}`);
        } catch (err) {
            console.error("Failed to create group: ", err);
            alert("Error creating group chat");
        }
    };

    if (!user) {
        return (
            <div className={`dashboard-wrapper dark ${theme}`} style={{ padding: 20, textAlign: 'center' }}>
                <p>Loading user profile...</p>
            </div>
        );
    }

    return (
        <div className={`dashboard-wrapper quiz-carousel dark ${theme}`}>
            <div className="dashboard-container">
                <div className="sidebar-panel">
                    <div className="sidebar-header">
                        <h2>Messages</h2>
                        <button className="create-group-trigger-btn" onClick={() => setShowCreateModal(true)}>
                            + Group
                        </button>
                    </div>

                    <div className="chats-list-scroll">
                        {chats.length > 0 ? (
                            chats.map(chat => {
                                let dynamicChatTitle = "Direct Message";
                                let dynamicAvatar = "";

                                if (!chat.isGroup && chat.titles) {
                                    const friendId = Object.keys(chat.titles).find(id => id !== user?.uid);
                                    if (friendId) {
                                        dynamicChatTitle = chat.titles[friendId];
                                        dynamicAvatar = chat.avatarURLs?.[friendId] || "";
                                    }
                                } else if (chat.isGroup) {
                                    dynamicChatTitle = chat.groupName || "Unnamed Group";
                                    dynamicAvatar = chat.groupAvatar || "";
                                }

                                const unreadCount = chat.unreadCounts?.[user?.uid] || 0;

                                return (
                                    <div
                                        key={chat.id}
                                        className={`chat-list-card ${unreadCount > 0 ? "has-unread-messages" : ""}`}
                                        onClick={() => navigate(`/messages/${chat.id}`)}
                                    >
                                        <div className="chat-card-avatar">
                                            {dynamicAvatar ? (
                                                <img
                                                    src={dynamicAvatar}
                                                    alt={dynamicChatTitle}
                                                    style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }}
                                                />
                                            ) : (
                                                <span>
                                                    {chat.isGroup
                                                        ? dynamicChatTitle.slice(0, 2)
                                                        : dynamicChatTitle.charAt(0)
                                                    }
                                                </span>
                                            )}
                                        </div>
                                        <div className="chat-card-info">
                                            <div className="chat-card-title-row">
                                                <div className="chat-card-title">
                                                    {dynamicChatTitle}
                                                </div>
                                                {unreadCount > 0 && (
                                                    <span className="chat-unread-count-pill">
                                                        {unreadCount > 99 ? "99+" : unreadCount}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="chat-card-snippet">
                                                {chat.lastMessage || "No messages yet"}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        ) : (
                            <p className="empty-inbox-text">No chats yet</p>
                        )}
                    </div>
                </div>

                <div className="dashboard-main-view">
                    <div className="centred-hero-message">
                        <h3>Select a chat or create a new chat</h3>
                    </div>
                </div>

                {showCreateModal && (
                    <div className="modal-backdrop-overlay" onClick={() => {
                        setShowCreateModal(false);
                        setGroupPicUrl("");
                    }}>
                        <div className="group-form-modal-card" onClick={(e) => e.stopPropagation()}>
                            <h3>Create Group Chat</h3>
                            <form onSubmit={handleCreateGroupSubmit}>
                                <GroupPicUpload onUploadSuccess={(url) => setGroupPicUrl(url)} />
                                <input
                                    type="text"
                                    className="modal-text-input"
                                    placeholder="Enter Group Name"
                                    value={groupName}
                                    onChange={(e) => setGroupName(e.target.value)}
                                    maxLength={30}
                                />

                                <h4>Add Friends to group chat</h4>
                                <div className="modal-friends-checklist-scroll">
                                    {friends.length > 0 ? (
                                        friends.map(friend => (
                                            <label key={friend.id} className="friend-checkbox-row">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedFriends.includes(friend.id)}
                                                    onChange={() => handleToggleFriend(friend.id)}
                                                />
                                                <span className="checkbox-label-text">
                                                    {friend.username || friend.displayName || "Anonymous Friend"}
                                                </span>
                                            </label>
                                        ))
                                    ) : (
                                        <p className="no-friends-text">Add Friends to start chatting</p>
                                    )}
                                </div>

                                <div className="modal-action-row">
                                    <button type="submit" className="modal-save-btn">Create</button>
                                    <button
                                        type="button"
                                        className="modal-cancel-btn"
                                        onClick={() => {
                                            setShowCreateModal(false);
                                            setGroupPicUrl("");
                                        }}
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default ChatDashboard;