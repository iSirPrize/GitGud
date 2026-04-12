import { Outlet, Link } from "react-router-dom";
import PicUpload from './PicUpload'

function Homepage() {
  return (
    <>
      <h1>Home</h1>
      <p>Welcome to GitGud 🚀</p>
       <PicUpload />
    </>
  );
}

export default Homepage;