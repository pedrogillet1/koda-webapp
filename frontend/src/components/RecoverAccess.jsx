import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

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
      const response = await axios.post('/api/auth/forgot-password-init', {
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
            hasPhone: response.data.hasPhone
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
          onClick={() => navigate('/login')}
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
          Recover Access
        </h1>

        <p style={{
          fontSize: '16px',
          color: '#666',
          marginBottom: '32px',
          textAlign: 'center'
        }}>
          Enter your email to recover your account
        </p>

        <div style={{ width: '100%', marginBottom: '24px' }}>
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
              padding: '12px 16px',
              fontSize: '16px',
              border: '1px solid #E0E0E0',
              borderRadius: '8px',
              outline: 'none',
              boxSizing: 'border-box'
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
            padding: '14px',
            fontSize: '16px',
            fontWeight: '600',
            color: '#FFF',
            background: loading ? '#666' : '#000',
            border: 'none',
            borderRadius: '8px',
            cursor: loading ? 'not-allowed' : 'pointer'
          }}
        >
          {loading ? 'Please wait...' : 'Continue'}
        </button>
      </div>
    </div>
  );
}

export default RecoverAccess;
