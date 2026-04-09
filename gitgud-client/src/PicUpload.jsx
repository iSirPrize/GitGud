import { useState } from "react";

function PicUpload()
{
    const [file, setFile] = useState(null);
    const [preview, setPreview] = useState(null);
    const [message, setMessage] = useState('');
    //using a forced user til our user creation is done
    const currentUser = "GitGudAdmin";

    const handleFileChange = (e) => {
        const selected = e.target.files[0];

        if(selected)
        {
            setFile(selected);
            setPreview(URL.createObjectURL(selected));
        }
    };

    const handleUpload = async () => {
        if(!file)
        {
            return;
        }

        const formData = new FormData();
        formData.append('ProfilePic', file);

        try
        {
            const response = await fetch('http://localhost:3001/api/upload', {
                method: 'POST',
                headers: {
                    'useriddata': currentUser
                },
                body: formData,
            });

            const data = await response.json();

            if(response.ok)
            {
                setMessage(`Image uploaded Successfully`);
            }
            else
            {
                setMessage(`Error: ${data.message}`);
            }
        }catch (err){
            setMessage("Server error")
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