import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import backArrow from '../assets/arrow-narrow-left.svg';
import PhoneInput from 'react-phone-number-input';
import 'react-phone-number-input/style.css';
import './PhoneNumber.css';
import { isValidPhoneNumber } from 'react-phone-number-input';

const PhoneNumber = () => {
    const [phoneNumber, setPhoneNumber] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [phoneFocused, setPhoneFocused] = useState(false);
    const navigate = useNavigate();
    const { user } = useAuth();

    const handleSendCode = async () => {
        if (!phoneNumber) {
            setError('Please enter a phone number');
            return;
        }

        // Validate phone number format
        if (!isValidPhoneNumber(phoneNumber)) {
            setError('Please enter a valid phone number');
            return;
        }

        setIsLoading(true);
        setError('');

        try {
            // Get pending email from localStorage (set during registration)
            const pendingEmail = localStorage.getItem('pendingEmail');

            if (!pendingEmail) {
                throw new Error('No pending registration found. Please register first.');
            }

            const response = await fetch(`${process.env.REACT_APP_API_URL}/api/auth/pending/add-phone`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    email: pendingEmail,
                    phoneNumber
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to send verification code');
            }

            console.log('✅ Verification code sent to:', phoneNumber);
            navigate('/verification', { state: { phoneNumber, email: pendingEmail } });
        } catch (error) {
            console.error('Error sending code:', error);
            setError(error.message || 'Failed to send verification code');
        } finally {
            setIsLoading(false);
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
                {/* Icon */}
                <div style={{
                    marginBottom: '32px',
                    fontSize: '72px',
                    textShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                    display: 'inline-block',
                    transform: 'rotate(-15deg)'
                }}>
                    📱
                </div>

                <h1 style={{
                    fontSize: '32px',
                    fontWeight: '600',
                    textAlign: 'center',
                    margin: 0,
                    marginBottom: '16px'
                }}>
                    Enter Your Phone
                </h1>

                <p style={{
                    fontSize: '16px',
                    color: '#666',
                    textAlign: 'center',
                    margin: 0,
                    marginBottom: '48px',
                    lineHeight: '1.5'
                }}>
                    Authenticate your account via SMS.
                </p>

                {/* Phone Input */}
                <div style={{
                    width: '100%',
                    marginBottom: '12px'
                }}>
                    <label style={{
                        display: 'block',
                        color: '#32302C',
                        fontSize: 14,
                        fontFamily: 'Plus Jakarta Sans',
                        fontWeight: '600',
                        lineHeight: '20px',
                        marginBottom: '6px',
                        textAlign: 'left'
                    }}>
                        Phone Number <span style={{color: '#ef4444'}}>*</span>
                    </label>
                    <div
                        onFocus={() => setPhoneFocused(true)}
                        onBlur={() => setPhoneFocused(false)}
                        style={{
                            width: '100%',
                            minHeight: 52,
                            paddingLeft: 18,
                            paddingRight: 18,
                            paddingTop: 10,
                            paddingBottom: 10,
                            background: 'transparent',
                            overflow: 'visible',
                            borderRadius: 26,
                            border: phoneFocused ? '1px solid #181818' : '1px solid #E0E0E0',
                            boxSizing: 'border-box',
                            display: 'flex',
                            alignItems: 'center',
                            transform: phoneFocused ? 'scale(1.02)' : 'scale(1)',
                            transition: 'transform 0.2s ease, border-color 0.2s ease'
                        }}
                    >
                        <PhoneInput
                            international
                            defaultCountry="US"
                            value={phoneNumber}
                            onChange={setPhoneNumber}
                            placeholder="Enter phone number"
                            style={{
                                flex: '1 1 0',
                                width: '100%',
                                border: 'none',
                                background: 'transparent'
                            }}
                            className="custom-phone-input"
                        />
                    </div>
                </div>

                {error && (
                    <div style={{
                        width: '100%',
                        background: '#FEE2E2',
                        color: '#DC2626',
                        padding: '12px 16px',
                        borderRadius: 26,
                        fontSize: 14,
                        marginBottom: '12px',
                        boxSizing: 'border-box'
                    }}>
                        {error}
                    </div>
                )}

                {/* Send Code Button */}
                <button
                    onClick={handleSendCode}
                    disabled={isLoading}
                    style={{
                        width: '100%',
                        height: '52px',
                        padding: '14px 24px',
                        marginTop: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: 'rgba(24, 24, 24, 0.90)',
                        border: 'none',
                        borderRadius: '26px',
                        cursor: isLoading ? 'not-allowed' : 'pointer',
                        fontSize: '16px',
                        fontWeight: '600',
                        color: 'white',
                        opacity: isLoading ? 0.6 : 1
                    }}
                >
                    {isLoading ? 'Sending Code...' : 'Send Code'}
                </button>
            </div>
        </div>
    );
};

export default PhoneNumber;
