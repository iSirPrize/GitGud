import { useState, useEffect } from 'react';
import { db, auth } from './firebase';
import { doc, getDoc, setDoc, collectionGroup, query, where, getDocs, writeBatch, addDoc, collection, serverTimestamp, deleteDoc } from 'firebase/firestore';
import PicUpload from './PicUpload';
import './ProfilePage.css';
import { updateProfile } from 'firebase/auth';
import { useTheme } from './context/ThemeContext';
import { useParams, useNavigate } from 'react-router-dom';
import ProfileFavouritesTab from './components/ProfileFavouritesTab';
import { useSearchParams } from "react-router-dom";
import { ACHIEVEMENTS } from "./achievement";
import {FRAMES} from "./frames";
import {TITLES} from "./titles";

function ProfilePage({ user, targetUser })
{
    const { profileId } = useParams();
    const { theme } = useTheme();    
    const navigate = useNavigate();
    const targetId = profileId || user?.uid;
    const isOwner = user?.uid === targetId;
    const [isEditing, setIsEditing]   = useState(false);
    const [username, setUsername]     = useState("");
    const [aboutMe, setAboutMe]       = useState("");
    const [loading, setLoading]       = useState(true);
    const [saving, setSaving]         = useState(false);
    const [profilePic, setProfilePic] = useState("");    
    const [friends, setFriends] = useState([]);
    const [requests, setRequests] = useState([]);
    const [friendStatus, setFriendStatus] = useState("none");
    const [searchParams] = useSearchParams();
    const [activeTab, setActiveTab] = useState( searchParams.get("tab") || "overview" );
    const [equippedAchievements, setEquippedAchievements] = useState([]);
    const canViewAchievements = isOwner || friendStatus === "friend";
    const canViewFavourites = isOwner;
    const [equippedFrame, setEquippedFrame] = useState(null);
    const [equippedTitle, setEquippedTitle] = useState(null);
    const [titleFont, setTitleFont] = useState("default");

    useEffect(() => {
        async function loadProfileData() {
            if (!targetId)
            {
                console.log("no targetId")
                return;
            }
            setLoading(true);
            setIsEditing(false);
            setUsername("");
            setAboutMe("")
            setProfilePic("");

            try {
                console.log("attempting fetch doc", targetId);
                const docRef  = doc(db, "users", targetId);
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    console.log("doc found ", docSnap.data());
                    const data = docSnap.data();
                    setAboutMe(data.aboutMe || "");
                    const fallbackName = isOwner ? (user?.displayName || "new user") : "unknown user";
                    setUsername(data.username || user.displayName || "");
                    const fallbackPic = isOwner ? user?.photoURL : "";
                    setProfilePic(data.photoURL || user.photoURL || "");
                    setEquippedAchievements( data.equippedAchievement || []);
                    setEquippedFrame( data.equippedFrame || null );
                    setEquippedTitle( data.equippedTitle || null );
                    setTitleFont( data.titleFont || "default");
                } else
                { 
                    console.log("no doc exists")
                    if(isOwner)
                    {
                        console.log("user is I");                
                        setUsername(user.displayName || "");
                        setProfilePic(user.photoURL || "");
                    }                
                }
            } catch (err) {
                console.error("Error loading profile", err);
            } finally {
                setLoading(false);
            }
        }
        loadProfileData();
    }, [targetId, user, isOwner]);
    
    //friend request grabber so user can add people if we want
    useEffect(() => {
        if(!targetId || !user?.uid) return;

        setFriends([]);
        setRequests([]);
        setFriendStatus("none");

        const fetchFriends = async () => {
            try{
                const q = query(collection(db, "users", targetId, "friends"));
                const snap = await getDocs(q);
                const friendsList = snap.docs.map(doc => ({ id: doc.id, ...doc.data()}));
                setFriends(friendsList);

                if(friendsList.some(f => f.id === user.uid))
                {
                    setFriendStatus("friend");
                }
            }catch(err) {
                console.error("Fetch friends failed: ", err);
            }
        };

        const fetchRequests = async () => {
            try{
                if(isOwner)
                {
                    const q = query(collection(db, "friendRequests"), where("to", "==", user.uid), where("status", "==", "pending"));
                    const snap = await getDocs(q);
                    setRequests(snap.docs.map(doc => ({ id : doc.id, ...doc.data() })));
                } else {
                    const q = query(
                        collection(db, "friendRequests"),
                        where("from", "==", user.uid),
                        where("to", "==", targetId),
                        where("status", "==", "pending")
                    );

                    const snap = await getDocs(q);
                    if(!snap.empty)
                    {
                        setFriendStatus("pending");
                    }
                }
            } catch(err)
            {
                console.error("Requests failed: ", err);
            }
        };

        fetchFriends();
        fetchRequests();
    }, [targetId, user?.uid, isOwner]);

    //adding add friend functionality with db updatess
    const handleAddFriend = async () => {
        try
        {
            await addDoc(collection(db, "friendRequests"), {
                from: user.uid,
                fromName: user.displayName || "",
                fromPhoto: user.photoURL || "",
                to: targetId,
                status: "pending",
                timestamp: serverTimestamp()
            });

            try {
                const notifRef = await addDoc(collection(db, "users", targetId, "notifications"), {
                    type: "friend_request",
                    senderName: user.displayName || "Someone",
                    isRead: false,
                    timestamp: serverTimestamp()
                });

                fetch('http://localhost:3001/api/notifications/schedule-notification', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        userId: targetId,
                        notificationId: notifRef.id,
                        type: "friend_request",
                        senderName: user.displayName || "Someone"
                    })
                }).catch(err => console.error("Server scheduler connection failed:", err));

            } catch (notifErr) {
                console.error("Failed to add bell notification for friend request:", notifErr);
            }

            setFriendStatus("pending")
            alert("Friend request sent");
        } catch(err) {
            console.error("Failed to send friend request", err);
        }
    }

    const handleAcceptFriend = async(req) => {
        try{
            const batch = writeBatch(db);

            const myFriendRef = doc(db, "users", user.uid, "friends", req.from);
            batch.set(myFriendRef, {
                id: req.from,
                username: req.fromName,
                photoURL: req.fromPhoto || "",
            });

            const thierFriendRef = doc(db, "users", req.from, "friends", user.uid);
            batch.set(thierFriendRef, {
                id: user.uid,
                username: user.displayName || "",
                photoURL: user.photoURL || "",
            });

            batch.delete(doc(db, "friendRequests", req.id));
            await batch.commit();

            setRequests(prev => prev.filter(r => r.id !== req.id));
            setFriends(prev => [...prev, { id: req.from, username: req.fromName, photoURL: req.fromPhoto}]);
        } catch(err) {
            console.error("accept failed", err);
        }
    }

    //forgot to add a decline :^)
    const handleDeclineFriend = async (req) =>
    {
        try {
            await deleteDoc(doc(db, "friendRequests", req.id));

            setRequests((prev) => prev.filter((item) => item.id !== req.id));
            console.log("Request declined");
        } catch(err){
            console.error("Error declineing friend request", err);
            alert("Failed to decline request");
        }
    }

    const handleRemoveFriend = async () => {
        if(!window.confirm("are you sure you want to remove this friend?")) return;

        try{
            const thierFriendRef = doc(db, "users", targetId, "friends", user.uid);
            await deleteDoc(thierFriendRef);

            const myFriendRef = doc(db, "users", user.uid, "friends", targetId);
            await deleteDoc(myFriendRef);

            setFriendStatus("none");
            setFriends((prev) => prev.filter((f) => f.id !== targetId));

            alert("Friend removed");
        } catch(err) {
            console.error("error removing friend: ", err);
            alert("Failed to remove friend. Please try again.")
        }
    }

    const backfillComments = async (newUsername, newPhotoURL) => {
        try {
            const commentsQuery = query(
                collectionGroup(db, "comments"),
                where("userId", "==", user.uid)
            );
            const snapshot = await getDocs(commentsQuery);

            if (snapshot.empty) return;

            const BATCH_SIZE = 400;
            const docs = snapshot.docs;

            for (let i = 0; i < docs.length; i += BATCH_SIZE) {
                const batch = writeBatch(db);
                docs.slice(i, i + BATCH_SIZE).forEach((d) => {
                    batch.update(d.ref, {
                        userName:  newUsername,
                        userPhoto: newPhotoURL,
                    });
                });
                await batch.commit();
            }

            console.log(`Backfilled ${docs.length} comment(s) with updated profile.`);
        } catch (err) {
            console.error("Comment backfill failed:", err);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await updateProfile(auth.currentUser, { 
                displayName: username,
                photoURL: profilePic 
            });

            await setDoc(doc(db, "users", user.uid), {
                username:  username,
                aboutMe:   aboutMe,
                photoURL:  profilePic,
                updatedAt: serverTimestamp(),
            }, { merge: true });

            await backfillComments(username, profilePic);

            setIsEditing(false);
            alert("Profile Updated");
        } catch (err) {
            console.error(err);
            alert(`Profile failed to update: ${err.message}`);
        } finally {
            setSaving(false);
        }
    };

    const handleStartChat = async () => {
        if(!user?.uid || !targetId) {
            console.error("Navigation IDs missing: ", { myId: user?.uid, targetId });
            return;
        }
        
        const customChatId = user.uid < targetId 
            ? `${user.uid}_${targetId}` 
            : `${targetId}_${user.uid}`;

        try {
            const chatRef = doc(db, "chats", customChatId);
            const chatSnap = await getDoc(chatRef);

            if(!chatSnap.exists()) {
                let targetName = username || "Friend";
                let targetPhoto = profilePic || "";
                
                try {
                    const targetUserRef = doc(db, "users", targetId);
                    const targetUserSnap = await getDoc(targetUserRef);

                    if(targetUserSnap.exists()) {
                        const data = targetUserSnap.data();
                        targetName = data.username || data.displayName || "Friend";
                        targetPhoto = data.photoURL || "";
                    }
                } catch(profileErr) {
                    console.warn("Realtime DB failed: ", profileErr);
                }

                const myName = auth.currentUser?.displayName || user.displayName || "User";
                const myPhoto = auth.currentUser?.photoURL || user.photoURL || "";

                await setDoc(chatRef, {
                    id: customChatId,
                    chatId: customChatId,
                    participants: [user.uid, targetId],
                    isGroup: false,
                    updatedAt: serverTimestamp(),
                    lastMessage: "",
                    titles: {
                        [user.uid]: myName,
                        [targetId]: targetName
                    },
                    avatarURLs: {
                        [user.uid]: myPhoto,
                        [targetId]: targetPhoto
                    }
                });
            }
            
            console.log("Navigating to room ID:", customChatId);
            navigate(`/messages/${customChatId}`);
        } catch(err) {
            console.error("start chat failed: ", err);
            alert(`Could not start chat thread: ${err.message}`);
        }
    };

    if (loading) {
        return <div className="profile-container dark">Loading...</div>;
    }

    const activeFrame = FRAMES.find( frame => frame.id === equippedFrame ); // Get the full frame data for the equipped frame ID
    const equippedTitleData = TITLES.find( title => title.id === equippedTitle );

    return (
        <div className={`profile-container quiz-carousel dark ${theme}`}>
            <div className="profile-header-container">
                <div className="profile-header">
                    <div className="avatar-wrapper">

  {activeFrame && (
    <img
      src={activeFrame.image}
      alt=""
      className="profile-frame"
    />
  )}

  <div className="avatar">
    {profilePic
      ? <img src={profilePic} alt="Profile" />
      : (
        <span>
          {username.charAt(0) || "G"}
        </span>
      )}
  </div>

</div>

                    {isEditing && isOwner && (
                        <div className="avatar-edit">
                            <PicUpload onUploadSuccess={(url) => setProfilePic(url)} />
                        </div>
                    )}
                </div>

                <div>
                    {isEditing ? (
    <input
        className="profile-input"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        placeholder="Enter Username"
    />
) : (
    <>
      <h1 className="username-display">
        {username || "Set a Username"}
      </h1>

      {equippedTitleData && (
        <div
          className={`profile-title font-${titleFont}`}
        >
          {equippedTitleData.title}
        </div>
      )}
    </>
)}
                </div>
            </div>

            <div className="about-section">
                <h3>About Me</h3>
                {isEditing ? (
                    <textarea
                        className="profile-textarea"
                        value={aboutMe}
                        onChange={(e) => setAboutMe(e.target.value)}
                        placeholder="Tell us about yourself."
                        rows={10}
                    />
                ) : (
                    <p className="about-text">{aboutMe || (isOwner ? "Empty, like your teammates brains. Click edit to update." : "This user doesn't know how to edit profile")}</p>
                )}
            </div>

            <div className="profile-actions">
                {isOwner ? (
                    <div className="owner-controls">
                        <div className="main-btns">
                            {isEditing ? (
                                <>
                                    <button className="save-btn" onClick={handleSave} disabled={saving}>
                                        {saving ? "Saving" : "Save Profile"}
                                    </button>
                                    <button className="cancel-btn" onClick={() => setIsEditing(false)}>Cancel</button>
                                </>
                            ) : (
                                <button className="edit-btn" onClick={() => setIsEditing(true)}>Edit Profile</button>
                            )}      
                                                                                                                                                
                        </div>
                    
                        {requests.length > 0 && !isEditing && (
                            <div className="request-panel">
                                <h4>Pending Requests ({requests.length})</h4>
                                {requests.map((req) => (
                                    <div key={req.id} className="request-card">
                                        <div className="request-info">
                                            <div className="request-avatar">
                                                {req.fromPhoto ? (
                                                    <img src={req.fromPhoto} alt="avatar" />
                                                ) : (
                                                    <div className="thumb-placeholder">{req.fromName?.[0] || ""}</div>
                                                )}
                                            </div>
                                            <span className="request-name">{req.fromName}</span>
                                        </div>
                                        <div className="request-actions">
                                            <button className="accept-btn" onClick={() => handleAcceptFriend(req)}>Accept</button>
                                            <button className="decline-btn" onClick={() => handleDeclineFriend(req)}>Decline</button>                                    
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                ) : (
                    user && (
                        <div className="visitor-controls">
                            {friendStatus === "friend" ? (
                                <div className="friend-actions-wrapper">
                                    <button className="message-btn" onClick={handleStartChat}>Message</button>
                                    <button className="remove-btn" onClick={handleRemoveFriend}>Remove Friend</button>                                    
                                </div>    
                            ) : friendStatus === "pending" ? (
                                <button className="pending-btn" disabled>Request Sent</button>
                            ) : (
                                <button className="add-friend-btn" onClick={handleAddFriend}>Add Friend</button>
                            )}
                        </div>
                    )
                )}
            </div>

            {!isEditing && (
  <>
    <hr className="divider" />

    <div className="profile-tabs">
      <button
        className={activeTab === "overview" ? "tab-btn active" : "tab-btn"}
        onClick={() => setActiveTab("overview")}
      >
        Overview
      </button>

     {canViewAchievements && (
    <button
      className={activeTab === "achievements"
        ? "tab-btn active"
        : "tab-btn"}
      onClick={() => setActiveTab("achievements")}
    >
      Achievements
    </button>
  )}

      {isOwner && (
  <button
    className={activeTab === "favourites"
      ? "tab-btn active"
      : "tab-btn"}
    onClick={() => setActiveTab("favourites")}
  >
    Favourite Clips
  </button>
)}
    </div>

    {activeTab === "overview" && (
      <div className="friends-section">
        <h3>Friends ({friends.length})</h3>
        <div className="friends-grid">
          {friends.length > 0 ? (
            friends.map((friend) => (
              <div
                key={friend.id}
                className="friend-item"
                onClick={() => navigate(`/profile/${friend.id}`)}
              >
                <div className="friend-thumb">
                  {friend.photoURL ? (
                    <img src={friend.photoURL} alt={friend.username} />
                  ) : (
                    <div className="thumb-placeholder">
                      {friend.username?.charAt(0)}
                    </div>
                  )}
                </div>
                <span className="friend-name">{friend.username}</span>
              </div>
            ))
          ) : (
            <p className="no-friends-text">Friends List is Empty</p>
          )}
        </div>
      </div>
    )}

    {activeTab === "achievements" &&
 canViewAchievements && (

  <div className="achievements-section">

    <h3 className="equipped-heading">
  Equipped Achievements
</h3>

    <div className="equipped-grid">

      {equippedAchievements.length > 0 ? (
        equippedAchievements.map(id => {

          const achievement =
            ACHIEVEMENTS.find(
              a => a.id === id
            );

          if (!achievement) return null;

          return (
            <div
  key={id}
  className="achievement-badge"
>
  <div className="badge-icon">
    {achievement.icon}
  </div>

  <div className="badge-name">
    {achievement.name}
  </div>

   <div className="badge-tooltip">
    {achievement.description}
  </div>
</div>
          );
        })
      ) : (
        <p>
          No achievements equipped. How Boring!
        </p>
      )}

    </div>

  </div>
)} 

    {/* Favourites tab: saved clips */}
    {activeTab === "favourites" && isOwner && (
  <div className="favourites-section">
    <h3>Favourite Clips</h3>
    <ProfileFavouritesTab uidProp={targetId} />
  </div>
)}
  </>
)}
        </div>
    );
}

export default ProfilePage;