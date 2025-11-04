import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import backArrow from '../assets/arrow-narrow-left.svg';
import mailIcon from '../assets/Mail.svg';
import messageIcon from '../assets/message-3.svg';
import PhoneInput from 'react-phone-number-input';
import 'react-phone-number-input/style.css';
import './PhoneNumber.css';
import { isValidPhoneNumber } from 'react-phone-number-input';

const ForgotPassword = () => {
    const navigate = useNavigate();
    const [selectedOption, setSelectedOption] = useState('');
    const [contactInfo, setContactInfo] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleContinue = async () => {
        if (!selectedOption || !contactInfo) {
            setError('Please enter your ' + (selectedOption === 'email' ? 'email' : 'phone number'));
            return;
        }

        // Basic validation
        if (selectedOption === 'email') {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(contactInfo)) {
                setError('Please enter a valid email address');
                return;
            }
        } else if (selectedOption === 'message') {
            if (!isValidPhoneNumber(contactInfo)) {
                setError('Please enter a valid phone number');
                return;
            }
        }

        setIsLoading(true);
        setError('');

        try {
            // Send password reset code
            const response = await fetch(`${process.env.REACT_APP_API_URL}/api/auth/forgot-password`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    email: selectedOption === 'email' ? contactInfo : undefined,
                    phoneNumber: selectedOption === 'message' ? contactInfo : undefined,
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to send reset code');
            }

            // Navigate to email sent confirmation page
            navigate('/forgot-password-email-sent', {
                state: {
                    email: selectedOption === 'email' ? contactInfo : undefined,
                    phoneNumber: selectedOption === 'message' ? contactInfo : undefined
                }
            });
        } catch (error) {
            console.error('Error sending reset code:', error);
            setError(error.message || 'Failed to send reset code');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div style={{width: '100%', height: '100%', padding: 16, background: 'white', overflow: 'hidden', display: 'flex', flexDirection: 'column'}}>
            {/* Header */}
            <div onClick={() => navigate(-1)} style={{alignSelf: 'flex-start', justifyContent: 'center', alignItems: 'center', gap: 4, display: 'flex', cursor: 'pointer', marginBottom: 24}}>
                <img src={backArrow} alt="Back" />
                <div style={{color: '#181818', fontSize: 14, fontFamily: 'Plus Jakarta Sans', fontWeight: '600', lineHeight: '20px'}}>Back</div>
            </div>

            {/* Main Content */}
            <div style={{flex: '1 1 0', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center'}}>
                <div style={{width: 500, flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'center', gap: 32, display: 'flex'}}>
                    {/* Title */}
                    <div style={{alignSelf: 'stretch', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'center', gap: 12, display: 'flex'}}>
                        <div style={{alignSelf: 'stretch', textAlign: 'center', color: '#32302C', fontSize: 30, fontFamily: 'Plus Jakarta Sans', fontWeight: '600', textTransform: 'capitalize', lineHeight: '40px'}}>Forgot Password?</div>
                        <div style={{alignSelf: 'stretch', textAlign: 'center', color: '#6C6B6E', fontSize: 16, fontFamily: 'Plus Jakarta Sans', fontWeight: '500', lineHeight: '24px'}}>No worries, we’ll send you a code via email or message.</div>
                    </div>

                    {/* Options */}
                    <div style={{alignSelf: 'stretch', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', gap: 16, display: 'flex'}}>
                        <div onClick={() => setSelectedOption('email')} style={{alignSelf: 'stretch', height: 52, padding: '10px 18px', background: selectedOption === 'email' ? '#E6E6EC' : '#F5F5F5', borderRadius: 14, border: `1px solid ${selectedOption === 'email' ? '#323232' : '#E6E6EC'}`, justifyContent: 'center', alignItems: 'center', gap: 8, display: 'flex', cursor: 'pointer'}}>
                            <img src={mailIcon} alt="Email" />
                            <div style={{color: '#323232', fontSize: 16, fontFamily: 'Plus Jakarta Sans', fontWeight: '600', textTransform: 'capitalize', lineHeight: '24px'}}>Send Via Email</div>
                        </div>
                        <div onClick={() => setSelectedOption('message')} style={{alignSelf: 'stretch', height: 52, padding: '10px 18px', background: selectedOption === 'message' ? '#E6E6EC' : '#F5F5F5', borderRadius: 14, border: `1px solid ${selectedOption === 'message' ? '#323232' : '#E6E6EC'}`, justifyContent: 'center', alignItems: 'center', gap: 8, display: 'flex', cursor: 'pointer'}}>
                            <img src={messageIcon} alt="Message" />
                            <div style={{color: '#323232', fontSize: 16, fontFamily: 'Plus Jakarta Sans', fontWeight: '600', textTransform: 'capitalize', lineHeight: '24px'}}>Send via Messages</div>
                        </div>
                    </div>

                    {/* Contact Info Input */}
                    {selectedOption && (
                        <div style={{alignSelf: 'stretch', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', gap: 6, display: 'flex'}}>
                            <label style={{color: '#32302C', fontSize: 14, fontFamily: 'Plus Jakarta Sans', fontWeight: '600', lineHeight: '20px'}}>
                                {selectedOption === 'email' ? 'Email Address' : 'Phone Number'}
                            </label>
                            <div style={{alignSelf: 'stretch', minHeight: 52, paddingLeft: 18, paddingRight: 18, paddingTop: 10, paddingBottom: 10, background: '#F5F5F5', overflow: selectedOption === 'message' ? 'visible' : 'hidden', borderRadius: 14, outline: error ? '1px rgba(217, 45, 32, 0.40) solid' : '1px #E6E6EC solid', outlineOffset: '-1px', justifyContent: 'flex-start', alignItems: 'center', gap: 8, display: 'flex'}}>
                                {selectedOption === 'email' ? (
                                    <input
                                        type="email"
                                        value={contactInfo}
                                        onChange={(e) => {
                                            setContactInfo(e.target.value);
                                            setError('');
                                        }}
                                        placeholder="Enter your email"
                                        style={{flex: '1 1 0', color: '#32302C', fontSize: 16, fontFamily: 'Plus Jakarta Sans', fontWeight: '400', lineHeight: '24px', background: 'transparent', border: 'none', outline: 'none', width: '100%'}}
                                    />
                                ) : (
                                    <PhoneInput
                                        international
                                        defaultCountry="US"
                                        value={contactInfo}
                                        onChange={(value) => {
                                            setContactInfo(value || '');
                                            setError('');
                                        }}
                                        placeholder="Enter phone number"
                                        style={{
                                            flex: '1 1 0',
                                            width: '100%',
                                            border: 'none',
                                            background: 'transparent'
                                        }}
                                        className="custom-phone-input"
                                    />
                                )}
                            </div>
                            {error && (
                                <div style={{color: '#D92D20', fontSize: 14, fontFamily: 'Plus Jakarta Sans', fontWeight: '600', lineHeight: '20px'}}>{error}</div>
                            )}
                        </div>
                    )}

                    {/* Continue Button */}
                    <div style={{alignSelf: 'stretch'}}>
                        <button onClick={handleContinue} disabled={!selectedOption || !contactInfo || isLoading} style={{width: '100%', height: 52, background: (selectedOption && contactInfo && !isLoading) ? '#181818' : '#F5F5F5', borderRadius: 14, border: 'none', cursor: (selectedOption && contactInfo && !isLoading) ? 'pointer' : 'not-allowed'}}>
                            <div style={{color: (selectedOption && contactInfo && !isLoading) ? 'white' : '#6C6B6E', fontSize: 16, fontFamily: 'Plus Jakarta Sans', fontWeight: '600', textTransform: 'capitalize', lineHeight: '24px'}}>
                                {isLoading ? 'Sending...' : 'Continue'}
                            </div>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ForgotPassword;
