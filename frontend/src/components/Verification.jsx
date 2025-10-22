import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import backArrow from '../assets/arrow-narrow-left.svg';

const Verification = () => {
    const [code, setCode] = useState(new Array(6).fill(''));
    const [timer, setTimer] = useState(30);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const navigate = useNavigate();
    const location = useLocation();
    const inputsRef = useRef([]);
    const { user } = useAuth();

    const phoneNumber = location.state?.phoneNumber || '';

    useEffect(() => {
        const interval = setInterval(() => {
            setTimer((prevTimer) => (prevTimer > 0 ? prevTimer - 1 : 0));
        }, 1000);
        return () => clearInterval(interval);
    }, []);

    const handleResendCode = async () => {
        if (timer === 0) {
            setIsLoading(true);
            setError('');

            try {
                const token = localStorage.getItem('accessToken');
                const response = await fetch(`${process.env.REACT_APP_API_URL}/api/auth/verify/send-phone`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ phoneNumber })
                });

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.error || 'Failed to resend code');
                }

                setTimer(30);
                console.log('✅ Verification code resent');
            } catch (error) {
                console.error('Error resending code:', error);
                setError(error.message || 'Failed to resend code');
            } finally {
                setIsLoading(false);
            }
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
            const token = localStorage.getItem('accessToken');
            const response = await fetch(`${process.env.REACT_APP_API_URL}/api/auth/verify/phone`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ code: verificationCode })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Invalid verification code');
            }

            console.log('✅ Phone verified successfully');
            navigate('/');
        } catch (error) {
            console.error('Error verifying code:', error);
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
                        <div style={{alignSelf: 'stretch', textAlign: 'center', color: '#32302C', fontSize: 30, fontFamily: 'Plus Jakarta Sans', fontWeight: '600', textTransform: 'capitalize', lineHeight: '40px', wordWrap: 'break-word'}}>2-Step Verification</div>
                        <div style={{alignSelf: 'stretch', textAlign: 'center', color: '#6C6B6E', fontSize: 16, fontFamily: 'Plus Jakarta Sans', fontWeight: '500', lineHeight: '24px', wordWrap: 'break-word'}}>Keep your Koda account safe. Enter the 6-digit code sent to your phone.</div>
                    </div>
                    <div style={{alignSelf: 'stretch', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', gap: 12, display: 'flex'}}>
                        <div style={{alignSelf: 'stretch', justifyContent: 'space-between', alignItems: 'center', display: 'inline-flex'}}>
                            <div style={{color: '#181818', fontSize: 14, fontFamily: 'Plus Jakarta Sans', fontWeight: '600', lineHeight: '20px', wordWrap: 'break-word'}}>Phone</div>
                            <div onClick={() => navigate('/phone-number')} style={{cursor: 'pointer', color: '#181818', fontSize: 14, fontFamily: 'Plus Jakarta Sans', fontWeight: '600', textTransform: 'capitalize', lineHeight: '20px', wordWrap: 'break-word'}}>Change number</div>
                        </div>
                        <div style={{alignSelf: 'stretch', color: '#181818', fontSize: 16, fontFamily: 'Plus Jakarta Sans', fontWeight: '500', lineHeight: '24px', wordWrap: 'break-word'}}>{phoneNumber.replace(/(\d{3})(?=\d{3}$)/, '••• ')}</div>
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
                        <div style={{alignSelf: 'stretch', justifyContent: 'center', alignItems: 'center', gap: 6, display: 'inline-flex'}}>
                            <div style={{color: '#6C6B6E', fontSize: 14, fontFamily: 'Plus Jakarta Sans', fontWeight: '500', textTransform: 'capitalize', lineHeight: '20px', wordWrap: 'break-word'}}>Didn’t get a code?</div>
                            <div onClick={handleResendCode} style={{cursor: timer === 0 ? 'pointer' : 'default', color: '#181818', fontSize: 14, fontFamily: 'Plus Jakarta Sans', fontWeight: '600', lineHeight: '20px', wordWrap: 'break-word'}}>
                                {timer > 0 ? `Resend in 00:${timer.toString().padStart(2, '0')}` : 'Click To Resend'}
                            </div>
                        </div>
                    </div>
                    {error && (
                        <div style={{alignSelf: 'stretch', background: '#FEE2E2', color: '#DC2626', padding: '12px 16px', borderRadius: 8, fontSize: 14}}>
                            {error}
                        </div>
                    )}
                    <button onClick={handleVerify} style={{alignSelf: 'stretch', height: 52, borderRadius: 14, border: 'none', cursor: isVerifyDisabled || isLoading ? 'not-allowed' : 'pointer', background: isVerifyDisabled || isLoading ? '#F5F5F5' : '#181818', padding: 0, opacity: isLoading ? 0.6 : 1}} disabled={isVerifyDisabled || isLoading}>
                        <div style={{width: '100%', height: 52, overflow: 'hidden', borderRadius: 14, justifyContent: 'center', alignItems: 'center', display: 'flex'}}>
                            <div style={{color: isVerifyDisabled || isLoading ? '#6C6B6E' : 'white', fontSize: 16, fontFamily: 'Plus Jakarta Sans', fontWeight: '600', textTransform: 'capitalize', lineHeight: '24px', wordWrap: 'break-word'}}>
                                {isLoading ? 'Verifying...' : 'Verify & Continue'}
                            </div>
                        </div>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Verification;
