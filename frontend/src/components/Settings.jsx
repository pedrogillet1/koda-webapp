import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import LeftNav from './LeftNav';
import DeleteConfirmationModal from './DeleteConfirmationModal';
import FeedbackModal from './FeedbackModal';
import { useToast } from '../context/ToastContext';
import { ReactComponent as DonutIcon } from '../assets/Donut.svg';
import { ReactComponent as UserIcon } from '../assets/User.svg';
import { ReactComponent as LayersIcon } from '../assets/Layers.svg';
import { ReactComponent as KeyIcon } from '../assets/Key.svg';
import { ReactComponent as BellIcon } from '../assets/Bell-1.svg';
import { ReactComponent as SettingsFilledIcon } from '../assets/Settings-filled.svg';
import { ReactComponent as Document2Icon } from '../assets/Document 2.svg';
import { ReactComponent as ImageIcon } from '../assets/Image.svg';
import { ReactComponent as VideoIcon } from '../assets/Video.svg';
import { ReactComponent as InfoCircleIcon } from '../assets/Info circle.svg';
import { ReactComponent as XCloseIcon } from '../assets/x-close.svg';
import { ReactComponent as Right3Icon } from '../assets/Right 3.svg';
import { ReactComponent as PlusWhiteIcon } from '../assets/plus-white.svg';
import { ReactComponent as HideIcon } from '../assets/Hide.svg';
import { ReactComponent as CheckCircleIcon } from '../assets/check-circle.svg';
import { ReactComponent as CheckDoubleIcon } from '../assets/check-double_svgrepo.com.svg';
import pdfIcon from '../assets/pdf-icon.svg';
import jpgIcon from '../assets/jpg-icon.svg';
import docIcon from '../assets/doc-icon.svg';
import txtIcon from '../assets/txt-icon.svg';
import xlsIcon from '../assets/xls.svg';
import pngIcon from '../assets/png-icon.svg';
import pptxIcon from '../assets/pptx.svg';
import movIcon from '../assets/mov.svg';
import mp4Icon from '../assets/mp4.svg';
import mp3Icon from '../assets/mp3.svg';
import crownIcon from '../assets/crown.png';
import api from '../services/api';

const Settings = () => {
  const navigate = useNavigate();
  const { showSuccess, showError } = useToast();
  const [activeSection, setActiveSection] = useState('general');
  const [documents, setDocuments] = useState([]);
  const [fileData, setFileData] = useState([]);
  const [totalStorage, setTotalStorage] = useState(0);
  const [storageLimit] = useState(1024 * 1024 * 1024); // 1GB in bytes
  const [user, setUser] = useState(null);
  const [profileImage, setProfileImage] = useState(null);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [showPhoneVerification, setShowPhoneVerification] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');

  // Notification preferences
  const [accountUpdates, setAccountUpdates] = useState(true);
  const [securityAlerts, setSecurityAlerts] = useState(true);
  const [chatDocumentLinks, setChatDocumentLinks] = useState(false);
  const [uploadConfirmations, setUploadConfirmations] = useState(false);
  const [encryptionAlerts, setEncryptionAlerts] = useState(true);
  const [featureAnnouncements, setFeatureAnnouncements] = useState(false);

  // Notifications popup
  const [showNotificationsPopup, setShowNotificationsPopup] = useState(false);

  // Load notification preferences from localStorage
  useEffect(() => {
    const savedPreferences = localStorage.getItem('notificationPreferences');
    if (savedPreferences) {
      const prefs = JSON.parse(savedPreferences);
      setAccountUpdates(prefs.accountUpdates ?? true);
      setSecurityAlerts(prefs.securityAlerts ?? true);
      setChatDocumentLinks(prefs.chatDocumentLinks ?? false);
      setUploadConfirmations(prefs.uploadConfirmations ?? false);
      setEncryptionAlerts(prefs.encryptionAlerts ?? true);
      setFeatureAnnouncements(prefs.featureAnnouncements ?? false);
    }
  }, []);

  // Fetch user data
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const response = await api.get('/api/auth/me');
        const userData = response.data.user;
        setUser(userData);

        // Set form fields
        setFirstName(userData.firstName || '');
        setLastName(userData.lastName || '');
        setPhoneNumber(userData.phoneNumber || '');
        setProfileImage(userData.profileImage || null);
      } catch (error) {
        console.error('Error fetching user:', error);
      }
    };

    fetchUser();
  }, []);

  // Fetch documents and calculate statistics
  useEffect(() => {
    const fetchDocuments = async () => {
      try {
        const response = await api.get('/api/documents');
        const docs = response.data.documents || [];
        setDocuments(docs);

        // Calculate total storage
        const total = docs.reduce((sum, doc) => sum + (doc.fileSize || 0), 0);
        setTotalStorage(total);

        // Calculate file breakdown by type
        const breakdown = {
          video: { count: 0, size: 0 },
          document: { count: 0, size: 0 },
          image: { count: 0, size: 0 },
          other: { count: 0, size: 0 }
        };

        docs.forEach(doc => {
          const filename = doc.filename.toLowerCase();
          const size = doc.fileSize || 0;

          if (filename.match(/\.(mp4|avi|mov|wmv|flv|mkv|webm)$/)) {
            breakdown.video.count++;
            breakdown.video.size += size;
          } else if (filename.match(/\.(pdf|doc|docx|txt|rtf|odt)$/)) {
            breakdown.document.count++;
            breakdown.document.size += size;
          } else if (filename.match(/\.(jpg|jpeg|png|gif|bmp|svg|webp)$/)) {
            breakdown.image.count++;
            breakdown.image.size += size;
          } else {
            breakdown.other.count++;
            breakdown.other.size += size;
          }
        });

        // Format file data for chart
        const formatBytes = (bytes) => {
          if (bytes === 0) return '0 B';
          const sizes = ['B', 'KB', 'MB', 'GB'];
          const i = Math.floor(Math.log(bytes) / Math.log(1024));
          return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
        };

        setFileData([
          { name: 'Video', value: breakdown.video.count, color: '#181818', size: formatBytes(breakdown.video.size) },
          { name: 'Document', value: breakdown.document.count, color: '#000000', size: formatBytes(breakdown.document.size) },
          { name: 'Image', value: breakdown.image.count, color: '#A8A8A8', size: formatBytes(breakdown.image.size) },
          { name: 'Other', value: breakdown.other.count, color: '#D9D9D9', size: formatBytes(breakdown.other.size) }
        ]);
      } catch (error) {
        console.error('Error fetching documents:', error);
      }
    };

    fetchDocuments();
  }, []);

  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 B';
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  const getFileIcon = (doc) => {
    // Prioritize MIME type over file extension (more reliable for encrypted filenames)
    const mimeType = doc?.mimeType || '';
    const filename = doc?.filename || '';

    // ========== VIDEO FILES ==========
    if (mimeType === 'video/quicktime') return movIcon;
    if (mimeType === 'video/mp4') return mp4Icon;
    if (mimeType.startsWith('video/')) return mp4Icon;

    // ========== AUDIO FILES ==========
    if (mimeType.startsWith('audio/') || mimeType === 'audio/mpeg' || mimeType === 'audio/mp3') {
      return mp3Icon;
    }

    // ========== DOCUMENT FILES ==========
    if (mimeType === 'application/pdf') return pdfIcon;
    if (mimeType.includes('word') || mimeType.includes('msword')) return docIcon;
    if (mimeType.includes('sheet') || mimeType.includes('excel')) return xlsIcon;
    if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return pptxIcon;
    if (mimeType === 'text/plain' || mimeType === 'text/csv') return txtIcon;

    // ========== IMAGE FILES ==========
    if (mimeType.startsWith('image/')) {
      if (mimeType.includes('jpeg') || mimeType.includes('jpg')) return jpgIcon;
      if (mimeType.includes('png')) return pngIcon;
      return pngIcon;
    }

    // ========== FALLBACK: Extension-based check ==========
    if (filename) {
      const ext = filename.toLowerCase();
      if (ext.match(/\.(pdf)$/)) return pdfIcon;
      if (ext.match(/\.(doc|docx)$/)) return docIcon;
      if (ext.match(/\.(xls|xlsx)$/)) return xlsIcon;
      if (ext.match(/\.(ppt|pptx)$/)) return pptxIcon;
      if (ext.match(/\.(txt)$/)) return txtIcon;
      if (ext.match(/\.(jpg|jpeg)$/)) return jpgIcon;
      if (ext.match(/\.(png)$/)) return pngIcon;
      if (ext.match(/\.(mov)$/)) return movIcon;
      if (ext.match(/\.(mp4)$/)) return mp4Icon;
      if (ext.match(/\.(mp3|wav|aac|m4a)$/)) return mp3Icon;
    }

    return txtIcon;
  };

  const getInitials = (userData) => {
    if (!userData) return 'U';

    // Use firstName and lastName if available
    if (userData.firstName && userData.lastName) {
      return `${userData.firstName.charAt(0)}${userData.lastName.charAt(0)}`.toUpperCase();
    }

    // Use firstName only if available
    if (userData.firstName) {
      return userData.firstName.substring(0, 2).toUpperCase();
    }

    // Fallback to email
    if (userData.email) {
      const username = userData.email.split('@')[0];
      return username.substring(0, 2).toUpperCase();
    }

    return 'U';
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfileImage(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveChanges = async () => {
    setProfileError('');

    try {
      // Update user profile
      const response = await api.put('/api/users/profile', {
        firstName,
        lastName,
        phoneNumber,
        profileImage
      });

      // Check if phone verification is needed
      if (response.data.needsPhoneVerification) {
        setShowPhoneVerification(true);
        showSuccess('Verification code sent to your phone!');
      } else {
        showSuccess('Profile updated successfully!');

        // Refresh user data
        const userResponse = await api.get('/api/auth/me');
        const userData = userResponse.data.user;
        setUser(userData);

        // Update form fields with the refreshed data
        setFirstName(userData.firstName || '');
        setLastName(userData.lastName || '');
        setPhoneNumber(userData.phoneNumber || '');
        setProfileImage(userData.profileImage || null);
      }
    } catch (error) {
      console.error('Error saving profile:', error);

      // Check if it's a phone number already in use error
      if (error.response?.data?.field === 'phoneNumber' && error.response?.data?.error) {
        setProfileError(error.response.data.error);
      } else {
        showError('Failed to update profile. Please try again.');
      }
    }
  };

  const handleVerifyPhone = async () => {
    try {
      const response = await api.post('/api/users/verify-phone', {
        code: verificationCode
      });

      showSuccess('Phone number verified successfully!');
      setShowPhoneVerification(false);
      setVerificationCode('');

      // Update user with verified phone
      setUser(response.data.user);
    } catch (error) {
      console.error('Error verifying phone:', error);
      showError(error.response?.data?.error || 'Invalid verification code');
    }
  };

  const handlePasswordChange = async () => {
    try {
      // Check if new password is provided
      if (!newPassword) {
        alert('Please enter a new password');
        return;
      }

      // Validate passwords match
      if (newPassword !== confirmPassword) {
        alert('New password and confirm password do not match');
        return;
      }

      // Validate password requirements
      if (newPassword.length < 8) {
        alert('Password must be at least 8 characters');
        return;
      }

      if (!/[!@#$%^&*(),.?":{}|<>0-9]/.test(newPassword)) {
        alert('Password must contain a symbol or number');
        return;
      }

      // Check if password contains name or email
      if (user?.email?.includes(newPassword.toLowerCase()) ||
          user?.firstName?.toLowerCase().includes(newPassword.toLowerCase()) ||
          user?.lastName?.toLowerCase().includes(newPassword.toLowerCase())) {
        alert('Password must not contain your name or email');
        return;
      }

      // Call API to change password
      const requestBody = { newPassword };

      // Only include currentPassword if it's provided
      if (currentPassword) {
        requestBody.currentPassword = currentPassword;
      }

      const response = await api.put('/api/users/change-password', requestBody);

      showSuccess(response.data.message || 'Password changed successfully!');

      // Clear password fields
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      console.error('Error changing password:', error);
      const errorMessage = error.response?.data?.error || 'Failed to change password. Please try again.';
      showError(errorMessage);
    }
  };

  const handleSaveNotificationPreferences = () => {
    try {
      const preferences = {
        accountUpdates,
        securityAlerts,
        chatDocumentLinks,
        uploadConfirmations,
        encryptionAlerts,
        featureAnnouncements
      };

      // Save to localStorage
      localStorage.setItem('notificationPreferences', JSON.stringify(preferences));

      showSuccess('Notification preferences saved successfully!');
    } catch (error) {
      console.error('Error saving notification preferences:', error);
      showError('Failed to save notification preferences. Please try again.');
    }
  };

  // Get 5 most recent documents
  const recentDocuments = documents
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 5);

  const storagePercentage = (totalStorage / storageLimit) * 100;

  const handleClearCache = () => {
    setShowDeleteModal(true);
  };

  const handleConfirmClearCache = async () => {
    try {
      // Delete all documents
      const deletePromises = documents.map(doc => api.delete(`/api/documents/${doc.id}`));
      await Promise.all(deletePromises);

      // Clear localStorage
      localStorage.clear();

      // Reset state
      setDocuments([]);
      setTotalStorage(0);
      setFileData([]);

      showSuccess('Cache cleared successfully');
    } catch (error) {
      console.error('Error clearing cache:', error);
      showError('Failed to clear cache');
    } finally {
      setShowDeleteModal(false);
    }
  };

  const handleDeleteDocument = async (docId, e) => {
    e.stopPropagation(); // Prevent navigation when clicking delete
    try {
      await api.delete(`/api/documents/${docId}`);
      // Refresh documents
      const response = await api.get('/api/documents');
      const docs = response.data.documents || [];
      setDocuments(docs);

      // Recalculate storage and file breakdown
      const total = docs.reduce((sum, doc) => sum + (doc.fileSize || 0), 0);
      setTotalStorage(total);

      const breakdown = {
        video: { count: 0, size: 0 },
        document: { count: 0, size: 0 },
        image: { count: 0, size: 0 },
        other: { count: 0, size: 0 }
      };

      docs.forEach(doc => {
        const filename = doc.filename.toLowerCase();
        const size = doc.fileSize || 0;

        if (filename.match(/\.(mp4|avi|mov|wmv|flv|mkv|webm)$/)) {
          breakdown.video.count++;
          breakdown.video.size += size;
        } else if (filename.match(/\.(pdf|doc|docx|txt|rtf|odt)$/)) {
          breakdown.document.count++;
          breakdown.document.size += size;
        } else if (filename.match(/\.(jpg|jpeg|png|gif|bmp|svg|webp)$/)) {
          breakdown.image.count++;
          breakdown.image.size += size;
        } else {
          breakdown.other.count++;
          breakdown.other.size += size;
        }
      });

      setFileData([
        { name: 'Video', value: breakdown.video.count, color: '#181818', size: formatBytes(breakdown.video.size) },
        { name: 'Document', value: breakdown.document.count, color: '#000000', size: formatBytes(breakdown.document.size) },
        { name: 'Image', value: breakdown.image.count, color: '#A8A8A8', size: formatBytes(breakdown.image.size) },
        { name: 'Other', value: breakdown.other.count, color: '#D9D9D9', size: formatBytes(breakdown.other.size) }
      ]);
    } catch (error) {
      console.error('Error deleting document:', error);
    }
  };

  return (
    <div style={{ width: '100%', height: '100vh', background: '#F5F5F5', overflow: 'hidden', justifyContent: 'flex-start', alignItems: 'center', display: 'flex' }}>
      <LeftNav onNotificationClick={() => setShowNotificationsPopup(true)} />

      {/* Settings Sidebar */}
      <div style={{ width: 314, height: '100vh', padding: 20, background: 'white', borderRight: '1px #E6E6EC solid', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', gap: 20, display: 'flex' }}>
        <div style={{ alignSelf: 'stretch', height: 44, justifyContent: 'flex-start', alignItems: 'center', gap: 8, display: 'flex' }}>
          <SettingsFilledIcon style={{ width: 20, height: 20 }} />
          <div style={{ color: '#32302C', fontSize: 18, fontFamily: 'Plus Jakarta Sans', fontWeight: '700', lineHeight: '19.80px' }}>Settings</div>
        </div>

        <div style={{ alignSelf: 'stretch', flex: '1 1 0', flexDirection: 'column', justifyContent: 'space-between', alignItems: 'flex-start', display: 'flex' }}>
          <div style={{ alignSelf: 'stretch', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', display: 'flex' }}>
            {/* General */}
            <div
              onClick={() => setActiveSection('general')}
              style={{
                alignSelf: 'stretch',
                height: 44,
                paddingLeft: 14,
                paddingRight: 14,
                paddingTop: 10,
                paddingBottom: 10,
                background: activeSection === 'general' ? '#F5F5F5' : 'transparent',
                borderRadius: 12,
                justifyContent: 'space-between',
                alignItems: 'center',
                display: 'flex',
                cursor: 'pointer',
                gap: 8
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <LayersIcon style={{ width: 16, height: 16 }} />
                <div style={{ color: '#32302C', fontSize: 14, fontFamily: 'Plus Jakarta Sans', fontWeight: '600', lineHeight: '19.60px' }}>General</div>
              </div>
              <Right3Icon style={{ width: 16, height: 16 }} />
            </div>

            {/* Profile */}
            <div
              onClick={() => setActiveSection('profile')}
              style={{
                alignSelf: 'stretch',
                paddingLeft: 14,
                paddingRight: 14,
                paddingTop: 12,
                paddingBottom: 12,
                background: activeSection === 'profile' ? '#F5F5F5' : 'transparent',
                borderRadius: 12,
                justifyContent: 'space-between',
                alignItems: 'center',
                display: 'flex',
                cursor: 'pointer',
                gap: 8
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <UserIcon style={{ width: 16, height: 16 }} />
                <div style={{ color: '#32302C', fontSize: 14, fontFamily: 'Plus Jakarta Sans', fontWeight: '600', lineHeight: '19.60px' }}>Profile</div>
              </div>
              <Right3Icon style={{ width: 16, height: 16 }} />
            </div>

            {/* Password */}
            <div
              onClick={() => setActiveSection('password')}
              style={{
                alignSelf: 'stretch',
                paddingLeft: 14,
                paddingRight: 14,
                paddingTop: 12,
                paddingBottom: 12,
                background: activeSection === 'password' ? '#F5F5F5' : 'transparent',
                borderRadius: 12,
                justifyContent: 'space-between',
                alignItems: 'center',
                display: 'flex',
                cursor: 'pointer',
                gap: 8
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <KeyIcon style={{ width: 16, height: 16 }} />
                <div style={{ color: '#32302C', fontSize: 14, fontFamily: 'Plus Jakarta Sans', fontWeight: '600', lineHeight: '19.60px' }}>Password</div>
              </div>
              <Right3Icon style={{ width: 16, height: 16 }} />
            </div>

            {/* Notifications */}
            <div
              onClick={() => setActiveSection('notifications')}
              style={{
                alignSelf: 'stretch',
                paddingLeft: 14,
                paddingRight: 14,
                paddingTop: 12,
                paddingBottom: 12,
                background: activeSection === 'notifications' ? '#F5F5F5' : 'transparent',
                borderRadius: 12,
                justifyContent: 'space-between',
                alignItems: 'center',
                display: 'flex',
                cursor: 'pointer',
                gap: 8
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <BellIcon style={{ width: 16, height: 16 }} />
                <div style={{ color: '#32302C', fontSize: 14, fontFamily: 'Plus Jakarta Sans', fontWeight: '600', lineHeight: '19.60px' }}>Notifications</div>
              </div>
              <Right3Icon style={{ width: 16, height: 16 }} />
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div style={{ flex: '1 1 0', height: '100vh', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', display: 'flex' }}>
        {/* Header */}
        <div style={{ alignSelf: 'stretch', height: 84, paddingLeft: 20, paddingRight: 20, background: 'white', borderBottom: '1px #E6E6EC solid', justifyContent: 'flex-start', alignItems: 'center', gap: 12, display: 'flex' }}>
          <div style={{ textAlign: 'center', color: '#32302C', fontSize: 20, fontFamily: 'Plus Jakarta Sans', fontWeight: '700', textTransform: 'capitalize', lineHeight: '30px' }}>
            {activeSection}
          </div>
        </div>

        {/* Content */}
        {activeSection === 'general' && (
        <div style={{ alignSelf: 'stretch', flex: '1 1 0', padding: 32, overflow: 'auto', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', gap: 24, display: 'flex' }}>
          {/* Profile Card - Row 1 */}
          <div
            onClick={() => setActiveSection('profile')}
            style={{ alignSelf: 'stretch', padding: 24, background: 'white', borderRadius: 16, border: '1px #E6E6EC solid', justifyContent: 'flex-start', alignItems: 'center', gap: 20, display: 'flex', cursor: 'pointer', transition: 'background 0.2s ease' }}
            onMouseOver={(e) => e.currentTarget.style.background = '#F5F5F5'}
            onMouseOut={(e) => e.currentTarget.style.background = 'white'}
          >
            {user?.profileImage ? (
              <img
                src={user.profileImage}
                alt="Profile"
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: '50%',
                  objectFit: 'cover'
                }}
              />
            ) : (
              <div style={{
                width: 56,
                height: 56,
                borderRadius: '50%',
                background: '#181818',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontSize: 20,
                fontFamily: 'Plus Jakarta Sans',
                fontWeight: '700'
              }}>
                {user ? getInitials(user) : 'U'}
              </div>
            )}
            <div style={{ flex: '1 1 0', flexDirection: 'column', justifyContent: 'center', alignItems: 'flex-start', gap: 6, display: 'flex' }}>
              <div style={{ color: '#32302C', fontSize: 20, fontFamily: 'Plus Jakarta Sans', fontWeight: '700', lineHeight: '28px' }}>
                {user && (user.firstName || user.lastName)
                  ? `${user.firstName || ''} ${user.lastName || ''}`.trim()
                  : user?.email.split('@')[0] || 'User'}
              </div>
              <div style={{ color: '#6C6B6E', fontSize: 15, fontFamily: 'Plus Jakarta Sans', fontWeight: '500', lineHeight: '20px' }}>
                {user ? user.email : 'Loading...'}
              </div>
            </div>
          </div>

          {/* Plan and Storage Cards - Row 2 */}
          <div style={{ alignSelf: 'stretch', justifyContent: 'flex-start', alignItems: 'stretch', gap: 24, display: 'flex' }}>
            {/* Beta Access */}
            <div style={{ flex: '1 1 0', padding: 24, background: 'white', borderRadius: 16, border: '1px #E6E6EC solid', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', gap: 20, display: 'flex' }}>
              <div style={{ width: 70, height: 70, background: 'white', borderRadius: 14, border: '2px solid #181818', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <img src={crownIcon} alt="Crown" style={{ width: 60, height: 60 }} />
              </div>
              <div style={{ alignSelf: 'stretch', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', gap: 8, display: 'flex' }}>
                <div style={{ color: '#32302C', fontSize: 32, fontFamily: 'Plus Jakarta Sans', fontWeight: '700', lineHeight: '40px' }}>Beta Access</div>
                <div style={{ color: '#6C6B6E', fontSize: 14, fontFamily: 'Plus Jakarta Sans', fontWeight: '500', lineHeight: '20px' }}>
                  Early access · All features unlocked
                </div>
                <div style={{ color: '#6C6B6E', fontSize: 15, fontFamily: 'Plus Jakarta Sans', fontWeight: '500', lineHeight: '22px', marginTop: 8 }}>
                  You're part of Koda's early access program. Every search, upload, and note helps refine how Koda thinks — and how secure document intelligence should feel.
                </div>
              </div>
              <button
                onClick={() => setShowFeedbackModal(true)}
                style={{
                  width: '100%',
                  paddingLeft: 18,
                  paddingRight: 18,
                  paddingTop: 10,
                  paddingBottom: 10,
                  background: '#F5F5F5',
                  borderRadius: 100,
                  border: '1px #E6E6EC solid',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  cursor: 'pointer',
                  transition: 'background 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#E6E6EC'}
                onMouseLeave={(e) => e.currentTarget.style.background = '#F5F5F5'}
              >
                <div style={{
                  color: '#32302C',
                  fontSize: 16,
                  fontFamily: 'Plus Jakarta Sans',
                  fontWeight: '600',
                  lineHeight: '24px'
                }}>
                  Send Feedback
                </div>
              </button>
            </div>

            {/* Storage */}
            <div style={{
              flex: '1 1 0',
              padding: 24,
              background: 'white',
              borderRadius: 16,
              border: '1px #E6E6EC solid',
              flexDirection: 'column',
              justifyContent: 'flex-start',
              alignItems: 'center',
              gap: 24,
              display: 'flex',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
              cursor: 'default'
            }}
            >
              <div style={{ width: 180, height: 180, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 16 }}>
                <svg width="180" height="180" style={{ transform: 'rotate(-90deg)' }}>
                  {/* Background circle (unused storage) */}
                  <circle
                    cx="90"
                    cy="90"
                    r="74"
                    fill="none"
                    stroke="#E6E6EC"
                    strokeWidth="18"
                  />
                  {/* Progress circle (used storage) */}
                  <circle
                    cx="90"
                    cy="90"
                    r="74"
                    fill="none"
                    stroke="#181818"
                    strokeWidth="18"
                    strokeDasharray={`${2 * Math.PI * 74}`}
                    strokeDashoffset={`${2 * Math.PI * 74 * (1 - storagePercentage / 100)}`}
                    strokeLinecap="round"
                  />
                </svg>
                {/* Storage percentage text */}
                <div style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  color: '#181818',
                  fontSize: 28,
                  fontFamily: 'Plus Jakarta Sans',
                  fontWeight: '700',
                  lineHeight: '32px'
                }}>
                  {Math.round(storagePercentage)}%
                </div>
              </div>
              <div style={{ alignSelf: 'stretch', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', gap: 8, display: 'flex', paddingLeft: 8 }}>
                <div style={{ color: '#6C6B6E', fontSize: 14, fontFamily: 'Plus Jakarta Sans', fontWeight: '500', letterSpacing: '0.5px' }}>Storage</div>
                <div style={{ marginTop: 4 }}>
                  <span style={{ color: '#32302C', fontSize: 32, fontFamily: 'Plus Jakarta Sans', fontWeight: '700', lineHeight: '40px' }}>{formatBytes(totalStorage)} </span>
                  <span style={{ color: '#B9B9B9', fontSize: 32, fontFamily: 'Plus Jakarta Sans', fontWeight: '700', lineHeight: '40px' }}>/ 1GB</span>
                </div>
              </div>
            </div>
          </div>

          {/* File Breakdown and Recently Added - Row 3 */}
          <div style={{ alignSelf: 'stretch', justifyContent: 'flex-start', alignItems: 'stretch', gap: 24, display: 'flex' }}>
            {/* File Breakdown */}
            <div style={{ flex: '1 1 0', padding: 16, background: 'white', borderRadius: 20, border: '1px #E6E6EC solid', display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ color: '#101828', fontSize: 18, fontFamily: 'Plus Jakarta Sans', fontWeight: '500', lineHeight: '26px' }}>File Breakdown</div>

              {/* Semicircle Chart */}
              <div style={{ position: 'relative', width: '100%', height: 200, display: 'flex', justifyContent: 'center', alignItems: 'flex-end', pointerEvents: 'none' }}>
                <div style={{ width: '100%', height: '300px', position: 'absolute', bottom: 0 }}>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                      <Pie
                        data={fileData}
                        cx="50%"
                        cy="100%"
                        startAngle={180}
                        endAngle={0}
                        innerRadius={90}
                        outerRadius={150}
                        paddingAngle={2}
                        dataKey="value"
                        stroke="none"
                        isAnimationActive={false}
                      >
                        {fileData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div style={{ position: 'absolute', bottom: 0, left: '50%', transform: 'translateX(-50%)', zIndex: 10, textAlign: 'center' }}>
                  <div style={{ color: '#32302C', fontSize: 32, fontFamily: 'Plus Jakarta Sans', fontWeight: '700', lineHeight: '40px' }}>{documents.length} Files</div>
                  <div style={{ color: '#6C6B6E', fontSize: 14, fontFamily: 'Plus Jakarta Sans', fontWeight: '500', lineHeight: '20px' }}>Total</div>
                </div>
              </div>

              {/* File Legend - 2x2 Grid */}
              <div style={{ padding: 14, background: '#F5F5F5', borderRadius: 18, border: '1px #E6E6EC solid', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {fileData.map((item, index) => (
                  <div key={index} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 40, height: 40, background: 'white', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {item.name === 'Video' && <VideoIcon style={{ width: 20, height: 20 }} />}
                      {item.name === 'Document' && <Document2Icon style={{ width: 20, height: 20 }} />}
                      {item.name === 'Image' && <ImageIcon style={{ width: 20, height: 20 }} />}
                      {item.name === 'Other' && <InfoCircleIcon style={{ width: 20, height: 20 }} />}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <div style={{ color: '#32302C', fontSize: 14, fontFamily: 'Plus Jakarta Sans', fontWeight: '600', lineHeight: '19.60px' }}>{item.name}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ color: '#6C6B6E', fontSize: 14, fontFamily: 'Plus Jakarta Sans', fontWeight: '500', lineHeight: '15.40px' }}>{item.value} Files</div>
                        <div style={{ width: 4, height: 4, background: '#6C6B6E', borderRadius: '50%', opacity: 0.9 }} />
                        <div style={{ color: '#6C6B6E', fontSize: 14, fontFamily: 'Plus Jakarta Sans', fontWeight: '500', lineHeight: '15.40px' }}>{item.size}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Recently Added */}
            <div style={{ flex: '1 1 0', padding: 24, background: 'white', borderRadius: 16, border: '1px #E6E6EC solid', minHeight: 480, flexDirection: 'column', display: 'flex' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <div style={{ color: '#32302C', fontSize: 18, fontFamily: 'Plus Jakarta Sans', fontWeight: '700' }}>Recently Added</div>
                <button
                  onClick={() => navigate('/documents')}
                  style={{
                    padding: '8px 16px',
                    background: 'transparent',
                    border: 'none',
                    color: '#6C6B6E',
                    fontSize: 14,
                    fontFamily: 'Plus Jakarta Sans',
                    fontWeight: '600',
                    cursor: 'pointer',
                    borderRadius: 8,
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#F5F5F5';
                    e.currentTarget.style.color = '#32302C';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.color = '#6C6B6E';
                  }}
                >
                  See all
                </button>
              </div>

              {recentDocuments.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {recentDocuments.map((doc) => (
                    <div
                      key={doc.id}
                      onClick={() => navigate(`/document/${doc.id}`)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        padding: 12,
                        borderRadius: 12,
                        background: '#F5F5F5',
                        cursor: 'pointer',
                        transition: 'background 0.2s ease'
                      }}
                      onMouseOver={(e) => e.currentTarget.style.background = '#E6E6EC'}
                      onMouseOut={(e) => e.currentTarget.style.background = '#F5F5F5'}
                    >
                      <img src={getFileIcon(doc)} alt="File icon" style={{ width: 40, height: 40, aspectRatio: '1/1' }} />
                      <div style={{ flex: 1, overflow: 'hidden' }}>
                        <div style={{ color: '#32302C', fontSize: 14, fontFamily: 'Plus Jakarta Sans', fontWeight: '600', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {doc.filename}
                        </div>
                        <div style={{ color: '#6C6B6E', fontSize: 12, fontFamily: 'Plus Jakarta Sans', fontWeight: '500', marginTop: 4 }}>
                          {formatBytes(doc.fileSize)} • {new Date(doc.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{alignSelf: 'stretch', flex: '1 1 0', paddingLeft: 40, paddingRight: 40, paddingTop: 60, paddingBottom: 60, background: '#F5F5F5', overflow: 'hidden', borderRadius: 20, outline: '2px rgba(108, 107, 110, 0.40) solid', outlineOffset: '-2px', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: 32, display: 'flex'}}>
                  <Document2Icon style={{width: 80, height: 80, opacity: 0.3}} />
                  <div style={{flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'center', gap: 4, display: 'flex'}}>
                    <div style={{alignSelf: 'stretch', justifyContent: 'center', alignItems: 'flex-start', gap: 6, display: 'inline-flex'}}>
                      <div style={{color: '#32302C', fontSize: 20, fontFamily: 'Plus Jakarta Sans', fontWeight: '600', textTransform: 'capitalize', lineHeight: '30px', wordWrap: 'break-word'}}>No document yet</div>
                    </div>
                    <div style={{width: 366, textAlign: 'center', color: '#6C6B6E', fontSize: 16, fontFamily: 'Plus Jakarta Sans', fontWeight: '500', lineHeight: '24px', wordWrap: 'break-word'}}>Upload your first document. All file types supported (max 15MB)</div>
                  </div>
                  <div style={{width: 340, borderRadius: 12, justifyContent: 'center', alignItems: 'flex-start', gap: 8, display: 'inline-flex'}}>
                    <div style={{width: 166, height: 52, borderRadius: 14, justifyContent: 'flex-start', alignItems: 'flex-start', display: 'flex'}}>
                      <div
                        onClick={() => navigate('/upload-hub')}
                        style={{flex: '1 1 0', alignSelf: 'stretch', paddingLeft: 18, paddingRight: 18, paddingTop: 10, paddingBottom: 10, background: 'white', overflow: 'hidden', borderRadius: 14, outline: '1px #E6E6EC solid', outlineOffset: '-1px', justifyContent: 'center', alignItems: 'center', gap: 8, display: 'flex', cursor: 'pointer'}}>
                        <div style={{color: '#323232', fontSize: 16, fontFamily: 'Plus Jakarta Sans', fontWeight: '600', textTransform: 'capitalize', lineHeight: '24px', wordWrap: 'break-word'}}>Select Files</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
        )}

        {/* Profile Section */}
        {activeSection === 'profile' && (
          <div style={{ alignSelf: 'stretch', flex: '1 1 0', padding: 20, overflow: 'hidden', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'center', gap: 20, display: 'flex' }}>
            <div style={{ alignSelf: 'stretch', position: 'relative', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: 12, display: 'flex' }}>
              {profileImage ? (
                <img
                  src={profileImage}
                  alt="Profile"
                  style={{
                    width: 120,
                    height: 120,
                    borderRadius: '50%',
                    objectFit: 'cover',
                    border: '2px solid #E6E6EC'
                  }}
                />
              ) : (
                <div style={{
                  width: 120,
                  height: 120,
                  borderRadius: '50%',
                  background: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#181818',
                  fontSize: 48,
                  fontFamily: 'Plus Jakarta Sans',
                  fontWeight: '700',
                  border: '2px solid #E6E6EC'
                }}>
                  {user ? getInitials(user) : 'U'}
                </div>
              )}
              <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                style={{ display: 'none' }}
                id="profile-image-upload"
              />
              <label
                htmlFor="profile-image-upload"
                style={{ width: 44, height: 44, position: 'absolute', right: 'calc(50% - 82px)', bottom: 0, background: '#171717', borderRadius: 100, justifyContent: 'center', alignItems: 'center', gap: 10, display: 'flex', cursor: 'pointer' }}
              >
                <PlusWhiteIcon style={{ width: 18, height: 18 }} />
              </label>
            </div>
            <div style={{ alignSelf: 'stretch', flex: '1 1 0', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', gap: 20, display: 'flex' }}>
              <div style={{ alignSelf: 'stretch', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', display: 'flex' }}>
                <div style={{ alignSelf: 'stretch', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', gap: 6, display: 'flex' }}>
                  <div style={{ color: '#32302C', fontSize: 14, fontFamily: 'Plus Jakarta Sans', fontWeight: '600', lineHeight: '20px' }}>First Name</div>
                  <div style={{ alignSelf: 'stretch', height: 52, paddingLeft: 18, paddingRight: 18, paddingTop: 10, paddingBottom: 10, background: 'white', overflow: 'hidden', borderRadius: 14, border: '1px #E6E6EC solid', justifyContent: 'flex-start', alignItems: 'center', gap: 8, display: 'flex' }}>
                    <input
                      type="text"
                      placeholder="First Name"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      style={{ flex: '1 1 0', color: '#32302C', fontSize: 16, fontFamily: 'Plus Jakarta Sans', fontWeight: '400', lineHeight: '24px', border: 'none', outline: 'none', background: 'transparent' }}
                    />
                  </div>
                </div>
              </div>
              <div style={{ alignSelf: 'stretch', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', display: 'flex' }}>
                <div style={{ alignSelf: 'stretch', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', gap: 6, display: 'flex' }}>
                  <div style={{ color: '#32302C', fontSize: 14, fontFamily: 'Plus Jakarta Sans', fontWeight: '600', lineHeight: '20px' }}>Last Name</div>
                  <div style={{ alignSelf: 'stretch', height: 52, paddingLeft: 18, paddingRight: 18, paddingTop: 10, paddingBottom: 10, background: 'white', overflow: 'hidden', borderRadius: 14, border: '1px #E6E6EC solid', justifyContent: 'flex-start', alignItems: 'center', gap: 8, display: 'flex' }}>
                    <input
                      type="text"
                      placeholder="Last Name"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      style={{ flex: '1 1 0', color: '#32302C', fontSize: 16, fontFamily: 'Plus Jakarta Sans', fontWeight: '400', lineHeight: '24px', border: 'none', outline: 'none', background: 'transparent' }}
                    />
                  </div>
                </div>
              </div>
              <div style={{ alignSelf: 'stretch', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', display: 'flex' }}>
                <div style={{ alignSelf: 'stretch', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', gap: 6, display: 'flex' }}>
                  <div style={{ color: '#32302C', fontSize: 14, fontFamily: 'Plus Jakarta Sans', fontWeight: '600', lineHeight: '20px' }}>Email</div>
                  <div style={{ alignSelf: 'stretch', height: 52, paddingLeft: 18, paddingRight: 18, paddingTop: 10, paddingBottom: 10, background: 'white', overflow: 'hidden', borderRadius: 14, border: '1px #E6E6EC solid', justifyContent: 'flex-start', alignItems: 'center', gap: 8, display: 'flex' }}>
                    <input
                      type="email"
                      value={user ? user.email : ''}
                      readOnly
                      style={{ flex: '1 1 0', color: '#32302C', fontSize: 16, fontFamily: 'Plus Jakarta Sans', fontWeight: '400', lineHeight: '24px', border: 'none', outline: 'none', background: 'transparent' }}
                    />
                  </div>
                </div>
              </div>
              <div style={{ alignSelf: 'stretch', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', display: 'flex' }}>
                <div style={{ alignSelf: 'stretch', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', gap: 6, display: 'flex' }}>
                  <div style={{ color: '#32302C', fontSize: 14, fontFamily: 'Plus Jakarta Sans', fontWeight: '600', lineHeight: '20px' }}>Phone Number</div>
                  <div style={{ alignSelf: 'stretch', height: 52, paddingLeft: 18, paddingRight: 18, paddingTop: 10, paddingBottom: 10, background: 'white', overflow: 'hidden', borderRadius: 14, border: profileError ? '1px #DC2626 solid' : '1px #E6E6EC solid', justifyContent: 'flex-start', alignItems: 'center', gap: 8, display: 'flex' }}>
                    <input
                      type="tel"
                      placeholder="+ 112 6280 1890"
                      value={phoneNumber}
                      onChange={(e) => {
                        setPhoneNumber(e.target.value);
                        setProfileError('');
                      }}
                      style={{ flex: '1 1 0', color: '#32302C', fontSize: 16, fontFamily: 'Plus Jakarta Sans', fontWeight: '400', lineHeight: '24px', border: 'none', outline: 'none', background: 'transparent' }}
                    />
                  </div>
                  {profileError && (
                    <div style={{ color: '#DC2626', background: '#FEE2E2', padding: '12px 16px', borderRadius: 8, fontSize: 14, fontFamily: 'Plus Jakarta Sans', fontWeight: '500', alignSelf: 'stretch' }}>
                      {profileError}
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div style={{ alignSelf: 'stretch', borderRadius: 12, flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'center', gap: 24, display: 'flex' }}>
              <div style={{ alignSelf: 'stretch', height: 52, borderRadius: 14, justifyContent: 'flex-start', alignItems: 'flex-start', display: 'flex' }}>
                <div
                  onClick={handleSaveChanges}
                  style={{ flex: '1 1 0', height: 52, background: '#181818', overflow: 'hidden', borderRadius: 14, justifyContent: 'center', alignItems: 'center', display: 'flex', cursor: 'pointer' }}
                >
                  <div style={{ color: 'white', fontSize: 16, fontFamily: 'Plus Jakarta Sans', fontWeight: '600', textTransform: 'capitalize', lineHeight: '24px' }}>Save changes</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Password Section */}
        {activeSection === 'password' && (
          <div style={{ alignSelf: 'stretch', flex: '1 1 0', padding: 20, overflow: 'hidden', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'center', gap: 20, display: 'flex' }}>
            <div style={{ alignSelf: 'stretch', flex: '1 1 0', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'center', gap: 32, display: 'flex' }}>
              <div style={{ alignSelf: 'stretch', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', gap: 20, display: 'flex' }}>

                {/* Current Password */}
                <div style={{ alignSelf: 'stretch', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', display: 'flex' }}>
                  <div style={{ alignSelf: 'stretch', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', gap: 6, display: 'flex' }}>
                    <div style={{ color: '#32302C', fontSize: 14, fontFamily: 'Plus Jakarta Sans', fontWeight: '600', lineHeight: '20px' }}>Current Password (leave empty if you signed in with Google)</div>
                    <div style={{ alignSelf: 'stretch', height: 52, paddingLeft: 18, paddingRight: 18, paddingTop: 10, paddingBottom: 10, background: 'white', overflow: 'hidden', borderRadius: 14, border: '1px #E6E6EC solid', justifyContent: 'flex-start', alignItems: 'center', gap: 8, display: 'flex' }}>
                      <input
                        type={showCurrentPassword ? 'text' : 'password'}
                        placeholder="••••••••"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        style={{ flex: '1 1 0', color: '#32302C', fontSize: 16, fontFamily: 'Plus Jakarta Sans', fontWeight: '400', lineHeight: '24px', border: 'none', outline: 'none', background: 'transparent' }}
                      />
                      <div
                        onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                        style={{ cursor: 'pointer' }}
                      >
                        <HideIcon style={{ width: 20, height: 20 }} />
                      </div>
                    </div>
                  </div>
                </div>

                {/* New Password */}
                <div style={{ alignSelf: 'stretch', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', display: 'flex' }}>
                  <div style={{ alignSelf: 'stretch', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', gap: 6, display: 'flex' }}>
                    <div style={{ color: '#32302C', fontSize: 14, fontFamily: 'Plus Jakarta Sans', fontWeight: '600', lineHeight: '20px' }}>New Password</div>
                    <div style={{ alignSelf: 'stretch', height: 52, paddingLeft: 18, paddingRight: 18, paddingTop: 10, paddingBottom: 10, background: 'white', overflow: 'hidden', borderRadius: 14, border: '1px #E6E6EC solid', justifyContent: 'flex-start', alignItems: 'center', gap: 8, display: 'flex' }}>
                      <input
                        type={showNewPassword ? 'text' : 'password'}
                        placeholder="••••••••"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        style={{ flex: '1 1 0', color: '#32302C', fontSize: 16, fontFamily: 'Plus Jakarta Sans', fontWeight: '400', lineHeight: '24px', border: 'none', outline: 'none', background: 'transparent' }}
                      />
                      <div
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        style={{ cursor: 'pointer' }}
                      >
                        <HideIcon style={{ width: 20, height: 20 }} />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Confirm Password */}
                <div style={{ alignSelf: 'stretch', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', display: 'flex' }}>
                  <div style={{ alignSelf: 'stretch', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', gap: 6, display: 'flex' }}>
                    <div style={{ color: '#32302C', fontSize: 14, fontFamily: 'Plus Jakarta Sans', fontWeight: '600', lineHeight: '20px' }}>Confirm Password</div>
                    <div style={{ alignSelf: 'stretch', height: 52, paddingLeft: 18, paddingRight: 18, paddingTop: 10, paddingBottom: 10, background: 'white', overflow: 'hidden', borderRadius: 14, border: '1px #E6E6EC solid', justifyContent: 'flex-start', alignItems: 'center', gap: 8, display: 'flex' }}>
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        placeholder="••••••••"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        style={{ flex: '1 1 0', color: '#32302C', fontSize: 16, fontFamily: 'Plus Jakarta Sans', fontWeight: '400', lineHeight: '24px', border: 'none', outline: 'none', background: 'transparent' }}
                      />
                      <div
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        style={{ cursor: 'pointer' }}
                      >
                        <HideIcon style={{ width: 20, height: 20 }} />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Password Requirements */}
                <div style={{ flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', gap: 12, display: 'flex' }}>
                  <div style={{ justifyContent: 'center', alignItems: 'center', gap: 8, display: 'flex' }}>
                    <CheckCircleIcon
                      style={{
                        width: 20,
                        height: 20,
                        color: !newPassword || (!user?.email?.includes(newPassword) && !user?.firstName?.toLowerCase().includes(newPassword.toLowerCase()) && !user?.lastName?.toLowerCase().includes(newPassword.toLowerCase())) ? '#34A853' : 'rgba(50, 48, 44, 0.30)'
                      }}
                    />
                    <div style={{ color: '#32302C', fontSize: 16, fontFamily: 'Plus Jakarta Sans', fontWeight: '500', textTransform: 'capitalize', lineHeight: '24px' }}>Must not contain your name or email</div>
                  </div>
                  <div style={{ justifyContent: 'center', alignItems: 'center', gap: 8, display: 'flex' }}>
                    <CheckCircleIcon
                      style={{
                        width: 20,
                        height: 20,
                        color: newPassword.length >= 8 ? '#34A853' : 'rgba(50, 48, 44, 0.30)'
                      }}
                    />
                    <div style={{ color: '#32302C', fontSize: 16, fontFamily: 'Plus Jakarta Sans', fontWeight: '500', textTransform: 'capitalize', lineHeight: '24px' }}>At least 8 characters</div>
                  </div>
                  <div style={{ justifyContent: 'center', alignItems: 'center', gap: 8, display: 'flex' }}>
                    <CheckCircleIcon
                      style={{
                        width: 20,
                        height: 20,
                        color: /[!@#$%^&*(),.?":{}|<>0-9]/.test(newPassword) ? '#34A853' : 'rgba(50, 48, 44, 0.30)'
                      }}
                    />
                    <div style={{ color: '#32302C', fontSize: 16, fontFamily: 'Plus Jakarta Sans', fontWeight: '500', textTransform: 'capitalize', lineHeight: '24px' }}>Contains a symbol or a number</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Save Button */}
            <div style={{ alignSelf: 'stretch', borderRadius: 12, flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'center', gap: 24, display: 'flex' }}>
              <div style={{ alignSelf: 'stretch', height: 52, borderRadius: 14, justifyContent: 'flex-start', alignItems: 'flex-start', display: 'flex' }}>
                <div
                  onClick={handlePasswordChange}
                  style={{ flex: '1 1 0', height: 52, background: '#181818', overflow: 'hidden', borderRadius: 14, justifyContent: 'center', alignItems: 'center', display: 'flex', cursor: 'pointer' }}
                >
                  <div style={{ color: 'white', fontSize: 16, fontFamily: 'Plus Jakarta Sans', fontWeight: '600', textTransform: 'capitalize', lineHeight: '24px' }}>Save changes</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Notifications Section */}
        {activeSection === 'notifications' && (
          <div style={{ alignSelf: 'stretch', flex: '1 1 0', padding: 20, overflow: 'hidden', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'center', gap: 20, display: 'flex' }}>
            <div style={{ alignSelf: 'stretch', flex: '1 1 0', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'center', gap: 32, display: 'flex' }}>
              <div style={{ alignSelf: 'stretch', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', gap: 20, display: 'flex' }}>

                {/* Account Updates */}
                <div style={{ alignSelf: 'stretch', justifyContent: 'space-between', alignItems: 'flex-start', display: 'flex' }}>
                  <div style={{ flex: '1 1 0', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', gap: 4, display: 'flex' }}>
                    <div style={{ color: '#32302C', fontSize: 16, fontFamily: 'Plus Jakarta Sans', fontWeight: '600', lineHeight: '24px' }}>Account updates</div>
                    <div style={{ alignSelf: 'stretch', color: 'rgba(50, 48, 44, 0.60)', fontSize: 14, fontFamily: 'Plus Jakarta Sans', fontWeight: '500', lineHeight: '20px' }}>Get notified about important changes to your account</div>
                  </div>
                  <div
                    onClick={() => setAccountUpdates(!accountUpdates)}
                    style={{
                      width: 48,
                      height: 28,
                      padding: 2,
                      background: accountUpdates ? '#181818' : '#E6E6EC',
                      borderRadius: 100,
                      justifyContent: accountUpdates ? 'flex-end' : 'flex-start',
                      alignItems: 'center',
                      display: 'flex',
                      cursor: 'pointer',
                      transition: 'background 0.3s ease'
                    }}
                  >
                    <div style={{ width: 24, height: 24, background: 'white', borderRadius: 9999 }} />
                  </div>
                </div>

                {/* Security Alerts */}
                <div style={{ alignSelf: 'stretch', justifyContent: 'space-between', alignItems: 'flex-start', display: 'flex' }}>
                  <div style={{ flex: '1 1 0', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', gap: 4, display: 'flex' }}>
                    <div style={{ color: '#32302C', fontSize: 16, fontFamily: 'Plus Jakarta Sans', fontWeight: '600', lineHeight: '24px' }}>Security alerts</div>
                    <div style={{ alignSelf: 'stretch', color: 'rgba(50, 48, 44, 0.60)', fontSize: 14, fontFamily: 'Plus Jakarta Sans', fontWeight: '500', lineHeight: '20px' }}>Receive alerts about suspicious activity on your account</div>
                  </div>
                  <div
                    onClick={() => setSecurityAlerts(!securityAlerts)}
                    style={{
                      width: 48,
                      height: 28,
                      padding: 2,
                      background: securityAlerts ? '#181818' : '#E6E6EC',
                      borderRadius: 100,
                      justifyContent: securityAlerts ? 'flex-end' : 'flex-start',
                      alignItems: 'center',
                      display: 'flex',
                      cursor: 'pointer',
                      transition: 'background 0.3s ease'
                    }}
                  >
                    <div style={{ width: 24, height: 24, background: 'white', borderRadius: 9999 }} />
                  </div>
                </div>

                {/* Chat Document Links */}
                <div style={{ alignSelf: 'stretch', justifyContent: 'space-between', alignItems: 'flex-start', display: 'flex' }}>
                  <div style={{ flex: '1 1 0', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', gap: 4, display: 'flex' }}>
                    <div style={{ color: '#32302C', fontSize: 16, fontFamily: 'Plus Jakarta Sans', fontWeight: '600', lineHeight: '24px' }}>Chat document links</div>
                    <div style={{ alignSelf: 'stretch', color: 'rgba(50, 48, 44, 0.60)', fontSize: 14, fontFamily: 'Plus Jakarta Sans', fontWeight: '500', lineHeight: '20px' }}>Be notified when documents are mentioned in chats</div>
                  </div>
                  <div
                    onClick={() => setChatDocumentLinks(!chatDocumentLinks)}
                    style={{
                      width: 48,
                      height: 28,
                      padding: 2,
                      background: chatDocumentLinks ? '#181818' : '#E6E6EC',
                      borderRadius: 100,
                      justifyContent: chatDocumentLinks ? 'flex-end' : 'flex-start',
                      alignItems: 'center',
                      display: 'flex',
                      cursor: 'pointer',
                      transition: 'background 0.3s ease'
                    }}
                  >
                    <div style={{ width: 24, height: 24, background: 'white', borderRadius: 9999 }} />
                  </div>
                </div>

                {/* Upload Confirmations */}
                <div style={{ alignSelf: 'stretch', justifyContent: 'space-between', alignItems: 'flex-start', display: 'flex' }}>
                  <div style={{ flex: '1 1 0', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', gap: 4, display: 'flex' }}>
                    <div style={{ color: '#32302C', fontSize: 16, fontFamily: 'Plus Jakarta Sans', fontWeight: '600', lineHeight: '24px' }}>Upload confirmations</div>
                    <div style={{ alignSelf: 'stretch', color: 'rgba(50, 48, 44, 0.60)', fontSize: 14, fontFamily: 'Plus Jakarta Sans', fontWeight: '500', lineHeight: '20px' }}>Get confirmations when files are successfully uploaded</div>
                  </div>
                  <div
                    onClick={() => setUploadConfirmations(!uploadConfirmations)}
                    style={{
                      width: 48,
                      height: 28,
                      padding: 2,
                      background: uploadConfirmations ? '#181818' : '#E6E6EC',
                      borderRadius: 100,
                      justifyContent: uploadConfirmations ? 'flex-end' : 'flex-start',
                      alignItems: 'center',
                      display: 'flex',
                      cursor: 'pointer',
                      transition: 'background 0.3s ease'
                    }}
                  >
                    <div style={{ width: 24, height: 24, background: 'white', borderRadius: 9999 }} />
                  </div>
                </div>

                {/* Encryption Alerts */}
                <div style={{ alignSelf: 'stretch', justifyContent: 'space-between', alignItems: 'flex-start', display: 'flex' }}>
                  <div style={{ flex: '1 1 0', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', gap: 4, display: 'flex' }}>
                    <div style={{ color: '#32302C', fontSize: 16, fontFamily: 'Plus Jakarta Sans', fontWeight: '600', lineHeight: '24px' }}>Encryption alerts</div>
                    <div style={{ alignSelf: 'stretch', color: 'rgba(50, 48, 44, 0.60)', fontSize: 14, fontFamily: 'Plus Jakarta Sans', fontWeight: '500', lineHeight: '20px' }}>Stay informed about encryption status and key changes</div>
                  </div>
                  <div
                    onClick={() => setEncryptionAlerts(!encryptionAlerts)}
                    style={{
                      width: 48,
                      height: 28,
                      padding: 2,
                      background: encryptionAlerts ? '#181818' : '#E6E6EC',
                      borderRadius: 100,
                      justifyContent: encryptionAlerts ? 'flex-end' : 'flex-start',
                      alignItems: 'center',
                      display: 'flex',
                      cursor: 'pointer',
                      transition: 'background 0.3s ease'
                    }}
                  >
                    <div style={{ width: 24, height: 24, background: 'white', borderRadius: 9999 }} />
                  </div>
                </div>

                {/* Feature Announcements */}
                <div style={{ alignSelf: 'stretch', justifyContent: 'space-between', alignItems: 'flex-start', display: 'flex' }}>
                  <div style={{ flex: '1 1 0', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', gap: 4, display: 'flex' }}>
                    <div style={{ color: '#32302C', fontSize: 16, fontFamily: 'Plus Jakarta Sans', fontWeight: '600', lineHeight: '24px' }}>Feature announcements</div>
                    <div style={{ alignSelf: 'stretch', color: 'rgba(50, 48, 44, 0.60)', fontSize: 14, fontFamily: 'Plus Jakarta Sans', fontWeight: '500', lineHeight: '20px' }}>Learn about new features and improvements as they launch</div>
                  </div>
                  <div
                    onClick={() => setFeatureAnnouncements(!featureAnnouncements)}
                    style={{
                      width: 48,
                      height: 28,
                      padding: 2,
                      background: featureAnnouncements ? '#181818' : '#E6E6EC',
                      borderRadius: 100,
                      justifyContent: featureAnnouncements ? 'flex-end' : 'flex-start',
                      alignItems: 'center',
                      display: 'flex',
                      cursor: 'pointer',
                      transition: 'background 0.3s ease'
                    }}
                  >
                    <div style={{ width: 24, height: 24, background: 'white', borderRadius: 9999 }} />
                  </div>
                </div>

              </div>
            </div>

            {/* Save Button */}
            <div style={{ alignSelf: 'stretch', borderRadius: 12, flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'center', gap: 24, display: 'flex' }}>
              <div style={{ alignSelf: 'stretch', height: 52, borderRadius: 14, justifyContent: 'flex-start', alignItems: 'flex-start', display: 'flex' }}>
                <div
                  onClick={handleSaveNotificationPreferences}
                  style={{ flex: '1 1 0', height: 52, background: '#181818', overflow: 'hidden', borderRadius: 14, justifyContent: 'center', alignItems: 'center', display: 'flex', cursor: 'pointer' }}
                >
                  <div style={{ color: 'white', fontSize: 16, fontFamily: 'Plus Jakarta Sans', fontWeight: '600', textTransform: 'capitalize', lineHeight: '24px' }}>Save changes</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Notifications Popup Overlay */}
      {showNotificationsPopup && (
        <>
          {/* Dark Overlay */}
          <div
            onClick={() => setShowNotificationsPopup(false)}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              background: 'linear-gradient(180deg, rgba(17, 19, 21, 0.50) 0%, rgba(17, 19, 21, 0.90) 100%)',
              zIndex: 999
            }}
          />

          {/* Notifications Panel */}
          <div style={{
            width: 440,
            height: 824,
            position: 'fixed',
            left: 84,
            top: 68,
            background: 'white',
            borderRadius: 14,
            zIndex: 1000,
            paddingLeft: 20,
            paddingRight: 20,
            paddingTop: 32,
            paddingBottom: 32,
            overflow: 'auto',
            flexDirection: 'column',
            justifyContent: 'flex-start',
            alignItems: 'center',
            gap: 24,
            display: 'flex'
          }}>
            {/* Header with tabs and close button */}
            <div style={{ alignSelf: 'stretch', justifyContent: 'space-between', alignItems: 'center', gap: 10, display: 'flex' }}>
              <div style={{ flex: '1 1 0', justifyContent: 'flex-start', alignItems: 'center', gap: 8, display: 'flex' }}>
                <div style={{ height: 36, paddingLeft: 18, paddingRight: 18, paddingTop: 10, paddingBottom: 10, background: '#F5F5F5', borderRadius: 100, outline: '1px #E6E6EC solid', outlineOffset: '-1px', justifyContent: 'center', alignItems: 'center', gap: 8, display: 'flex' }}>
                  <div style={{ color: '#32302C', fontSize: 14, fontFamily: 'Plus Jakarta Sans', fontWeight: '600', lineHeight: '19.60px' }}>All (0)</div>
                </div>
                <div style={{ paddingLeft: 12, paddingRight: 12, paddingTop: 8, paddingBottom: 8, borderRadius: 6, justifyContent: 'center', alignItems: 'center', gap: 8, display: 'flex', cursor: 'pointer' }}>
                  <div style={{ color: '#6C6B6E', fontSize: 14, fontFamily: 'Plus Jakarta Sans', fontWeight: '600', lineHeight: '19.60px' }}>Unread</div>
                </div>
                <div style={{ paddingLeft: 12, paddingRight: 12, paddingTop: 8, paddingBottom: 8, borderRadius: 6, justifyContent: 'center', alignItems: 'center', gap: 8, display: 'flex', cursor: 'pointer' }}>
                  <div style={{ color: '#6C6B6E', fontSize: 14, fontFamily: 'Plus Jakarta Sans', fontWeight: '600', lineHeight: '19.60px' }}>Read</div>
                </div>
              </div>
              <div
                onClick={() => setShowNotificationsPopup(false)}
                style={{ width: 52, height: 52, padding: 8, background: '#171717', borderRadius: 100, justifyContent: 'center', alignItems: 'center', display: 'flex', cursor: 'pointer' }}
              >
                <CheckDoubleIcon style={{ width: 20, height: 20 }} />
              </div>
            </div>

            {/* No notifications message */}
            <div style={{ alignSelf: 'stretch', flex: 1, flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: 16, display: 'flex' }}>
              <BellIcon style={{ width: 64, height: 64, opacity: 0.3 }} />
              <div style={{ color: '#6C6B6E', fontSize: 16, fontFamily: 'Plus Jakarta Sans', fontWeight: '600', textAlign: 'center' }}>No notifications yet</div>
              <div style={{ color: '#B9B9B9', fontSize: 14, fontFamily: 'Plus Jakarta Sans', fontWeight: '500', textAlign: 'center', maxWidth: 300 }}>
                You're all caught up! Check back later for updates on your documents and account.
              </div>
            </div>
          </div>
        </>
      )}

      <DeleteConfirmationModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleConfirmClearCache}
        itemName="cache and all documents"
      />

      <FeedbackModal
        isOpen={showFeedbackModal}
        onClose={() => setShowFeedbackModal(false)}
      />

      {/* Phone Verification Modal */}
      {showPhoneVerification && (
        <>
          {/* Dark Overlay */}
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              background: 'rgba(0, 0, 0, 0.5)',
              zIndex: 9998
            }}
          />

          {/* Verification Modal */}
          <div style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '400px',
            background: 'white',
            borderRadius: 16,
            padding: 32,
            zIndex: 9999,
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)'
          }}>
            <h2 style={{ fontSize: 24, fontWeight: '600', marginBottom: 8, textAlign: 'center' }}>
              Verify Your Phone
            </h2>
            <p style={{ fontSize: 14, color: '#666', marginBottom: 24, textAlign: 'center' }}>
              Enter the verification code sent to {phoneNumber}
            </p>

            <input
              type="text"
              placeholder="Enter 6-digit code"
              value={verificationCode}
              onChange={(e) => setVerificationCode(e.target.value)}
              maxLength={6}
              style={{
                width: '100%',
                height: 52,
                padding: '14px 16px',
                fontSize: 16,
                border: '1px solid #E0E0E0',
                borderRadius: 8,
                outline: 'none',
                boxSizing: 'border-box',
                marginBottom: 16,
                textAlign: 'center',
                letterSpacing: '4px',
                fontSize: 24,
                fontWeight: '600'
              }}
            />

            <div style={{ display: 'flex', gap: 12 }}>
              <button
                onClick={() => {
                  setShowPhoneVerification(false);
                  setVerificationCode('');
                }}
                style={{
                  flex: 1,
                  height: 52,
                  background: '#F5F5F5',
                  border: '1px solid #E0E0E0',
                  borderRadius: 8,
                  fontSize: 16,
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleVerifyPhone}
                disabled={verificationCode.length !== 6}
                style={{
                  flex: 1,
                  height: 52,
                  background: verificationCode.length === 6 ? '#181818' : '#666',
                  color: '#FFF',
                  border: 'none',
                  borderRadius: 8,
                  fontSize: 16,
                  fontWeight: '600',
                  cursor: verificationCode.length === 6 ? 'pointer' : 'not-allowed'
                }}
              >
                Verify
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Settings;
