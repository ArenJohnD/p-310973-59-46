
import {
  BrowserRouter,
  Routes,
  Route,
} from "react-router-dom";
import Index from "@/pages/Index";
import Login from "@/pages/Login";
import Admin from "@/pages/Admin";
import NotFound from "@/pages/NotFound";
import { AuthProvider } from "@/context/AuthContext";
import { Toaster } from "@/components/ui/toaster"
import PolicyDocuments from "@/pages/PolicyDocuments";
import PDFViewer from "@/pages/PDFViewer";

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/login" element={<Login />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/policy/:id" element={<PolicyDocuments />} />
          <Route path="/policy-viewer/:id" element={<PDFViewer />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
        <Toaster />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
