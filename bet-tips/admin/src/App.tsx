import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./auth/AuthContext";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Tokens from "./pages/Tokens";
import Uploads from "./pages/Uploads";
import Schema from "./pages/Schema";

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
        <Route path="/uploads" element={<Uploads />} />
        <Route path="/schema" element={<Schema />} />
        <Route path="*" element={<Navigate to="/tokens" replace />} />
      </Routes>
    </Layout>
  );
};

export default App;
