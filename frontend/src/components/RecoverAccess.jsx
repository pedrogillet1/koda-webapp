import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

function RecoverAccess() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

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
      console.log('🔐 [RecoverAccess] Calling /api/auth/forgot-password-init with email:', email.toLowerCase());
      const response = await api.post('/api/auth/forgot-password-init', {
        email: email.toLowerCase()
      });

      console.log('✅ [RecoverAccess] API response received:', response.data);

      if (response.data.success) {
        if (response.data.sessionToken) {
          console.log('🔑 [RecoverAccess] Storing sessionToken:', response.data.sessionToken.substring(0, 20) + '...');
          sessionStorage.setItem('resetSessionToken', response.data.sessionToken);
          console.log('✅ [RecoverAccess] SessionToken stored successfully');

          console.log('🔄 [RecoverAccess] Navigating to /forgot-password...');
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
        } else {
          console.warn('⚠️  [RecoverAccess] No sessionToken in response!');
          setError('Unable to process password reset. Please verify your email address is correct and try again.');
        }
      }
    } catch (error) {
      console.error('❌ [RecoverAccess] Error occurred:', error);
      console.error('❌ [RecoverAccess] Error response:', error.response?.data);

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
        paddingTop: '140px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center'
      }}>
        {/* Icon */}
        <div style={{
          marginBottom: '32px',
          fontSize: '72px',
          textShadow: '0 4px 12px rgba(0, 0, 0, 0.15)'
        }}>
          🔑
        </div>

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
            color: '#000',
            textAlign: 'left',
            paddingLeft: '20px'
          }}>
            Email
          </label>
          <input
            type="email"
            placeholder="example@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyPress={handleKeyPress}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            style={{
              width: '100%',
              height: '52px',
              padding: '14px 20px',
              fontSize: '16px',
              border: isFocused ? '1px solid #181818' : '1px solid #E0E0E0',
              borderRadius: '26px',
              outline: 'none',
              boxSizing: 'border-box',
              backgroundColor: 'transparent',
              transform: isFocused ? 'scale(1.02)' : 'scale(1)',
              transition: 'transform 0.2s ease, border-color 0.2s ease'
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
            borderRadius: '26px',
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
            borderRadius: '26px',
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
