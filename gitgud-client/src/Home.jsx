import { Outlet, Link } from "react-router-dom";
import ProfilePage from "./ProfilePage"
import AuthPage from "./AuthPage";
import { Navigate } from "react-router-dom";

function Home({user}) {
  if(user === undefined) return <div>Loading</div>;
  if(!user) return <Navigate to="/auth" replace />

  return (   
    <Navigate to={`/profile/${user.uid}`} replace />    
    // <ProfilePage user={user}/>
  );
}

export default Home;