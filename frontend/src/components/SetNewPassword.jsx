import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import backArrow from '../assets/arrow-narrow-left.svg';
import hideIcon from '../assets/Hide.svg'; // Assuming you have a hide icon

const SetNewPassword = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const email = location.state?.email || '';
    const phoneNumber = location.state?.phoneNumber || '';
    const code = location.state?.code || '';

    const handleSave = async () => {
        if (isSaveDisabled) return;

        try {
            setLoading(true);
            setError('');

            const response = await fetch(`${process.env.REACT_APP_API_URL}/api/auth/reset-password`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    email,
                    phoneNumber,
                    code,
                    newPassword
                }),
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to reset password');
            }

            navigate('/password-changed');
        } catch (err) {
            setError(err.message || 'Failed to reset password');
        } finally {
            setLoading(false);
        }
    };

    const passwordsMatch = newPassword === confirmPassword;
    const isSaveDisabled = !newPassword || !confirmPassword || !passwordsMatch;

    return (
        <div style={{width: '100%', height: '100%', padding: 16, background: 'white', overflow: 'hidden', display: 'flex', flexDirection: 'column'}}>
            {/* Header */}
            <div onClick={() => navigate(-1)} style={{alignSelf: 'flex-start', justifyContent: 'center', alignItems: 'center', gap: 4, display: 'flex', cursor: 'pointer', marginBottom: 24}}>
                <img src={backArrow} alt="Back" />
                <div style={{color: '#181818', fontSize: 14, fontFamily: 'Plus Jakarta Sans', fontWeight: '600', lineHeight: '20px'}}>Back</div>
            </div>

            {/* Main Content */}
            <div style={{flex: '1 1 0', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '0 16px'}}>
                <div style={{width: '100%', maxWidth: 500, flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'center', gap: 32, display: 'flex'}}>
                    {/* Title */}
                    <div style={{alignSelf: 'stretch', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'center', gap: 12, display: 'flex'}}>
                        <div style={{alignSelf: 'stretch', textAlign: 'center', color: '#32302C', fontSize: 30, fontFamily: 'Plus Jakarta Sans', fontWeight: '600', textTransform: 'capitalize', lineHeight: '40px', wordWrap: 'break-word'}}>Set A New Password</div>
                        <div style={{alignSelf: 'stretch', textAlign: 'center', color: '#6C6B6E', fontSize: 16, fontFamily: 'Plus Jakarta Sans', fontWeight: '500', lineHeight: '24px'}}>Set a new secure password.</div>
                    </div>

                    {/* Form */}
                    <div style={{alignSelf: 'stretch', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', gap: 20, display: 'flex'}}>
                        {/* New Password */}
                        <div style={{alignSelf: 'stretch', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', gap: 6, display: 'flex'}}>
                            <label style={{color: '#32302C', fontSize: 14, fontFamily: 'Plus Jakarta Sans', fontWeight: '600', lineHeight: '20px'}}>New Password</label>
                            <div style={{alignSelf: 'stretch', height: 52, padding: '10px 18px', background: '#F5F5F5', borderRadius: 14, border: '1px solid #E6E6EC', justifyContent: 'space-between', alignItems: 'center', display: 'flex'}}>
                                <input 
                                    type={showPassword ? "text" : "password"}
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    placeholder="••••••••"
                                    style={{flex: '1 1 0', color: '#32302C', fontSize: 16, fontFamily: 'Plus Jakarta Sans', fontWeight: '400', lineHeight: '24px', background: 'transparent', border: 'none', outline: 'none'}}
                                />
                                <img src={hideIcon} alt="Show/Hide password" onClick={() => setShowPassword(!showPassword)} style={{cursor: 'pointer'}} />
                            </div>
                        </div>

                        {/* Confirm Password */}
                        <div style={{alignSelf: 'stretch', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', gap: 6, display: 'flex'}}>
                            <label style={{color: '#32302C', fontSize: 14, fontFamily: 'Plus Jakarta Sans', fontWeight: '600', lineHeight: '20px'}}>Confirm Password</label>
                            <div style={{alignSelf: 'stretch', height: 52, padding: '10px 18px', background: '#F5F5F5', borderRadius: 14, border: '1px solid #E6E6EC', justifyContent: 'space-between', alignItems: 'center', display: 'flex'}}>
                                <input 
                                    type={showConfirmPassword ? "text" : "password"}
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    placeholder="••••••••"
                                    style={{flex: '1 1 0', color: '#32302C', fontSize: 16, fontFamily: 'Plus Jakarta Sans', fontWeight: '400', lineHeight: '24px', background: 'transparent', border: 'none', outline: 'none'}}
                                />
                                <img src={hideIcon} alt="Show/Hide password" onClick={() => setShowConfirmPassword(!showConfirmPassword)} style={{cursor: 'pointer'}} />
                            </div>
                        </div>
                    </div>

                    {error && (
                        <div style={{alignSelf: 'stretch', padding: '12px 18px', background: '#FEE2E2', borderRadius: 14, border: '1px solid #FCA5A5'}}>
                            <div style={{color: '#DC2626', fontSize: 14, fontFamily: 'Plus Jakarta Sans', fontWeight: '500', lineHeight: '20px'}}>{error}</div>
                        </div>
                    )}

                    {/* Save Button */}
                    <div style={{alignSelf: 'stretch'}}>
                        <button onClick={handleSave} disabled={isSaveDisabled || loading} style={{width: '100%', height: 52, background: (isSaveDisabled || loading) ? '#F5F5F5' : '#181818', borderRadius: 14, border: 'none', cursor: (isSaveDisabled || loading) ? 'not-allowed' : 'pointer'}}>
                            <div style={{color: (isSaveDisabled || loading) ? '#6C6B6E' : 'white', fontSize: 16, fontFamily: 'Plus Jakarta Sans', fontWeight: '600', textTransform: 'capitalize', lineHeight: '24px'}}>
                                {loading ? 'Saving...' : 'Save'}
                            </div>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SetNewPassword;
