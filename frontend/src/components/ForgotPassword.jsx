import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';

function ForgotPassword() {
  const location = useLocation();
  const navigate = useNavigate();

  const { maskedEmail, maskedPhone, hasPhone } = location.state || {};

  const [selectedMethod, setSelectedMethod] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!maskedEmail) {
      navigate('/recover-access');
    }
  }, [maskedEmail, navigate]);

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
      const response = await axios.post('/api/auth/send-reset-link', {
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
      display: 'flex',
      width: '100vw',
      height: '100vh',
      padding: '16px',
      flexDirection: 'column',
      alignItems: 'center',
      background: '#FFF'
    }}>
      <div style={{ width: '100%', maxWidth: '400px', marginBottom: '40px' }}>
        <button
          onClick={() => navigate('/recover-access')}
          style={{
            background: 'none',
            border: 'none',
            fontSize: '16px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            color: '#000',
            padding: '8px 0'
          }}
        >
          ← Back
        </button>
      </div>

      <div style={{
        width: '100%',
        maxWidth: '400px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center'
      }}>
        <h1 style={{
          fontSize: '32px',
          fontWeight: '600',
          marginBottom: '12px',
          textAlign: 'center'
        }}>
          Forgot Password?
        </h1>

        <p style={{
          fontSize: '16px',
          color: '#666',
          marginBottom: '32px',
          textAlign: 'center'
        }}>
          No worries, we'll send you a code via email or message
        </p>

        {/* Email Option */}
        <button
          onClick={() => setSelectedMethod('email')}
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
            cursor: 'pointer'
          }}
        >
          <div style={{ width: '24px', height: '24px' }}>📧</div>
          <div style={{ flex: 1, textAlign: 'left' }}>
            <div style={{ fontSize: '16px', fontWeight: '600', color: '#000', marginBottom: '4px' }}>
              Send Via Email
            </div>
            <div style={{ fontSize: '14px', color: '#666' }}>
              {maskedEmail}
            </div>
          </div>
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
        </button>

        {/* Phone Option */}
        <button
          onClick={() => hasPhone && setSelectedMethod('sms')}
          disabled={!hasPhone}
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
            cursor: hasPhone ? 'pointer' : 'not-allowed',
            opacity: hasPhone ? 1 : 0.5
          }}
        >
          <div style={{ width: '24px', height: '24px' }}>💬</div>
          <div style={{ flex: 1, textAlign: 'left' }}>
            <div style={{ fontSize: '16px', fontWeight: '600', color: hasPhone ? '#000' : '#999', marginBottom: '4px' }}>
              Send Via Messages
            </div>
            <div style={{ fontSize: '14px', color: hasPhone ? '#666' : '#999' }}>
              {hasPhone ? maskedPhone : 'No phone number linked'}
            </div>
          </div>
          {hasPhone && (
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
            padding: '14px',
            fontSize: '16px',
            fontWeight: '600',
            color: '#FFF',
            background: (!selectedMethod || loading) ? '#666' : '#000',
            border: 'none',
            borderRadius: '8px',
            cursor: (!selectedMethod || loading) ? 'not-allowed' : 'pointer'
          }}
        >
          {loading ? 'Sending...' : 'Continue'}
        </button>
      </div>
    </div>
  );
}

export default ForgotPassword;
