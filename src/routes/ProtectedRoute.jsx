/*
 * Route guards used in App.jsx. Each one either shows the nested pages (<Outlet />)
 * or redirects the person somewhere else.
 */
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Loading } from "../components/ui";
import { ROLE_HOME } from "../utils/format";

/** Everything below this route needs a signed-in user. */
export function RequireAuth() {
  const { user, loading } = useAuth();
  const location = useLocation();
  // Wait until the saved session has been checked, otherwise a signed-in person would be bounced to /login.
  if (loading) return <Loading text="Restoring your session…" />;
  // Not signed in: go to /login and remember the page they wanted (state.from).
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  return <Outlet />;
}

/**
 * Everything below this route is limited to the given roles. This only improves the
 * experience; the backend enforces the same rules on every API call.
 */
export function RequireRole({ roles }) {
  const { user } = useAuth();
  // Wrong role: send them to their own dashboard instead of showing an error.
  if (!roles.includes(user.role)) return <Navigate to={ROLE_HOME[user.role]} replace />;
  return <Outlet />;
}

/** "/" sends each role to its own dashboard. */
export function RoleHome() {
  const { user, loading } = useAuth();
  if (loading) return <Loading />;
  return <Navigate to={user ? ROLE_HOME[user.role] : "/login"} replace />;
}
