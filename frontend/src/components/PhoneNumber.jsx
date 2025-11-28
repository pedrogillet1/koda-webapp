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
        <div style={{width: '100%', height: '100%', background: 'white', position: 'relative'}}>
            <div onClick={() => navigate(-1)} style={{position: 'absolute', top: 32, left: 32, display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer'}}>
                <img src={backArrow} alt="Back" />
                <div style={{color: '#181818', fontSize: 14, fontFamily: 'Plus Jakarta Sans', fontWeight: '600', lineHeight: '20px', wordWrap: 'break-word'}}>Back</div>
            </div>
            <div style={{width: '100%', height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center'}}>
                <div style={{width: 500, flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'center', gap: 32, display: 'flex'}}>
                    <div style={{alignSelf: 'stretch', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', gap: 12, display: 'flex'}}>
                        <div style={{alignSelf: 'stretch', textAlign: 'center', color: '#32302C', fontSize: 30, fontFamily: 'Plus Jakarta Sans', fontWeight: '600', textTransform: 'capitalize', lineHeight: '40px', wordWrap: 'break-word'}}>Enter Your Phone</div>
                        <div style={{alignSelf: 'stretch', textAlign: 'center', color: '#6C6B6E', fontSize: 16, fontFamily: 'Plus Jakarta Sans', fontWeight: '500', lineHeight: '24px', wordWrap: 'break-word'}}>Authenticate your account via SMS.</div>
                    </div>
                    <div style={{alignSelf: 'stretch', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', gap: 20, display: 'flex'}}>
                        <div style={{alignSelf: 'stretch', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', gap: 6, display: 'flex'}}>
                            <label style={{color: '#32302C', fontSize: 14, fontFamily: 'Plus Jakarta Sans', fontWeight: '600', lineHeight: '20px', wordWrap: 'break-word'}}>Phone Number <span style={{color: '#ef4444'}}>*</span></label>
                            <div style={{alignSelf: 'stretch', minHeight: 52, paddingLeft: 18, paddingRight: 18, paddingTop: 10, paddingBottom: 10, background: '#F5F5F5', overflow: 'visible', borderRadius: 14, outline: '1px #E6E6EC solid', outlineOffset: '-1px', justifyContent: 'flex-start', alignItems: 'center', gap: 8, display: 'flex'}}>
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
                    </div>
                    {error && (
                        <div style={{alignSelf: 'stretch', background: '#FEE2E2', color: '#DC2626', padding: '12px 16px', borderRadius: 8, fontSize: 14}}>
                            {error}
                        </div>
                    )}
                    <div style={{alignSelf: 'stretch', borderRadius: 12, flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'center', gap: 24, display: 'flex'}}>
                        <button onClick={handleSendCode} disabled={isLoading} style={{alignSelf: 'stretch', height: 52, borderRadius: 14, border: 'none', cursor: isLoading ? 'not-allowed' : 'pointer', padding: 0, background: 'transparent', opacity: isLoading ? 0.6 : 1}}>
                            <div style={{width: '100%', height: 52, background: 'rgba(24, 24, 24, 0.90)', overflow: 'hidden', borderRadius: 14, justifyContent: 'center', alignItems: 'center', display: 'flex'}}>
                                <div style={{color: 'white', fontSize: 16, fontFamily: 'Plus Jakarta Sans', fontWeight: '600', textTransform: 'capitalize', lineHeight: '24px', wordWrap: 'break-word'}}>
                                    {isLoading ? 'Sending Code...' : 'Send Code'}
                                </div>
                            </div>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PhoneNumber;
