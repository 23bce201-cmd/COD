import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { Login } from "./components/screens/auth/Login";
import { AdminDashboard } from "./components/screens/dashboards/AdminDashboard";
import { EmployeeDashboard } from "./components/screens/dashboards/EmployeeDashboard";
import { ClientDashboard } from "./components/screens/dashboards/ClientDashboard";
import { ManagerDashboard } from "./components/screens/dashboards/ManagerDashboard";
import { PageSpinner } from "./components/ui/LoadingSkeletons";
import { Toaster } from "./components/ui/sonner";

import { ReactNode } from "react";

/**
 * Route guard — checks authentication and role access.
 * Accepts one or more allowed roles.
 */
function AuthGuard({
    children,
    allowedRoles,
}: {
    children: ReactNode;
    allowedRoles?: ("admin" | "manager" | "employee" | "client")[];
}) {
    const { user, loading } = useAuth();
    const location = useLocation();

    if (loading) {
        return <PageSpinner />;
    }

    if (!user) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    if (allowedRoles && !allowedRoles.includes(user.role)) {
        // Wrong role — redirect to their dashboard
        return <Navigate to={getDashboardPath(user.role)} replace />;
    }

    return <>{children}</>;
}

/**
 * Returns the dashboard path for a given role.
 */
function getDashboardPath(role: string): string {
    switch (role) {
        case "admin":
            return "/admin/dashboard";
        case "manager":
            return "/manager/dashboard";
        case "employee":
            return "/employee/dashboard";
        case "client":
            return "/client/dashboard";
        default:
            return "/login";
    }
}

function SmartRedirect() {
    const { user, loading } = useAuth();

    if (loading) return <PageSpinner />;

    if (!user) return <Navigate to="/login" replace />;
    return <Navigate to={getDashboardPath(user.role)} replace />;
}



function AppRoutes() {
    return (
        <div className="min-h-screen flex" style={{ backgroundColor: "#F1F5F9" }}>
            <main className="flex-1 overflow-auto">
                <Routes>
                    <Route path="/" element={<SmartRedirect />} />
                    <Route path="/login" element={<Login />} />

                    {/* Admin routes */}
                    <Route
                        path="/admin/*"
                        element={
                            <AuthGuard allowedRoles={["admin"]}>
                                <AdminDashboard />
                            </AuthGuard>
                        }
                    />
                    <Route
                        path="/agency/*"
                        element={
                            <AuthGuard allowedRoles={["admin"]}>
                                <Navigate to="/admin/dashboard" replace />
                            </AuthGuard>
                        }
                    />
                    <Route
                        path="/manager/*"
                        element={
                            <AuthGuard allowedRoles={["manager"]}>
                                <ManagerDashboard />
                            </AuthGuard>
                        }
                    />
                    <Route
                        path="/employee/*"
                        element={
                            <AuthGuard allowedRoles={["employee"]}>
                                <EmployeeDashboard />
                            </AuthGuard>
                        }
                    />

                    {/* Client routes */}
                    <Route
                        path="/client/*"
                        element={
                            <AuthGuard allowedRoles={["client"]}>
                                <ClientDashboard />
                            </AuthGuard>
                        }
                    />

                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
            </main>
        </div>
    );
}

export default function App() {
    return (
        <AuthProvider>
            <BrowserRouter>
                <AppRoutes />
                <Toaster />
            </BrowserRouter>
        </AuthProvider>
    );
}
