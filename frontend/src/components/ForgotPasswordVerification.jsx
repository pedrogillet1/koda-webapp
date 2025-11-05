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
      width: '100vw',
      height: '100vh',
      background: '#FFF',
      position: 'relative'
    }}>
      {/* Back Button */}
      <button
        onClick={() => navigate(-1)}
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
        {/* Blue Icon Circle */}
        <div style={{
          width: '80px',
          height: '80px',
          borderRadius: '50%',
          background: '#E3F2FD',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '32px',
          fontSize: '40px'
        }}>
          {isEmail ? '📧' : '💬'}
        </div>

        <h1 style={{
          fontSize: '32px',
          fontWeight: '600',
          margin: 0,
          marginBottom: '16px'
        }}>
          {title}
        </h1>

        <p style={{
          fontSize: '16px',
          color: '#666',
          margin: 0,
          marginBottom: '48px',
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
            height: '52px',
            padding: '14px 24px',
            fontSize: '16px',
            fontWeight: '600',
            color: '#000',
            background: '#FFF',
            border: '1px solid #E0E0E0',
            borderRadius: '8px',
            cursor: 'pointer',
            boxSizing: 'border-box'
          }}
        >
          Back to Log In
        </button>
      </div>
    </div>
  );
}

export default ForgotPasswordVerification;
