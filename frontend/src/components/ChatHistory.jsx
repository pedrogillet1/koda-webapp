import React, { useState, useEffect, useCallback } from 'react';
import { ReactComponent as SearchIcon } from '../assets/Search.svg';
import { ReactComponent as EditIcon } from '../assets/Edit4.svg';
import { ReactComponent as TrashIcon } from '../assets/Trash can.svg';
import * as chatService from '../services/chatService';
import DeleteConfirmationModal from './DeleteConfirmationModal';

const ChatHistory = ({ onSelectConversation, currentConversation, onNewChat, onConversationUpdate }) => {
    const [conversations, setConversations] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [hoveredConversation, setHoveredConversation] = useState(null);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [itemToDelete, setItemToDelete] = useState(null);

    useEffect(() => {
        loadConversations();
    }, []);

    // Add new conversation to list when it doesn't exist yet (instead of full reload)
    useEffect(() => {
        if (currentConversation && !conversations.find(c => c.id === currentConversation.id)) {
            // Add the new conversation to the top of the list
            console.log('➕ Adding new conversation to list:', currentConversation.id);
            setConversations(prevConversations => {
                // Double-check it doesn't exist before adding
                if (prevConversations.find(c => c.id === currentConversation.id)) {
                    console.log('⚠️ Conversation already in list, skipping');
                    return prevConversations;
                }
                return [currentConversation, ...prevConversations];
            });
        }
    }, [currentConversation]);

    // Update conversation in the list (used for title updates)
    // Use useCallback to prevent infinite loop
    const updateConversationInList = useCallback((updatedConversation) => {
        console.log('📝 ChatHistory: Updating conversation', updatedConversation);
        setConversations(prevConversations =>
            prevConversations.map(conv =>
                conv.id === updatedConversation.id
                    ? { ...conv, ...updatedConversation, updatedAt: new Date().toISOString() }
                    : conv
            )
        );
    }, []);

    // Expose the update function to parent component
    useEffect(() => {
        if (onConversationUpdate) {
            onConversationUpdate(updateConversationInList);
        }
    }, [onConversationUpdate, updateConversationInList]);

    const loadConversations = async () => {
        try {
            const data = await chatService.getConversations();
            setConversations(data);
        } catch (error) {
            console.error('Error loading conversations:', error);
        }
    };

    const handleNewChat = async () => {
        try {
            const newConversation = await chatService.createConversation();
            // Don't add to conversations list here - the useEffect will handle it when onNewChat triggers currentConversation change
            onNewChat?.(newConversation);
        } catch (error) {
            console.error('Error creating conversation:', error);
        }
    };

    const handleDeleteAll = async () => {
        setItemToDelete({ type: 'all' });
        setShowDeleteModal(true);
    };

    const handleDeleteConversation = async (conversationId, e) => {
        e.stopPropagation(); // Prevent conversation selection when clicking delete
        const conversation = conversations.find(c => c.id === conversationId);
        setItemToDelete({
            type: 'conversation',
            id: conversationId,
            name: conversation?.title || 'this conversation'
        });
        setShowDeleteModal(true);
    };

    const handleConfirmDelete = async () => {
        if (!itemToDelete) return;

        try {
            if (itemToDelete.type === 'all') {
                await chatService.deleteAllConversations();
                setConversations([]);
                onSelectConversation?.(null);
            } else if (itemToDelete.type === 'conversation') {
                await chatService.deleteConversation(itemToDelete.id);
                setConversations(conversations.filter(c => c.id !== itemToDelete.id));

                // If deleting current conversation, clear selection
                if (currentConversation?.id === itemToDelete.id) {
                    onSelectConversation?.(null);
                }
            }
        } catch (error) {
            console.error('Error deleting:', error);
        } finally {
            setShowDeleteModal(false);
            setItemToDelete(null);
        }
    };

    const groupConversationsByDate = () => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        const twoDaysAgo = new Date(today);
        twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

        const grouped = {
            Today: [],
            Yesterday: [],
            '2 days ago': [],
            Older: [],
        };

        conversations
            .filter((conv) =>
                (conv.title || 'New Chat').toLowerCase().includes(searchQuery.toLowerCase())
            )
            .forEach((conv) => {
                const convDate = new Date(conv.updatedAt);
                convDate.setHours(0, 0, 0, 0);

                if (convDate.getTime() === today.getTime()) {
                    grouped.Today.push(conv);
                } else if (convDate.getTime() === yesterday.getTime()) {
                    grouped.Yesterday.push(conv);
                } else if (convDate.getTime() === twoDaysAgo.getTime()) {
                    grouped['2 days ago'].push(conv);
                } else {
                    grouped.Older.push(conv);
                }
            });

        return grouped;
    };

    const groupedConversations = groupConversationsByDate();

    return (
        <div style={{width: 314, height: '100%', padding: 20, background: 'white', borderRight: '1px solid #E6E6EC', display: 'flex', flexDirection: 'column', gap: 20}}>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                <div style={{color: '#32302C', fontSize: 18, fontFamily: 'Plus Jakarta Sans', fontWeight: '700'}}>Chat</div>
                <div
                    onClick={handleNewChat}
                    style={{width: 44, height: 44, padding: 8, background: '#171717', borderRadius: 14, display: 'flex', justifyContent: 'center', alignItems: 'center', cursor: 'pointer'}}
                >
                    <EditIcon style={{width: 24, height: 24, color: 'white'}} />
                </div>
            </div>

            <div style={{position: 'relative'}}>
                <input
                    type="text"
                    placeholder="Search for conversation..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{width: '100%', height: 44, padding: '10px 12px 10px 40px', background: '#F5F5F5', borderRadius: 100, border: '1px solid #E6E6EC', outline: 'none', fontSize: 14}}
                />
                <SearchIcon style={{width: 20, height: 20, color: '#32302C', position: 'absolute', left: 12, top: 12}} />
            </div>

            <div style={{flex: '1 1 0', overflowY: 'auto'}}>
                {Object.entries(groupedConversations).map(([day, list]) => {
                    if (list.length === 0) return null;

                    return (
                        <div key={day} style={{marginBottom: 20}}>
                            <div style={{color: '#32302C', fontSize: 12, fontFamily: 'Plus Jakarta Sans', fontWeight: '700', textTransform: 'uppercase', marginBottom: 12}}>{day}</div>
                            <div>
                                {list.map((convo) => (
                                    <div
                                        key={convo.id}
                                        onClick={() => onSelectConversation?.(convo)}
                                        onMouseEnter={() => setHoveredConversation(convo.id)}
                                        onMouseLeave={() => setHoveredConversation(null)}
                                        style={{
                                            padding: '12px 14px',
                                            background: currentConversation?.id === convo.id ? '#F5F5F5' : 'transparent',
                                            borderRadius: 12,
                                            color: currentConversation?.id === convo.id ? '#32302C' : '#6C6B6E',
                                            fontSize: 14,
                                            fontFamily: 'Plus Jakarta Sans',
                                            fontWeight: '600',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            gap: 8,
                                        }}
                                    >
                                        <div style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {convo.title || 'New Chat'}
                                        </div>
                                        {hoveredConversation === convo.id && (
                                            <div
                                                onClick={(e) => handleDeleteConversation(convo.id, e)}
                                                style={{
                                                    width: 28,
                                                    height: 28,
                                                    borderRadius: 8,
                                                    display: 'flex',
                                                    justifyContent: 'center',
                                                    alignItems: 'center',
                                                    cursor: 'pointer',
                                                    flexShrink: 0,
                                                }}
                                                onMouseEnter={(e) => {
                                                    e.currentTarget.style.background = '#FEE4E2';
                                                }}
                                                onMouseLeave={(e) => {
                                                    e.currentTarget.style.background = 'transparent';
                                                }}
                                            >
                                                <TrashIcon style={{ width: 16, height: 16, color: '#D92D20' }} />
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    );
                })}
                {conversations.length === 0 && (
                    <div style={{textAlign: 'center', color: '#6C6B6E', fontSize: 14, marginTop: 20}}>
                        No conversations yet. Start a new chat!
                    </div>
                )}
            </div>

            {conversations.length > 0 && (
                <div
                    onClick={handleDeleteAll}
                    style={{paddingTop: 12, borderTop: '1px solid #E6E6EC', textAlign: 'center', color: '#D92D20', fontSize: 14, fontFamily: 'Plus Jakarta Sans', fontWeight: '700', cursor: 'pointer'}}
                >
                    Delete All
                </div>
            )}

            <DeleteConfirmationModal
                isOpen={showDeleteModal}
                onClose={() => {
                    setShowDeleteModal(false);
                    setItemToDelete(null);
                }}
                onConfirm={handleConfirmDelete}
                itemName={itemToDelete?.type === 'all' ? 'all conversations' : itemToDelete?.name}
            />
        </div>
    );
};

export default ChatHistory;
