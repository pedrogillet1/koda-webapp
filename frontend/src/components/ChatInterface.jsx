import React, { useState, useEffect, useRef, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ReactComponent as AttachmentIcon } from '../assets/Paperclip.svg';
import { ReactComponent as SendIcon } from '../assets/arrow-narrow-up.svg';
import logo from '../assets/logo1.svg';
import kodaLogoSvg from '../assets/koda-logo_1.svg';
import sphere from '../assets/sphere.svg';
import * as chatService from '../services/chatService';
import useStreamingText from '../hooks/useStreamingText';
import VoiceInput from './VoiceInput';
import { useNavigate, useLocation } from 'react-router-dom';
import pdfIcon from '../assets/pdf-icon.svg';
import docIcon from '../assets/doc-icon.svg';
import txtIcon from '../assets/txt-icon.svg';
import xlsIcon from '../assets/xls.svg';
import jpgIcon from '../assets/jpg-icon.svg';
import pngIcon from '../assets/png-icon.svg';
import pptxIcon from '../assets/pptx.svg';
import movIcon from '../assets/mov.svg';
import mp4Icon from '../assets/mp4.svg';
import mp3Icon from '../assets/mp3.svg';
import GeneratedDocumentCard from './GeneratedDocumentCard';
import DocumentCard from './DocumentCard';

// Module-level variable to prevent duplicate socket initialization across all instances
let globalSocketInitialized = false;
let globalProcessedMessageIds = new Set();
let globalListenersAttached = false;

const ChatInterface = ({ currentConversation, onConversationUpdate, onConversationCreated }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const [message, setMessage] = useState('');
    const [messages, setMessages] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [user, setUser] = useState(null);
    const [streamingMessage, setStreamingMessage] = useState('');
    const [attachedFile, setAttachedFile] = useState(null);
    const [attachedDocument, setAttachedDocument] = useState(null);
    const [isUploading, setIsUploading] = useState(false);
    const [copiedMessageId, setCopiedMessageId] = useState(null);
    const [currentStage, setCurrentStage] = useState({ stage: 'searching', message: 'Searching documents...' });
    const [researchMode, setResearchMode] = useState(false);
    const [showResearchSuggestion, setShowResearchSuggestion] = useState(false);
    const [expandedSources, setExpandedSources] = useState({});
    const [researchProgress, setResearchProgress] = useState(null);
    const messagesEndRef = useRef(null);
    const messagesContainerRef = useRef(null);
    const inputRef = useRef(null);
    const fileInputRef = useRef(null);
    const justCreatedConversationId = useRef(null);
    const abortControllerRef = useRef(null);
    const manuallyRemovedDocumentRef = useRef(false);

    // Use streaming hook for the current AI response (5ms = 200 chars/sec for fast smooth streaming)
    const { displayedText, isStreaming } = useStreamingText(streamingMessage, 5);

    // Helper function to get file icon based on extension
    const getFileIcon = (filename) => {
        if (!filename) return docIcon;
        const ext = filename.toLowerCase();
        if (ext.match(/\.(pdf)$/)) return pdfIcon;
        if (ext.match(/\.(jpg|jpeg)$/)) return jpgIcon;
        if (ext.match(/\.(png)$/)) return pngIcon;
        if (ext.match(/\.(doc|docx)$/)) return docIcon;
        if (ext.match(/\.(xls|xlsx)$/)) return xlsIcon;
        if (ext.match(/\.(txt)$/)) return txtIcon;
        if (ext.match(/\.(ppt|pptx)$/)) return pptxIcon;
        if (ext.match(/\.(mov)$/)) return movIcon;
        if (ext.match(/\.(mp4)$/)) return mp4Icon;
        if (ext.match(/\.(mp3)$/)) return mp3Icon;
        return docIcon; // Default icon
    };

    // Scroll to bottom function
    const scrollToBottom = () => {
        if (messagesContainerRef.current) {
            messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
        }
    };

    useEffect(() => {
        // Fetch fresh user info from API
        const fetchUserInfo = async () => {
            const token = localStorage.getItem('accessToken');
            if (token) {
                try {
                    const response = await fetch(`${process.env.REACT_APP_API_URL}/api/auth/me`, {
                        headers: {
                            'Authorization': `Bearer ${token}`
                        }
                    });
                    if (response.ok) {
                        const data = await response.json();
                        setUser(data.user);
                        localStorage.setItem('user', JSON.stringify(data.user));
                    }
                } catch (error) {
                    console.error('Error fetching user info:', error);
                    // Fallback to localStorage
                    const userInfo = localStorage.getItem('user');
                    if (userInfo) {
                        setUser(JSON.parse(userInfo));
                    }
                }
            }
        };

        fetchUserInfo();

        // Initialize socket connection ONLY ONCE using global variable
        if (globalSocketInitialized) {
            console.log('⚠️ Socket already initialized globally, skipping');
            return;
        }

        const token = localStorage.getItem('accessToken');
        if (token) {
            console.log('🔌 Initializing socket connection...');
            globalSocketInitialized = true;

            chatService.initializeSocket(token);

            // IMPORTANT: Remove any existing listeners first to prevent duplicates
            chatService.removeMessageListeners();

            console.log('📡 Attaching global message listeners...');

            // Listen for new messages - ONLY ATTACH ONCE
            chatService.onNewMessage((data) => {
                    console.log('=== WEBSOCKET MESSAGE RECEIVED (COMPLETE) ===');
                    console.log('📨 Message Data:', data);

                    // Use the assistant message ID as unique identifier
                    const messageId = data.assistantMessage.id;
                    console.log('Message ID:', messageId);
                    console.log('Already processed?', globalProcessedMessageIds.has(messageId));
                    console.log('Processed IDs:', Array.from(globalProcessedMessageIds));

                    // Check if we've already processed this message
                    if (globalProcessedMessageIds.has(messageId)) {
                        console.log('⚠️ Duplicate message detected, skipping:', messageId);
                        return;
                    }

                    // Mark this message as processed
                    globalProcessedMessageIds.add(messageId);
                    console.log('✅ Message marked as processed:', messageId);

                    // Check if conversation title was updated
                    if (data.conversationTitle && data.conversationTitle !== 'New Chat') {
                        console.log('📝 Conversation title updated:', data.conversationTitle);
                        // Notify parent to update the conversation list
                        if (onConversationUpdate) {
                            onConversationUpdate({
                                id: data.conversationId,
                                title: data.conversationTitle
                            });
                        }
                    }

                    // Stop loading and clear streaming message
                    setIsLoading(false);
                    setStreamingMessage('');

                    // Add permanent messages immediately (streaming already happened in real-time)
                    setMessages((prev) => {
                        // Triple-check if message already exists in the array
                        const assistantExists = prev.some(msg => msg.id === messageId);

                        if (assistantExists) {
                            console.log('⚠️ Message already exists in state, skipping:', messageId);
                            return prev;
                        }

                        console.log('✅ Replacing optimistic user message with real one + adding assistant message');
                        console.log('Current message count:', prev.length);

                        // Replace optimistic user message with real one, then add assistant message
                        // Filter out optimistic messages AND check for duplicate IDs
                        const withoutOptimistic = prev.filter(m => {
                            // Remove optimistic messages
                            if (m.isOptimistic) return false;
                            // Remove any existing messages with the same ID as the new ones
                            if (m.id === data.userMessage?.id || m.id === data.assistantMessage?.id) return false;
                            return true;
                        });
                        return [...withoutOptimistic, data.userMessage, data.assistantMessage];
                    });
                    console.log('=== MESSAGE PROCESSING COMPLETE ===');
                });

            // Listen for message chunks (real-time streaming)
            chatService.onMessageChunk((data) => {
                console.log('📦 Received chunk:', data.chunk);
                // Append chunk to streaming message
                setStreamingMessage(prev => prev + data.chunk);
            });

            // Listen for message stages (thinking, analyzing, etc.)
            chatService.onMessageStage((data) => {
                console.log('🎭 Message stage:', data.stage, data.message);
                // Update current stage for display
                setCurrentStage({ stage: data.stage, message: data.message });
                // Ensure loading is visible
                setIsLoading(true);
            });

            chatService.onMessageError((error) => {
                console.error('❌ Message error:', error);
                setIsLoading(false);
                setStreamingMessage('');
            });

            // Listen for research progress updates
            chatService.onResearchProgress((data) => {
                console.log('🔬 Research progress:', data.stage, data.message);
                setResearchProgress({
                    stage: data.stage,
                    message: data.message
                });
                // Clear progress when complete
                if (data.stage === 'complete') {
                    setTimeout(() => setResearchProgress(null), 2000);
                }
            });

            // Listen for message aborted event
            chatService.onMessageAborted((data) => {
                console.log('🛑 Message generation aborted:', data.conversationId);
                setIsLoading(false);
                setStreamingMessage('');
                setCurrentStage({ stage: 'searching', message: 'Searching documents...' });

                // Add "Stopped Searching" message to chat
                const stoppedMessage = {
                    id: `stopped-${Date.now()}`,
                    role: 'assistant',
                    content: '⏸️ **Stopped Searching**',
                    createdAt: new Date().toISOString(),
                };
                setMessages((prev) => [...prev, stoppedMessage]);
            });
        }

        return () => {
            console.log('🧹 Cleaning up socket listeners (keeping global flag)');
            // Don't reset globalSocketInitialized to prevent re-initialization in StrictMode
            // Only remove listeners for this component instance
        };
    }, []);

    useEffect(() => {
        // Load conversation messages when conversation changes
        console.log('🔄 currentConversation changed:', currentConversation?.id);
        console.log('📌 justCreatedConversationId:', justCreatedConversationId.current);

        if (currentConversation?.id) {
            // Skip loading if we just created this conversation
            // We already have the messages locally from the REST API response
            if (justCreatedConversationId.current === currentConversation.id) {
                console.log('⏭️ Skipping loadConversation - just created this conversation with messages locally');
                justCreatedConversationId.current = null; // Reset flag
            } else {
                console.log('🔃 Loading conversation from server...');
                loadConversation(currentConversation.id);
            }

            console.log('📡 Joining conversation room:', currentConversation.id);
            chatService.joinConversation(currentConversation.id);
            // Clear streaming message and reset stage when switching conversations
            setStreamingMessage('');
            setCurrentStage({ stage: 'searching', message: 'Searching documents...' });
        }

        return () => {
            if (currentConversation?.id) {
                console.log('👋 Leaving conversation room:', currentConversation.id);
                chatService.leaveConversation(currentConversation.id);
            }
        };
    }, [currentConversation]);

    useEffect(() => {
        // Scroll to bottom when new messages arrive
        console.log('📨 Messages array changed:', messages.length, 'messages');
        console.log('🔢 Message IDs in array:', messages.map(m => ({ id: m.id, role: m.role, content: m.content?.substring(0, 30) })));
        scrollToBottom();
    }, [messages]);

    // Auto-scroll while streaming (only if user is near bottom)
    useEffect(() => {
        if (displayedText && messagesContainerRef.current) {
            const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
            const isNearBottom = scrollHeight - scrollTop - clientHeight < 150;

            // Only auto-scroll if user is already near the bottom
            if (isNearBottom) {
                scrollToBottom();
            }
        }
    }, [displayedText]);

    // Delayed scroll to ensure DOM is updated (only for new messages, not during streaming)
    useEffect(() => {
        if (!streamingMessage && messages.length > 0) {
            const timer = setTimeout(scrollToBottom, 100);
            return () => clearTimeout(timer);
        }
    }, [messages.length]); // Only depend on message count, not content

    // Focus input on mount
    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    // Focus input when conversation changes
    useEffect(() => {
        setTimeout(() => {
            inputRef.current?.focus();
        }, 100);
    }, [currentConversation]);

    // Focus input when loading state changes (after receiving response)
    useEffect(() => {
        if (!isLoading) {
            setTimeout(() => {
                inputRef.current?.focus();
            }, 100);
        }
    }, [isLoading]);

    // Smart suggestion: Detect if user needs Research Mode
    useEffect(() => {
        if (researchMode || !message) {
            setShowResearchSuggestion(false);
            return;
        }

        const researchKeywords = [
            'latest', 'recent', 'current', 'today', 'now', 'news',
            'stock', 'price', 'weather', 'what\'s happening',
            'update', 'breaking', 'trending', 'live', 'real-time',
            'currency', 'exchange rate', 'bitcoin', 'crypto',
            'sports score', 'election', 'market', 'economic'
        ];

        const messageLower = message.toLowerCase();
        const needsWeb = researchKeywords.some(keyword => messageLower.includes(keyword));
        setShowResearchSuggestion(needsWeb);
    }, [message, researchMode]);

    // Handle documentId from URL parameter (Ask Koda feature)
    useEffect(() => {
        const searchParams = new URLSearchParams(location.search);
        const documentId = searchParams.get('documentId');

        // Don't re-attach if user manually removed it
        if (manuallyRemovedDocumentRef.current) {
            console.log('⏭️ Skipping document attachment - user manually removed it');
            return;
        }

        if (documentId && !attachedDocument) {
            console.log('📎 Document ID found in URL:', documentId);

            // Fetch document info
            const fetchDocumentInfo = async () => {
                try {
                    const token = localStorage.getItem('accessToken');
                    const response = await fetch(`${process.env.REACT_APP_API_URL}/api/documents/${documentId}/status`, {
                        headers: {
                            'Authorization': `Bearer ${token}`
                        }
                    });

                    if (response.ok) {
                        const data = await response.json();
                        console.log('✅ Document loaded:', data);

                        // Create a File-like object to set as attached document
                        setAttachedDocument({
                            id: data.documentId,
                            name: data.filename,
                            type: 'application/pdf', // Default type since it's not in status response
                            size: 0 // Size not available in status response
                        });

                        // Remove documentId from URL to avoid re-attaching on refresh
                        const newUrl = window.location.pathname;
                        window.history.replaceState({}, '', newUrl);
                    } else {
                        console.error('❌ Failed to fetch document:', response.status);
                    }
                } catch (error) {
                    console.error('❌ Error fetching document:', error);
                }
            };

            fetchDocumentInfo();
        }
    }, [location.search, attachedDocument]);

    const loadConversation = async (conversationId) => {
        try {
            const conversation = await chatService.getConversation(conversationId);
            const loadedMessages = conversation.messages || [];

            console.log(`📥 API returned ${loadedMessages.length} messages`);

            // Deduplicate messages by ID to prevent duplicate key warnings
            const uniqueMessages = [];
            const seenIds = new Set();
            let duplicatesRemoved = 0;

            for (const msg of loadedMessages) {
                if (msg.id && !seenIds.has(msg.id)) {
                    seenIds.add(msg.id);

                    // Parse RAG sources from metadata if present
                    if (msg.metadata && msg.role === 'assistant') {
                        try {
                            const metadata = typeof msg.metadata === 'string' ? JSON.parse(msg.metadata) : msg.metadata;
                            if (metadata.ragSources) {
                                msg.ragSources = metadata.ragSources;
                            }
                            if (metadata.webSources) {
                                msg.webSources = metadata.webSources;
                            }
                            if (metadata.expandedQuery) {
                                msg.expandedQuery = metadata.expandedQuery;
                            }
                            if (metadata.actions) {
                                msg.actions = metadata.actions;
                            }
                            if (metadata.contextId) {
                                msg.contextId = metadata.contextId;
                            }
                        } catch (e) {
                            console.error('Error parsing RAG metadata:', e);
                        }
                    }

                    uniqueMessages.push(msg);
                    globalProcessedMessageIds.add(msg.id);
                } else if (msg.id && seenIds.has(msg.id)) {
                    // Duplicate found
                    duplicatesRemoved++;
                    console.warn(`⚠️ Duplicate message ID found: ${msg.id}`);
                } else if (!msg.id) {
                    // Keep messages without IDs (shouldn't happen but be safe)
                    uniqueMessages.push(msg);
                }
            }

            if (duplicatesRemoved > 0) {
                console.warn(`🗑️ Removed ${duplicatesRemoved} duplicate message(s)`);
            }

            console.log(`✅ Loaded ${uniqueMessages.length} unique messages`);
            setMessages(uniqueMessages);
            setStreamingMessage(''); // Clear any streaming message when loading conversation
        } catch (error) {
            console.error('Error loading conversation:', error);
        }
    };

    const handleFileSelect = async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        manuallyRemovedDocumentRef.current = false; // Reset flag when new file is selected
        setAttachedFile(file);
    };

    const handleRemoveAttachment = () => {
        console.log('🗑️ Manually removing attachment');
        manuallyRemovedDocumentRef.current = true; // Prevent re-attaching from URL
        setAttachedFile(null);
        setAttachedDocument(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
        // Clear documentId from URL if present
        const searchParams = new URLSearchParams(location.search);
        if (searchParams.has('documentId')) {
            searchParams.delete('documentId');
            const newSearch = searchParams.toString();
            const newUrl = newSearch ? `${window.location.pathname}?${newSearch}` : window.location.pathname;
            window.history.replaceState({}, '', newUrl);
        }
    };

    const handleVoiceTranscript = (transcript) => {
        // Set the transcript as the message input
        setMessage(transcript);
        // Optionally auto-focus the input
        setTimeout(() => {
            inputRef.current?.focus();
        }, 100);
    };

    const handleCopyMessage = async (messageId, content) => {
        try {
            await navigator.clipboard.writeText(content);
            setCopiedMessageId(messageId);
            // Reset copied state after 2 seconds
            setTimeout(() => {
                setCopiedMessageId(null);
            }, 2000);
        } catch (error) {
            console.error('Failed to copy message:', error);
        }
    };

    const handleStopGeneration = () => {
        console.log('🛑 Stopping message generation...');

        // Emit WebSocket stop event to backend
        if (currentConversation?.id) {
            chatService.stopStreaming(currentConversation.id);
        }

        // Abort any ongoing fetch request
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
        }

        // Reset UI state
        setIsLoading(false);
        setStreamingMessage('');
        setCurrentStage({ stage: 'searching', message: 'Searching documents...' });

        // Add "Stopped Searching" message to chat
        const stoppedMessage = {
            id: `stopped-${Date.now()}`,
            role: 'assistant',
            content: '⏸️ **Stopped Searching**',
            createdAt: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, stoppedMessage]);

        // Refocus input
        setTimeout(() => {
            inputRef.current?.focus();
        }, 100);
    };

    const uploadAttachedFile = async (file = attachedFile) => {
        if (!file) {
            console.log('❌ No file to upload');
            return null;
        }

        try {
            console.log('📤 Starting file upload:', file.name);
            setIsUploading(true);

            // Calculate file hash
            const arrayBuffer = await file.arrayBuffer();
            const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            const fileHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

            console.log('🔐 File hash calculated:', fileHash);

            // Upload file
            const formData = new FormData();
            formData.append('file', file);
            formData.append('fileHash', fileHash);

            const token = localStorage.getItem('accessToken');
            const response = await fetch(`${process.env.REACT_APP_API_URL}/api/documents/upload`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: formData
            });

            console.log('📡 Upload response status:', response.status);

            if (!response.ok) {
                const errorText = await response.text();
                console.error('❌ Upload failed:', errorText);
                throw new Error('Failed to upload file: ' + errorText);
            }

            const data = await response.json();
            console.log('✅ File uploaded successfully:', data.document);
            setIsUploading(false);
            return data.document;
        } catch (error) {
            console.error('❌ Error uploading file:', error);
            setIsUploading(false);
            alert('Failed to upload file: ' + error.message);
            return null;
        }
    };

    const handleSendMessage = async () => {
        if ((!message.trim() && !attachedFile && !attachedDocument) || isLoading || isUploading) return;

        let messageText = message;
        const fileToUpload = attachedFile; // Store reference before clearing
        const documentToAttach = attachedDocument; // Store reference before clearing

        // Clear input and attachments immediately for better UX
        setMessage('');
        handleRemoveAttachment();
        setAttachedDocument(null);

        // Store original message text for UI display (files will be shown visually, not as text)
        const displayMessageText = messageText || '';

        // Detect if this should use RAG (question detection)
        const isQuestion = researchMode ||
                          messageText.includes('?') ||
                          /^(what|who|where|when|why|how|is|are|can|could|would|should|does|do|did|find|search|show|tell|explain)/i.test(messageText.trim());

        console.log(`🤔 Message analysis: isQuestion=${isQuestion}, researchMode=${researchMode}`);

        // Add user message to UI immediately (optimistic update)
        const tempUserId = `temp-${Date.now()}`;
        const userMessage = {
            id: tempUserId,
            role: 'user',
            content: displayMessageText,
            createdAt: new Date().toISOString(),
            isOptimistic: true,
            attachedFile: fileToUpload ? { name: fileToUpload.name, type: fileToUpload.type } :
                         documentToAttach ? { name: documentToAttach.name, type: documentToAttach.type } : null,
        };
        setMessages((prev) => {
            // Check if this exact message was just added (prevent double-send)
            const recentUserMsg = prev[prev.length - 1];
            if (recentUserMsg?.role === 'user' &&
                recentUserMsg?.content === messageText &&
                Math.abs(new Date(recentUserMsg.createdAt).getTime() - new Date().getTime()) < 2000) {
                console.log('🚫 Duplicate user message detected, skipping');
                return prev;
            }
            console.log('➕ Adding optimistic user message:', tempUserId);
            return [...prev, userMessage];
        });

        setIsLoading(true);

        // Upload file in background if attached, or use already-uploaded document
        let uploadedDocument = null;
        if (fileToUpload) {
            uploadedDocument = await uploadAttachedFile(fileToUpload);

            // If no message text was provided, add a default message
            if (uploadedDocument && !messageText.trim()) {
                messageText = `I just uploaded a file called "${fileToUpload.name}". Please analyze it and tell me what's in it.`;
            }
        } else if (documentToAttach) {
            // Use the document that was already uploaded (from URL parameter)
            uploadedDocument = { id: documentToAttach.id };

            // If no message text was provided, add a default message
            if (!messageText.trim()) {
                messageText = `I'd like to ask about this document: "${documentToAttach.name}". Please analyze it and tell me what's in it.`;
            }
        }

        console.log('📤 Sending message:', { messageText, hasConversation: !!currentConversation, hasUser: !!user, hasDocument: !!uploadedDocument });

        // Scroll to bottom after adding user message
        setTimeout(scrollToBottom, 100);

        // Refocus input after clearing message
        setTimeout(() => {
            inputRef.current?.focus();
        }, 0);

        try {
            // Ensure we have a conversation
            let conversationId = currentConversation?.id;
            if (!conversationId) {
                console.log('🆕 Creating new conversation...');
                const newConversation = await chatService.createConversation();
                console.log('✅ Conversation created:', newConversation);
                justCreatedConversationId.current = newConversation.id;
                onConversationCreated?.(newConversation);
                conversationId = newConversation.id;
            }

            // Route to RAG or regular chat based on question detection
            if (isQuestion) {
                console.log('🔍 Using RAG for question:', messageText);
                setCurrentStage({ stage: 'searching', message: researchMode ? 'Searching documents and web...' : 'Searching documents...' });

                // Use RAG endpoint (with all Phase 1-4 improvements)
                try {
                    const token = localStorage.getItem('accessToken');
                    const response = await fetch(
                        `${process.env.REACT_APP_API_URL}/api/rag/query`,
                        {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                Authorization: `Bearer ${token}`,
                            },
                            body: JSON.stringify({
                                conversationId,
                                query: messageText,
                                researchMode,
                                attachedFile: fileToUpload ? { name: fileToUpload.name, type: fileToUpload.type } :
                                            documentToAttach ? { name: documentToAttach.name, type: documentToAttach.type } : null,
                                documentId: uploadedDocument?.id,
                            }),
                        }
                    );

                    if (!response.ok) {
                        throw new Error(`HTTP error! status: ${response.status}`);
                    }

                    const data = await response.json();

                    console.log('✅ RAG Response:', data);

                    // Create assistant message with RAG metadata
                    const assistantMessage = {
                        id: data.assistantMessage.id,
                        role: 'assistant',
                        content: data.answer,
                        createdAt: new Date().toISOString(),
                        ragSources: data.sources || [],
                        webSources: data.webSources || [],
                        expandedQuery: data.expandedQuery,
                        contextId: data.contextId,
                        actions: data.actions || [],
                    };

                    setStreamingMessage('');
                    setIsLoading(false);
                    setResearchMode(false); // ✅ AUTO-RESET: Research mode is one-time use

                    // Add messages to history
                    setMessages((prev) => {
                        const withoutOptimistic = prev.filter(m => !m.isOptimistic);
                        // Use the real user message from the response (with metadata)
                        const realUserMessage = {
                            ...data.userMessage,
                            content: displayMessageText,
                        };
                        return [...withoutOptimistic, realUserMessage, assistantMessage];
                    });
                } catch (error) {
                    console.error('❌ Error querying RAG:', error);
                    setIsLoading(false);
                    setStreamingMessage('');

                    // Add error message
                    const errorMessage = {
                        role: 'assistant',
                        content: 'Sorry, I encountered an error while searching. Please try again.',
                        createdAt: new Date().toISOString(),
                    };
                    setMessages((prev) => [...prev, errorMessage]);
                }
            } else if (currentConversation?.id && user?.id) {
                console.log('🔌 Sending via WebSocket:', { conversationId: currentConversation.id, userId: user.id, documentId: uploadedDocument?.id });
                // Send via WebSocket for real-time response
                chatService.sendMessageRealtime(
                    currentConversation.id,
                    user.id,
                    messageText,
                    uploadedDocument?.id
                );
            } else {
                // Regular REST API for new conversation
                console.log('📨 Sending message via REST...');
                const result = await chatService.sendMessage(conversationId, messageText, uploadedDocument?.id);
                console.log('✅ Got response:', result);

                if (result.assistantMessage.id) {
                    globalProcessedMessageIds.add(result.assistantMessage.id);
                    console.log('🔒 Locked message ID to prevent duplication:', result.assistantMessage.id);
                }

                // Trigger streaming effect for assistant message
                setStreamingMessage(result.assistantMessage.content);
                setIsLoading(false);

                // After streaming completes, add to messages history
                const streamDuration = result.assistantMessage.content.length * 15 + 500;
                setTimeout(() => {
                    setStreamingMessage('');
                    setMessages((prev) => {
                        const withoutOptimistic = prev.filter(m => !m.isOptimistic);
                        return [...withoutOptimistic, result.userMessage, result.assistantMessage];
                    });
                }, streamDuration);
            }
        } catch (error) {
            console.error('❌ Error sending message:', error);
            setIsLoading(false);
            // Keep the user message visible even on error
            // Add an error message from the assistant
            const errorMessage = {
                role: 'assistant',
                content: 'Sorry, I encountered an error. Please try again.',
                createdAt: new Date().toISOString(),
            };
            setMessages((prev) => [...prev, errorMessage]);
        }
    };

    const userName = user?.firstName || 'there';

    return (
        <div style={{flex: '1 1 0', height: '100%', display: 'flex', flexDirection: 'column'}}>
            {/* Header */}
            <div style={{height: 84, padding: '0 20px', background: 'white', borderBottom: '1px solid #E6E6EC', display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                <img style={{height: 65}} src={kodaLogoSvg} alt="Logo" />
            </div>

            {/* Messages Area */}
            <div ref={messagesContainerRef} style={{flex: '1 1 0', overflowY: 'auto', overflowX: 'hidden', padding: 20, paddingBottom: 20}}>
                {messages.length === 0 ? (
                    // Show welcome message when no messages
                    <div style={{display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%'}}>
                        <div style={{textAlign: 'center'}}>
                            <div style={{margin: '0 auto 12px'}}>
                                <img src={sphere} alt="Sphere" style={{width: 128, height: 128}} />
                            </div>
                            <div style={{fontSize: 30, fontWeight: '600', color: '#32302C'}}>Hey {userName}. What are you looking for today?</div>
                        </div>
                    </div>
                ) : (
                    // Show messages
                    <div style={{width: '100%', height: '100%'}}>
                        {messages.map((msg, index) => (
                            <div
                                key={msg.isOptimistic ? `optimistic-${index}-${msg.createdAt}` : msg.id || `msg-${index}`}
                                style={{
                                    marginBottom: 16,
                                    display: 'flex',
                                    justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                                }}
                            >
                                {msg.role === 'assistant' ? (
                                    // Assistant message with styled card
                                    <div style={{display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-start', maxWidth: '75%'}}>
                                        <div style={{padding: 12, background: 'white', borderRadius: 18, border: '1px solid #E6E6EC', justifyContent: 'flex-start', alignItems: 'flex-start', gap: 10, display: 'flex'}}>
                                            <div style={{flexDirection: 'column', justifyContent: 'center', alignItems: 'flex-start', gap: 16, display: 'flex'}}>
                                                <div style={{justifyContent: 'flex-start', alignItems: 'flex-start', gap: 8, display: 'flex'}}>
                                                    <div style={{width: 34, height: 34, minWidth: 34, minHeight: 34, background: 'white', borderRadius: '50%', border: '1px solid #F1F0EF', justifyContent: 'center', alignItems: 'center', gap: 10, display: 'flex', overflow: 'hidden'}}>
                                                        <img style={{width: '100%', height: '100%', objectFit: 'cover'}} src={logo} alt="KODA" />
                                                    </div>
                                                    <div style={{justifyContent: 'flex-start', alignItems: 'flex-start', gap: 12, display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0}}>
                                                        <div style={{flexDirection: 'column', justifyContent: 'center', alignItems: 'flex-start', gap: 4, display: 'flex', width: '100%'}}>
                                                            <div className="markdown-content" style={{color: '#323232', fontSize: 16, fontFamily: 'Plus Jakarta Sans', fontWeight: '500', lineHeight: '24px', width: '100%', wordWrap: 'break-word', overflowWrap: 'break-word'}}>
                                                                <ReactMarkdown
                                                                    remarkPlugins={[remarkGfm]}
                                                                >
                                                                    {msg.content}
                                                                </ReactMarkdown>
                                                            </div>

                                                            {/* Generated Document Card */}
                                                            {msg.chatDocument && (
                                                                <GeneratedDocumentCard chatDocument={msg.chatDocument} />
                                                            )}

                                                            {/* Document Cards (for document requests) */}
                                                            {msg.documents && msg.documents.length > 0 && (
                                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
                                                                    {msg.documents.map((doc) => (
                                                                        <DocumentCard key={doc.id} document={doc} />
                                                                    ))}
                                                                </div>
                                                            )}

                                                            {/* Confidence Indicator Badge */}
                                                            {msg.confidence && (
                                                                <div
                                                                    style={{
                                                                        display: 'inline-flex',
                                                                        alignItems: 'center',
                                                                        gap: 6,
                                                                        padding: '6px 12px',
                                                                        background: msg.confidence === 'high' ? '#ECFDF5' : msg.confidence === 'medium' ? '#FEF3C7' : '#FEE2E2',
                                                                        border: `1px solid ${msg.confidence === 'high' ? '#10B981' : msg.confidence === 'medium' ? '#F59E0B' : '#EF4444'}`,
                                                                        borderRadius: 8,
                                                                        marginTop: 8,
                                                                        cursor: 'help'
                                                                    }}
                                                                    title={`Confidence Score: ${(msg.confidenceScore * 100).toFixed(0)}%\n\nBased on:\n• Relevance of sources (50%)\n• Number of sources found (30%)\n• Coverage of information (20%)`}
                                                                >
                                                                    <svg
                                                                        width="14"
                                                                        height="14"
                                                                        viewBox="0 0 24 24"
                                                                        fill="none"
                                                                        stroke={msg.confidence === 'high' ? '#10B981' : msg.confidence === 'medium' ? '#F59E0B' : '#EF4444'}
                                                                        strokeWidth="2"
                                                                        strokeLinecap="round"
                                                                        strokeLinejoin="round"
                                                                    >
                                                                        {msg.confidence === 'high' ? (
                                                                            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                                                                        ) : msg.confidence === 'medium' ? (
                                                                            <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                                                        ) : (
                                                                            <path d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                                        )}
                                                                        {msg.confidence === 'high' && <polyline points="22 4 12 14.01 9 11.01" />}
                                                                    </svg>
                                                                    <span style={{
                                                                        fontSize: 12,
                                                                        fontWeight: '600',
                                                                        color: msg.confidence === 'high' ? '#059669' : msg.confidence === 'medium' ? '#D97706' : '#DC2626',
                                                                        textTransform: 'capitalize'
                                                                    }}>
                                                                        {msg.confidence} Confidence
                                                                    </span>
                                                                    {msg.isMultiStep && (
                                                                        <span style={{
                                                                            fontSize: 11,
                                                                            color: '#6B7280',
                                                                            marginLeft: 4,
                                                                            padding: '2px 6px',
                                                                            background: 'white',
                                                                            borderRadius: 4
                                                                        }}
                                                                        title={`Multi-step reasoning used:\n${msg.subQuestions?.join('\n')}`}
                                                                        >
                                                                            Multi-Step
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>

                                                    {/* RAG Sources Display */}
                                                    {msg.ragSources && msg.ragSources.length > 0 && (() => {
                                                        // Group sources by document ID to show unique documents
                                                        const uniqueDocuments = msg.ragSources.reduce((acc, source) => {
                                                            // Skip sources without valid document names
                                                            if (!source.documentName || source.documentName === 'Unknown Document') {
                                                                return acc;
                                                            }

                                                            if (!acc[source.documentId]) {
                                                                acc[source.documentId] = {
                                                                    documentId: source.documentId,
                                                                    documentName: source.documentName,
                                                                    chunks: []
                                                                };
                                                            }
                                                            acc[source.documentId].chunks.push(source);
                                                            return acc;
                                                        }, {});

                                                        const documentList = Object.values(uniqueDocuments);

                                                        // Don't show document sources if no valid documents
                                                        if (documentList.length === 0) {
                                                            return null;
                                                        }
                                                        const isExpanded = expandedSources[`${msg.id}-rag`];

                                                        // Helper function to get file icon based on filename
                                                        const getFileIcon = (filename) => {
                                                            if (!filename) return docIcon;
                                                            const ext = filename.toLowerCase();
                                                            if (ext.match(/\.(pdf)$/)) return pdfIcon;
                                                            if (ext.match(/\.(jpg|jpeg)$/)) return jpgIcon;
                                                            if (ext.match(/\.(png)$/)) return pngIcon;
                                                            if (ext.match(/\.(doc|docx)$/)) return docIcon;
                                                            if (ext.match(/\.(xls|xlsx)$/)) return xlsIcon;
                                                            if (ext.match(/\.(txt)$/)) return txtIcon;
                                                            if (ext.match(/\.(ppt|pptx)$/)) return pptxIcon;
                                                            if (ext.match(/\.(mov)$/)) return movIcon;
                                                            if (ext.match(/\.(mp4)$/)) return mp4Icon;
                                                            if (ext.match(/\.(mp3)$/)) return mp3Icon;
                                                            return docIcon; // Default icon
                                                        };

                                                        return (
                                                            <div style={{ width: '100%', marginTop: 12 }}>
                                                                {/* Toggle Button for Document Sources */}
                                                                <button
                                                                    onClick={() => {
                                                                        setExpandedSources(prev => ({
                                                                            ...prev,
                                                                            [`${msg.id}-rag`]: !isExpanded
                                                                        }));
                                                                    }}
                                                                    style={{
                                                                        width: '100%',
                                                                        padding: '10px 14px',
                                                                        background: 'white',
                                                                        border: '1px solid #E6E6EC',
                                                                        borderRadius: 10,
                                                                        cursor: 'pointer',
                                                                        fontSize: 13,
                                                                        fontWeight: '600',
                                                                        color: '#181818',
                                                                        transition: 'all 0.2s',
                                                                        display: 'flex',
                                                                        alignItems: 'center',
                                                                        justifyContent: 'space-between'
                                                                    }}
                                                                    onMouseEnter={(e) => e.currentTarget.style.background = '#F5F5F5'}
                                                                    onMouseLeave={(e) => e.currentTarget.style.background = 'white'}
                                                                >
                                                                    <div style={{
                                                                        display: 'flex',
                                                                        alignItems: 'center',
                                                                        gap: 8
                                                                    }}>
                                                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                                            <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
                                                                            <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
                                                                        </svg>
                                                                        <span>Document Sources ({documentList.length})</span>
                                                                    </div>
                                                                    <svg
                                                                        width="14"
                                                                        height="14"
                                                                        viewBox="0 0 24 24"
                                                                        fill="none"
                                                                        stroke="currentColor"
                                                                        strokeWidth="2"
                                                                        strokeLinecap="round"
                                                                        strokeLinejoin="round"
                                                                        style={{
                                                                            transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                                                                            transition: 'transform 0.2s'
                                                                        }}
                                                                    >
                                                                        <polyline points="6 9 12 15 18 9" />
                                                                    </svg>
                                                                </button>

                                                                {/* Document Sources List (shown when expanded) */}
                                                                {isExpanded && (
                                                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
                                                                    {documentList.map((doc, index) => {
                                                                        // Get the highest similarity chunk for this document
                                                                        const bestChunk = doc.chunks.reduce((best, curr) =>
                                                                            (curr.similarity || 0) > (best.similarity || 0) ? curr : best
                                                                        );

                                                                        return (
                                                                            <div
                                                                                key={index}
                                                                                style={{
                                                                                    padding: 12,
                                                                                    background: 'linear-gradient(135deg, #FAFAFA 0%, #F5F5F5 100%)',
                                                                                    borderRadius: 10,
                                                                                    border: '1px solid #E6E6EC',
                                                                                    cursor: 'pointer',
                                                                                    transition: 'all 0.2s',
                                                                                    position: 'relative',
                                                                                    overflow: 'hidden'
                                                                                }}
                                                                                onClick={() => navigate(`/document/${doc.documentId}`)}
                                                                                onMouseEnter={(e) => {
                                                                                    e.currentTarget.style.background = 'linear-gradient(135deg, #F0F0F0 0%, #E6E6EC 100%)';
                                                                                    e.currentTarget.style.borderColor = '#D1D1D6';
                                                                                    e.currentTarget.style.transform = 'translateY(-2px)';
                                                                                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)';
                                                                                }}
                                                                                onMouseLeave={(e) => {
                                                                                    e.currentTarget.style.background = 'linear-gradient(135deg, #FAFAFA 0%, #F5F5F5 100%)';
                                                                                    e.currentTarget.style.borderColor = '#E6E6EC';
                                                                                    e.currentTarget.style.transform = 'translateY(0)';
                                                                                    e.currentTarget.style.boxShadow = 'none';
                                                                                }}
                                                                            >
                                                                                <div style={{
                                                                                    display: 'flex',
                                                                                    alignItems: 'center',
                                                                                    gap: 12
                                                                                }}>
                                                                                    <img
                                                                                        src={getFileIcon(doc.documentName)}
                                                                                        alt="File icon"
                                                                                        style={{
                                                                                            width: 40,
                                                                                            height: 40,
                                                                                            flexShrink: 0,
                                                                                            imageRendering: '-webkit-optimize-contrast',
                                                                                            objectFit: 'contain',
                                                                                            shapeRendering: 'geometricPrecision'
                                                                                        }}
                                                                                    />
                                                                                    <div style={{ flex: 1, minWidth: 0 }}>
                                                                                        <div style={{
                                                                                            fontSize: 14,
                                                                                            fontWeight: '600',
                                                                                            color: '#181818',
                                                                                            display: 'flex',
                                                                                            alignItems: 'center',
                                                                                            gap: 6,
                                                                                            overflow: 'hidden',
                                                                                            textOverflow: 'ellipsis',
                                                                                            whiteSpace: 'nowrap'
                                                                                        }}>
                                                                                            {doc.documentName || 'Unknown Document'}
                                                                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink: 0}}>
                                                                                                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                                                                                                <polyline points="15 3 21 3 21 9" />
                                                                                                <line x1="10" y1="14" x2="21" y2="3" />
                                                                                            </svg>
                                                                                        </div>
                                                                                    </div>
                                                                                </div>
                                                                            </div>
                                                                        );
                                                                    })}
                                                                </div>
                                                                )}
                                                            </div>
                                                        );
                                                    })()}

                                                    {/* Web Sources Display */}
                                                    {msg.webSources && msg.webSources.length > 0 && (() => {
                                                        const isExpanded = expandedSources[`${msg.id}-web`];

                                                        return (
                                                            <div style={{ width: '100%', marginTop: 12 }}>
                                                                {/* Toggle Button for Web Sources */}
                                                                <button
                                                                    onClick={() => {
                                                                        setExpandedSources(prev => ({
                                                                            ...prev,
                                                                            [`${msg.id}-web`]: !isExpanded
                                                                        }));
                                                                    }}
                                                                    style={{
                                                                        width: '100%',
                                                                        padding: '10px 14px',
                                                                        background: 'white',
                                                                        border: '1px solid #E6E6EC',
                                                                        borderRadius: 10,
                                                                        cursor: 'pointer',
                                                                        fontSize: 13,
                                                                        fontWeight: '600',
                                                                        color: '#181818',
                                                                        transition: 'all 0.2s',
                                                                        display: 'flex',
                                                                        alignItems: 'center',
                                                                        justifyContent: 'space-between'
                                                                    }}
                                                                    onMouseEnter={(e) => e.currentTarget.style.background = '#F5F5F5'}
                                                                    onMouseLeave={(e) => e.currentTarget.style.background = 'white'}
                                                                >
                                                                    <div style={{
                                                                        display: 'flex',
                                                                        alignItems: 'center',
                                                                        gap: 8
                                                                    }}>
                                                                        <span>🌐</span>
                                                                        <span>Web Sources ({msg.webSources.length})</span>
                                                                    </div>
                                                                    <svg
                                                                        width="14"
                                                                        height="14"
                                                                        viewBox="0 0 24 24"
                                                                        fill="none"
                                                                        stroke="currentColor"
                                                                        strokeWidth="2"
                                                                        strokeLinecap="round"
                                                                        strokeLinejoin="round"
                                                                        style={{
                                                                            transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                                                                            transition: 'transform 0.2s'
                                                                        }}
                                                                    >
                                                                        <polyline points="6 9 12 15 18 9" />
                                                                    </svg>
                                                                </button>

                                                                {/* Web Sources List (shown when expanded) */}
                                                                {isExpanded && (
                                                                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 12 }}>
                                                                    {msg.webSources.map((source, index) => (
                                                                        <div
                                                                            key={index}
                                                                            style={{
                                                                                padding: 10,
                                                                                background: '#F5F5F5',
                                                                                borderRadius: 8,
                                                                                border: '1px solid #E6E6EC',
                                                                                cursor: 'pointer',
                                                                                transition: 'all 0.2s'
                                                                            }}
                                                                            onClick={() => window.open(source.url, '_blank')}
                                                                            onMouseEnter={(e) => e.currentTarget.style.background = '#E6E6EC'}
                                                                            onMouseLeave={(e) => e.currentTarget.style.background = '#F5F5F5'}
                                                                        >
                                                                            <div style={{ fontSize: 13, fontWeight: '600', color: '#181818', marginBottom: 4 }}>
                                                                                {source.title}
                                                                            </div>
                                                                            <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 4 }}>
                                                                                {source.snippet}
                                                                            </div>
                                                                            <div style={{ fontSize: 11, color: '#3B82F6', textDecoration: 'underline' }}>
                                                                                {source.url}
                                                                            </div>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                                )}
                                                            </div>
                                                        );
                                                    })()}

                                                    {/* File Attachment Card */}
                                                    {msg.metadata && (() => {
                                                        try {
                                                            const metadata = typeof msg.metadata === 'string' ? JSON.parse(msg.metadata) : msg.metadata;
                                                            if (metadata?.result?.fileType === 'document_location') {
                                                                const filename = metadata.result.filename || '';
                                                                const extension = filename.split('.').pop()?.toLowerCase() || '';

                                                                // File type icon mapping
                                                                const getFileIcon = (ext) => {
                                                                    const iconMap = {
                                                                        'pdf': '📕',
                                                                        'doc': '📘',
                                                                        'docx': '📘',
                                                                        'xls': '📗',
                                                                        'xlsx': '📗',
                                                                        'ppt': '📙',
                                                                        'pptx': '📙',
                                                                        'txt': '📄',
                                                                        'jpg': '🖼️',
                                                                        'jpeg': '🖼️',
                                                                        'png': '🖼️',
                                                                        'gif': '🖼️',
                                                                        'zip': '📦',
                                                                        'rar': '📦',
                                                                    };
                                                                    return iconMap[ext] || '📄';
                                                                };

                                                                const handleDownload = async () => {
                                                                    try {
                                                                        const token = localStorage.getItem('accessToken');
                                                                        const documentId = metadata.result.documentId;

                                                                        const response = await fetch(`${process.env.REACT_APP_API_URL}/api/documents/${documentId}/download`, {
                                                                            headers: {
                                                                                'Authorization': `Bearer ${token}`
                                                                            }
                                                                        });

                                                                        if (!response.ok) throw new Error('Download failed');

                                                                        const data = await response.json();

                                                                        // Open the download URL in a new tab
                                                                        window.open(data.url, '_blank');
                                                                    } catch (error) {
                                                                        console.error('Error downloading file:', error);
                                                                        alert('Failed to download file');
                                                                    }
                                                                };

                                                                return (
                                                                    <div style={{
                                                                        width: '100%',
                                                                        marginTop: 8,
                                                                    }}>
                                                                        <div style={{
                                                                            padding: 12,
                                                                            background: '#F5F5F5',
                                                                            borderRadius: 12,
                                                                            border: '1px solid #E6E6EC',
                                                                            display: 'flex',
                                                                            alignItems: 'center',
                                                                            gap: 12,
                                                                        }}>
                                                                            <div style={{
                                                                                width: 40,
                                                                                height: 40,
                                                                                background: '#181818',
                                                                                borderRadius: 8,
                                                                                display: 'flex',
                                                                                alignItems: 'center',
                                                                                justifyContent: 'center',
                                                                                fontSize: 20,
                                                                            }}>
                                                                                {getFileIcon(extension)}
                                                                            </div>
                                                                            <div style={{flex: 1}}>
                                                                                <div style={{
                                                                                    fontSize: 14,
                                                                                    fontWeight: '600',
                                                                                    color: '#32302C',
                                                                                    marginBottom: 2
                                                                                }}>
                                                                                    {filename}
                                                                                </div>
                                                                                <div style={{
                                                                                    fontSize: 12,
                                                                                    color: '#8E8E93'
                                                                                }}>
                                                                                    {metadata.result.folderName ? `In ${metadata.result.folderName}` : 'In Documents'}
                                                                                </div>
                                                                            </div>
                                                                            <div style={{display: 'flex', gap: 8, alignItems: 'center'}}>
                                                                                <button
                                                                                    onClick={() => {
                                                                                        const documentId = metadata.result.documentId;
                                                                                        navigate(`/document/${documentId}`);
                                                                                    }}
                                                                                    style={{
                                                                                        padding: 8,
                                                                                        background: 'white',
                                                                                        border: '1px solid #E6E6EC',
                                                                                        borderRadius: 8,
                                                                                        cursor: 'pointer',
                                                                                        display: 'flex',
                                                                                        alignItems: 'center',
                                                                                        justifyContent: 'center',
                                                                                        transition: 'all 0.2s',
                                                                                        minWidth: 36,
                                                                                        minHeight: 36
                                                                                    }}
                                                                                    onMouseEnter={(e) => e.currentTarget.style.background = '#F5F5F5'}
                                                                                    onMouseLeave={(e) => e.currentTarget.style.background = 'white'}
                                                                                    title="Preview Document"
                                                                                >
                                                                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#323232" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                                                        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
                                                                                        <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
                                                                                    </svg>
                                                                                </button>
                                                                                <button
                                                                                    onClick={handleDownload}
                                                                                    style={{
                                                                                        padding: 8,
                                                                                        background: '#181818',
                                                                                        border: 'none',
                                                                                        borderRadius: 8,
                                                                                        cursor: 'pointer',
                                                                                        display: 'flex',
                                                                                        alignItems: 'center',
                                                                                        justifyContent: 'center',
                                                                                        transition: 'all 0.2s',
                                                                                        minWidth: 36,
                                                                                        minHeight: 36
                                                                                    }}
                                                                                    onMouseEnter={(e) => e.currentTarget.style.background = '#323232'}
                                                                                    onMouseLeave={(e) => e.currentTarget.style.background = '#181818'}
                                                                                    title="Download file"
                                                                                >
                                                                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                                                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                                                                        <polyline points="7 10 12 15 17 10" />
                                                                                        <line x1="12" y1="15" x2="12" y2="3" />
                                                                                    </svg>
                                                                                </button>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                );
                                                            }
                                                        } catch (e) {
                                                            console.error('Error parsing message metadata:', e);
                                                        }
                                                        return null;
                                                    })()}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Copy button - outside the message bubble */}
                                    <button
                                        onClick={() => handleCopyMessage(msg.id, msg.content)}
                                        style={{
                                            padding: 6,
                                            background: copiedMessageId === msg.id ? '#10B981' : '#F5F5F5',
                                            border: '1px solid #E6E6EC',
                                            borderRadius: 6,
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            color: copiedMessageId === msg.id ? 'white' : '#6C6B6E',
                                            transition: 'all 0.2s',
                                            minWidth: 28,
                                            minHeight: 28,
                                            flexShrink: 0,
                                        }}
                                        onMouseEnter={(e) => {
                                            if (copiedMessageId !== msg.id) {
                                                e.currentTarget.style.background = '#E6E6EC';
                                            }
                                        }}
                                        onMouseLeave={(e) => {
                                            if (copiedMessageId !== msg.id) {
                                                e.currentTarget.style.background = '#F5F5F5';
                                            }
                                        }}
                                        title={copiedMessageId === msg.id ? 'Copied!' : 'Copy message'}
                                    >
                                        {copiedMessageId === msg.id ? (
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <polyline points="20 6 9 17 4 12" />
                                            </svg>
                                        ) : (
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                                            </svg>
                                        )}
                                    </button>
                                </div>
                                ) : (
                                    // User message
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end', maxWidth: '70%' }}>
                                        {/* Attached file display - check both optimistic attachedFile and metadata */}
                                        {(() => {
                                            // Try to get attached file from metadata first (for persisted messages)
                                            let attachedFile = msg.attachedFile;

                                            if (!attachedFile && msg.metadata) {
                                                try {
                                                    const metadata = typeof msg.metadata === 'string' ? JSON.parse(msg.metadata) : msg.metadata;
                                                    if (metadata?.attachedFile) {
                                                        attachedFile = metadata.attachedFile;
                                                    }
                                                } catch (e) {
                                                    console.error('Error parsing message metadata:', e);
                                                }
                                            }

                                            return attachedFile ? (
                                            <div style={{
                                                padding: 12,
                                                background: '#FFFFFF',
                                                border: '1px solid #E6E6EC',
                                                borderRadius: 12,
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 12,
                                                minWidth: 280,
                                            }}>
                                                {/* File icon */}
                                                <div style={{
                                                    width: 40,
                                                    height: 40,
                                                    background: '#F5F5F5',
                                                    borderRadius: 8,
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    fontSize: 20,
                                                    flexShrink: 0,
                                                }}>
                                                    {(() => {
                                                        const ext = attachedFile.name.split('.').pop()?.toLowerCase() || '';
                                                        const iconMap = {
                                                            'pdf': '📕',
                                                            'doc': '📘',
                                                            'docx': '📘',
                                                            'xls': '📗',
                                                            'xlsx': '📗',
                                                            'ppt': '📙',
                                                            'pptx': '📙',
                                                            'txt': '📄',
                                                            'jpg': '🖼️',
                                                            'jpeg': '🖼️',
                                                            'png': '🖼️',
                                                            'gif': '🖼️',
                                                            'zip': '📦',
                                                            'rar': '📦',
                                                        };
                                                        return iconMap[ext] || '📄';
                                                    })()}
                                                </div>

                                                {/* File info */}
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <div style={{
                                                        fontSize: 14,
                                                        fontWeight: '600',
                                                        color: '#32302C',
                                                        whiteSpace: 'nowrap',
                                                        overflow: 'hidden',
                                                        textOverflow: 'ellipsis',
                                                    }}>
                                                        {attachedFile.name}
                                                    </div>
                                                    <div style={{
                                                        fontSize: 12,
                                                        color: '#8E8E93',
                                                        marginTop: 2,
                                                    }}>
                                                        {attachedFile.type || 'File'}
                                                    </div>
                                                </div>
                                            </div>
                                            ) : null;
                                        })()}

                                        {/* Message text (only show if there's actual text content) */}
                                        {msg.content && msg.content.trim() && (
                                            <div
                                                style={{
                                                    padding: '12px 16px',
                                                    borderRadius: 12,
                                                    width: '100%',
                                                    background: '#171717',
                                                    color: 'white',
                                                    fontSize: 16,
                                                    lineHeight: '24px',
                                                }}
                                            >
                                                {msg.content}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        ))}

                        {/* Streaming Message - Only show if streamingMessage is not empty */}
                        {streamingMessage && displayedText && (
                            <div style={{marginBottom: 16, display: 'flex', justifyContent: 'flex-start'}}>
                                <div style={{maxWidth: '70%', padding: 12, background: 'white', borderRadius: 18, border: '1px solid #E6E6EC', justifyContent: 'flex-start', alignItems: 'flex-start', gap: 10, display: 'flex'}}>
                                    <div style={{overflow: 'hidden', flexDirection: 'column', justifyContent: 'center', alignItems: 'flex-start', gap: 16, display: 'flex'}}>
                                        <div style={{justifyContent: 'flex-start', alignItems: 'flex-start', gap: 8, display: 'flex'}}>
                                            <div style={{width: 34, height: 34, minWidth: 34, minHeight: 34, background: 'white', borderRadius: '50%', border: '1px solid #F1F0EF', justifyContent: 'center', alignItems: 'center', gap: 10, display: 'flex', overflow: 'hidden'}}>
                                                <img style={{width: '100%', height: '100%', objectFit: 'cover'}} src={logo} alt="KODA" />
                                            </div>
                                            <div style={{justifyContent: 'flex-start', alignItems: 'flex-start', gap: 12, display: 'flex'}}>
                                                <div style={{flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: 4, display: 'flex'}}>
                                                    <div className="markdown-content streaming" style={{color: '#323232', fontSize: 16, fontFamily: 'Plus Jakarta Sans', fontWeight: '500', lineHeight: '24px', whiteSpace: 'nowrap', overflow: 'auto'}}>
                                                        <ReactMarkdown
                                                            remarkPlugins={[remarkGfm]}
                                                        >
                                                            {displayedText}
                                                        </ReactMarkdown>
                                                        {isStreaming && <span className="cursor">▋</span>}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Research Progress Indicator */}
                        {researchProgress && (
                            <div style={{marginBottom: 16, display: 'flex', justifyContent: 'flex-start'}}>
                                <div style={{
                                    padding: '12px 16px',
                                    borderRadius: 12,
                                    background: 'linear-gradient(135deg, #FAFAFA 0%, #F5F5F5 100%)',
                                    border: '1px solid #E6E6EC',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: 8,
                                    minWidth: 280
                                }}>
                                    <div style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 8
                                    }}>
                                        <div style={{
                                            width: 20,
                                            height: 20,
                                            borderRadius: '50%',
                                            border: '3px solid #E6E6EC',
                                            borderTop: '3px solid #181818',
                                            animation: 'spin 1s linear infinite'
                                        }} />
                                        <div style={{
                                            fontSize: 13,
                                            fontWeight: '600',
                                            color: '#181818'
                                        }}>
                                            {researchProgress.message}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Loading Indicator - show when waiting for response OR when response arrived but streaming hasn't started yet */}
                        {(isLoading || (streamingMessage && !displayedText)) && (
                            <div style={{marginBottom: 16, display: 'flex', justifyContent: 'flex-start'}}>
                                <div style={{padding: '12px 16px', borderRadius: 12, background: '#F5F5F5', color: '#32302C', display: 'flex', flexDirection: 'column', gap: 8}}>
                                    <div style={{color: '#6B7280', fontSize: 13, fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: '500'}}>
                                        {currentStage.message}
                                    </div>
                                    <span className="typing-indicator">●●●</span>
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>
                )}
            </div>

            {/* Message Input */}
            <div style={{padding: 20, background: 'white', borderTop: '1px solid #E6E6EC'}}>
                {/* Smart Research Mode Suggestion */}
                {showResearchSuggestion && !researchMode && (
                    <div style={{
                        marginBottom: 12,
                        padding: 12,
                        background: '#181818',
                        borderRadius: 12,
                        border: '1px solid #323232',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        animation: 'slideIn 0.3s ease-out'
                    }}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink: 0}}>
                            <circle cx="12" cy="12" r="10"/>
                            <path d="M12 16v-4"/>
                            <path d="M12 8h.01"/>
                        </svg>
                        <div style={{flex: 1}}>
                            <div style={{fontSize: 14, fontWeight: '600', color: 'white', marginBottom: 2}}>
                                Enable Research Mode?
                            </div>
                            <div style={{fontSize: 12, color: 'rgba(255,255,255,0.7)'}}>
                                Your question looks like it needs current web information
                            </div>
                        </div>
                        <button
                            onClick={() => {
                                setResearchMode(true);
                                setShowResearchSuggestion(false);
                            }}
                            style={{
                                padding: '8px 16px',
                                background: 'white',
                                color: '#181818',
                                border: 'none',
                                borderRadius: 8,
                                cursor: 'pointer',
                                fontSize: 14,
                                fontWeight: '600',
                                transition: 'all 0.2s',
                                flexShrink: 0
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                            onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                        >
                            Enable
                        </button>
                        <button
                            onClick={() => setShowResearchSuggestion(false)}
                            style={{
                                padding: 6,
                                background: 'rgba(255,255,255,0.1)',
                                border: 'none',
                                borderRadius: 6,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: 'rgba(255,255,255,0.7)',
                                fontSize: 16,
                                flexShrink: 0,
                                transition: 'all 0.2s'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
                            onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                            title="Dismiss"
                        >
                            ✕
                        </button>
                    </div>
                )}

                {/* File Attachment Preview */}
                {attachedFile && (
                    <div style={{marginBottom: 12, padding: 12, background: '#F5F5F5', borderRadius: 12, border: '1px solid #E6E6EC', display: 'flex', alignItems: 'center', gap: 12}}>
                        <div style={{position: 'relative', width: 40, height: 40, flexShrink: 0}}>
                            <img
                                src={getFileIcon(attachedFile.name)}
                                alt="File icon"
                                style={{
                                    width: 40,
                                    height: 40,
                                    imageRendering: '-webkit-optimize-contrast',
                                    objectFit: 'contain',
                                    shapeRendering: 'geometricPrecision',
                                    opacity: isUploading ? 0.5 : 1
                                }}
                            />
                            {isUploading && (
                                <div style={{
                                    position: 'absolute',
                                    top: '50%',
                                    left: '50%',
                                    transform: 'translate(-50%, -50%)',
                                    width: 20,
                                    height: 20,
                                    border: '3px solid #E6E6EC',
                                    borderTop: '3px solid #181818',
                                    borderRadius: '50%',
                                    animation: 'spin 1s linear infinite'
                                }} />
                            )}
                        </div>
                        <div style={{flex: 1}}>
                            <div style={{fontSize: 14, fontWeight: '600', color: '#32302C'}}>{attachedFile.name}</div>
                            <div style={{fontSize: 12, color: isUploading ? '#3B82F6' : '#8E8E93'}}>
                                {isUploading ? 'Uploading...' : `${(attachedFile.size / 1024).toFixed(2)} KB`}
                            </div>
                        </div>
                        {!isUploading && (
                            <button
                                onClick={handleRemoveAttachment}
                                style={{width: 32, height: 32, background: 'white', border: '1px solid #E6E6EC', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, color: '#8E8E93'}}
                            >
                                ✕
                            </button>
                        )}
                    </div>
                )}

                {/* Document Attachment Banner (from URL parameter) */}
                {attachedDocument && (
                    <div style={{marginBottom: 12, padding: 12, background: 'white', borderRadius: 12, border: '1px solid #E6E6EC', display: 'flex', alignItems: 'center', gap: 12}}>
                        <img
                            src={getFileIcon(attachedDocument.name)}
                            alt="File icon"
                            style={{
                                width: 40,
                                height: 40,
                                imageRendering: '-webkit-optimize-contrast',
                                objectFit: 'contain',
                                shapeRendering: 'geometricPrecision',
                                flexShrink: 0
                            }}
                        />
                        <div style={{flex: 1}}>
                            <div style={{fontSize: 14, fontWeight: '600', color: '#32302C'}}>{attachedDocument.name}</div>
                            <div style={{fontSize: 12, color: '#8E8E93'}}>
                                Ready to answer questions about this document
                            </div>
                        </div>
                        <button
                            onClick={handleRemoveAttachment}
                            style={{width: 32, height: 32, background: '#F5F5F5', border: '1px solid #E6E6EC', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, color: '#8E8E93', transition: 'all 0.2s'}}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.background = '#E6E6EC';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.background = '#F5F5F5';
                            }}
                        >
                            ✕
                        </button>
                    </div>
                )}

                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        handleSendMessage();
                    }}
                    onClick={() => {
                        // Focus input when clicking anywhere on the form
                        if (inputRef.current && document.activeElement !== inputRef.current) {
                            inputRef.current.focus();
                        }
                    }}
                    style={{
                        padding: 16,
                        background: '#F5F5F5',
                        borderRadius: 18,
                        border: '1px solid #E6E6EC',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 16,
                        cursor: 'text'
                    }}
                >
                    <input
                        ref={inputRef}
                        type="text"
                        placeholder="Ask KODA anything..."
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        onFocus={(e) => {
                            // Always allow focus, even if disabled
                            if (e.target.disabled) {
                                e.target.disabled = false;
                            }
                        }}
                        autoFocus
                        style={{
                            flex: '1 1 0',
                            background: 'transparent',
                            border: 'none',
                            outline: 'none',
                            fontSize: 16,
                            color: '#32302C',
                            cursor: 'text'
                        }}
                    />
                    <div style={{display: 'flex', gap: 6}}>
                        <input
                            ref={fileInputRef}
                            type="file"
                            onChange={handleFileSelect}
                            style={{display: 'none'}}
                            accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.jpg,.jpeg,.png,.gif,.webp"
                        />
                        <AttachmentIcon
                            onClick={() => fileInputRef.current?.click()}
                            style={{width: 24, height: 24, color: '#171717', cursor: 'pointer'}}
                        />
                        <VoiceInput
                            onTranscript={handleVoiceTranscript}
                            disabled={isLoading}
                        />
                    </div>
                    <div style={{width: 1, height: 24, background: 'rgba(85, 83, 78, 0.20)'}} />
                    {isLoading ? (
                        <button
                            type="button"
                            onClick={handleStopGeneration}
                            title="Stop generation"
                            style={{
                                width: 40,
                                height: 40,
                                background: '#171717',
                                borderRadius: '50%',
                                border: 'none',
                                cursor: 'pointer',
                                display: 'flex',
                                justifyContent: 'center',
                                alignItems: 'center',
                                transition: 'background 0.2s'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.background = '#262626'}
                            onMouseLeave={(e) => e.currentTarget.style.background = '#171717'}
                        >
                            <div style={{width: 14, height: 14, background: 'white', borderRadius: 2}} />
                        </button>
                    ) : (
                        <button
                            type="submit"
                            disabled={!message.trim() && !attachedFile && !attachedDocument}
                            style={{
                                width: 40,
                                height: 40,
                                background: (message.trim() || attachedFile || attachedDocument) ? '#171717' : '#ccc',
                                borderRadius: '50%',
                                border: 'none',
                                cursor: (message.trim() || attachedFile || attachedDocument) ? 'pointer' : 'not-allowed',
                                display: 'flex',
                                justifyContent: 'center',
                                alignItems: 'center',
                            }}
                        >
                            <SendIcon style={{width: 18, height: 18, color: 'white'}} />
                        </button>
                    )}
                </form>

                {/* TASK #10: Trust & Security Footer */}
                <div style={{
                    marginTop: 16,
                    paddingTop: 12,
                    borderTop: '1px solid rgba(0,0,0,0.06)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    fontSize: 12,
                    color: '#8E8E93'
                }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    </svg>
                    <span>Your workspace is encrypted. All documents and conversations are private and secure.</span>
                </div>
            </div>
        </div>
    );
};

export default ChatInterface;
