import { useState } from "react";
import { db, auth } from "./firebase";
import { updateProfile } from 'firebase/auth';
import { doc, updateDoc} from "firebase/firestore"


function PicUpload({ onUploadSuccess })
{
    const [file, setFile] = useState(null);
    const [preview, setPreview] = useState(null);
    const [message, setMessage] = useState('');

    const handleFileChange = (e) => {
        const selected = e.target.files[0];

        if(selected)
        {
            setFile(selected);
            setPreview(URL.createObjectURL(selected));
        }
    };

    const handleUpload = async () => {

        const userId = auth.currentUser?.uid || "";

        if(!file)
        {
            setMessage("Select appropriate file");
            return;
        }

        setMessage("Uploading");

        try
        {
            const formData = new FormData();
            formData.append("file", file);
            formData.append("upload_preset", import.meta.env.VITE_CLOUDINARY_PRESET);
            formData.append("folder", `avatars/${userId}`);

            const response = await fetch(
                `https://api.cloudinary.com/v1_1/${import.meta.env.VITE_CLOUDINARY_CLOUD_NAME}/image/upload`,                
                {
                    method: "POST",
                    body: formData,
                }
            );

            if(!response.ok)
            {
                const errorData = await response.json();
                console.error("Cloudinary error: ", errorData);
                throw new Error(errorData.error?.message || "Cloudinary upload failed")
            }

            const data = await response.json();
            const downloadURL = data.secure_url;

            if(onUploadSuccess)
            {
                onUploadSuccess(downloadURL);
            }
            const userDoc = doc(db, "users", userId);
            await updateDoc(userDoc, { photoURL: downloadURL});
            await updateProfile(auth.currentUser, { photoURL: downloadURL});

            setMessage("image updated successfully");

        } catch(err) {
            console.error(err);
            setMessage("upload failed: " + err.message);
        }
    };

    return (
        <div style={{ textAlign: 'center', padding: '16px' }}>
            <h2>Update Profile Picture</h2>

            <div style={{ marginBottom: '16px' }}>
                {preview ? (
                    <img src={preview} alt="Preview" style={{ width: 150, borderRadius: '25%'}} />
                ) : (
                    <div style={{ width: 150, height: 150, margin: '0 auto'}}>No Image</div>
                )}
            </div>

            <input type="file" accept="image/jpeg, image/jpg, image/png" onChange={handleFileChange} />
            <button onClick={handleUpload}>Save Image</button>
            <p>{message}</p>
        </div>
    );
}

export default PicUpload;