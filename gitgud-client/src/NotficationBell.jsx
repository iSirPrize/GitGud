import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { db } from "./firebase";
import { collection, query, orderBy, onSnapshot, writeBatch, doc } from "firebase/firestore";
import { useTheme } from "./context/ThemeContext";
import "./NotificationBell.css";

export default function NotificationBell({ user }) {
    const [open, setOpen] = useState(false)
    const [notifications, setNotifications] = useState([])
    const ref = useRef()
    const navigate = useNavigate()
    const { theme } = useTheme()

    //QM real time listener
    useEffect(() => {
    if (!user?.uid) return

    const notifRef = collection(db, "users", user.uid, "notifications")
    const q = query(notifRef, orderBy("timestamp", "desc"))

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const notifList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
      setNotifications(notifList)
    }, (error) => {
      console.error("Notification listener failed: ", error)
    })

    return () => unsubscribe()
  }, [user?.uid])

  //QM listener for event when user clicks away
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener("mousedown", handleOutsideClick)
    return () => document.removeEventListener("mousedown", handleOutsideClick)
  }, [])

  const handleToggleBell = async () => {
    const nextOpenState = !open
    setOpen(nextOpenState)

    const unreadNotifs = notifications.filter(n => !n.isRead)
    if (nextOpenState && unreadNotifs.length > 0 && user?.uid) {
      try {
        const batch = writeBatch(db)
        unreadNotifs.forEach((n) => {
          const docRef = doc(db, "users", user.uid, "notifications", n.id)
          batch.update(docRef, { 
            isRead: true,
            "pendingEmail.status": "cancelled",
            "pendingEmail.message": null 
          })
        })
        await batch.commit()
      } catch (err) {
        console.error("Failed to clear notifications:", err)
      }
    }
  }

  if (!user) return null

  const unreadCount = notifications.filter(n => !n.isRead).length

  return (
    <div ref={ref} className={`notif-bell-container ${theme === "dark" ? "dark" : "light"}`}>
      
      <button onClick={handleToggleBell} className="notif-bell-btn" title="Notifications">        
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
        </svg>

        {unreadCount > 0 && (
          <div className="notif-badge">
            {unreadCount}
          </div>
        )}
      </button>

      {open && (
        <div className="notif-dropdown">
          <div className="notif-header">
            <span>Notifications</span>
            {unreadCount > 0 && <span className="notif-indicator">● {unreadCount} new</span>}
          </div>

          <div className="notif-feed">
            {notifications.length === 0 ? (
              <div className="notif-empty">No notifications yet</div>
            ) : (
              notifications.map((notif) => (
                <div 
                  key={notif.id}
                  onClick={() => {
                    if (notif.link) navigate(notif.link)
                    setOpen(false)
                  }}
                  className={`notif-item ${notif.isRead ? 'read' : 'unread'}`}
                >
                  <div>{notif.text}</div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}