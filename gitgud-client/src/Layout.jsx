import { Outlet, NavLink } from "react-router-dom";
import DarkModeToggle from "./components/DarkModeToggle";
import "./NavBar.css"
import { useTheme } from './context/ThemeContext';


function Layout() {
  const { theme } = useTheme();

  return (
  <div className={`quiz-carousel ${theme?.toLowerCase?.()}`}>
    
    {/* Sidebar */}
    <div className={`sidebar`}>
      <div className="sidebar-content">
        <NavLink
          to="/"
          className={({ isActive }) =>
            isActive ? "practice active" : "practice"
          }
        >
          Home
        </NavLink>

        <NavLink
          to="/practice"
          className={({ isActive }) =>
            isActive ? "practice active" : "practice"
          }
        >
          Practice
        </NavLink>

        <NavLink
          to="/quiz"
          className={({ isActive }) =>
            isActive ? "practice active" : "practice"
          }
        >
          Quiz
        </NavLink>
      </div>
    </div>

    {/* Main content */}
    <section id="center" className={theme}>
      <div style={{ position: 'absolute', top: '16px', right: '16px' }}>
        <DarkModeToggle />
      </div>
      <Outlet />
    </section>

  </div>
);
}

export default Layout;