import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { db } from "./firebase";
import { collection, query, orderBy, onSnapshot, writeBatch, doc } from "firebase/firestore";
import { useTheme } from "./context/ThemeContext";
import "./NotificationBell.css";

export default function NotificationBell({ user }) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const ref = useRef();
  const navigate = useNavigate();
  const { theme } = useTheme();

  // firebase event listener for notifs
  useEffect(() => {
    if (!user?.uid) return;

    const notifRef = collection(db, "users", user.uid, "notifications");
    const q = query(notifRef, orderBy("timestamp", "desc"));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const notifList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setNotifications(notifList);
    }, (error) => {
      console.error("Notification listener failed: ", error);
    });

    return () => unsubscribe();
  }, [user?.uid]);

  const clearNotificationsFromDb = async () => {
    if (notifications.length === 0 || !user?.uid) return;

    try {
      const batch = writeBatch(db);
      notifications.forEach((n) => {
        const docRef = doc(db, "users", user.uid, "notifications", n.id);
        batch.delete(docRef);

        const jobKey = n.chatId || n.id;
        fetch('http://localhost:3001/api/notifications/cancel-notification', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jobKey })
        }).catch(err => console.error("Failed to cancel server job:", err));
      });
      await batch.commit();
      setNotifications([]);
      console.log("🧼 Database notifications scrubbed clean.");
    } catch (err) {
      console.error("Failed to delete notifications during cleanup:", err);
    }
  };

  // QM listener for event when user clicks away
  useEffect(() => {
    const handleOutsideClick = async (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        if (open) {
          setOpen(false);
          await clearNotificationsFromDb();
        }
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [open, notifications, user?.uid]);

  // Handle manual clicking of the bell icon toggle
  const handleToggleBell = async () => {
    const nextOpenState = !open;
    setOpen(nextOpenState);

    // If we close the bell, clear out the notifications
    if (!nextOpenState) {
      await clearNotificationsFromDb();
    }
  };

  // Handle clicking a specific notification
  const handleNotifClick = async (notif) => {
    setOpen(false);
    
    //clear notifs
    await clearNotificationsFromDb();

    //navigation for notifs
    if (notif.type === "unread_message" && notif.chatId) {
      navigate(`/messages/${notif.chatId}`);
    } else if (notif.type === "comment_reply" && notif.quizId) {
      navigate(`/quiz/${notif.quizId}`);
    } else if (notif.type === "friend_request") {
      navigate(`/profile/${user.uid}?tab=overview`);
    } else if (notif.link) {
      navigate(notif.link);
    }
  };

  if (!user) return null;

  const unreadCount = notifications.filter(n => !n.isRead).length;

  return (
    <div ref={ref} className={`notif-bell-container ${theme === "dark" ? "dark" : "light"}`}>
      <button onClick={handleToggleBell} className="notif-bell-btn" title="Notifications">        
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
        </svg>

        {unreadCount > 0 && (
          <div className="notif-badge">
            {unreadCount}
          </div>
        )}
      </button>

      {/* below is for when you open the dropdown for notfibell */}
      {open && (
        <div className="notif-dropdown">
          <div className="notif-header">
            <span className="notif-header-title">Notifications</span>
            {unreadCount > 0 && <span className="notif-indicator">● {unreadCount} new</span>}
          </div>

          <div className="notif-feed">
            {notifications.length === 0 ? (
              <div className="notif-empty">No notifications yet</div>
            ) : (
              notifications.map((notif) => (
                <div 
                  key={notif.id}
                  onClick={() => handleNotifClick(notif)}
                  className={`notif-item ${notif.isRead ? 'read' : 'unread'}`}
                >
                  <div className="notif-item-content">
                    {notif.type === "unread_message" && (
                      <div>
                        <span className="notif-type-icon">💬</span>
                        <strong>{notif.senderName}</strong> sent a message: 
                        <span className="notif-snippet"> "{notif.messageSnippet}"</span>
                      </div>
                    )}
                    {notif.type === "friend_request" && (
                      <div>
                        <span className="notif-type-icon">👥</span>
                        <strong>{notif.senderName}</strong> sent you a friend request!
                      </div>
                    )}                   
                    
                    {notif.type === "comment_reply" && (
                      <div>
                        <span className="notif-type-icon">🎮</span>
                        <strong>{notif.senderName}</strong> replied to your comment: 
                        <span className="notif-snippet"> "{notif.replySnippet}"</span>
                      </div>
                    )}

                    {!notif.type && <div>{notif.text || "New notification"}</div>}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}