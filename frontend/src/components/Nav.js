import { Link } from 'react-router-dom'
import { useLogout } from '../hooks/useLogout'
import { useAuthContext } from '../hooks/useAuthContext'

const Nav = () => {
    const { logout } = useLogout()
    const { user } = useAuthContext()

    return (
        <header>
            <div className="container">
                <Link to="/">
                    <h1>Fitness Planner</h1>
                </Link>
                <nav>
                    {user && (
                        <div>
                            <span>{user.email}</span>
                            <button onClick={logout}>Log out</button>
                        </div>
                    )}
                    {!user && (
                        <div>
                            <Link to="/login">Login</Link>
                            <Link to="/signup">Signup</Link>
                        </div>
                    )}
                </nav>
            </div>
        </header>
    )
}

export default Nav