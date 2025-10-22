import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import backArrow from '../assets/arrow-narrow-left.svg';
import hideIcon from '../assets/Hide.svg'; // Assuming you have a hide icon

const SetNewPassword = () => {
    const navigate = useNavigate();
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    const handleSave = () => {
        if (!isSaveDisabled) {
            console.log('Saving new password...');
            navigate('/password-changed');
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
            <div style={{flex: '1 1 0', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center'}}>
                <div style={{width: 500, flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'center', gap: 32, display: 'flex'}}>
                    {/* Title */}
                    <div style={{alignSelf: 'stretch', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'center', gap: 12, display: 'flex'}}>
                        <div style={{alignSelf: 'stretch', textAlign: 'center', color: '#32302C', fontSize: 30, fontFamily: 'Plus Jakarta Sans', fontWeight: '600', textTransform: 'capitalize', lineHeight: '40px'}}>Set a New Password</div>
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

                    {/* Save Button */}
                    <div style={{alignSelf: 'stretch'}}>
                        <button onClick={handleSave} disabled={isSaveDisabled} style={{width: '100%', height: 52, background: isSaveDisabled ? '#F5F5F5' : '#181818', borderRadius: 14, border: 'none', cursor: isSaveDisabled ? 'not-allowed' : 'pointer'}}>
                            <div style={{color: isSaveDisabled ? '#6C6B6E' : 'white', fontSize: 16, fontFamily: 'Plus Jakarta Sans', fontWeight: '600', textTransform: 'capitalize', lineHeight: '24px'}}>Save</div>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SetNewPassword;
