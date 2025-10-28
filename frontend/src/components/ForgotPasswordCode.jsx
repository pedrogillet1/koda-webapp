import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import backArrow from '../assets/arrow-narrow-left.svg';

const ForgotPasswordCode = () => {
    const [code, setCode] = useState(new Array(6).fill(''));
    const [timer, setTimer] = useState(30);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const navigate = useNavigate();
    const location = useLocation();
    const inputsRef = useRef([]);

    // This would be passed from the previous screen
    const contactInfo = location.state?.contactInfo || '';
    const email = location.state?.email || '';
    const phoneNumber = location.state?.phoneNumber || ''; 

    useEffect(() => {
        const interval = setInterval(() => {
            setTimer((prevTimer) => (prevTimer > 0 ? prevTimer - 1 : 0));
        }, 1000);
        return () => clearInterval(interval);
    }, []);

    const handleResendCode = async () => {
        if (timer === 0) {
            try {
                setLoading(true);
                setError('');

                const response = await fetch('http://localhost:5000/api/auth/forgot-password', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ email, phoneNumber }),
                });

                if (!response.ok) {
                    const data = await response.json();
                    throw new Error(data.error || 'Failed to resend code');
                }

                setTimer(30);
            } catch (err) {
                setError(err.message || 'Failed to resend code');
            } finally {
                setLoading(false);
            }
        }
    };

    const handleContinue = async () => {
        if (isContinueDisabled) return;

        try {
            setLoading(true);
            setError('');

            const verificationCode = code.join('');

            const response = await fetch('http://localhost:5000/api/auth/verify-reset-code', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    email,
                    phoneNumber,
                    code: verificationCode
                }),
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Invalid verification code');
            }

            const data = await response.json();

            // Navigate to SetNewPassword with the verification code
            navigate('/set-new-password', {
                state: {
                    email,
                    phoneNumber,
                    code: verificationCode
                }
            });
        } catch (err) {
            setError(err.message || 'Failed to verify code');
        } finally {
            setLoading(false);
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

    const isContinueDisabled = code.join('').length !== 6;

    return (
        <div style={{width: '100%', height: '100%', padding: 16, background: 'white', overflow: 'hidden', display: 'flex', flexDirection: 'column'}}>
            <div onClick={() => navigate(-1)} style={{alignSelf: 'flex-start', justifyContent: 'center', alignItems: 'center', gap: 4, display: 'flex', cursor: 'pointer', marginBottom: 24}}>
                <img src={backArrow} alt="Back" />
                <div style={{color: '#181818', fontSize: 14, fontFamily: 'Plus Jakarta Sans', fontWeight: '600', lineHeight: '20px'}}>Back</div>
            </div>

            <div style={{flex: '1 1 0', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center'}}>
                <div style={{width: 500, flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'center', gap: 32, display: 'flex'}}>
                    <div style={{alignSelf: 'stretch', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'center', gap: 12, display: 'flex'}}>
                        <div style={{alignSelf: 'stretch', textAlign: 'center', color: '#32302C', fontSize: 30, fontFamily: 'Plus Jakarta Sans', fontWeight: '600', textTransform: 'capitalize', lineHeight: '40px'}}>Enter the code</div>
                        <div style={{alignSelf: 'stretch', textAlign: 'center'}}>
                            <span style={{color: '#6C6B6E', fontSize: 16, fontFamily: 'Plus Jakarta Sans', fontWeight: '500', lineHeight: '24px'}}>Enter the 6-digit code sent to </span>
                            <span style={{color: '#181818', fontSize: 16, fontFamily: 'Plus Jakarta Sans', fontWeight: '500', lineHeight: '24px'}}>{contactInfo}</span>
                        </div>
                    </div>

                    <div style={{alignSelf: 'stretch', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'center', gap: 24, display: 'flex'}}>
                        <div style={{alignSelf: 'stretch', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', gap: 12, display: 'flex'}}>
                            <label style={{color: '#32302C', fontSize: 14, fontFamily: 'Plus Jakarta Sans', fontWeight: '600', lineHeight: '20px'}}>Enter Code</label>
                            <div style={{alignSelf: 'stretch', display: 'flex', justifyContent: 'space-between', gap: 12}}>
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
                                            width: 52,
                                            height: 60,
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
                        <div style={{alignSelf: 'stretch', justifyContent: 'center', alignItems: 'center', gap: 6, display: 'inline-flex'}}>
                            <div style={{color: '#6C6B6E', fontSize: 14, fontFamily: 'Plus Jakarta Sans', fontWeight: '500', textTransform: 'capitalize', lineHeight: '20px'}}>Didn’t get a code?</div>
                            <div onClick={handleResendCode} style={{cursor: timer === 0 ? 'pointer' : 'default', color: '#181818', fontSize: 14, fontFamily: 'Plus Jakarta Sans', fontWeight: '600', lineHeight: '20px'}}>
                                {timer > 0 ? `Resend in 00:${timer.toString().padStart(2, '0')}` : 'Resend'}
                            </div>
                        </div>
                    </div>

                    {error && (
                        <div style={{alignSelf: 'stretch', padding: '12px 18px', background: '#FEE2E2', borderRadius: 14, border: '1px solid #FCA5A5'}}>
                            <div style={{color: '#DC2626', fontSize: 14, fontFamily: 'Plus Jakarta Sans', fontWeight: '500', lineHeight: '20px'}}>{error}</div>
                        </div>
                    )}

                    <div style={{alignSelf: 'stretch'}}>
                        <button onClick={handleContinue} disabled={isContinueDisabled || loading} style={{width: '100%', height: 52, background: (isContinueDisabled || loading) ? '#F5F5F5' : '#181818', borderRadius: 14, border: 'none', cursor: (isContinueDisabled || loading) ? 'not-allowed' : 'pointer'}}>
                            <div style={{color: (isContinueDisabled || loading) ? '#6C6B6E' : 'white', fontSize: 16, fontFamily: 'Plus Jakarta Sans', fontWeight: '600', textTransform: 'capitalize', lineHeight: '24px'}}>
                                {loading ? 'Verifying...' : 'Continue'}
                            </div>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ForgotPasswordCode;
