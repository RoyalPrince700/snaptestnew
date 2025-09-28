import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import logo from '../assets/snaptest-logo.png'

const Navbar = ({ onMenuClick }) => {
  const { user, isAuthenticated, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/')
  }

  return (
    <nav className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo and Brand */}
          <div className="flex items-center">
            <button
              type="button"
              onClick={onMenuClick}
              className="mr-3 p-2 rounded-md text-gray-500 hover:text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 lg:hidden"
              aria-label="Open sidebar"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
              </svg>
            </button>
            <Link to="/" className="flex items-center space-x-2">
              <img src={logo} alt="SnapTest Logo" className="h-8 w-auto" />
              <span className="text-xl font-bold text-gray-900">SnapTest</span>
            </Link>
          </div>

          {/* Navigation */}
          <div className="flex items-center space-x-4">
            {isAuthenticated ? (
              // Logged in state
              <div className="flex items-center space-x-4">
                {/* Mobile: Only show username */}
                <span className="text-sm text-gray-700 lg:hidden">
                  {(user?.profile?.firstName || user?.username)?.charAt(0).toUpperCase() + (user?.profile?.firstName || user?.username)?.slice(1)}
                </span>
                {/* Desktop: Show username and logout button */}
                <span className="hidden text-sm text-gray-700 lg:inline">
                  {(user?.profile?.firstName || user?.username)?.charAt(0).toUpperCase() + (user?.profile?.firstName || user?.username)?.slice(1)}
                </span>
                <button
                  onClick={handleLogout}
                  className="hidden lg:px-4 lg:py-2 lg:text-sm lg:font-medium lg:text-gray-700 lg:bg-gray-100 lg:hover:bg-gray-200 lg:rounded-md lg:transition-colors"
                >
                  Logout
                </button>
              </div>
            ) : (
              // Logged out state
              <div className="flex items-center space-x-3">
                <Link
                  to="/login"
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
                >
                  Sign In
                </Link>
                <Link
                  to="/register"
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors"
                >
                  Sign Up
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  )
}

export default Navbar
