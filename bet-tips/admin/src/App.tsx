import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./auth/AuthContext";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Tokens from "./pages/Tokens";
import Users from "./pages/Users";
import Uploads from "./pages/Uploads";
import Assets from "./pages/Assets";
import Admins from "./pages/Admins";

const App = () => {
  const { me, loading } = useAuth();
  if (loading) return <div style={{ padding: 32 }}>Loading…</div>;
  if (!me) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }
  return (
    <Layout>
      <Routes>
        <Route path="/tokens" element={<Tokens />} />
        <Route path="/users" element={<Users />} />
        <Route path="/uploads" element={<Uploads />} />
        <Route path="/assets" element={<Assets />} />
        <Route path="/admins" element={<Admins />} />
        <Route path="*" element={<Navigate to="/tokens" replace />} />
      </Routes>
    </Layout>
  );
};

export default App;
