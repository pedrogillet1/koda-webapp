import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import api from '../services/api';

function ForgotPassword() {
  const location = useLocation();
  const navigate = useNavigate();

  const { maskedEmail, maskedPhone, hasPhone, canUseEmail = true, canUsePhone, hasUnverifiedPhone } = location.state || {};

  const [selectedMethod, setSelectedMethod] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    console.log('🔐 [ForgotPassword] Component mounted');
    console.log('📧 [ForgotPassword] maskedEmail:', maskedEmail);
    console.log('📱 [ForgotPassword] maskedPhone:', maskedPhone);
    console.log('🔑 [ForgotPassword] location.state:', location.state);

    const sessionToken = sessionStorage.getItem('resetSessionToken');
    console.log('🗝️  [ForgotPassword] sessionToken in sessionStorage:', sessionToken ? sessionToken.substring(0, 20) + '...' : 'NOT FOUND');

    if (!maskedEmail) {
      console.warn('⚠️  [ForgotPassword] No maskedEmail found, redirecting to /recover-access');
      navigate('/recover-access');
    }
  }, [maskedEmail, navigate, maskedPhone, location.state]);

  const handleContinue = async () => {
    if (!selectedMethod) {
      setError('Please select a verification method');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const sessionToken = sessionStorage.getItem('resetSessionToken');

      if (!sessionToken) {
        setError('Session expired. Please start over.');
        setTimeout(() => navigate('/recover-access'), 2000);
        return;
      }

      // Send reset LINK (not code) via selected method
      const response = await api.post('/api/auth/send-reset-link', {
        sessionToken,
        method: selectedMethod
      });

      if (response.data.success) {
        navigate('/forgot-password-verification', {
          state: {
            method: selectedMethod,
            maskedEmail,
            maskedPhone
          }
        });
      }
    } catch (error) {
      console.error('Send reset link error:', error);

      if (error.response?.data?.error) {
        setError(error.response.data.error);
      } else {
        setError('Failed to send reset link. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      background: '#FFF',
      position: 'relative'
    }}>
      {/* Back Button */}
      <button
        onClick={() => navigate('/recover-access')}
        style={{
          position: 'absolute',
          top: '24px',
          left: '24px',
          background: 'none',
          border: 'none',
          fontSize: '16px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          color: '#000',
          padding: 0
        }}
      >
        ← Back
      </button>

      {/* Content Container */}
      <div style={{
        width: '100%',
        maxWidth: '400px',
        margin: '0 auto',
        padding: '0 24px',
        boxSizing: 'border-box',
        paddingTop: '140px'
      }}>
        <h1 style={{
          fontSize: '32px',
          fontWeight: '600',
          textAlign: 'center',
          margin: 0,
          marginBottom: '16px'
        }}>
          Forgot Password?
        </h1>

        <p style={{
          fontSize: '16px',
          color: '#666',
          textAlign: 'center',
          margin: 0,
          marginBottom: '48px',
          lineHeight: '1.5'
        }}>
          No worries, we'll send you a code via email or message
        </p>

        {/* Email Option */}
        <button
          onClick={() => canUseEmail && setSelectedMethod('email')}
          disabled={!canUseEmail}
          style={{
            width: '100%',
            padding: '16px',
            marginBottom: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            background: selectedMethod === 'email' ? '#F0F0F0' : '#FFF',
            border: selectedMethod === 'email' ? '2px solid #000' : '1px solid #E0E0E0',
            borderRadius: '8px',
            cursor: canUseEmail ? 'pointer' : 'not-allowed',
            opacity: canUseEmail ? 1 : 0.5
          }}
        >
          <div style={{ width: '24px', height: '24px' }}>📧</div>
          <div style={{ flex: 1, textAlign: 'left' }}>
            <div style={{ fontSize: '16px', fontWeight: '600', color: canUseEmail ? '#000' : '#999', marginBottom: '4px' }}>
              Send Via Email
            </div>
            <div style={{ fontSize: '14px', color: canUseEmail ? '#666' : '#999' }}>
              {canUseEmail ? maskedEmail : 'Email not verified'}
            </div>
          </div>
          {canUseEmail && (
            <div style={{
              width: '20px',
              height: '20px',
              borderRadius: '50%',
              border: '2px solid ' + (selectedMethod === 'email' ? '#000' : '#CCC'),
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              {selectedMethod === 'email' && (
                <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#000' }} />
              )}
            </div>
          )}
        </button>

        {/* Phone Option */}
        <button
          onClick={() => canUsePhone && setSelectedMethod('sms')}
          disabled={!canUsePhone}
          style={{
            width: '100%',
            padding: '16px',
            marginBottom: '24px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            background: selectedMethod === 'sms' ? '#F0F0F0' : '#FFF',
            border: selectedMethod === 'sms' ? '2px solid #000' : '1px solid #E0E0E0',
            borderRadius: '8px',
            cursor: canUsePhone ? 'pointer' : 'not-allowed',
            opacity: canUsePhone ? 1 : 0.5
          }}
        >
          <div style={{ width: '24px', height: '24px' }}>💬</div>
          <div style={{ flex: 1, textAlign: 'left' }}>
            <div style={{ fontSize: '16px', fontWeight: '600', color: canUsePhone ? '#000' : '#999', marginBottom: '4px' }}>
              Send Via Messages
            </div>
            <div style={{ fontSize: '14px', color: canUsePhone ? '#666' : '#999' }}>
              {hasUnverifiedPhone ? (
                <>
                  <div>{maskedPhone}</div>
                  <div style={{ fontSize: '12px', color: '#999', marginTop: '2px' }}>Number not verified</div>
                </>
              ) : canUsePhone ? maskedPhone : 'No phone number linked'}
            </div>
          </div>
          {canUsePhone && (
            <div style={{
              width: '20px',
              height: '20px',
              borderRadius: '50%',
              border: '2px solid ' + (selectedMethod === 'sms' ? '#000' : '#CCC'),
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              {selectedMethod === 'sms' && (
                <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#000' }} />
              )}
            </div>
          )}
        </button>

        {error && (
          <div style={{
            width: '100%',
            padding: '12px',
            marginBottom: '16px',
            background: '#FEE',
            border: '1px solid #FCC',
            borderRadius: '8px',
            color: '#C00',
            fontSize: '14px'
          }}>
            {error}
          </div>
        )}

        <button
          onClick={handleContinue}
          disabled={!selectedMethod || loading}
          style={{
            width: '100%',
            height: '52px',
            padding: '14px 24px',
            fontSize: '16px',
            fontWeight: '600',
            color: '#FFF',
            background: (!selectedMethod || loading) ? '#666' : '#000',
            border: 'none',
            borderRadius: '8px',
            cursor: (!selectedMethod || loading) ? 'not-allowed' : 'pointer',
            boxSizing: 'border-box'
          }}
        >
          {loading ? 'Sending...' : 'Continue'}
        </button>
      </div>
    </div>
  );
}

export default ForgotPassword;
