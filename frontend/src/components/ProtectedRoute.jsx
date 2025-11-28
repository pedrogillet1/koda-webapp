import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import WelcomeModal from './WelcomeModal';

/**
 * Protected Route Component
 *
 * Instead of redirecting unauthenticated users to login,
 * it shows the page content with a welcome popup.
 * Users can dismiss the popup and continue exploring,
 * or click the popup to sign in.
 */
const ProtectedRoute = ({ children }) => {
    const { isAuthenticated, loading } = useAuth();
    const [showWelcome, setShowWelcome] = useState(true);

    if (loading) {
        return (
            <div style={{
                width: '100%',
                height: '100vh',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                background: 'white'
            }}>
                <div style={{
                    color: '#6C6B6E',
                    fontSize: 16,
                    fontFamily: 'Plus Jakarta Sans',
                    fontWeight: '500'
                }}>
                    Loading...
                </div>
            </div>
        );
    }

    // If not authenticated, show content + welcome popup
    if (!isAuthenticated) {
        return (
            <>
                {children}
                <WelcomeModal
                    isOpen={showWelcome}
                    onClose={() => setShowWelcome(false)}
                />
            </>
        );
    }

    // If authenticated, show content normally
    return children;
};

export default ProtectedRoute;
