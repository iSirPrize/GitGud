import { useState } from "react";
import { auth } from "./firebase";
import { useTheme } from "./context/ThemeContext";

function GroupPicUpload({ onUploadSuccess }) {
    const [file, setFile] = useState(null);
    const [preview, setPreview] = useState(null);
    const [message, setMessage] = useState('');
    const { theme } = useTheme();

    const handleFileChange = (e) => {
        const selected = e.target.files[0];
        if (selected) {
            setFile(selected);
            setPreview(URL.createObjectURL(selected));
        }
    };

    const handleUpload = async () => {
        const userId = auth.currentUser?.uid || "anonymous";

        if (!file) {
            setMessage("Select appropriate file");
            return;
        }

        setMessage("Uploading group avatar...");

        try {
            const formData = new FormData();
            formData.append("file", file);
            formData.append("upload_preset", import.meta.env.VITE_CLOUDINARY_PRESET);
            formData.append("folder", `group_avatars/${userId}`);

            const response = await fetch(
                `https://api.cloudinary.com/v1_1/${import.meta.env.VITE_CLOUDINARY_CLOUD_NAME}/image/upload`,                
                {
                    method: "POST",
                    body: formData,
                }
            );

            if (!response.ok) {
                const errorData = await response.json();
                console.error("Cloudinary error: ", errorData);
                throw new Error(errorData.error?.message || "Cloudinary upload failed");
            }

            const data = await response.json();
            const downloadURL = data.secure_url;

            if (onUploadSuccess) {
                onUploadSuccess(downloadURL);
            }
            setMessage("Group image uploaded successfully!");
        } catch (err) {
            console.error(err);
            setMessage("Upload failed: " + err.message);
        }
    };

    return (
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.1)', marginBottom: '15px' }}>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px', width: '100%', justifyContent: 'center' }}>
                <div style={{ width: '55px', height: '55px', borderRadius: '50%', overflow: 'hidden', background: '#333', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #555', flexShrink: 0 }}>
                    {preview ? (
                        <img src={preview} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                        <span style={{ fontSize: '0.75rem', fontWeight: 'bold', textTransform: 'uppercase', color: '#aaa' }}>GRP</span>
                    )}
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', alignItems: 'flex-start' }}>
                    <input 
                        type="file" 
                        accept="image/jpeg, image/jpg, image/png" 
                        onChange={handleFileChange} 
                        style={{ fontSize: '0.8rem', maxWidth: '180px' }}
                    />
                    {file && (
                        <button 
                            type="button" 
                            onClick={handleUpload} 
                            style={{ padding: '4px 10px', fontSize: '0.75rem', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                        >
                            Upload Image
                        </button>
                    )}
                </div>
            </div>
            
            {message && (
                <p style={{ fontSize: '0.75rem', margin: '4px 0 0 0', fontWeight: 'bold', color: message.toLowerCase().includes('failed') ? '#ff4a4a' : '#4aff4a' }}>
                    {message}
                </p>
            )}
        </div>
    );
}

export default GroupPicUpload;