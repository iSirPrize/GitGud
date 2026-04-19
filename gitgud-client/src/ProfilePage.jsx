// ProfilePage.jsx
// Place at: gitgud-client/src/ProfilePage.jsx

import { useState, useEffect } from 'react';
import { db, auth } from './firebase';
import { doc, getDoc, setDoc, collectionGroup, query, where, getDocs, writeBatch } from 'firebase/firestore';
import PicUpload from './PicUpload';
import './ProfilePage.css';
import { updateProfile } from 'firebase/auth';
import { useTheme } from './context/ThemeContext';

function ProfilePage({ user })
{
    const [isEditing, setIsEditing]   = useState(false);
    const [username, setUsername]     = useState(user?.displayName || "");
    const [aboutMe, setAboutMe]       = useState("");
    const [loading, setLoading]       = useState(true);
    const [saving, setSaving]         = useState(false);
    const [profilePic, setProfilePic] = useState(user?.photoURL || "");
    const { theme } = useTheme();

    useEffect(() => {
        async function loadProfileData() {
            if (!user?.uid) return;
            try {
                const docRef  = doc(db, "users", user.uid);
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    setAboutMe(docSnap.data().aboutMe || "");
                    setUsername(docSnap.data().username || user.displayName || "");
                    setProfilePic(docSnap.data().photoURL || user.photoURL || "");
                }
            } catch (err) {
                console.error("Error loading profile", err);
            } finally {
                setLoading(false);
            }
        }
        loadProfileData();
    }, [user]);

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
            await updateProfile(auth.currentUser, { displayName: username });

            // 2. Save profile to Firestore (include photoURL so it persists)
            await setDoc(doc(db, "users", user.uid), {
                username:  username,
                aboutMe:   aboutMe,
                photoURL:  profilePic,   // FIX: was missing, caused photo to get dropped on save
                updatedAt: new Date(),
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
            <div>
                <div className="profile-header">
                    <div className="avatar">
                        {profilePic
                            ? <img src={profilePic} alt="Profile" />
                            : <span>{username.charAt(0) || "G"}</span>
                        }
                    </div>

                    {isEditing && (
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
                    <p className="about-text">{aboutMe || "Empty, like your teammates brains."}</p>
                )}
            </div>

            <div className="profile-actions">
                {isEditing ? (
                    <>
                        <button className="save-btn" onClick={handleSave} disabled={saving}>
                            {saving ? "Saving…" : "Save Profile"}
                        </button>
                        <button className="cacnel-btn" onClick={() => setIsEditing(false)} disabled={saving}>
                            Cancel Changes
                        </button>
                    </>
                ) : (
                    <button className="edit-btn" onClick={() => setIsEditing(true)}>
                        Edit Profile
                    </button>
                )}
            </div>

            <hr className="divider" />
        </div>
    );
}

export default ProfilePage;
