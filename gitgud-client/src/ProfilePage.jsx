import { useState, useEffect } from 'react';
import { db, auth } from './firebase';
import { doc, getDoc, setDoc, collectionGroup, query, where, getDocs, writeBatch, addDoc, collection, serverTimestamp, deleteDoc } from 'firebase/firestore';
import PicUpload from './PicUpload';
import './ProfilePage.css';
import { updateProfile } from 'firebase/auth';
import { useTheme } from './context/ThemeContext';
import { useParams, useNavigate } from 'react-router-dom';

function ProfilePage({ user })
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
    }, [targetId, user?.uid, isOwner]);
    
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
    const handleDeclineFriend = async (requestId) =>
    {
        try {
            await deleteDoc(doc(db, "friendRequests", requestId));

            setRequests((prev) => prev.filter((req) => req.id !== requestId));
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

    // ── Backfill all past comments with new username/photo ────────────────
    // This fixes the "old comments still show old name/avatar" problem.
    const backfillComments = async (newUsername, newPhotoURL) => {
        try {
            // collectionGroup queries ALL "comments" subcollections across every quiz
            const commentsQuery = query(
                collectionGroup(db, "comments"),
                where("userId", "==", user.uid)
            );
            const snapshot = await getDocs(commentsQuery);

            if (snapshot.empty) return;

            // Firestore batch limit is 500 writes — chunk if needed
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
            // Non-fatal — profile still saves even if backfill fails
            console.error("Comment backfill failed:", err);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            // 1. Update Firebase Auth display name
            await updateProfile(auth.currentUser, { 
                displayName: username,
                photoURL: profilePic 
            });

            // 2. Save profile to Firestore (include photoURL so it persists)
            await setDoc(doc(db, "users", user.uid), {
                username:  username,
                aboutMe:   aboutMe,
                photoURL:  profilePic,   // FIX: was missing, caused photo to get dropped on save
                updatedAt: serverTimestamp(),
            }, { merge: true });

            // 3. Backfill all past comments with new name + photo
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

    if (loading) {
        return <div className="profile-container dark">Loading...</div>;
    }

    return (
        <div className={`profile-container quiz-carousel dark ${theme}`}>
            <div className="profile-header-container">
                <div className="profile-header">
                    <div className="avatar">
                        {profilePic
                            ? <img src={profilePic} alt="Profile" />
                            : ( <span>{username.charAt(0) || "G"}</span>
                        )}
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
                        <h1 className="username-display">{username || "Set a Username"}</h1>
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
                                <button className="remove-btn" onClick={handleRemoveFriend}>Remove Friend</button>
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
                                                <div className="thumb-placeholder">{friend.username?.charAt(0)}</div>
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
                </>
            )}
        </div>
    );
}

export default ProfilePage;
