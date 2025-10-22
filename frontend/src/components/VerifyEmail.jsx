import React, { useState, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import backArrow from '../assets/arrow-narrow-left.svg';

const VerifyEmail = () => {
    const [code, setCode] = useState(new Array(6).fill(''));
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [isResending, setIsResending] = useState(false);
    const [resendCountdown, setResendCountdown] = useState(0);
    const [successMessage, setSuccessMessage] = useState('');
    const navigate = useNavigate();
    const location = useLocation();
    const inputsRef = useRef([]);
    const { verifyPendingEmail, resendPendingEmail } = useAuth();

    // Get email from navigation state or localStorage
    const email = location.state?.email || localStorage.getItem('pendingEmail') || '';

    // Countdown timer effect
    React.useEffect(() => {
        if (resendCountdown > 0) {
            const timer = setTimeout(() => setResendCountdown(resendCountdown - 1), 1000);
            return () => clearTimeout(timer);
        }
    }, [resendCountdown]);

    const handleResendCode = async () => {
        if (resendCountdown > 0) return;

        setIsResending(true);
        setError('');
        setSuccessMessage('');

        try {
            await resendPendingEmail({ email });
            setSuccessMessage('Verification code resent! Check your email.');
            setResendCountdown(60); // 60 seconds cooldown

            // Clear success message after 5 seconds
            setTimeout(() => setSuccessMessage(''), 5000);
        } catch (error) {
            console.error('Error resending code:', error);
            setError(error.message || 'Failed to resend code');
        } finally {
            setIsResending(false);
        }
    };

    const handleVerify = async () => {
        const verificationCode = code.join('');
        if (verificationCode.length !== 6) {
            setError('Please enter the complete 6-digit code');
            return;
        }

        setIsLoading(true);
        setError('');

        try {
            await verifyPendingEmail({ email, code: verificationCode });

            console.log('✅ Email verified successfully');
            // Navigate to documents screen after successful verification
            navigate('/home');
        } catch (error) {
            console.error('Error verifying email:', error);
            setError(error.message || 'Invalid verification code');
        } finally {
            setIsLoading(false);
        }
    };

    const handleChange = (e, index) => {
        const { value } = e.target;
        if (/^[0-9]$/.test(value) || value === '') {
            const newCode = [...code];
            newCode[index] = value;
            setCode(newCode);

            if (value !== '' && index < 5) {
                inputsRef.current[index + 1].focus();
            }
        }
    };

    const handleKeyDown = (e, index) => {
        if (e.key === 'Backspace' && code[index] === '' && index > 0) {
            inputsRef.current[index - 1].focus();
        }
    };

    const isVerifyDisabled = code.join('').length !== 6;

    return (
        <div style={{width: '100%', height: '100%', background: 'white', position: 'relative'}}>
            <div onClick={() => navigate(-1)} style={{position: 'absolute', top: 32, left: 32, display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer'}}>
                <img src={backArrow} alt="Back" />
                <div style={{color: '#181818', fontSize: 14, fontFamily: 'Plus Jakarta Sans', fontWeight: '600', lineHeight: '20px', wordWrap: 'break-word'}}>Back</div>
            </div>
            <div style={{width: '100%', height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center'}}>
                <div style={{width: 500, flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'center', gap: 32, display: 'flex'}}>
                    <div style={{alignSelf: 'stretch', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', gap: 12, display: 'flex'}}>
                        <div style={{alignSelf: 'stretch', textAlign: 'center', color: '#32302C', fontSize: 30, fontFamily: 'Plus Jakarta Sans', fontWeight: '600', textTransform: 'capitalize', lineHeight: '40px', wordWrap: 'break-word'}}>Verify Your Email</div>
                        <div style={{alignSelf: 'stretch', textAlign: 'center', color: '#6C6B6E', fontSize: 16, fontFamily: 'Plus Jakarta Sans', fontWeight: '500', lineHeight: '24px', wordWrap: 'break-word'}}>Enter the 6-digit code sent to your email address.</div>
                    </div>
                    <div style={{alignSelf: 'stretch', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', gap: 12, display: 'flex'}}>
                        <div style={{color: '#181818', fontSize: 14, fontFamily: 'Plus Jakarta Sans', fontWeight: '600', lineHeight: '20px', wordWrap: 'break-word'}}>Email</div>
                        <div style={{alignSelf: 'stretch', color: '#181818', fontSize: 16, fontFamily: 'Plus Jakarta Sans', fontWeight: '500', lineHeight: '24px', wordWrap: 'break-word'}}>{email}</div>
                    </div>
                    <div style={{alignSelf: 'stretch', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'center', gap: 32, display: 'flex'}}>
                        <div style={{alignSelf: 'stretch', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', gap: 12, display: 'flex'}}>
                            <label style={{color: '#32302C', fontSize: 14, fontFamily: 'Plus Jakarta Sans', fontWeight: '600', lineHeight: '20px', wordWrap: 'break-word'}}>Enter Code</label>
                            <div style={{alignSelf: 'stretch', display: 'flex', justifyContent: 'space-between', gap: 8}}>
                                {code.map((digit, index) => (
                                    <input
                                        key={index}
                                        ref={el => inputsRef.current[index] = el}
                                        type="text"
                                        maxLength="1"
                                        value={digit}
                                        onChange={(e) => handleChange(e, index)}
                                        onKeyDown={(e) => handleKeyDown(e, index)}
                                        style={{
                                            width: '52px',
                                            height: '60px',
                                            textAlign: 'center',
                                            fontSize: 30,
                                            fontFamily: 'Plus Jakarta Sans',
                                            fontWeight: '600',
                                            color: '#32302C',
                                            background: '#F5F5F5',
                                            borderRadius: 14,
                                            border: `1px solid ${inputsRef.current[index] === document.activeElement ? '#181818' : '#E6E6EC'}`,
                                            outline: 'none'
                                        }}
                                    />
                                ))}
                            </div>
                        </div>
                    </div>
                    {error && (
                        <div style={{alignSelf: 'stretch', background: '#FEE2E2', color: '#DC2626', padding: '12px 16px', borderRadius: 8, fontSize: 14}}>
                            {error}
                        </div>
                    )}
                    {successMessage && (
                        <div style={{alignSelf: 'stretch', background: '#D1FAE5', color: '#059669', padding: '12px 16px', borderRadius: 8, fontSize: 14}}>
                            {successMessage}
                        </div>
                    )}
                    <div style={{alignSelf: 'stretch', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', gap: 16, display: 'flex'}}>
                        <button onClick={handleVerify} style={{alignSelf: 'stretch', height: 52, borderRadius: 14, border: 'none', cursor: isVerifyDisabled || isLoading ? 'not-allowed' : 'pointer', background: isVerifyDisabled || isLoading ? '#F5F5F5' : '#181818', padding: 0, opacity: isLoading ? 0.6 : 1}} disabled={isVerifyDisabled || isLoading}>
                            <div style={{width: '100%', height: 52, overflow: 'hidden', borderRadius: 14, justifyContent: 'center', alignItems: 'center', display: 'flex'}}>
                                <div style={{color: isVerifyDisabled || isLoading ? '#6C6B6E' : 'white', fontSize: 16, fontFamily: 'Plus Jakarta Sans', fontWeight: '600', textTransform: 'capitalize', lineHeight: '24px', wordWrap: 'break-word'}}>
                                    {isLoading ? 'Verifying...' : 'Verify & Continue'}
                                </div>
                            </div>
                        </button>
                        <div style={{alignSelf: 'stretch', textAlign: 'center', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 4}}>
                            <span style={{color: '#6C6B6E', fontSize: 14, fontFamily: 'Plus Jakarta Sans', fontWeight: '500', lineHeight: '20px'}}>
                                Didn't receive the code?
                            </span>
                            <button
                                onClick={handleResendCode}
                                disabled={resendCountdown > 0 || isResending}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    color: resendCountdown > 0 || isResending ? '#6C6B6E' : '#181818',
                                    fontSize: 14,
                                    fontFamily: 'Plus Jakarta Sans',
                                    fontWeight: '600',
                                    lineHeight: '20px',
                                    cursor: resendCountdown > 0 || isResending ? 'not-allowed' : 'pointer',
                                    padding: 0,
                                    textDecoration: 'underline'
                                }}
                            >
                                {isResending ? 'Resending...' : resendCountdown > 0 ? `Resend Code (${resendCountdown}s)` : 'Resend Code'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default VerifyEmail;
