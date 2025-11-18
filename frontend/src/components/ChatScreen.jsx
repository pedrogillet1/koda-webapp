import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import LeftNav from './LeftNav';
import ChatHistory from './ChatHistory';
import ChatInterface from './ChatInterface';
import NotificationPanel from './NotificationPanel';
import { useIsMobile } from '../hooks/useIsMobile';
import chatService from '../services/chatService';

const ChatScreen = () => {
    const location = useLocation();
    const isMobile = useIsMobile();
    const [showNotificationsPopup, setShowNotificationsPopup] = useState(false);
    const [showMobileChatHistory, setShowMobileChatHistory] = useState(false);

    // Load current conversation from sessionStorage on mount (persists during session)
    const [currentConversation, setCurrentConversation] = useState(() => {
        // Check if a new conversation was passed via navigation state
        if (location.state?.newConversation) {
            return location.state.newConversation;
        }

        const saved = sessionStorage.getItem('currentConversationId');
        if (saved) {
            return { id: saved }; // Will be fully loaded by ChatInterface
        }
        return null;
    });

    const [updateConversationInList, setUpdateConversationInList] = useState(null);

    // Check for new conversation passed via navigation state
    useEffect(() => {
        if (location.state?.newConversation) {
            setCurrentConversation(location.state.newConversation);
        }
    }, [location.state]);

    // Save current conversation ID to sessionStorage whenever it changes
    useEffect(() => {
        if (currentConversation?.id) {
            sessionStorage.setItem('currentConversationId', currentConversation.id);
        } else {
            sessionStorage.removeItem('currentConversationId');
        }
    }, [currentConversation]);

    // ✅ FIX #2: Create a new conversation on first visit if none exists
    useEffect(() => {
        const initializeChat = async () => {
            // Only create if no conversation exists and not already loading one
            if (!currentConversation && !location.state?.newConversation) {
                try {
                    console.log('🆕 [ChatScreen] First visit - creating initial conversation...');
                    const newConversation = await chatService.createConversation();
                    console.log('✅ [ChatScreen] Initial conversation created:', newConversation.id);
                    setCurrentConversation(newConversation);
                } catch (error) {
                    console.error('❌ [ChatScreen] Error creating initial conversation:', error);
                }
            }
        };

        initializeChat();
    }, []); // Empty dependency array - only run on mount

    // ✅ FIX: Add initial conversation to history list when updateConversationInList becomes available
    useEffect(() => {
        if (currentConversation && updateConversationInList) {
            console.log('📋 [ChatScreen] Adding conversation to history list:', currentConversation.id.substring(0, 8));
            updateConversationInList(currentConversation);
        }
    }, [updateConversationInList]); // Run when updateConversationInList is registered

    const handleSelectConversation = (conversation) => {
        setCurrentConversation(conversation);
    };

    const handleNewChat = async (existingConversation) => {
        try {
            // If conversation already created by ChatHistory, use it
            if (existingConversation) {
                console.log('✅ [ChatScreen] Using conversation from ChatHistory:', existingConversation.id);
                setCurrentConversation(existingConversation);
                return;
            }

            // Otherwise create a new conversation
            console.log('🆕 [ChatScreen] Creating new chat...');
            const newConversation = await chatService.createConversation();
            console.log('✅ [ChatScreen] New chat created:', newConversation.id);
            setCurrentConversation(newConversation);

            // Add to conversation list via callback
            if (updateConversationInList) {
                updateConversationInList(newConversation);
            }
        } catch (error) {
            console.error('❌ Error creating new chat:', error);
            // Fallback to clearing conversation
            setCurrentConversation(null);
        }
    };

    const handleConversationUpdate = async (updatedConversation) => {
        // If updatedConversation is null, it means the conversation was not found (404)
        // Create a new conversation automatically
        if (updatedConversation === null) {
            console.log('⚠️ [ChatScreen] Conversation not found, creating new one...');
            try {
                const newConversation = await chatService.createConversation();
                console.log('✅ [ChatScreen] New conversation created after 404:', newConversation.id);
                setCurrentConversation(newConversation);

                // Add to conversation list
                if (updateConversationInList) {
                    updateConversationInList(newConversation);
                }
            } catch (error) {
                console.error('❌ [ChatScreen] Error creating new conversation after 404:', error);
                setCurrentConversation(null);
            }
            return;
        }

        // Update current conversation state
        setCurrentConversation(prev => prev ? { ...prev, ...updatedConversation } : null);

        // Also update in the conversation list via ChatHistory's update function
        if (updateConversationInList) {
            updateConversationInList(updatedConversation);
        }
    };

    const handleConversationCreated = (newConversation) => {
        setCurrentConversation(newConversation);
    };

    // Receive the update function from ChatHistory
    const registerUpdateFunction = (updateFn) => {
        setUpdateConversationInList(() => updateFn);
    };

    return (
        <div style={{width: '100%', height: '100%', background: '#F5F5F5', display: 'flex', overflow: 'hidden'}}>
            <LeftNav onNotificationClick={() => setShowNotificationsPopup(true)} />

            {/* Mobile: Hide ChatHistory, show full-width ChatInterface */}
            {!isMobile && (
                <ChatHistory
                    onSelectConversation={handleSelectConversation}
                    currentConversation={currentConversation}
                    onNewChat={handleNewChat}
                    onConversationUpdate={registerUpdateFunction}
                />
            )}

            <ChatInterface
                currentConversation={currentConversation}
                onConversationUpdate={handleConversationUpdate}
                onConversationCreated={handleConversationCreated}
            />

            <NotificationPanel
                showNotificationsPopup={showNotificationsPopup}
                setShowNotificationsPopup={setShowNotificationsPopup}
            />
        </div>
    );
};

export default ChatScreen;
