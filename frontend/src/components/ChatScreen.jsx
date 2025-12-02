import React, { useState, useEffect, useRef } from 'react';
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
    const initialConversationAddedRef = useRef(false); // Track if initial conversation was added to history
    const hadInitialConversationRef = useRef(false); // Track if there was a conversation on mount

    // Load current conversation from sessionStorage on mount (persists during session)
    const [currentConversation, setCurrentConversation] = useState(() => {
        // Check if a new conversation was passed via navigation state
        if (location.state?.newConversation) {
            hadInitialConversationRef.current = true; // Had a conversation on mount
            return location.state.newConversation;
        }

        // ✅ FIX: Load conversation from sessionStorage to persist on refresh
        const savedConversationId = sessionStorage.getItem('currentConversationId');
        if (savedConversationId && savedConversationId !== 'new') {
            // Return a minimal conversation object, will be fully loaded by useEffect
            hadInitialConversationRef.current = true;
            return { id: savedConversationId, title: 'Loading...' };
        }

        // ✅ NEW: Start with ephemeral "New Chat" placeholder
        return {
            id: 'new',
            title: 'New Chat',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            isEphemeral: true
        };
    });

    const [updateConversationInList, setUpdateConversationInList] = useState(null);

    // Check for new conversation passed via navigation state
    useEffect(() => {
        if (location.state?.newConversation) {
            setCurrentConversation(location.state.newConversation);
        }
    }, [location.state]);

    // ✅ FIX: Save conversation to sessionStorage to persist on refresh
    // Don't save ephemeral conversations - they should start fresh on reload
    useEffect(() => {
        if (currentConversation?.id && currentConversation.id !== 'new' && !currentConversation.isEphemeral) {
            sessionStorage.setItem('currentConversationId', currentConversation.id);
        } else {
            sessionStorage.removeItem('currentConversationId');
        }
    }, [currentConversation]);

    // ✅ FIX: Load full conversation details if only minimal object exists
    useEffect(() => {
        const loadFullConversation = async () => {
            // Skip ephemeral conversations
            if (currentConversation?.id === 'new' || currentConversation?.isEphemeral) {
                console.log('⏭️ [ChatScreen] Skipping load - ephemeral conversation');
                return;
            }

            // Check if current conversation is a minimal object (title is 'Loading...')
            if (currentConversation?.id && currentConversation?.title === 'Loading...') {
                console.log('🔄 [ChatScreen] Loading full conversation details for:', currentConversation.id);
                try {
                    const fullConversation = await chatService.getConversation(currentConversation.id);
                    console.log('✅ [ChatScreen] Loaded full conversation:', fullConversation);
                    setCurrentConversation(fullConversation);
                } catch (error) {
                    console.error('❌ [ChatScreen] Error loading full conversation:', error);
                    // If conversation doesn't exist (404), show ephemeral new chat
                    if (error.response?.status === 404) {
                        console.log('⚠️ [ChatScreen] Conversation not found, showing ephemeral new chat...');
                        setCurrentConversation({
                            id: 'new',
                            title: 'New Chat',
                            createdAt: new Date().toISOString(),
                            updatedAt: new Date().toISOString(),
                            isEphemeral: true
                        });
                    }
                }
            }
        };

        loadFullConversation();
    }, [currentConversation?.id, currentConversation?.title, updateConversationInList]);

    // ✅ NEW: With ephemeral conversations, we don't need to auto-create on mount
    // The ephemeral "New Chat" placeholder is shown by default
    // A real conversation is only created when the user sends their first message

    // ✅ FIX: Add conversation to history when it becomes real (not ephemeral)
    useEffect(() => {
        // Skip ephemeral conversations - they shouldn't be added to history
        if (!currentConversation || currentConversation.id === 'new' || currentConversation.isEphemeral) {
            return;
        }

        console.log('🔍 [ChatScreen] useEffect triggered - checking if should add to history:', {
            hasConversation: !!currentConversation,
            conversationId: currentConversation?.id?.substring(0, 8),
            hasUpdateFunction: !!updateConversationInList,
            alreadyAdded: initialConversationAddedRef.current,
            hadInitialConversation: hadInitialConversationRef.current
        });

        if (updateConversationInList && !initialConversationAddedRef.current) {
            // Only add if there was NO conversation on mount (meaning it was newly created)
            if (!hadInitialConversationRef.current) {
                console.log('📋 [ChatScreen] Adding conversation to history list:', currentConversation.id?.substring(0, 8));
                console.log('📋 [ChatScreen] Conversation to add:', currentConversation);
                updateConversationInList(currentConversation);
            } else {
                console.log('⏭️ [ChatScreen] Skipping add - conversation existed on mount:', currentConversation.id?.substring(0, 8));
            }

            initialConversationAddedRef.current = true; // Mark as handled to prevent duplicate checks
        }
    }, [currentConversation, updateConversationInList]); // Run when either becomes available

    const handleSelectConversation = (conversation) => {
        setCurrentConversation(conversation);
    };

    const handleNewChat = (ephemeralConversation) => {
        console.log('🆕 [ChatScreen] Starting new chat...');

        // ✅ NEW: Use ephemeral conversation from ChatHistory (no API call)
        setCurrentConversation(ephemeralConversation || {
            id: 'new',
            title: 'New Chat',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            isEphemeral: true
        });

        // Reset the initial conversation tracking so the next real conversation gets added to history
        initialConversationAddedRef.current = false;
        hadInitialConversationRef.current = false;
    };

    const handleConversationUpdate = async (updatedConversation) => {
        // If updatedConversation is null, it means the conversation was not found (404)
        // Show ephemeral new chat
        if (updatedConversation === null) {
            console.log('⚠️ [ChatScreen] Conversation not found, showing ephemeral new chat...');
            setCurrentConversation({
                id: 'new',
                title: 'New Chat',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                isEphemeral: true
            });
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

        // Add to conversation list
        if (updateConversationInList) {
            console.log('📋 [ChatScreen] Adding newly created conversation to history list:', newConversation.id?.substring(0, 8));
            updateConversationInList(newConversation);
            // Prevent the useEffect from trying to add the initial conversation later
            initialConversationAddedRef.current = true;
        }
    };

    // Receive the update function from ChatHistory
    const registerUpdateFunction = (updateFn) => {
        setUpdateConversationInList(() => updateFn);
    };

    return (
        <div data-chat-container="true" className="chat-container" style={{
            width: '100%',
            height: isMobile ? 'auto' : '100%',
            minHeight: isMobile ? '100vh' : 'auto',
            background: '#F5F5F5',
            display: 'flex',
            overflow: isMobile ? 'visible' : 'hidden',
            flexDirection: 'row',
            position: 'relative'
        }}>
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
