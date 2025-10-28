import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { DocumentsProvider } from './context/DocumentsContext';
import { logPerformanceMetrics } from './utils/performance';
import './styles/safari-fixes.css';
import Login from './components/Login';
import SignUp from './components/Signup';
import Authentication from './components/Authentication';
import PhoneNumber from './components/PhoneNumber';
import Verification from './components/Verification';
import VerifyEmail from './components/VerifyEmail';
import PhoneNumberPending from './components/PhoneNumberPending';
import VerificationPending from './components/VerificationPending';
import Upload from './components/Upload';
import ForgotPassword from './components/ForgotPassword';
import ForgotPasswordCode from './components/ForgotPasswordCode';
import SetNewPassword from './components/SetNewPassword';
import PasswordChanged from './components/PasswordChanged';
import ChatScreen from './components/ChatScreen';
import OAuthCallback from './components/OAuthCallback';
import ProtectedRoute from './components/ProtectedRoute';
import Documents from './components/Documents';
import DocumentsPage from './components/DocumentsPage';
import Dashboard from './components/Dashboard';
import CategoryDetail from './components/CategoryDetail';
import DocumentViewer from './components/DocumentViewer';
import UploadHub from './components/UploadHub';
import Settings from './components/Settings';
import Upgrade from './components/Upgrade';

function App() {
  // Log performance metrics on mount (development only)
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      window.addEventListener('load', () => {
        setTimeout(() => {
          logPerformanceMetrics();
        }, 1000);
      });
    }
  }, []);

  return (
    <AuthProvider>
      <DocumentsProvider>
        <Router>
          <div style={{ width: '100vw', height: '100vh' }}>
            <Routes>
            <Route path="/" element={<Login />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<SignUp />} />
            <Route path="/authentication" element={<Authentication />} />
            <Route path="/verify-email" element={<VerifyEmail />} />
            <Route path="/phone-number-pending" element={<PhoneNumberPending />} />
            <Route path="/verification-pending" element={<VerificationPending />} />
            <Route path="/auth/callback" element={<OAuthCallback />} />
            <Route path="/phone-number" element={<PhoneNumber />} />
            <Route path="/verification" element={<Verification />} />
            <Route path="/upload" element={<ProtectedRoute><Upload /></ProtectedRoute>} />
            <Route path="/upload-hub" element={<ProtectedRoute><UploadHub /></ProtectedRoute>} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/forgot-password-code" element={<ForgotPasswordCode />} />
            <Route path="/reset-password" element={<SetNewPassword />} />
            <Route path="/set-new-password" element={<SetNewPassword />} />
            <Route path="/password-changed" element={<PasswordChanged />} />
            <Route path="/chat" element={<ProtectedRoute><ChatScreen /></ProtectedRoute>} />
            <Route path="/home" element={<ProtectedRoute><Documents /></ProtectedRoute>} />
            <Route path="/documents" element={<ProtectedRoute><DocumentsPage /></ProtectedRoute>} />
            <Route path="/category/:categoryName" element={<ProtectedRoute><CategoryDetail /></ProtectedRoute>} />
            <Route path="/folder/:folderId" element={<ProtectedRoute><CategoryDetail /></ProtectedRoute>} />
            <Route path="/document/:documentId" element={<ProtectedRoute><DocumentViewer /></ProtectedRoute>} />
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
            <Route path="/upgrade" element={<ProtectedRoute><Upgrade /></ProtectedRoute>} />
          </Routes>
          </div>
        </Router>
      </DocumentsProvider>
    </AuthProvider>
  );
}

export default App;
