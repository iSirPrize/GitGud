import { Outlet, Link } from "react-router-dom";
import ProfilePage from "./ProfilePage"
import AuthPage from "./AuthPage";

function Home({user}) {
  if(!user) return <AuthPage />

  return (   
    <ProfilePage user={user}/>    
  );
}

export default Home;