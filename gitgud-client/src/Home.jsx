import { Outlet, Link } from "react-router-dom";
import ProfilePage from "./ProfilePage"

function Home({user}) {
  return (
   
    <ProfilePage user={user}/>
    
  );
}

export default Home;