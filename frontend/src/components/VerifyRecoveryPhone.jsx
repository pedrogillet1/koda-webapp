import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import '../styles/VerifyRecovery.css';

const VerifyRecoveryPhone = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState('verifying'); // verifying, success, error
  const [message, setMessage] = useState('');

  useEffect(() => {
    const verifyPhone = async () => {
      const token = searchParams.get('token');

      if (!token) {
        setStatus('error');
        setMessage('Invalid verification link. No token provided.');
        return;
      }

      try {
        const response = await axios.get(
          `${process.env.REACT_APP_API_URL || 'http://localhost:5000'}/api/recovery-verification/verify-phone?token=${token}`
         );

        if (response.data.success) {
          setStatus('success');
          setMessage('Your recovery phone has been verified successfully!');

          // Redirect to settings after 3 seconds
          setTimeout(() => {
            navigate('/settings');
          }, 3000);
        } else {
          setStatus('error');
          setMessage(response.data.message || 'Verification failed.');
        }
      } catch (error) {
        setStatus('error');
        setMessage(error.response?.data?.error || 'An error occurred during verification.');
      }
    };

    verifyPhone();
  }, [searchParams, navigate]);

  return (
    <div className="verify-recovery-container">
      <div className="verify-recovery-card">
        {status === 'verifying' && (
          <>
            <div className="verify-icon verifying">⏳</div>
            <h1>Verifying your phone...</h1>
            <p>Please wait while we verify your recovery phone number.</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="verify-icon success">✅</div>
            <h1>Phone Verified!</h1>
            <p>{message}</p>
            <p className="redirect-message">Redirecting you to Settings...</p>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="verify-icon error">❌</div>
            <h1>Verification Failed</h1>
            <p>{message}</p>
            <button
              className="button-primary"
              onClick={() => navigate('/settings')}
            >
              Go to Settings
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default VerifyRecoveryPhone;
