import { Outlet, Link } from "react-router-dom";
import DarkModeToggle from "./components/DarkModeToggle";
import "./App.css"

function Layout() {
  return (
    <>
      {/* Sidebar */}
      <div className="sidebar">
        <div className="sidebar-content">
          <Link to="/" className="practice">Home</Link>
          <Link to="/practice" className="practice">Practice</Link>
          <Link to="/quiz" className="practice">Quiz</Link>
        </div>
      </div>

      {/* Main content */}
      <section id="center">
        {/* Dark mode stays global */}
        <div style={{ position: 'absolute', top: '16px', right: '16px' }}>
          <DarkModeToggle />
        </div>
        <Outlet />
      </section>
    </>
  );
}

export default Layout;