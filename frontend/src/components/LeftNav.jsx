import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ReactComponent as DocumentIcon } from '../assets/Document 2.svg';
import { ReactComponent as FolderIcon } from '../assets/Folder.svg';
import { ReactComponent as Folder1Icon } from '../assets/Folder1.svg';
import { ReactComponent as HouseIcon } from '../assets/House.svg';
import { ReactComponent as MessageIcon } from '../assets/Message circle.svg';
import { ReactComponent as LogoutIcon } from '../assets/Logout-white.svg';
import { ReactComponent as NotificationIcon } from '../assets/Bell-white.svg';
import { ReactComponent as SettingsIcon } from '../assets/Settings.svg';
import { ReactComponent as SignoutIcon } from '../assets/signout.svg';
import LogoutModal from './LogoutModal';
import { useIsMobile, useMobileBreakpoints } from '../hooks/useIsMobile';
import { useDocuments } from '../context/DocumentsContext';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import kodaLogoWhite from '../assets/koda-logo_white.svg';
import { spacing, radius, typography } from '../design/tokens';

const LeftNav = ({ onNotificationClick, hamburgerTop = 16 }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const { t } = useTranslation();
    const isMobile = useIsMobile();
    const mobile = useMobileBreakpoints();
    const { refreshAll } = useDocuments();
    const { user } = useAuth(); // ✅ Check if user is authenticated
    const [isExpanded, setIsExpanded] = useState(true);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [showLogoutModal, setShowLogoutModal] = useState(false);
    const [hasUnreadNotifications, setHasUnreadNotifications] = useState(false);

    // ADAPTIVE SIZING - MOBILE ONLY
    const hamburgerSize = isMobile ? mobile.buttonSize : 44;
    const hamburgerLeft = isMobile ? mobile.padding.base : 16;
    const sidebarWidth = isMobile ? (mobile.isSmallPhone ? 260 : 280) : 280;
    const sidebarPadding = isMobile ? `${mobile.padding.lg}px 0` : '20px 0';
    const menuItemPadding = isMobile ? `${mobile.padding.base}px ${mobile.padding.lg}px` : '12px 20px';
    const menuFontSize = isMobile ? mobile.fontSize.base : 14;
    const menuIconSize = isMobile ? mobile.iconSize.base : 24;

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

    // Mobile: No hamburger - navigation handled by MobileBottomNav
    if (isMobile) {
        return null;
    }

    // Desktop: Original sidebar
    return (
        <div style={{width: isExpanded ? 180 : 64, height: '100%', background: '#181818', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', alignItems: isExpanded ? 'flex-start' : 'center', paddingTop: 0, paddingBottom: spacing.xl, transition: 'width 0.3s ease'}}>
            {/* Top Icons */}
            <div style={{display: 'flex', flexDirection: 'column', alignItems: isExpanded ? 'flex-start' : 'center', gap: spacing.md, width: '100%', paddingLeft: isExpanded ? 20 : spacing.md, paddingRight: isExpanded ? 20 : spacing.md}}>
                <div style={{height: 84, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: isExpanded ? 'flex-start' : 'center', width: '100%', marginBottom: -12}}>
                    <div onClick={() => navigate('/home')} style={{display: 'flex', alignItems: 'center', justifyContent: isExpanded ? 'flex-start' : 'center', cursor: 'pointer'}}>
                        <img style={{height: 80}} src={kodaLogoWhite} alt="KODA Logo" />
                    </div>
                </div>
                {/* Separator line - aligns with header border at 84px from top */}
                <div style={{width: 'calc(100% + 40px)', marginLeft: -20, marginRight: -20, height: 1, background: 'rgba(255, 255, 255, 0.20)', marginBottom: spacing.sm}}></div>
                <div style={{display: 'flex', flexDirection: 'column', gap: spacing.lg, width: '100%', alignItems: isExpanded ? 'flex-start' : 'center'}}>
                    <div onClick={() => navigate('/home')} style={{padding: spacing.sm, borderRadius: 100, cursor: 'pointer', background: location.pathname === '/home' ? 'rgba(255, 255, 255, 0.10)' : 'transparent', display: 'flex', alignItems: 'center', gap: spacing.md, justifyContent: 'flex-start', width: isExpanded ? '100%' : 'auto', transition: 'background 0.2s ease, transform 0.15s ease'}} onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.04)'; if (location.pathname !== '/home') e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'; }} onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; if (location.pathname !== '/home') e.currentTarget.style.background = 'transparent'; }}>
                        <HouseIcon style={{width: 20, height: 20, flexShrink: 0, color: 'white'}} />
                        {isExpanded && <span style={{color: 'white', fontSize: typography.body.size, fontWeight: typography.bodyStrong.weight, fontFamily: typography.body.family}}>{t('nav.home')}</span>}
                    </div>
                    <div
                        onClick={() => navigate('/documents')}
                        onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.04)'; handleDocumentsHover(); if (location.pathname !== '/documents') e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; if (location.pathname !== '/documents') e.currentTarget.style.background = 'transparent'; }}
                        style={{padding: spacing.sm, borderRadius: 100, cursor: 'pointer', background: location.pathname === '/documents' ? 'rgba(255, 255, 255, 0.10)' : 'transparent', display: 'flex', alignItems: 'center', gap: spacing.md, justifyContent: 'flex-start', width: isExpanded ? '100%' : 'auto', transition: 'background 0.2s ease, transform 0.15s ease'}}
                    >
                        <Folder1Icon style={{width: 20, height: 20, flexShrink: 0, color: 'white'}} />
                        {isExpanded && <span style={{color: 'white', fontSize: typography.body.size, fontWeight: typography.bodyStrong.weight, fontFamily: typography.body.family}}>{t('nav.documents')}</span>}
                    </div>
                    <div onClick={() => navigate('/chat')} style={{padding: spacing.sm, borderRadius: 100, cursor: 'pointer', background: location.pathname === '/chat' ? 'rgba(255, 255, 255, 0.10)' : 'transparent', display: 'flex', alignItems: 'center', gap: spacing.md, justifyContent: 'flex-start', width: isExpanded ? '100%' : 'auto', transition: 'background 0.2s ease, transform 0.15s ease'}} onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.04)'; if (location.pathname !== '/chat') e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'; }} onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; if (location.pathname !== '/chat') e.currentTarget.style.background = 'transparent'; }}>
                        <MessageIcon style={{width: 20, height: 20, color: 'white', flexShrink: 0}} />
                        {isExpanded && <span style={{color: 'white', fontSize: typography.body.size, fontWeight: typography.bodyStrong.weight, fontFamily: typography.body.family}}>{t('nav.chat')}</span>}
                    </div>
                    <div onClick={() => navigate('/upload-hub')} style={{padding: spacing.sm, borderRadius: 100, cursor: 'pointer', background: location.pathname === '/upload-hub' ? 'rgba(255, 255, 255, 0.10)' : 'transparent', display: 'flex', alignItems: 'center', gap: spacing.md, justifyContent: 'flex-start', width: isExpanded ? '100%' : 'auto', transition: 'background 0.2s ease, transform 0.15s ease'}} onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.04)'; if (location.pathname !== '/upload-hub') e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'; }} onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; if (location.pathname !== '/upload-hub') e.currentTarget.style.background = 'transparent'; }}>
                        <LogoutIcon style={{width: 20, height: 20, flexShrink: 0}} />
                        {isExpanded && <span style={{color: 'white', fontSize: typography.body.size, fontWeight: typography.bodyStrong.weight, fontFamily: typography.body.family}}>{t('nav.upload')}</span>}
                    </div>
                </div>
            </div>

            {/* Bottom Icons */}
            <div style={{display: 'flex', flexDirection: 'column', alignItems: isExpanded ? 'flex-start' : 'center', gap: spacing.md, borderTop: '1px solid rgba(255, 255, 255, 0.20)', paddingTop: spacing.xl, width: '100%', paddingLeft: isExpanded ? 20 : spacing.md, paddingRight: isExpanded ? 20 : spacing.md}}>
                <div onClick={onNotificationClick} style={{padding: spacing.sm, borderRadius: 100, display: 'flex', alignItems: 'center', justifyContent: isExpanded ? 'flex-start' : 'center', gap: spacing.md, cursor: 'pointer', minWidth: 36, transition: 'background 0.2s ease, transform 0.15s ease'}} onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.04)'; e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'; }} onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.background = 'transparent'; }}>
                    <div style={{position: 'relative', width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0}}>
                        <NotificationIcon style={{width: 20, height: 20}} />
                        {hasUnreadNotifications && (
                            <div style={{ width: 8, height: 8, position: 'absolute', right: -2, top: -2, background: '#D92D20', borderRadius: 9999 }} />
                        )}
                    </div>
                    {isExpanded && <span style={{color: 'white', fontSize: typography.body.size, fontWeight: typography.bodyStrong.weight, fontFamily: typography.body.family}}>{t('nav.notifications')}</span>}
                </div>
                <div onClick={() => navigate('/settings')} style={{padding: spacing.sm, borderRadius: 100, display: 'flex', alignItems: 'center', justifyContent: isExpanded ? 'flex-start' : 'center', gap: spacing.md, cursor: 'pointer', minWidth: 36, transition: 'background 0.2s ease, transform 0.15s ease', background: location.pathname === '/settings' ? 'rgba(255, 255, 255, 0.10)' : 'transparent'}} onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.04)'; if (location.pathname !== '/settings') e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'; }} onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; if (location.pathname !== '/settings') e.currentTarget.style.background = 'transparent'; }}>
                    <div style={{width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0}}>
                        <SettingsIcon style={{width: 20, height: 20, color: 'white'}} />
                    </div>
                    {isExpanded && <span style={{color: 'white', fontSize: typography.body.size, fontWeight: typography.bodyStrong.weight, fontFamily: typography.body.family}}>{t('nav.settings')}</span>}
                </div>
                <div
                    data-action="logout"
                    className="logout-button"
                    onClick={handleAuthButtonClick}
                    style={{padding: spacing.sm, borderRadius: 100, display: 'flex', alignItems: 'center', justifyContent: isExpanded ? 'flex-start' : 'center', gap: spacing.md, cursor: 'pointer', minWidth: 36, transition: 'background 0.2s ease, transform 0.15s ease'}}
                    onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.04)'; e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.background = 'transparent'; }}
                >
                    <div style={{width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0}}>
                        <SignoutIcon style={{width: 20, height: 20, color: 'white'}} />
                    </div>
                    {isExpanded && <span style={{color: 'white', fontSize: typography.body.size, fontWeight: typography.bodyStrong.weight, fontFamily: typography.body.family}}>
                        {user ? t('nav.signOut') : t('nav.signIn')}
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

