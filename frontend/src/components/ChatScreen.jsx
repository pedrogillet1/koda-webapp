import React, { useState, useEffect } from 'react';
import LeftNav from './LeftNav';
import ChatHistory from './ChatHistory';
import ChatInterface from './ChatInterface';
import NotificationPanel from './NotificationPanel';

const ChatScreen = () => {
    const [showNotificationsPopup, setShowNotificationsPopup] = useState(false);

    // Load current conversation from sessionStorage on mount (persists during session)
    const [currentConversation, setCurrentConversation] = useState(() => {
        const saved = sessionStorage.getItem('currentConversationId');
        if (saved) {
            return { id: saved }; // Will be fully loaded by ChatInterface
        }
        return null;
    });

    const [updateConversationInList, setUpdateConversationInList] = useState(null);

    // Save current conversation ID to sessionStorage whenever it changes
    useEffect(() => {
        if (currentConversation?.id) {
            sessionStorage.setItem('currentConversationId', currentConversation.id);
        } else {
            sessionStorage.removeItem('currentConversationId');
        }
    }, [currentConversation]);

    const handleSelectConversation = (conversation) => {
        setCurrentConversation(conversation);
    };

    const handleNewChat = (newConversation) => {
        setCurrentConversation(newConversation);
    };

    const handleConversationUpdate = (updatedConversation) => {
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
            <ChatHistory
                onSelectConversation={handleSelectConversation}
                currentConversation={currentConversation}
                onNewChat={handleNewChat}
                onConversationUpdate={registerUpdateFunction}
            />
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
