import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import backArrow from '../assets/arrow-narrow-left.svg';

const ForgotPasswordEmailSent = () => {
    const [timer, setTimer] = useState(30);
    const navigate = useNavigate();
    const location = useLocation();
    const email = location.state?.email || '';
    const phoneNumber = location.state?.phoneNumber || '';
    const method = email ? 'email' : 'message';

    useEffect(() => {
        const interval = setInterval(() => {
            setTimer((prevTimer) => (prevTimer > 0 ? prevTimer - 1 : 0));
        }, 1000);
        return () => clearInterval(interval);
    }, []);

    const handleResend = async () => {
        if (timer === 0) {
            try {
                const response = await fetch(`${process.env.REACT_APP_API_URL}/api/auth/forgot-password`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        email: method === 'email' ? email : undefined,
                        phoneNumber: method === 'message' ? phoneNumber : undefined
                    }),
                });

                if (response.ok) {
                    setTimer(30);
                }
            } catch (error) {
                console.error(`Error resending ${method}:`, error);
            }
        }
    };

    return (
        <div style={{width: '100%', height: '100vh', background: 'white', display: 'flex', flexDirection: 'column'}}>
            {/* Back Button */}
            <div onClick={() => navigate(-1)} style={{position: 'absolute', top: 16, left: 16, display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer'}}>
                <img src={backArrow} alt="Back" style={{width: 20, height: 20}} />
                <div style={{color: '#181818', fontSize: 14, fontFamily: 'Plus Jakarta Sans', fontWeight: '600', lineHeight: '20px'}}>Back</div>
            </div>

            {/* Main Content - Centered */}
            <div style={{flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '0 16px'}}>
                <div style={{width: '100%', maxWidth: 400, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24}}>
                    {/* Icon */}
                    <div style={{width: 64, height: 64, borderRadius: '50%', background: 'linear-gradient(135deg, #E0F2FE 0%, #BAE6FD 100%)', display: 'flex', justifyContent: 'center', alignItems: 'center'}}>
                        <div style={{width: 32, height: 32, borderRadius: '50%', background: '#0EA5E9', display: 'flex', justifyContent: 'center', alignItems: 'center'}}>
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M14 3L6 11L2 7" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                        </div>
                    </div>

                    {/* Title */}
                    <div style={{textAlign: 'center', color: '#32302C', fontSize: 24, fontFamily: 'Plus Jakarta Sans', fontWeight: '600', lineHeight: '32px'}}>
                        Check Your {method === 'email' ? 'Email' : 'SMS'}
                    </div>

                    {/* Description */}
                    <div style={{textAlign: 'center'}}>
                        <div style={{color: '#6C6B6E', fontSize: 14, fontFamily: 'Plus Jakarta Sans', fontWeight: '500', lineHeight: '20px'}}>
                            We've sent a secure link to reset your password.
                        </div>
                        {method === 'email' && (
                            <div style={{color: '#6C6B6E', fontSize: 14, fontFamily: 'Plus Jakarta Sans', fontWeight: '500', lineHeight: '20px', marginTop: 4}}>
                                If you don't see it in a few minutes, check your spam or junk folder.
                            </div>
                        )}
                    </div>

                    {/* Contact Display */}
                    <div style={{color: '#181818', fontSize: 14, fontFamily: 'Plus Jakarta Sans', fontWeight: '600', lineHeight: '20px'}}>
                        {method === 'email' ? email : phoneNumber}
                    </div>

                    {/* Resend Timer */}
                    <div style={{textAlign: 'center'}}>
                        <span style={{color: '#6C6B6E', fontSize: 13, fontFamily: 'Plus Jakarta Sans', fontWeight: '500', lineHeight: '18px'}}>
                            Didn't Get the {method === 'email' ? 'Email' : 'SMS'}?{' '}
                        </span>
                        <span
                            onClick={handleResend}
                            style={{
                                color: timer === 0 ? '#181818' : '#6C6B6E',
                                fontSize: 13,
                                fontFamily: 'Plus Jakarta Sans',
                                fontWeight: '600',
                                lineHeight: '18px',
                                cursor: timer === 0 ? 'pointer' : 'default'
                            }}
                        >
                            {timer > 0 ? `Resend in 00:${timer.toString().padStart(2, '0')}` : 'Resend'}
                        </span>
                    </div>

                    {/* Back to Login Button */}
                    <button
                        onClick={() => navigate('/login')}
                        style={{
                            width: '100%',
                            height: 48,
                            background: '#181818',
                            borderRadius: 12,
                            border: 'none',
                            cursor: 'pointer',
                            marginTop: 8
                        }}
                    >
                        <div style={{color: 'white', fontSize: 15, fontFamily: 'Plus Jakarta Sans', fontWeight: '600', lineHeight: '22px'}}>
                            Back to Log In
                        </div>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ForgotPasswordEmailSent;
