import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

function ForgotPasswordVerification() {
  const location = useLocation();
  const navigate = useNavigate();

  const { method } = location.state || {};
  const [countdown, setCountdown] = useState(60);
  const [canResend, setCanResend] = useState(false);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else {
      setCanResend(true);
    }
  }, [countdown]);

  const handleResend = async () => {
    if (!canResend) return;
    // TODO: Implement resend functionality
    setCountdown(60);
    setCanResend(false);
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const isEmail = method === 'email';
  const title = isEmail ? 'Check Your Email' : 'Check Your Messages';
  const subtitle = isEmail
    ? "We've sent a secure link to reset your password. If you don't see it in a few minutes, check your spam or junk folder."
    : "We've sent a secure link to reset your password via SMS.";

  return (
    <div style={{
      display: 'flex',
      width: '100vw',
      height: '100vh',
      flexDirection: 'column',
      background: '#FFF'
    }}>
      <div style={{ width: '100%', padding: '16px' }}>
        <button
          onClick={() => navigate('/forgot-password')}
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
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        flex: 1,
        justifyContent: 'center',
        width: '100%'
      }}>
        <div style={{
          width: '100%',
          maxWidth: '400px',
          padding: '0 16px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center'
        }}>
        <div style={{
          width: '80px',
          height: '80px',
          borderRadius: '50%',
          background: '#E3F2FD',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '24px',
          fontSize: '40px'
        }}>
          {isEmail ? '📧' : '💬'}
        </div>

        <h1 style={{
          fontSize: '32px',
          fontWeight: '600',
          marginBottom: '12px'
        }}>
          {title}
        </h1>

        <p style={{
          fontSize: '16px',
          color: '#666',
          marginBottom: '32px',
          lineHeight: '1.5'
        }}>
          {subtitle}
        </p>

        <div style={{ marginBottom: '24px' }}>
          <span style={{ fontSize: '14px', color: '#666' }}>
            Didn't Get the {isEmail ? 'Email' : 'Link'}?{' '}
          </span>
          {canResend ? (
            <button
              onClick={handleResend}
              style={{
                background: 'none',
                border: 'none',
                color: '#000',
                fontWeight: '600',
                cursor: 'pointer',
                textDecoration: 'underline',
                fontSize: '14px'
              }}
            >
              Resend
            </button>
          ) : (
            <span style={{ fontSize: '14px', color: '#000', fontWeight: '600' }}>
              Resend in {formatTime(countdown)}
            </span>
          )}
        </div>

        <button
          onClick={() => navigate('/login')}
          style={{
            width: '100%',
            padding: '14px',
            fontSize: '16px',
            fontWeight: '600',
            color: '#000',
            background: '#FFF',
            border: '1px solid #E0E0E0',
            borderRadius: '8px',
            cursor: 'pointer'
          }}
        >
          Back to Log In
        </button>
        </div>
      </div>
    </div>
  );
}

export default ForgotPasswordVerification;
