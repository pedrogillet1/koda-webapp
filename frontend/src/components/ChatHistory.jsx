import React, { useState, useEffect, useCallback } from 'react';
import { ReactComponent as SearchIcon } from '../assets/Search.svg';
import { ReactComponent as TrashIcon } from '../assets/Trash can.svg';
import { ReactComponent as PencilIcon } from '../assets/pencil-ai.svg';
import { ReactComponent as ExpandIcon } from '../assets/expand.svg';
import * as chatService from '../services/chatService';
import DeleteConfirmationModal from './DeleteConfirmationModal';

const ChatHistory = ({ onSelectConversation, currentConversation, onNewChat, onConversationUpdate }) => {
    const [conversations, setConversations] = useState(() => {
        // Load from cache immediately for instant display
        const cached = sessionStorage.getItem('koda_chat_conversations');
        if (cached) {
            try {
                return JSON.parse(cached);
            } catch (e) {
                return [];
            }
        }
        return [];
    });
    const [searchQuery, setSearchQuery] = useState('');
    const [hoveredConversation, setHoveredConversation] = useState(null);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [itemToDelete, setItemToDelete] = useState(null);
    const [isExpanded, setIsExpanded] = useState(false);
    const [showSearchModal, setShowSearchModal] = useState(false);

    useEffect(() => {
        loadConversations();
    }, []);

    // Add new conversation to list when it doesn't exist yet (instead of full reload)
    // ✅ FIX: Also update existing conversations when title changes
    useEffect(() => {
        if (currentConversation?.id && currentConversation?.title) {
            setConversations(prevConversations => {
                const existingIndex = prevConversations.findIndex(c => c.id === currentConversation.id);

                if (existingIndex === -1) {
                    // Conversation doesn't exist - add it
                    console.log('➕ Adding new conversation to list:', currentConversation.id);
                    const updated = [currentConversation, ...prevConversations];
                    sessionStorage.setItem('koda_chat_conversations', JSON.stringify(updated));
                    return updated;
                } else if (prevConversations[existingIndex].title !== currentConversation.title) {
                    // Conversation exists but title changed - update it
                    console.log('📝 Updating conversation title in list:', currentConversation.id,
                               `"${prevConversations[existingIndex].title}" → "${currentConversation.title}"`);
                    const updated = [...prevConversations];
                    updated[existingIndex] = {
                        ...updated[existingIndex],
                        ...currentConversation,
                        updatedAt: new Date().toISOString()
                    };
                    sessionStorage.setItem('koda_chat_conversations', JSON.stringify(updated));
                    return updated;
                }

                // No changes needed
                return prevConversations;
            });
        }
    }, [currentConversation?.id, currentConversation?.title]); // ✅ FIX: Only monitor ID and title, not conversations array

    // Update conversation in the list (used for title updates)
    // Use useCallback to prevent infinite loop
    const updateConversationInList = useCallback((updatedConversation) => {
        console.log('📝 ChatHistory: Updating conversation', updatedConversation);
        setConversations(prevConversations => {
            // ✅ FIX: Check if conversation exists before updating
            const existingIndex = prevConversations.findIndex(c => c.id === updatedConversation.id);

            if (existingIndex === -1) {
                // Conversation doesn't exist - add it at the beginning
                console.log('➕ Adding new conversation to list via update function:', updatedConversation.id);
                const updated = [updatedConversation, ...prevConversations];
                sessionStorage.setItem('koda_chat_conversations', JSON.stringify(updated));
                return updated;
            }

            // Conversation exists - update it
            const updated = prevConversations.map(conv =>
                conv.id === updatedConversation.id
                    ? { ...conv, ...updatedConversation, updatedAt: new Date().toISOString() }
                    : conv
            );

            // Update cache
            sessionStorage.setItem('koda_chat_conversations', JSON.stringify(updated));
            return updated;
        });
    }, []);

    // Expose the update function to parent component
    useEffect(() => {
        if (onConversationUpdate) {
            onConversationUpdate(updateConversationInList);
        }
    }, [onConversationUpdate, updateConversationInList]);

    const loadConversations = async (mergePending = false) => {
        try {
            console.log('📥 [ChatHistory] Loading conversations from API...');
            const data = await chatService.getConversations();
            const apiConversations = data.conversations || data;
            console.log(`✅ [ChatHistory] Loaded ${apiConversations.length} conversations from API`);

            if (mergePending) {
                // Merge mode: keep any conversations not in API response (recently created)
                setConversations(prev => {
                    const apiIds = new Set(apiConversations.map(c => c.id));
                    const pendingConversations = prev.filter(c => !apiIds.has(c.id));

                    if (pendingConversations.length > 0) {
                        console.log(`📌 [ChatHistory] Keeping ${pendingConversations.length} pending conversations`);
                        const merged = [...pendingConversations, ...apiConversations];
                        sessionStorage.setItem('koda_chat_conversations', JSON.stringify(merged));
                        return merged;
                    }

                    sessionStorage.setItem('koda_chat_conversations', JSON.stringify(apiConversations));
                    return apiConversations;
                });
            } else {
                // Replace mode: use API response as source of truth
                setConversations(apiConversations);
                sessionStorage.setItem('koda_chat_conversations', JSON.stringify(apiConversations));
            }
        } catch (error) {
            console.error('❌ [ChatHistory] Error loading conversations:', error);
        }
    };

    // ⚡ PERFORMANCE: Preload conversation messages on hover for instant switching
    const preloadConversation = async (conversationId) => {
        const cacheKey = `koda_chat_messages_${conversationId}`;
        const cacheTimestampKey = `${cacheKey}_timestamp`;

        // Skip if already cached and fresh (< 30 seconds old)
        const cached = sessionStorage.getItem(cacheKey);
        const cacheTimestamp = sessionStorage.getItem(cacheTimestampKey);

        if (cached && cacheTimestamp) {
            const cacheAge = Date.now() - parseInt(cacheTimestamp);
            if (cacheAge < 30 * 1000) {
                console.log(`⚡ Conversation ${conversationId} already preloaded`);
                return; // Already fresh in cache
            }
        }

        try {
            console.log(`⚡ Preloading conversation ${conversationId}...`);
            const conversation = await chatService.getConversation(conversationId);
            const messages = conversation.messages || [];

            // Cache the messages for instant display later
            sessionStorage.setItem(cacheKey, JSON.stringify(messages));
            sessionStorage.setItem(cacheTimestampKey, Date.now().toString());

            console.log(`✅ Preloaded ${messages.length} messages for conversation ${conversationId}`);
        } catch (error) {
            console.error(`❌ Failed to preload conversation ${conversationId}:`, error);

            // If conversation doesn't exist (404), remove it from the list
            if (error.response?.status === 404) {
                console.log(`🗑️ Removing non-existent conversation ${conversationId} from list`);
                setConversations(prev => {
                    const updated = prev.filter(c => c.id !== conversationId);
                    sessionStorage.setItem('koda_chat_conversations', JSON.stringify(updated));
                    return updated;
                });
            }
        }
    };

    const handleNewChat = async () => {
        try {
            console.log('🔵 [ChatHistory] Creating new conversation via API...');
            const newConversation = await chatService.createConversation();
            console.log('✅ [ChatHistory] New chat created from API:', newConversation);

            // Add to conversations list immediately BEFORE notifying parent
            setConversations(prevConversations => {
                console.log('📝 [ChatHistory] Current list has', prevConversations.length, 'conversations');

                // Check if already exists (avoid duplicates)
                const exists = prevConversations.some(c => c.id === newConversation.id);
                if (exists) {
                    console.log('⚠️ Conversation already in list, skipping');
                    return prevConversations;
                }

                console.log('➕ Adding new conversation to beginning of list');
                const updated = [newConversation, ...prevConversations];
                sessionStorage.setItem('koda_chat_conversations', JSON.stringify(updated));
                console.log('✅ List now has', updated.length, 'conversations');
                return updated;
            });

            // Small delay to ensure state update completes
            await new Promise(resolve => setTimeout(resolve, 50));

            // Notify parent component
            console.log('📢 [ChatHistory] Notifying parent component via onNewChat');
            onNewChat?.(newConversation);
        } catch (error) {
            console.error('❌ [ChatHistory] Error creating conversation:', error);
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
                // Clear cache
                sessionStorage.removeItem('koda_chat_conversations');
                // Clear all message caches
                Object.keys(sessionStorage).forEach(key => {
                    if (key.startsWith('koda_chat_messages_')) {
                        sessionStorage.removeItem(key);
                    }
                });
                // Create a new chat after deleting all
                onNewChat?.();
            } else if (itemToDelete.type === 'conversation') {
                await chatService.deleteConversation(itemToDelete.id);
                const updated = conversations.filter(c => c.id !== itemToDelete.id);
                setConversations(updated);
                // Update cache
                sessionStorage.setItem('koda_chat_conversations', JSON.stringify(updated));
                // Clear specific message cache
                sessionStorage.removeItem(`koda_chat_messages_${itemToDelete.id}`);

                // If deleting current conversation, create a new chat
                if (currentConversation?.id === itemToDelete.id) {
                    onNewChat?.();
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
            .filter((conv) => {
                // ✅ SHOW empty conversations (they'll be cleaned up when user navigates away)
                // Only filter by search query
                const matchesSearch = (conv.title || 'New Chat')
                    .toLowerCase()
                    .includes(searchQuery.toLowerCase());

                return matchesSearch;
            })
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

    // Add custom scrollbar styles
    const scrollbarStyles = `
        .chat-history-scrollbar::-webkit-scrollbar {
            width: 8px;
        }

        .chat-history-scrollbar::-webkit-scrollbar-track {
            background: transparent;
        }

        .chat-history-scrollbar::-webkit-scrollbar-thumb {
            background: #E6E6EC;
            border-radius: 4px;
            transition: background 200ms ease-in-out;
        }

        .chat-history-scrollbar::-webkit-scrollbar-thumb:hover {
            background: #D0D0D6;
        }

        .chat-history-scrollbar::-webkit-scrollbar-thumb:active {
            background: #B8B8C0;
        }
    `;

    // SearchModal Component
    const SearchModal = () => (
        <div
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: 'rgba(0, 0, 0, 0.5)',
                display: showSearchModal ? 'flex' : 'none',
                justifyContent: 'center',
                alignItems: 'flex-start',
                paddingTop: '10vh',
                zIndex: 1000,
            }}
            onClick={() => setShowSearchModal(false)}
        >
            <div
                style={{
                    width: 600,
                    maxHeight: '80vh',
                    background: 'white',
                    borderRadius: 16,
                    boxShadow: '0 4px 24px rgba(0, 0, 0, 0.15)',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Search Header */}
                <div style={{
                    padding: '20px 20px 16px',
                    borderBottom: '1px solid #E6E6EC',
                }}>
                    <div style={{position: 'relative'}}>
                        <input
                            type="text"
                            placeholder="Search chats..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            autoFocus
                            style={{
                                width: '100%',
                                height: 44,
                                padding: '10px 40px 10px 40px',
                                background: '#F5F5F5',
                                borderRadius: 100,
                                border: '1px solid #E6E6EC',
                                outline: 'none',
                                fontSize: 14,
                                fontFamily: 'Plus Jakarta Sans',
                            }}
                        />
                        <SearchIcon style={{
                            width: 20,
                            height: 20,
                            color: '#32302C',
                            position: 'absolute',
                            left: 12,
                            top: 12
                        }} />
                        <div
                            onClick={() => setShowSearchModal(false)}
                            style={{
                                position: 'absolute',
                                right: 12,
                                top: 10,
                                width: 24,
                                height: 24,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                borderRadius: 4,
                                transition: 'background 200ms ease-in-out',
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.background = '#F5F5F5'}
                            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                        >
                            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M13 1L1 13M1 1L13 13" stroke="#6C6B6E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                        </div>
                    </div>
                </div>

                {/* New Chat Button */}
                <div style={{padding: '16px 20px', borderBottom: '1px solid #E6E6EC'}}>
                    <button
                        onClick={() => {
                            handleNewChat();
                            setShowSearchModal(false);
                        }}
                        style={{
                            width: '100%',
                            height: 40,
                            padding: '8px 12px',
                            background: '#F5F5F5',
                            border: '1px solid #E0E0E0',
                            borderRadius: 8,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            cursor: 'pointer',
                            transition: 'background 200ms ease-in-out',
                            fontFamily: 'Plus Jakarta Sans',
                            fontSize: 13,
                            fontWeight: '500',
                            color: '#1A1A1A'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = '#EAEAEA'}
                        onMouseLeave={(e) => e.currentTarget.style.background = '#F5F5F5'}
                    >
                        <PencilIcon style={{width: 16, height: 16}} />
                        <span>New chat</span>
                    </button>
                </div>

                {/* Conversations List */}
                <div className="chat-history-scrollbar" style={{
                    flex: 1,
                    overflowY: 'auto',
                    padding: '16px 20px',
                }}>
                    {Object.entries(groupedConversations).map(([day, list]) => {
                        if (list.length === 0) return null;

                        return (
                            <div key={day} style={{marginBottom: 20}}>
                                <div style={{
                                    color: '#32302C',
                                    fontSize: 12,
                                    fontFamily: 'Plus Jakarta Sans',
                                    fontWeight: '700',
                                    textTransform: 'uppercase',
                                    marginBottom: 12
                                }}>
                                    {day}
                                </div>
                                <div>
                                    {list.map((convo) => (
                                        <div
                                            key={convo.id}
                                            onClick={() => {
                                                onSelectConversation?.(convo);
                                                setShowSearchModal(false);
                                            }}
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
                                                transition: 'background 200ms ease-in-out',
                                            }}
                                            onMouseEnter={(e) => {
                                                if (currentConversation?.id !== convo.id) {
                                                    e.currentTarget.style.background = '#F5F5F5';
                                                }
                                            }}
                                            onMouseLeave={(e) => {
                                                if (currentConversation?.id !== convo.id) {
                                                    e.currentTarget.style.background = 'transparent';
                                                }
                                            }}
                                        >
                                            <div style={{
                                                flex: 1,
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                                whiteSpace: 'nowrap'
                                            }}>
                                                {convo.title || 'New Chat'}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                    {conversations.length === 0 && (
                        <div style={{
                            textAlign: 'center',
                            color: '#6C6B6E',
                            fontSize: 14,
                            marginTop: 20
                        }}>
                            No conversations yet. Start a new chat!
                        </div>
                    )}
                </div>
            </div>
        </div>
    );

    return (
        <>
            {/* Inject custom scrollbar styles */}
            <style>{scrollbarStyles}</style>

            <div style={{
                width: isExpanded ? 314 : 64,
                height: '100%',
                padding: 20,
                background: 'white',
                borderRight: '1px solid #E6E6EC',
                display: 'flex',
                flexDirection: 'column',
                gap: 20,
                transition: 'width 300ms ease-in-out',
                overflow: 'hidden'
            }}>
            {/* Collapsed sidebar icons */}
            {!isExpanded && (
                <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12}}>
                    {/* Expand Button */}
                    <div
                        onClick={() => setIsExpanded(true)}
                        style={{
                            width: 44,
                            height: 44,
                            borderRadius: 12,
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center',
                            cursor: 'pointer',
                            transition: 'background 200ms ease-in-out'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = '#F5F5F5'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                        <ExpandIcon style={{width: 20, height: 20}} />
                    </div>

                    {/* New Chat Icon */}
                    <div
                        onClick={handleNewChat}
                        style={{
                            width: 44,
                            height: 44,
                            borderRadius: 12,
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center',
                            cursor: 'pointer',
                            transition: 'background 200ms ease-in-out'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = '#F5F5F5'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                        <PencilIcon style={{width: 20, height: 20}} />
                    </div>

                    {/* Search Icon */}
                    <div
                        onClick={() => setShowSearchModal(true)}
                        style={{
                            width: 44,
                            height: 44,
                            borderRadius: 12,
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center',
                            cursor: 'pointer',
                            transition: 'background 200ms ease-in-out'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = '#F5F5F5'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                        <SearchIcon style={{width: 20, height: 20}} />
                    </div>
                </div>
            )}

            {/* Expanded sidebar header */}
            {isExpanded && (
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                <div style={{color: '#32302C', fontSize: 18, fontFamily: 'Plus Jakarta Sans', fontWeight: '700'}}>Chat</div>
                {/* Collapse Button */}
                <div
                    onClick={() => setIsExpanded(false)}
                    style={{
                        width: 44,
                        height: 44,
                        borderRadius: 12,
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        cursor: 'pointer',
                        transition: 'background 200ms ease-in-out',
                        background: 'transparent',
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = '#F5F5F5'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                    <ExpandIcon style={{width: 20, height: 20, transform: 'rotate(180deg)'}} />
                </div>
            </div>
            )}

            {isExpanded && (
                <>
                    {/* New Chat Button */}
                    <button
                        onClick={handleNewChat}
                        style={{
                            width: '100%',
                            height: 40,
                            padding: '8px 12px',
                            background: '#F5F5F5',
                            border: '1px solid #E0E0E0',
                            borderRadius: 8,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            cursor: 'pointer',
                            transition: 'background 200ms ease-in-out',
                            fontFamily: 'Plus Jakarta Sans',
                            fontSize: 13,
                            fontWeight: '500',
                            color: '#1A1A1A'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = '#EAEAEA'}
                        onMouseLeave={(e) => e.currentTarget.style.background = '#F5F5F5'}
                    >
                        <PencilIcon style={{width: 16, height: 16}} />
                        <span>New Chat</span>
                    </button>

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
                </>
            )}

            {isExpanded && (
            <div className="chat-history-scrollbar" style={{flex: '1 1 0', overflowY: 'auto'}}>
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
                                        onMouseEnter={() => {
                                            setHoveredConversation(convo.id);
                                            preloadConversation(convo.id);
                                        }}
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
            )}

            {isExpanded && conversations.length > 0 && (
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

            {/* Search Modal */}
            <SearchModal />
            </div>
        </>
    );
};

export default ChatHistory;
