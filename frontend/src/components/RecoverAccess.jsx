import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

function RecoverAccess() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleContinue = async () => {
    setError('');

    if (!email) {
      setError('Please enter your email');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('Please enter a valid email address');
      return;
    }

    setLoading(true);

    try {
      const response = await api.post('/api/auth/forgot-password-init', {
        email: email.toLowerCase()
      });

      if (response.data.success) {
        if (response.data.sessionToken) {
          sessionStorage.setItem('resetSessionToken', response.data.sessionToken);
        }

        navigate('/forgot-password', {
          state: {
            maskedEmail: response.data.maskedEmail,
            maskedPhone: response.data.maskedPhone,
            hasPhone: response.data.hasPhone,
            canUseEmail: response.data.canUseEmail,
            canUsePhone: response.data.canUsePhone,
            hasUnverifiedPhone: response.data.hasUnverifiedPhone
          }
        });
      }
    } catch (error) {
      console.error('Recover access error:', error);

      if (error.response?.data?.needsVerification) {
        setError('Please verify your email first before resetting password');
      } else if (error.response?.data?.error) {
        setError(error.response.data.error);
      } else {
        setError('An error occurred. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleContinue();
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
        onClick={() => navigate('/login')}
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
          Recover Access
        </h1>

        <p style={{
          fontSize: '16px',
          color: '#666',
          textAlign: 'center',
          margin: 0,
          marginBottom: '48px',
          lineHeight: '1.5'
        }}>
          Enter your email to recover your account
        </p>

        <div style={{ width: '100%', marginBottom: '32px' }}>
          <label style={{
            display: 'block',
            fontSize: '14px',
            fontWeight: '500',
            marginBottom: '8px',
            color: '#000'
          }}>
            Email
          </label>
          <input
            type="email"
            placeholder="example@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyPress={handleKeyPress}
            style={{
              width: '100%',
              height: '52px',
              padding: '14px 16px',
              fontSize: '16px',
              border: '1px solid #E0E0E0',
              borderRadius: '8px',
              outline: 'none',
              boxSizing: 'border-box',
              backgroundColor: '#F9F9F9'
            }}
            disabled={loading}
          />
        </div>

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
          disabled={loading}
          style={{
            width: '100%',
            height: '52px',
            padding: '14px 24px',
            fontSize: '16px',
            fontWeight: '600',
            color: '#FFF',
            background: loading ? '#666' : '#000',
            border: 'none',
            borderRadius: '8px',
            cursor: loading ? 'not-allowed' : 'pointer',
            boxSizing: 'border-box'
          }}
        >
          {loading ? 'Please wait...' : 'Continue'}
        </button>
      </div>
    </div>
  );
}

export default RecoverAccess;
