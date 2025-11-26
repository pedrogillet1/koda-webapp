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
        if (savedConversationId) {
            // Return a minimal conversation object, will be fully loaded by useEffect
            hadInitialConversationRef.current = true;
            return { id: savedConversationId, title: 'Loading...' };
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

    // ✅ FIX: Save conversation to sessionStorage to persist on refresh
    useEffect(() => {
        if (currentConversation?.id) {
            sessionStorage.setItem('currentConversationId', currentConversation.id);
        } else {
            sessionStorage.removeItem('currentConversationId');
        }
    }, [currentConversation]);

    // ✅ FIX: Load full conversation details if only minimal object exists
    useEffect(() => {
        const loadFullConversation = async () => {
            // Check if current conversation is a minimal object (title is 'Loading...')
            if (currentConversation?.id && currentConversation?.title === 'Loading...') {
                console.log('🔄 [ChatScreen] Loading full conversation details for:', currentConversation.id);
                try {
                    const fullConversation = await chatService.getConversation(currentConversation.id);
                    console.log('✅ [ChatScreen] Loaded full conversation:', fullConversation);
                    setCurrentConversation(fullConversation);
                } catch (error) {
                    console.error('❌ [ChatScreen] Error loading full conversation:', error);
                    // If conversation doesn't exist (404), create a new one
                    if (error.response?.status === 404) {
                        console.log('⚠️ [ChatScreen] Conversation not found, creating new one...');
                        try {
                            const newConversation = await chatService.createConversation();
                            setCurrentConversation(newConversation);
                            if (updateConversationInList) {
                                updateConversationInList(newConversation);
                            }
                        } catch (createError) {
                            console.error('❌ [ChatScreen] Error creating new conversation:', createError);
                            setCurrentConversation(null);
                        }
                    }
                }
            }
        };

        loadFullConversation();
    }, [currentConversation?.id, currentConversation?.title, updateConversationInList]);

    // ✅ FIX #2: Create a new conversation on first visit if none exists
    // ✅ OPTIMISTIC LOADING: Non-blocking conversation creation
    // Greeting shows immediately, conversation creates in background
    useEffect(() => {
        const initializeChat = async () => {
            // Only create if no conversation exists and not already loading one
            if (!currentConversation && !location.state?.newConversation) {
                console.log('🆕 [ChatScreen] First visit - creating initial conversation...');

                try {
                    // Create conversation in background (non-blocking)
                    const newConversation = await chatService.createConversation('New Chat');
                    console.log('✅ [ChatScreen] Initial conversation created:', newConversation);
                    console.log('📋 [ChatScreen] Conversation details:', {
                        id: newConversation.id,
                        title: newConversation.title,
                        hasTitle: !!newConversation.title
                    });
                    setCurrentConversation(newConversation);
                } catch (error) {
                    console.error('❌ [ChatScreen] Error creating initial conversation:', error);
                }
            } else {
                console.log('⏭️ [ChatScreen] Skipping conversation creation:', {
                    hasCurrentConversation: !!currentConversation,
                    hasNavigationState: !!location.state?.newConversation
                });
            }
        };

        initializeChat(); // Non-blocking
    }, []); // Only run on mount

    // ✅ FIX: Add initial conversation to history when both conversation and update function are available
    useEffect(() => {
        console.log('🔍 [ChatScreen] useEffect triggered - checking if should add to history:', {
            hasConversation: !!currentConversation,
            conversationId: currentConversation?.id?.substring(0, 8),
            hasUpdateFunction: !!updateConversationInList,
            alreadyAdded: initialConversationAddedRef.current,
            hadInitialConversation: hadInitialConversationRef.current
        });

        if (currentConversation && updateConversationInList && !initialConversationAddedRef.current) {
            // Only add if there was NO conversation on mount (meaning it was newly created)
            if (!hadInitialConversationRef.current) {
                console.log('📋 [ChatScreen] Adding initial conversation to history list:', currentConversation.id.substring(0, 8));
                console.log('📋 [ChatScreen] Conversation to add:', currentConversation);
                updateConversationInList(currentConversation);
            } else {
                console.log('⏭️ [ChatScreen] Skipping add - conversation existed on mount:', currentConversation.id.substring(0, 8));
            }

            initialConversationAddedRef.current = true; // Mark as handled to prevent duplicate checks
        }
    }, [currentConversation, updateConversationInList]); // Run when either becomes available

    const handleSelectConversation = (conversation) => {
        setCurrentConversation(conversation);
    };

    const handleNewChat = async (existingConversation, replacingTempId) => {
        try {
            // If this is replacing a temp conversation with the real one
            if (replacingTempId) {
                console.log('🔄 [ChatScreen] Replacing temp conversation', replacingTempId, 'with real:', existingConversation.id);
                // Update current conversation if it's the temp one being replaced
                setCurrentConversation(prev =>
                    prev?.id === replacingTempId ? existingConversation : prev
                );
                return;
            }

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

        // Add to conversation list
        if (updateConversationInList) {
            console.log('📋 [ChatScreen] Adding newly created conversation to history list:', newConversation.id.substring(0, 8));
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
