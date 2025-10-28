import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ReactComponent as DocumentIcon } from '../assets/Document 2.svg';
import { ReactComponent as FolderIcon } from '../assets/Folder.svg';
import { ReactComponent as Folder1Icon } from '../assets/Folder1.svg';
import { ReactComponent as Folder1FilledIcon } from '../assets/Folder1-filled.svg';
import { ReactComponent as HouseIcon } from '../assets/House.svg';
import { ReactComponent as HouseFilledIcon } from '../assets/House-filled.svg';
import { ReactComponent as MessageIcon } from '../assets/Message circle.svg';
import { ReactComponent as MessageFilledIcon } from '../assets/Message circle - filled.svg';
import { ReactComponent as LogoutIcon } from '../assets/Logout-white.svg';
import { ReactComponent as UploadIcon } from '../assets/upload.svg';
import { ReactComponent as NotificationIcon } from '../assets/Bell-white.svg';
import { ReactComponent as SettingsIcon } from '../assets/Settings.svg';
import { ReactComponent as SettingsFilledIcon } from '../assets/Settings-filled.svg';
import { ReactComponent as SignoutIcon } from '../assets/signout.svg';
import LogoutModal from './LogoutModal';
import api from '../services/api';
import logo from '../assets/logo.png';

const LeftNav = ({ onNotificationClick }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const [isExpanded, setIsExpanded] = useState(true);
    const [showLogoutModal, setShowLogoutModal] = useState(false);
    const [hasUnreadNotifications, setHasUnreadNotifications] = useState(false);

    return (
        <div style={{width: isExpanded ? 205 : 84, height: '100%', background: '#181818', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', alignItems: isExpanded ? 'flex-start' : 'center', padding: '20px 0', transition: 'width 0.3s ease'}}>
            {/* Top Icons */}
            <div style={{display: 'flex', flexDirection: 'column', alignItems: isExpanded ? 'flex-start' : 'center', gap: 24, width: '100%', paddingLeft: isExpanded ? 20 : 0, paddingRight: isExpanded ? 20 : 0}}>
                <div style={{paddingBottom: 20, borderBottom: '1px solid rgba(255, 255, 255, 0.20)', display: 'flex', flexDirection: 'column', alignItems: isExpanded ? 'flex-start' : 'center', gap: 16, width: '100%'}}>
                    <div onClick={() => navigate('/home')} style={{display: 'flex', alignItems: 'center', gap: 12, justifyContent: isExpanded ? 'flex-start' : 'center', cursor: 'pointer'}}>
                        <img style={{width: 44, height: 44, borderRadius: '50%', border: '2px solid white', backgroundColor: 'transparent', display: 'block', verticalAlign: 'middle'}} src={logo} alt="Logo" />
                        {isExpanded && <div style={{color: 'white', fontSize: 24, fontWeight: 'bold', fontFamily: 'Plus Jakarta Sans', lineHeight: '44px'}}>KODA</div>}
                    </div>
                </div>
                <div style={{display: 'flex', flexDirection: 'column', gap: 16, width: '100%', alignItems: isExpanded ? 'flex-start' : 'center'}}>
                    <div onClick={() => navigate('/home')} style={{padding: 8, borderRadius: 8, cursor: 'pointer', background: location.pathname === '/home' ? 'rgba(255, 255, 255, 0.10)' : 'transparent', display: 'flex', alignItems: 'center', gap: 12, justifyContent: isExpanded ? 'flex-start' : 'center'}}>
                        {location.pathname === '/home' ? (
                            <HouseFilledIcon style={{width: 20, height: 20}} />
                        ) : (
                            <HouseIcon style={{width: 20, height: 20}} />
                        )}
                        {isExpanded && <span style={{color: 'white', fontSize: 14, fontWeight: '500'}}>Home</span>}
                    </div>
                    <div onClick={() => navigate('/documents')} style={{padding: 8, borderRadius: 8, cursor: 'pointer', background: location.pathname === '/documents' ? 'rgba(255, 255, 255, 0.10)' : 'transparent', display: 'flex', alignItems: 'center', gap: 12, justifyContent: isExpanded ? 'flex-start' : 'center'}}>
                        {location.pathname === '/documents' ? (
                            <Folder1FilledIcon style={{width: 20, height: 20}} />
                        ) : (
                            <Folder1Icon style={{width: 20, height: 20}} />
                        )}
                        {isExpanded && <span style={{color: 'white', fontSize: 14, fontWeight: '500'}}>Documents</span>}
                    </div>
                    <div onClick={() => navigate('/chat')} style={{padding: 8, borderRadius: 8, cursor: 'pointer', background: location.pathname === '/chat' ? 'rgba(255, 255, 255, 0.10)' : 'transparent', display: 'flex', alignItems: 'center', gap: 12, justifyContent: isExpanded ? 'flex-start' : 'center'}}>
                        {location.pathname === '/chat' ? (
                            <MessageFilledIcon style={{width: 20, height: 20, fill: 'white'}} />
                        ) : (
                            <MessageIcon style={{width: 20, height: 20, fill: 'white'}} />
                        )}
                        {isExpanded && <span style={{color: 'white', fontSize: 14, fontWeight: '500'}}>Chat</span>}
                    </div>
                    <div onClick={() => navigate('/upload-hub')} style={{padding: 8, borderRadius: 8, cursor: 'pointer', background: location.pathname === '/upload-hub' ? 'rgba(255, 255, 255, 0.10)' : 'transparent', display: 'flex', alignItems: 'center', gap: 12, justifyContent: isExpanded ? 'flex-start' : 'center'}}>
                        {location.pathname === '/upload-hub' ? (
                            <UploadIcon style={{width: 20, height: 20, fill: 'white'}} />
                        ) : (
                            <LogoutIcon style={{width: 20, height: 20, stroke: 'white', fill: 'none'}} />
                        )}
                        {isExpanded && <span style={{color: 'white', fontSize: 14, fontWeight: '500'}}>Upload</span>}
                    </div>
                </div>
            </div>

            {/* Bottom Icons */}
            <div style={{display: 'flex', flexDirection: 'column', alignItems: isExpanded ? 'flex-start' : 'center', gap: 12, borderTop: '1px solid rgba(255, 255, 255, 0.20)', paddingTop: 20, width: '100%', paddingLeft: isExpanded ? 20 : 0, paddingRight: isExpanded ? 20 : 0}}>
                <div onClick={onNotificationClick} style={{padding: 8, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: isExpanded ? 'flex-start' : 'center', gap: 12, cursor: 'pointer', minWidth: 36}}>
                    <div style={{position: 'relative', width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0}}>
                        <NotificationIcon style={{width: 20, height: 20}} />
                        {hasUnreadNotifications && (
                            <div style={{ width: 8, height: 8, position: 'absolute', right: -2, top: -2, background: '#D92D20', borderRadius: 9999 }} />
                        )}
                    </div>
                    {isExpanded && <span style={{color: 'white', fontSize: 14, fontWeight: '500'}}>Notifications</span>}
                </div>
                <div onClick={() => navigate('/settings')} style={{padding: 8, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: isExpanded ? 'flex-start' : 'center', gap: 12, cursor: 'pointer', minWidth: 36}}>
                    <div style={{width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0}}>
                        {location.pathname === '/settings' ? (
                            <SettingsFilledIcon style={{width: 20, height: 20, fill: 'white'}} />
                        ) : (
                            <SettingsIcon style={{width: 20, height: 20, fill: 'white'}} />
                        )}
                    </div>
                    {isExpanded && <span style={{color: 'white', fontSize: 14, fontWeight: '500'}}>Settings</span>}
                </div>
                <div
                    onClick={() => setShowLogoutModal(true)}
                    style={{padding: 8, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: isExpanded ? 'flex-start' : 'center', gap: 12, cursor: 'pointer', minWidth: 36}}
                >
                    <div style={{width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0}}>
                        <SignoutIcon style={{width: 20, height: 20, fill: 'white'}} />
                    </div>
                    {isExpanded && <span style={{color: 'white', fontSize: 14, fontWeight: '500'}}>Sign Out</span>}
                </div>
            </div>

            {/* Logout Modal */}
            <LogoutModal
                isOpen={showLogoutModal}
                onClose={() => setShowLogoutModal(false)}
            />
        </div>
    );
};

export default LeftNav;

