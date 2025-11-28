import React, { useState, useEffect } from 'react';
import axios from 'axios';
import PhoneInput from 'react-phone-number-input';
import 'react-phone-number-input/style.css';
import '../styles/RecoveryVerificationBanner.css';

const RecoveryVerificationBanner = () => {
  const [verificationStatus, setVerificationStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [notification, setNotification] = useState(null);
  const [showPhoneModal, setShowPhoneModal] = useState(false);

  useEffect(() => {
    fetchVerificationStatus();
  }, []);

  const fetchVerificationStatus = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      const response = await axios.get(
        `${process.env.REACT_APP_API_URL || 'http://localhost:5000'}/api/recovery-verification/status`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
       );
      console.log('📊 [Banner] Verification status received:', response.data);
      setVerificationStatus(response.data);
    } catch (error) {
      console.error('Error fetching verification status:', error);
    } finally {
      setLoading(false);
    }
  };

  const showNotification = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 5000);
  };

  const handleSendEmailVerification = async () => {
    setSending(true);
    try {
      const token = localStorage.getItem('accessToken');
      await axios.post(
        `${process.env.REACT_APP_API_URL || 'http://localhost:5000'}/api/recovery-verification/send-email-link`,
        {},
        {
          headers: { Authorization: `Bearer ${token}` },
        }
       );
      showNotification('Verification email sent! Check your inbox.');
    } catch (error) {
      showNotification(error.response?.data?.error || 'Failed to send verification email', 'error');
    } finally {
      setSending(false);
    }
  };

  const handleSendPhoneVerification = async () => {
    setSending(true);
    try {
      const token = localStorage.getItem('accessToken');
      await axios.post(
        `${process.env.REACT_APP_API_URL || 'http://localhost:5000'}/api/recovery-verification/send-phone-link`,
        {},
        {
          headers: { Authorization: `Bearer ${token}` },
        }
       );
      showNotification('Verification SMS sent! Check your phone.');
    } catch (error) {
      showNotification(error.response?.data?.error || 'Failed to send verification SMS', 'error');
    } finally {
      setSending(false);
    }
  };

  const handleAddPhone = () => {
    setShowPhoneModal(true);
  };

  // Don't render if loading or both channels are verified
  if (loading) {
    console.log('📊 [Banner] Not rendering - still loading');
    return null;
  }
  if (!verificationStatus) {
    console.log('📊 [Banner] Not rendering - no verification status');
    return null;
  }
  if (verificationStatus.isEmailVerified && verificationStatus.isPhoneVerified) {
    console.log('📊 [Banner] Not rendering - both email and phone verified');
    return null;
  }

  // Determine banner content based on verification status
  let bannerContent = null;

  console.log('📊 [Banner] Checking conditions:', {
    isEmailVerified: verificationStatus.isEmailVerified,
    isPhoneVerified: verificationStatus.isPhoneVerified,
    hasPhone: verificationStatus.hasPhone
  });

  if (!verificationStatus.isEmailVerified && verificationStatus.isPhoneVerified) {
    // Phone verified, email not verified
    console.log('📊 [Banner] Showing: Verify email (phone verified)');
    bannerContent = {
      icon: '📧',
      title: 'Verify your recovery email',
      body: `Add a second way to regain access. We'll send a verification link to ${verificationStatus.maskedEmail}.`,
      ctaText: 'Send verification link',
      ctaAction: handleSendEmailVerification,
    };
  } else if (verificationStatus.isEmailVerified && !verificationStatus.hasPhone) {
    // Email verified, no phone added
    console.log('📊 [Banner] Showing: Add phone');
    bannerContent = {
      icon: <span style={{ fontSize: 40, display: 'inline-block', transform: 'rotate(-15deg)', filter: 'drop-shadow(2px 4px 6px rgba(0, 0, 0, 0.2))' }}>📱</span>,
      title: 'Add a recovery phone',
      body: 'Use your phone as a second way to recover your account.',
      ctaText: 'Add phone',
      ctaAction: handleAddPhone,
    };
  } else if (verificationStatus.isEmailVerified && verificationStatus.hasPhone && !verificationStatus.isPhoneVerified) {
    // Email verified, phone added but not verified
    console.log('📊 [Banner] Showing: Verify phone');
    bannerContent = {
      icon: <span style={{ fontSize: 40, display: 'inline-block', transform: 'rotate(-15deg)', filter: 'drop-shadow(2px 4px 6px rgba(0, 0, 0, 0.2))' }}>📱</span>,
      title: 'Verify your recovery phone',
      body: `Add a second way to regain access. We'll send a verification link to ${verificationStatus.maskedPhone}.`,
      ctaText: 'Send verification link',
      ctaAction: handleSendPhoneVerification,
    };
  }

  if (!bannerContent) {
    console.log('📊 [Banner] Not rendering - no matching condition');
    return null;
  }

  return (
    <>
      <div className="recovery-verification-banner">
        <div className="banner-icon">{bannerContent.icon}</div>
        <div className="banner-content">
          <h3 className="banner-title">{bannerContent.title}</h3>
          <p className="banner-body">{bannerContent.body}</p>
        </div>
        <button
          className="banner-cta"
          onClick={bannerContent.ctaAction}
          disabled={sending}
        >
          {sending ? 'Sending...' : bannerContent.ctaText}
        </button>
      </div>

      {notification && (
        <div className={`notification ${notification.type}`}>
          {notification.message}
        </div>
      )}

      {showPhoneModal && (
        <AddPhoneModal
          onClose={() => setShowPhoneModal(false)}
          onSuccess={() => {
            setShowPhoneModal(false);
            fetchVerificationStatus();
            showNotification('Phone number added! Verification SMS sent.');
          }}
          onError={(message) => showNotification(message, 'error')}
        />
      )}
    </>
  );
};

// Phone number input modal component
const AddPhoneModal = ({ onClose, onSuccess, onError }) => {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const token = localStorage.getItem('accessToken');

      // Add phone number
      await axios.post(
        `${process.env.REACT_APP_API_URL || 'http://localhost:5000'}/api/recovery-verification/add-phone`,
        { phoneNumber },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
       );

      // Send verification SMS
      await axios.post(
        `${process.env.REACT_APP_API_URL || 'http://localhost:5000'}/api/recovery-verification/send-phone-link`,
        {},
        {
          headers: { Authorization: `Bearer ${token}` },
        }
       );

      onSuccess();
    } catch (error) {
      onError(error.response?.data?.error || 'Failed to add phone number');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="phone-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Add Recovery Phone</h2>
          <button className="close-button" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="phoneNumber">Phone Number</label>
            <PhoneInput
              international
              defaultCountry="US"
              value={phoneNumber}
              onChange={setPhoneNumber}
              placeholder="234 567 8900"
              className="phone-input-field"
              disabled={submitting}
            />
            <p className="form-hint">Select your country and enter your phone number</p>
          </div>
          <div className="modal-actions">
            <button
              type="button"
              className="button-secondary"
              onClick={onClose}
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="button-primary"
              disabled={submitting}
            >
              {submitting ? 'Adding...' : 'Add Phone'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RecoveryVerificationBanner;
