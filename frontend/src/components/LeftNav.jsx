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
import { useIsMobile } from '../hooks/useIsMobile';
import { useDocuments } from '../context/DocumentsContext';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import logo from '../assets/logo.png';

const LeftNav = ({ onNotificationClick }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const isMobile = useIsMobile();
    const { refreshAll } = useDocuments();
    const { user } = useAuth(); // ✅ Check if user is authenticated
    const [isExpanded, setIsExpanded] = useState(true);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [showLogoutModal, setShowLogoutModal] = useState(false);
    const [hasUnreadNotifications, setHasUnreadNotifications] = useState(false);

    // ✅ Handle auth button click - Sign In or Sign Out based on authentication
    const handleAuthButtonClick = () => {
        if (user) {
            // User is logged in - show logout modal
            setShowLogoutModal(true);
            setIsMobileMenuOpen(false);
        } else {
            // User is not logged in - navigate to login
            navigate('/login');
            setIsMobileMenuOpen(false);
        }
    };

    // ✅ PREFETCH: Load documents data when user hovers over Documents nav item
    // This makes the Documents page appear instantly when clicked
    const handleDocumentsHover = () => {
        refreshAll();
    };

    // Close mobile menu when route changes
    useEffect(() => {
        if (isMobile) {
            setIsMobileMenuOpen(false);
        }
    }, [location.pathname, isMobile]);

    // Handle mobile navigation
    const handleMobileNavigate = (path) => {
        navigate(path);
        setIsMobileMenuOpen(false);
    };

    // Mobile: Hamburger button + overlay sidebar
    if (isMobile) {
        return (
            <>
                {/* Hamburger Button */}
                <button
                    onClick={() => setIsMobileMenuOpen(true)}
                    style={{
                        position: 'fixed',
                        top: 16,
                        left: 16,
                        zIndex: 1000,
                        width: 44,
                        height: 44,
                        background: '#181818',
                        border: 'none',
                        borderRadius: 12,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)'
                    }}
                >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M3 12H21M3 6H21M3 18H21" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                </button>

                {/* Backdrop Overlay */}
                {isMobileMenuOpen && (
                    <div
                        onClick={() => setIsMobileMenuOpen(false)}
                        style={{
                            position: 'fixed',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            background: 'rgba(0, 0, 0, 0.5)',
                            zIndex: 1001,
                            transition: 'opacity 0.3s ease'
                        }}
                    />
                )}

                {/* Sidebar Drawer */}
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    bottom: 0,
                    width: 280,
                    background: '#181818',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    padding: '20px 0',
                    transform: isMobileMenuOpen ? 'translateX(0)' : 'translateX(-100%)',
                    transition: 'transform 0.3s ease',
                    zIndex: 1002,
                    overflowY: 'auto'
                }}>
                    {/* Close button */}
                    <div style={{position: 'absolute', top: 16, right: 16}}>
                        <button
                            onClick={() => setIsMobileMenuOpen(false)}
                            style={{
                                width: 36,
                                height: 36,
                                background: 'transparent',
                                border: 'none',
                                color: 'white',
                                fontSize: 24,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}
                        >
                            ×
                        </button>
                    </div>

                    {/* Top Icons */}
                    <div style={{display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 24, width: '100%', paddingLeft: 20, paddingRight: 20}}>
                        <div style={{paddingBottom: 20, borderBottom: '1px solid rgba(255, 255, 255, 0.20)', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 16, width: '100%'}}>
                            <div onClick={() => handleMobileNavigate('/home')} style={{display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer'}}>
                                <img style={{width: 44, height: 44, borderRadius: '50%', border: '2px solid white', backgroundColor: 'transparent'}} src={logo} alt="Logo" />
                                <div style={{color: 'white', fontSize: 24, fontWeight: 'bold', fontFamily: 'Plus Jakarta Sans'}}>KODA</div>
                            </div>
                        </div>
                        <div style={{display: 'flex', flexDirection: 'column', gap: 16, width: '100%'}}>
                            <div onClick={() => handleMobileNavigate('/home')} style={{padding: 8, borderRadius: 8, cursor: 'pointer', background: location.pathname === '/home' ? 'rgba(255, 255, 255, 0.10)' : 'transparent', display: 'flex', alignItems: 'center', gap: 12}}>
                                {location.pathname === '/home' ? <HouseFilledIcon style={{width: 20, height: 20}} /> : <HouseIcon style={{width: 20, height: 20}} />}
                                <span style={{color: 'white', fontSize: 14, fontWeight: '500'}}>Home</span>
                            </div>
                            <div
                                onClick={() => handleMobileNavigate('/documents')}
                                onMouseEnter={handleDocumentsHover}
                                style={{padding: 8, borderRadius: 8, cursor: 'pointer', background: location.pathname === '/documents' ? 'rgba(255, 255, 255, 0.10)' : 'transparent', display: 'flex', alignItems: 'center', gap: 12}}
                            >
                                {location.pathname === '/documents' ? <Folder1FilledIcon style={{width: 20, height: 20}} /> : <Folder1Icon style={{width: 20, height: 20}} />}
                                <span style={{color: 'white', fontSize: 14, fontWeight: '500'}}>Documents</span>
                            </div>
                            <div onClick={() => handleMobileNavigate('/chat')} style={{padding: 8, borderRadius: 8, cursor: 'pointer', background: location.pathname === '/chat' ? 'rgba(255, 255, 255, 0.10)' : 'transparent', display: 'flex', alignItems: 'center', gap: 12}}>
                                {location.pathname === '/chat' ? <MessageFilledIcon style={{width: 20, height: 20, fill: 'white'}} /> : <MessageIcon style={{width: 20, height: 20, fill: 'white'}} />}
                                <span style={{color: 'white', fontSize: 14, fontWeight: '500'}}>Chat</span>
                            </div>
                            <div onClick={() => handleMobileNavigate('/upload-hub')} style={{padding: 8, borderRadius: 8, cursor: 'pointer', background: location.pathname === '/upload-hub' ? 'rgba(255, 255, 255, 0.10)' : 'transparent', display: 'flex', alignItems: 'center', gap: 12}}>
                                {location.pathname === '/upload-hub' ? <UploadIcon style={{width: 20, height: 20, fill: 'white'}} /> : <LogoutIcon style={{width: 20, height: 20, stroke: 'white', fill: 'none'}} />}
                                <span style={{color: 'white', fontSize: 14, fontWeight: '500'}}>Upload</span>
                            </div>
                        </div>
                    </div>

                    {/* Bottom Icons */}
                    <div style={{display: 'flex', flexDirection: 'column', gap: 12, borderTop: '1px solid rgba(255, 255, 255, 0.20)', paddingTop: 20, width: '100%', paddingLeft: 20, paddingRight: 20}}>
                        <div onClick={() => { onNotificationClick(); setIsMobileMenuOpen(false); }} style={{padding: 8, borderRadius: 12, display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer'}}>
                            <div style={{position: 'relative', width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                                <NotificationIcon style={{width: 20, height: 20}} />
                                {hasUnreadNotifications && <div style={{width: 8, height: 8, position: 'absolute', right: -2, top: -2, background: '#D92D20', borderRadius: 9999}} />}
                            </div>
                            <span style={{color: 'white', fontSize: 14, fontWeight: '500'}}>Notifications</span>
                        </div>
                        <div onClick={() => handleMobileNavigate('/settings')} style={{padding: 8, borderRadius: 12, display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer'}}>
                            {location.pathname === '/settings' ? <SettingsFilledIcon style={{width: 20, height: 20, fill: 'white'}} /> : <SettingsIcon style={{width: 20, height: 20, fill: 'white'}} />}
                            <span style={{color: 'white', fontSize: 14, fontWeight: '500'}}>Settings</span>
                        </div>
                        <div onClick={handleAuthButtonClick} style={{padding: 8, borderRadius: 12, display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer'}}>
                            <SignoutIcon style={{width: 20, height: 20, fill: 'white'}} />
                            <span style={{color: 'white', fontSize: 14, fontWeight: '500'}}>
                                {user ? 'Sign Out' : 'Sign In'}
                            </span>
                        </div>
                    </div>

                    {/* Logout Modal */}
                    <LogoutModal
                        isOpen={showLogoutModal}
                        onClose={() => setShowLogoutModal(false)}
                    />
                </div>
            </>
        );
    }

    // Desktop: Original sidebar
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
                    <div
                        onClick={() => navigate('/documents')}
                        onMouseEnter={handleDocumentsHover}
                        style={{padding: 8, borderRadius: 8, cursor: 'pointer', background: location.pathname === '/documents' ? 'rgba(255, 255, 255, 0.10)' : 'transparent', display: 'flex', alignItems: 'center', gap: 12, justifyContent: isExpanded ? 'flex-start' : 'center'}}
                    >
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
                    onClick={handleAuthButtonClick}
                    style={{padding: 8, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: isExpanded ? 'flex-start' : 'center', gap: 12, cursor: 'pointer', minWidth: 36}}
                >
                    <div style={{width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0}}>
                        <SignoutIcon style={{width: 20, height: 20, fill: 'white'}} />
                    </div>
                    {isExpanded && <span style={{color: 'white', fontSize: 14, fontWeight: '500'}}>
                        {user ? 'Sign Out' : 'Sign In'}
                    </span>}
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

