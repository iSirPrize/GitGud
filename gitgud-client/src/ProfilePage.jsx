import { useState, useEffect } from 'react';
import { db, auth } from './firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import PicUpload from './PicUpload';
import './ProfilePage.css';
import { updateProfile } from 'firebase/auth';
import { useTheme } from './context/ThemeContext';

function ProfilePage({ user })
{
    const [isEditing, setIsEditing] = useState(false);
    const [username, setUsername] = useState(user?.displayName || "");
    const [aboutMe, setAboutMe] = useState("");
    const [loading, setLoading] = useState(true);
    const [profilePic, setProfilePic] = useState(user?.photoURL || "");
    const { theme } = useTheme();

    useEffect(() =>
    {
        async function loadProfileData()
        {
            if(!user?.uid)
            {
                return
            }

            try
            {
                const docRef = doc(db, "users", user.uid);
                const docSnap = await getDoc(docRef);

                if(docSnap.exists())
                {
                    setAboutMe(docSnap.data().aboutMe || "");
                    setUsername(docSnap.data().username || user.displayName || "");
                    setProfilePic(docSnap.data().photoURL || user.photoURL || "");
                }
            } catch(err){
                console.error("Error loading profile", err);
            } finally {
                setLoading(false);
            }
        }

            loadProfileData();
    }, [user]);

    const handleSave = async() => 
    {
        try
        {
            await updateProfile(auth.currentUser, { displayName : username});
            await setDoc(doc(db, "users", user.uid),
            {
                username: username,
                aboutMe: aboutMe,
                updatedAt: new Date()
            }, { merge : true});

            setIsEditing(false);
            alert("Profile Updated");
        } catch(err) {
            console.error(err);
            alert(`Profile failed to update: ${err.message}`);
        }
    };

    if(loading)
    {
        return(
            <div className="profile-container dark">Loading...</div>
        );
    }

    return (
        <div className={`profile-container quiz-carousel dark ${theme}`}>
            <div>                
                <div className="profile-header">
                    <div className="avatar">
                        {profilePic ? <img src={profilePic} alt="Profile" /> : <span>{username.charAt(0) || "G"}</span>}
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
                        <button className="save-btn" onClick={handleSave}>Save Profile</button>
                        <button className="cacnel-btn" onClick={() => setIsEditing(false)}>Cancel Changes</button>
                    </>
                ) : (
                    <button className="edit-btn" onClick={() => setIsEditing(true)}>Edit Profile</button>
                )}
            </div>

            <hr className="divider" />
        </div>
    );
}

export default ProfilePage;