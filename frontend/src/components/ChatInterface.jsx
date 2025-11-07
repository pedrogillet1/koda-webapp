import React, { useState, useEffect, useRef, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ReactComponent as AttachmentIcon } from '../assets/Paperclip.svg';
import { ReactComponent as SendIcon } from '../assets/arrow-narrow-up.svg';
import { ReactComponent as CheckIcon } from '../assets/check.svg';
import { ReactComponent as UploadIconDrag } from '../assets/Logout-black.svg';
import logo from '../assets/logo1.svg';
import kodaLogoSvg from '../assets/koda-logo_1.svg';
import sphere from '../assets/sphere.svg';
import * as chatService from '../services/chatService';
import useStreamingText from '../hooks/useStreamingText';
import VoiceInput from './VoiceInput';
import { useNavigate, useLocation } from 'react-router-dom';
import pdfIcon from '../assets/pdf-icon.png';
import docIcon from '../assets/doc-icon.png';
import txtIcon from '../assets/txt-icon.png';
import xlsIcon from '../assets/xls.png';
import jpgIcon from '../assets/jpg-icon.png';
import pngIcon from '../assets/png-icon.png';
import pptxIcon from '../assets/pptx.png';
import movIcon from '../assets/mov.png';
import mp4Icon from '../assets/mp4.png';
import mp3Icon from '../assets/mp3.svg';
import GeneratedDocumentCard from './GeneratedDocumentCard';
import DocumentCard from './DocumentCard';
import DocumentPreviewModal from './DocumentPreviewModal';

// Module-level variable to prevent duplicate socket initialization across all instances
let globalSocketInitialized = false;
let globalProcessedMessageIds = new Set();
let globalListenersAttached = false;

const ChatInterface = ({ currentConversation, onConversationUpdate, onConversationCreated }) => {
    const navigate = useNavigate();
    const location = useLocation();
    // ✅ FIX: Persist draft message across screen changes
    const [message, setMessage] = useState(() => {
        // Load draft from localStorage on mount
        const savedDraft = localStorage.getItem(`koda_draft_${currentConversation?.id || 'new'}`);
        return savedDraft || '';
    });
    const [messages, setMessages] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [user, setUser] = useState(null);
    const [streamingMessage, setStreamingMessage] = useState('');
    const [pendingFiles, setPendingFiles] = useState([]);      // Files attached but not yet sent
    const [uploadingFiles, setUploadingFiles] = useState([]);  // Files currently being uploaded
    const [uploadProgress, setUploadProgress] = useState({});  // Upload progress for each file
    const [attachedDocuments, setAttachedDocuments] = useState([]);
    const [showNotification, setShowNotification] = useState(false);
    const [notificationType, setNotificationType] = useState('success');
    const [uploadedCount, setUploadedCount] = useState(0);
    const [copiedMessageId, setCopiedMessageId] = useState(null);
    const [currentStage, setCurrentStage] = useState({ stage: 'searching', message: 'Searching documents...' });
    const [researchMode, setResearchMode] = useState(false);
    const [showResearchSuggestion, setShowResearchSuggestion] = useState(false);
    const [expandedSources, setExpandedSources] = useState({});
    const [researchProgress, setResearchProgress] = useState(null);
    const [isDraggingOver, setIsDraggingOver] = useState(false);
    const [previewDocument, setPreviewDocument] = useState(null); // For document preview popup
    const [socketReady, setSocketReady] = useState(false); // Track WebSocket connection state
    const messagesEndRef = useRef(null);
    const messagesContainerRef = useRef(null);
    const inputRef = useRef(null);
    const fileInputRef = useRef(null);
    const justCreatedConversationId = useRef(null);
    const abortControllerRef = useRef(null);
    const manuallyRemovedDocumentRef = useRef(false);
    const pendingMessageRef = useRef(null); // Queue final message data until animation completes

    // Use streaming hook for the current AI response (5ms = 200 chars/sec for fast smooth streaming)
    const { displayedText, isStreaming } = useStreamingText(streamingMessage, 5);

    // Helper function to get file icon based on extension
    const getFileIcon = (filename) => {
        if (!filename) {
            return docIcon;
        }
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

    // Helper function to check if file is an image
    const isImageFile = (file) => {
        if (!file) return false;
        // Check MIME type if available (for File objects)
        if (file.type) {
            return file.type.startsWith('image/');
        }
        // Fallback to filename extension check (for uploaded documents)
        if (file.name) {
            const ext = file.name.toLowerCase();
            return ext.match(/\.(jpg|jpeg|png|gif|webp|bmp|svg|tiff|tif)$/);
        }
        return false;
    };

    // Custom link component for document navigation
    const DocumentLink = ({ href, children }) => {
        // Check if this is a document link (starts with #doc-)
        if (href && href.startsWith('#doc-')) {
            const documentId = href.replace('#doc-', '');

            return (
                <a
                    href="#"
                    onClick={(e) => {
                        e.preventDefault();
                        navigate(`/document/${documentId}`);
                    }}
                    style={{
                        color: '#3B82F6',
                        textDecoration: 'underline',
                        cursor: 'pointer',
                        fontWeight: '600'
                    }}
                    onMouseEnter={(e) => {
                        e.target.style.color = '#2563EB';
                    }}
                    onMouseLeave={(e) => {
                        e.target.style.color = '#3B82F6';
                    }}
                >
                    {children}
                </a>
            );
        }

        // Regular link
        return <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>;
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

            const socket = chatService.initializeSocket(token);

            // Track socket connection state
            socket.on('connect', () => {
                console.log('✅ Socket connected');
                setSocketReady(true);
            });

            socket.on('disconnect', () => {
                console.log('❌ Socket disconnected');
                setSocketReady(false);
            });

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

                    // ✅ FIXED: Add messages immediately, don't queue
                    console.log('📬 Adding message immediately');

                    // Clear streaming states
                    setStreamingMessage('');
                    setIsLoading(false);

                    // Add final messages to history immediately
                    setMessages((prev) => {
                        const assistantExists = prev.some(msg => msg.id === data.assistantMessage.id);

                        if (assistantExists) {
                            console.log('⚠️ Message already exists, skipping:', data.assistantMessage.id);
                            return prev;
                        }

                        console.log('✅ Adding messages from new-message handler');

                        // Preserve attachedFiles from optimistic message
                        const optimisticMessage = prev.find(m => m.isOptimistic && m.role === 'user');
                        const userMessageWithFiles = {
                            ...data.userMessage,
                            attachedFiles: optimisticMessage?.attachedFiles || data.userMessage.attachedFiles || []
                        };

                        // ✅ FIX: Parse metadata and attach sources to assistantMessage
                        const assistantMessageWithSources = {
                            ...data.assistantMessage,
                            ragSources: data.sources || [],  // Attach sources from WebSocket
                        };

                        const withoutOptimistic = prev.filter(m => {
                            if (m.isOptimistic) return false;
                            if (m.id === data.userMessage?.id || m.id === data.assistantMessage?.id) return false;
                            return true;
                        });
                        return [...withoutOptimistic, userMessageWithFiles, assistantMessageWithSources];
                    });
                });

            // Listen for message chunks (real-time streaming)
            chatService.onMessageChunk((data) => {
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

            // Listen for message complete event (confirms streaming ended)
            chatService.onMessageComplete((data) => {
                console.log('✅ Message streaming complete event received:', data.conversationId);
                console.log('📚 Sources received:', data.sources);

                // ✅ FIX: Attach sources to the last assistant message
                if (data.sources && data.sources.length > 0) {
                    setMessages((prev) => {
                        const lastMessage = prev[prev.length - 1];
                        if (lastMessage && lastMessage.role === 'assistant') {
                            return [
                                ...prev.slice(0, -1),
                                { ...lastMessage, ragSources: data.sources }
                            ];
                        }
                        return prev;
                    });
                }

                // Clear streaming states
                setStreamingMessage('');
                setIsLoading(false);
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
        } else {
            // No conversation selected - clear messages to show blank new chat
            console.log('🆕 No conversation - clearing messages for new chat');
            setMessages([]);
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

    // CRITICAL FIX: Wait for streaming animation to complete before adding final message
    // This prevents the animation from being cut off mid-sentence
    useEffect(() => {
        if (!isStreaming && pendingMessageRef.current) {
            console.log('✅ Streaming animation completed - processing pending message');
            const pending = pendingMessageRef.current;
            pendingMessageRef.current = null;

            // Clear streaming message
            setStreamingMessage('');
            setIsLoading(false);

            // ✅ Clear attached documents AFTER AI finishes responding
            // The documents are already rendered in the user message's attachedFiles, so they'll stay visible
            // This clears the banner state so it doesn't reappear
            console.log('🧹 Clearing attachedDocuments and pendingFiles after streaming completes');
            setAttachedDocuments([]);
            setPendingFiles([]);

            // Add final messages to history
            setMessages((prev) => {
                // Triple-check if message already exists in the array
                const assistantExists = prev.some(msg => msg.id === pending.assistantMessage.id);

                if (assistantExists) {
                    console.log('⚠️ Message already exists in state, skipping:', pending.assistantMessage.id);
                    return prev;
                }

                console.log('✅ Replacing optimistic user message with real one + adding assistant message');
                console.log('Current message count:', prev.length);

                // Preserve attachedFiles from optimistic message
                const optimisticMessage = prev.find(m => m.isOptimistic && m.role === 'user');
                const userMessageWithFiles = {
                    ...pending.userMessage,
                    attachedFiles: optimisticMessage?.attachedFiles || pending.userMessage.attachedFiles || []
                };

                // Parse metadata for assistant message (for file actions, etc.)
                let assistantMessageWithMetadata = { ...pending.assistantMessage };
                if (pending.assistantMessage.metadata) {
                    const parsedMetadata = typeof pending.assistantMessage.metadata === 'string'
                        ? JSON.parse(pending.assistantMessage.metadata)
                        : pending.assistantMessage.metadata;
                    assistantMessageWithMetadata.metadata = parsedMetadata;
                    console.log('✅ Parsed assistant message metadata:', parsedMetadata);
                }

                // Replace optimistic user message with real one, then add assistant message
                const withoutOptimistic = prev.filter(m => {
                    if (m.isOptimistic) return false;
                    if (m.id === pending.userMessage?.id || m.id === pending.assistantMessage?.id) return false;
                    return true;
                });
                return [...withoutOptimistic, userMessageWithFiles, assistantMessageWithMetadata];
            });
        }
    }, [isStreaming]);

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

    // REMOVED: Research mode detection - popup disabled per user request
    // useEffect(() => {
    //     if (researchMode || !message) {
    //         setShowResearchSuggestion(false);
    //         return;
    //     }

    //     const researchKeywords = [
    //         'latest', 'recent', 'current', 'today', 'now', 'news',
    //         'stock', 'price', 'weather', 'what\'s happening',
    //         'update', 'breaking', 'trending', 'live', 'real-time',
    //         'currency', 'exchange rate', 'bitcoin', 'crypto',
    //         'sports score', 'election', 'market', 'economic'
    //     ];

    //     const messageLower = message.toLowerCase();
    //     const needsWeb = researchKeywords.some(keyword => messageLower.includes(keyword));
    //     setShowResearchSuggestion(needsWeb);
    // }, [message, researchMode]);

    // Handle documentId from URL parameter (Ask Koda feature)
    useEffect(() => {
        const searchParams = new URLSearchParams(location.search);
        const documentId = searchParams.get('documentId');

        // Don't re-attach if user manually removed it
        if (manuallyRemovedDocumentRef.current) {
            console.log('⏭️ Skipping document attachment - user manually removed it');
            return;
        }

        if (documentId && attachedDocuments.length === 0) {
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
                        setAttachedDocuments([{
                            id: data.documentId,
                            name: data.filename,
                            type: 'application/pdf', // Default type since it's not in status response
                            size: 0 // Size not available in status response
                        }]);

                        // Remove documentId from URL to avoid re-attaching on refresh
                        navigate(window.location.pathname, { replace: true });
                    } else {
                        console.error('❌ Failed to fetch document:', response.status);
                    }
                } catch (error) {
                    console.error('❌ Error fetching document:', error);
                }
            };

            fetchDocumentInfo();
        }
    }, [location.search]);

    // Simulate upload progress animation
    useEffect(() => {
        if (uploadingFiles.length > 0) {
            // Initialize progress for each file
            const initialProgress = {};
            uploadingFiles.forEach((_, index) => {
                initialProgress[index] = 0;
            });
            setUploadProgress(initialProgress);

            // Animate progress from 0 to 90% over 3 seconds
            const interval = setInterval(() => {
                setUploadProgress(prev => {
                    const updated = { ...prev };
                    let allComplete = true;
                    uploadingFiles.forEach((_, index) => {
                        if (updated[index] < 90) {
                            updated[index] = Math.min(90, (updated[index] || 0) + 3);
                            allComplete = false;
                        }
                    });
                    return updated;
                });
            }, 100);

            return () => clearInterval(interval);
        } else {
            // Clear progress when no files uploading
            setUploadProgress({});
        }
    }, [uploadingFiles.length]);

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

                    // Parse metadata for both assistant and user messages
                    if (msg.metadata) {
                        try {
                            const metadata = typeof msg.metadata === 'string' ? JSON.parse(msg.metadata) : msg.metadata;

                            // ✅ FIX: Preserve the entire metadata object first
                            msg.metadata = metadata;

                            // Parse RAG sources for assistant messages
                            if (msg.role === 'assistant') {
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
                            }

                            // ✅ FIX #1: Parse attachedFiles for user messages to persist on refresh
                            if (msg.role === 'user' && metadata.attachedFiles) {
                                msg.attachedFiles = metadata.attachedFiles;
                                console.log(`📎 [LOAD] Restored ${metadata.attachedFiles.length} attached files for user message`);
                            }
                        } catch (e) {
                            console.error('Error parsing message metadata:', e);
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
        const files = Array.from(event.target.files);
        console.log(`📎 File selection: ${files.length} file(s) selected`);
        console.log('📎 Files:', files.map(f => f.name).join(', '));
        if (files.length === 0) return;

        manuallyRemovedDocumentRef.current = false; // Reset flag when new file is selected
        setPendingFiles(prevFiles => {
            const newFiles = [...prevFiles, ...files];
            console.log(`📎 Pending files updated: now ${newFiles.length} file(s) total`);
            return newFiles;
        });
    };

    const handleRemoveAttachment = (indexToRemove = null) => {
        console.log('🗑️ Manually removing attachment');
        manuallyRemovedDocumentRef.current = true; // Prevent re-attaching from URL

        if (indexToRemove !== null) {
            // Remove specific file from array
            setPendingFiles(prevFiles => prevFiles.filter((_, index) => index !== indexToRemove));
        } else {
            // Remove all attachments
            setPendingFiles([]);
            setAttachedDocuments([]);
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
            // Clear documentId from URL if present
            const searchParams = new URLSearchParams(location.search);
            if (searchParams.has('documentId')) {
                console.log('🧹 Clearing documentId from URL');
                searchParams.delete('documentId');
                const newSearch = searchParams.toString();
                const newPath = newSearch ? `${window.location.pathname}?${newSearch}` : window.location.pathname;
                navigate(newPath, { replace: true });
            }
        }
    };

    // Drag and drop handlers
    const handleDragEnter = (e) => {
        e.preventDefault();
        e.stopPropagation();
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        e.stopPropagation();
        // Only show overlay for external file drags, not internal element drags
        const hasFiles = e.dataTransfer.types.includes('Files');
        setIsDraggingOver(hasFiles);
    };

    const handleDragLeave = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDraggingOver(false);
    };

    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDraggingOver(false);

        const files = Array.from(e.dataTransfer.files);
        console.log(`📎 Drag-and-drop: ${files.length} file(s) dropped`);
        console.log('📎 Files:', files.map(f => f.name).join(', '));

        if (files.length === 0) return;

        // Use the same logic as handleFileSelect
        manuallyRemovedDocumentRef.current = false;
        setPendingFiles(prevFiles => {
            const newFiles = [...prevFiles, ...files];
            console.log(`📎 Pending files updated: now ${newFiles.length} file(s) total`);
            return newFiles;
        });
    };

    // Clipboard paste handler for images
    const handlePaste = (e) => {
        const items = e.clipboardData?.items;
        if (!items) return;

        const imageFiles = [];

        // Iterate through clipboard items
        for (let i = 0; i < items.length; i++) {
            const item = items[i];

            // Check if item is an image
            if (item.type.startsWith('image/')) {
                console.log(`📋 Pasted image detected: ${item.type}`);

                // Get the blob from clipboard
                const blob = item.getAsFile();

                if (blob) {
                    // Convert blob to File with a meaningful name
                    const timestamp = Date.now();
                    const extension = item.type.split('/')[1] || 'png';
                    const file = new File(
                        [blob],
                        `screenshot-${timestamp}.${extension}`,
                        { type: blob.type }
                    );

                    imageFiles.push(file);
                    console.log(`📋 Created file: ${file.name}, size: ${file.size} bytes`);
                }
            }
        }

        // Add images to pending files
        if (imageFiles.length > 0) {
            console.log(`📋 Adding ${imageFiles.length} pasted image(s) to pending files`);
            manuallyRemovedDocumentRef.current = false;
            setPendingFiles(prevFiles => {
                const newFiles = [...prevFiles, ...imageFiles];
                console.log(`📋 Pending files updated: now ${newFiles.length} file(s) total`);
                return newFiles;
            });
        }
    };

    const handleVoiceTranscript = (transcript) => {
        // Set the transcript as the message input
        setMessage(transcript);
        // ✅ FIX: Save voice transcript to localStorage
        localStorage.setItem(`koda_draft_${currentConversation?.id || 'new'}`, transcript);
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

    const uploadAttachedFile = async (file) => {
        if (!file) {
            console.log('❌ No file to upload');
            return null;
        }

        try {
            console.log('📤 Starting file upload:', file.name);

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
            // Normalize filename to NFC form to handle special characters correctly
            formData.append('filename', file.name.normalize('NFC'));

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
            return data.document;
        } catch (error) {
            console.error('❌ Error uploading file:', error);
            alert('Failed to upload file: ' + error.message);
            return null;
        }
    };

    const uploadMultipleFiles = async (files) => {
        if (!files || files.length === 0) {
            console.log('❌ No files to upload');
            return [];
        }

        try {
            // Move files from pending to uploading state
            setUploadingFiles(files);
            console.log(`📤 Starting upload of ${files.length} file(s)`);

            // Calculate file hashes for all files
            const fileHashPromises = files.map(async (file) => {
                const arrayBuffer = await file.arrayBuffer();
                const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
                const hashArray = Array.from(new Uint8Array(hashBuffer));
                return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
            });
            const fileHashes = await Promise.all(fileHashPromises);

            // Prepare FormData
            const formData = new FormData();

            // Add all files
            files.forEach(file => {
                formData.append('files', file);
            });

            // Add file hashes as array
            formData.append('fileHashes', JSON.stringify(fileHashes));

            // Add filenames with proper encoding (NFC normalization)
            const normalizedFilenames = files.map(f => f.name.normalize('NFC'));
            formData.append('filenames', JSON.stringify(normalizedFilenames));

            console.log('📋 Uploading files:', normalizedFilenames);

            const token = localStorage.getItem('accessToken');
            const response = await fetch(`${process.env.REACT_APP_API_URL}/api/documents/upload-multiple`, {
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
                throw new Error('Failed to upload files: ' + errorText);
            }

            const data = await response.json();
            console.log(`✅ Successfully uploaded ${data.documents.length} file(s)`);

            // Clear uploading state - files are uploaded successfully
            setUploadingFiles([]);

            // ✅ FIX #2: Clear pending files AFTER successful upload
            setPendingFiles([]);

            // Show success notification (same as UniversalUploadModal)
            setUploadedCount(data.documents.length);
            setNotificationType('success');
            setShowNotification(true);
            setTimeout(() => setShowNotification(false), 5000);

            return data.documents;
        } catch (error) {
            console.error('❌ Error uploading files:', error);
            // On error, keep files in pending so user can retry
            // Don't move them back - they're still in pendingFiles
            setUploadingFiles([]);

            // Show error notification (same as UniversalUploadModal)
            setNotificationType('error');
            setShowNotification(true);
            setTimeout(() => setShowNotification(false), 5000);

            return [];
        }
    };

    const handleSendMessage = async () => {
        const isUploadingFiles = uploadingFiles.length > 0;
        if ((!message.trim() && pendingFiles.length === 0 && attachedDocuments.length === 0) || isLoading || isUploadingFiles) return;

        let messageText = message;
        const filesToUpload = [...pendingFiles]; // Store reference before clearing
        const documentsToAttach = [...attachedDocuments]; // Store reference before clearing

        console.log(`📤 handleSendMessage: Preparing to send with ${filesToUpload.length} file(s) and ${documentsToAttach.length} attached document(s)`);
        console.log(`📤 Files to upload:`, filesToUpload.map(f => f.name).join(', '));
        console.log(`📤 Attached documents:`, documentsToAttach.map(d => `${d.name} (ID: ${d.id})`).join(', '));

        // Clear input immediately
        setMessage('');
        // ✅ FIX: Clear draft from localStorage when message is sent
        localStorage.removeItem(`koda_draft_${currentConversation?.id || 'new'}`);
        // DON'T clear attachedDocuments or pendingFiles - they're needed for the API request
        // The banner will be hidden by checking isLoading state in the JSX

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
            attachedFiles: filesToUpload.length > 0
                ? filesToUpload.map(f => ({ name: f.name, type: f.type }))
                : documentsToAttach.length > 0
                    ? documentsToAttach.map(doc => ({ id: doc.id, name: doc.name, type: doc.type }))
                    : [],
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

        // Upload files in background if attached, or use already-uploaded document
        let uploadedDocuments = [];
        if (filesToUpload.length > 0) {
            // ✅ FIX: Show accurate upload status message
            setCurrentStage({ stage: 'uploading', message: `Uploading and processing ${filesToUpload.length} file(s)...` });
            uploadedDocuments = await uploadMultipleFiles(filesToUpload);
            setCurrentStage({ stage: 'searching', message: 'Searching documents...' });

            // ✅ FIX: Update optimistic message with document IDs after upload completes
            if (uploadedDocuments.length > 0) {
                setMessages((prev) => prev.map(msg => {
                    if (msg.id === tempUserId && msg.isOptimistic) {
                        console.log('📎 Updating optimistic message with uploaded document IDs');
                        return {
                            ...msg,
                            attachedFiles: uploadedDocuments.map(doc => ({
                                id: doc.id,
                                name: doc.filename || doc.name || filesToUpload.find(f => f.name)?.name,
                                type: doc.mimeType || doc.type || filesToUpload.find(f => f.type)?.type
                            }))
                        };
                    }
                    return msg;
                }));
            }

            // If no message text was provided, add a default message
            if (uploadedDocuments.length > 0 && !messageText.trim()) {
                if (uploadedDocuments.length === 1) {
                    messageText = `I just uploaded a file called "${filesToUpload[0].name}". Please analyze it and tell me what's in it.`;
                } else {
                    messageText = `I just uploaded ${uploadedDocuments.length} files. Please analyze them and tell me what's in them.`;
                }
            }
        } else if (documentsToAttach.length > 0) {
            // Use the documents that were already uploaded (from URL parameter)
            uploadedDocuments = documentsToAttach.map(doc => ({ id: doc.id }));

            // If no message text was provided, add a default message
            if (!messageText.trim()) {
                const docNames = documentsToAttach.map(d => d.name).join(', ');
                messageText = `I'd like to ask about ${documentsToAttach.length > 1 ? 'these documents' : 'this document'}: "${docNames}". Please analyze ${documentsToAttach.length > 1 ? 'them' : 'it'} and tell me what's in ${documentsToAttach.length > 1 ? 'them' : 'it'}.`;
            }
        }

        // For now, use the first uploaded document for compatibility with existing backend
        const uploadedDocument = uploadedDocuments.length > 0 ? uploadedDocuments[0] : null;

        console.log('📤 Sending message:', { messageText, hasConversation: !!currentConversation, hasUser: !!user, hasDocument: !!uploadedDocument });
        console.log('📤 uploadedDocuments:', uploadedDocuments);
        console.log('📤 uploadedDocument (first):', uploadedDocument);
        console.log('📤 documentsToAttach:', documentsToAttach);

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
                console.log('🔍 Using RAG with STREAMING (SSE) for question:', messageText);
                console.log('📊 Socket ready:', socketReady, '| User:', user?.id, '| Conversation:', currentConversation?.id);
                setCurrentStage({ stage: 'searching', message: researchMode ? 'Searching documents and web...' : 'Searching documents...' });

                // ✅ ALWAYS use SSE for questions (more reliable than WebSocket)
                // SSE doesn't depend on socket initialization state

                // Use RAG STREAMING endpoint for real-time responses
                try {
                    const token = localStorage.getItem('accessToken');
                    const requestBody = {
                        conversationId,
                        query: messageText,
                        researchMode,
                        // ✅ FIX: Use uploadedDocuments (which have IDs) instead of filesToUpload
                        attachedFiles: uploadedDocuments.length > 0
                            ? uploadedDocuments.map(doc => ({
                                id: doc.id,
                                name: doc.filename || doc.name,
                                type: doc.mimeType || doc.type
                            }))
                            : documentsToAttach.map(doc => ({
                                id: doc.id,
                                name: doc.name,
                                type: doc.type
                            })),
                        attachedDocuments: uploadedDocuments.length > 0
                            ? uploadedDocuments.map(doc => ({
                                id: doc.id,
                                name: doc.filename || doc.name,
                                type: doc.mimeType || doc.type
                            }))
                            : documentsToAttach.map(doc => ({
                                id: doc.id,
                                name: doc.name,
                                type: doc.type
                            })),
                        // ✅ FIX: Use uploadedDocument?.id which is extracted correctly
                        documentId: uploadedDocument?.id || null,
                    };

                    console.log('📤 RAG REQUEST BODY:', JSON.stringify(requestBody, null, 2));
                    console.log('🚀 [DEBUG] Starting SSE request to:', `${process.env.REACT_APP_API_URL}/api/rag/query/stream`);

                    const response = await fetch(
                        `${process.env.REACT_APP_API_URL}/api/rag/query/stream`,
                        {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                Authorization: `Bearer ${token}`,
                            },
                            body: JSON.stringify(requestBody),
                        }
                    );

                    console.log('🚀 [DEBUG] Response status:', response.status);
                    console.log('🚀 [DEBUG] Response headers:', [...response.headers.entries()]);
                    console.log('🚀 [DEBUG] Response ok:', response.ok);

                    if (!response.ok) {
                        throw new Error(`HTTP error! status: ${response.status}`);
                    }

                    // Set up SSE reader
                    const reader = response.body.getReader();
                    console.log('🚀 [DEBUG] Got reader:', !!reader);

                    const decoder = new TextDecoder();
                    let buffer = '';
                    let streamedContent = '';
                    let metadata = null;

                    console.log('🌊 Starting SSE stream...');
                    console.log('🚀 [DEBUG] Initial streamedContent:', streamedContent);
                    // Use varied, natural messages instead of robotic "Generating answer"
                    const thinkingMessages = ['Thinking...', 'Analyzing...', 'Processing...', 'Understanding...', 'Working on it...'];
                    const randomMessage = thinkingMessages[Math.floor(Math.random() * thinkingMessages.length)];
                    setCurrentStage({ stage: 'generating', message: randomMessage });

                    // Add timeout detection
                    const streamTimeout = setTimeout(() => {
                        console.error('❌ Stream timeout - no chunks received in 30 seconds');
                        reader.cancel();
                        throw new Error('Stream timeout - no response from server');
                    }, 30000);

                    let firstChunkReceived = false;

                    while (true) {
                        console.log('🚀 [DEBUG] Waiting for chunk...');
                        const { value, done } = await reader.read();
                        console.log('🚀 [DEBUG] Got chunk - done:', done, 'value length:', value?.length);

                        if (done) {
                            console.log('✅ Stream finished');
                            console.log('🚀 [DEBUG] Final streamedContent length:', streamedContent.length);
                            clearTimeout(streamTimeout);
                            break;
                        }

                        // Clear timeout on first chunk
                        if (!firstChunkReceived) {
                            console.log('🚀 [DEBUG] First chunk received, clearing timeout');
                            clearTimeout(streamTimeout);
                            firstChunkReceived = true;
                        }

                        // Decode chunk and add to buffer
                        const decodedChunk = decoder.decode(value, { stream: true });
                        console.log('🚀 [DEBUG] Decoded chunk length:', decodedChunk.length);
                        console.log('🚀 [DEBUG] Decoded chunk preview:', decodedChunk.substring(0, 100));
                        buffer += decodedChunk;

                        // Process complete SSE messages (delimited by \n\n)
                        const messages = buffer.split('\n\n');
                        buffer = messages.pop() || ''; // Keep incomplete message in buffer

                        for (const message of messages) {
                            if (message.startsWith('data: ')) {
                                try {
                                    const data = JSON.parse(message.slice(6));
                                    console.log('🚀 [DEBUG] Parsed SSE message type:', data.type);

                                    if (data.type === 'connected') {
                                        console.log('🔗 Connected to conversation:', data.conversationId);
                                    } else if (data.type === 'content') {
                                        // Stream content chunk
                                        streamedContent += data.content;
                                        console.log('💜 [STREAMING] Received chunk, total length:', streamedContent.length);
                                        console.log('💜 [STREAMING] Chunk preview:', streamedContent.substring(0, 50));
                                        console.log('🚀 [DEBUG] About to call setStreamingMessage with length:', streamedContent.length);
                                        setStreamingMessage(streamedContent);
                                        console.log('🚀 [DEBUG] Called setStreamingMessage');
                                    } else if (data.type === 'done') {
                                        console.log('✅ Stream complete, metadata received');
                                        metadata = data;
                                    } else if (data.type === 'error') {
                                        console.error('❌ Stream error:', data.error);
                                        throw new Error(data.error);
                                    }
                                } catch (parseError) {
                                    console.error('Error parsing SSE message:', parseError);
                                }
                            }
                        }
                    }

                    // CRITICAL FIX: Queue message instead of immediately clearing streaming
                    // Let the existing useEffect wait for animation to complete before processing
                    // This ensures SSE streaming behaves the same as WebSocket streaming
                    console.log('📬 SSE stream complete - queueing message to wait for animation');

                    if (metadata) {
                        // Use the full message objects from backend instead of reconstructing
                        const realUserMessage = metadata.userMessage || {
                            id: metadata.userMessageId,
                            role: 'user',
                            content: displayMessageText,
                            createdAt: new Date().toISOString(),
                        };

                        // 🐛 DEBUG: Log metadata and actions
                        console.log('🐛 [DEBUG] Metadata received:', JSON.stringify(metadata, null, 2));
                        console.log('🐛 [DEBUG] Sources:', metadata.sources);
                        console.log('🐛 [DEBUG] Actions:', metadata.actions);
                        console.log('🐛 [DEBUG] ContextId:', metadata.contextId);
                        console.log('🐛 [DEBUG] assistantMessage from backend:', metadata.assistantMessage);

                        // Use backend message object which includes metadata for file actions
                        const assistantMessage = metadata.assistantMessage ? {
                            ...metadata.assistantMessage,
                            content: streamedContent, // Use streamed content (raw from Gemini)
                            ragSources: metadata.sources || [],
                            webSources: [],
                            expandedQuery: metadata.expandedQuery,
                            contextId: metadata.contextId,
                            actions: metadata.actions || [],
                        } : {
                            id: metadata.assistantMessageId,
                            role: 'assistant',
                            content: streamedContent,
                            createdAt: new Date().toISOString(),
                            ragSources: metadata.sources || [],
                            webSources: [],
                            expandedQuery: metadata.expandedQuery,
                            contextId: metadata.contextId,
                            actions: metadata.actions || [],
                        };

                        // Queue message - the useEffect will handle it when animation completes
                        pendingMessageRef.current = {
                            userMessage: realUserMessage,
                            assistantMessage: assistantMessage
                        };

                        // Handle UI updates (folder refresh, etc.)
                        if (metadata.uiUpdate) {
                            console.log('🔄 UI update requested:', metadata.uiUpdate.type);
                            if (metadata.uiUpdate.type === 'refresh_folders' || metadata.uiUpdate.type === 'refresh_all') {
                                // Trigger folder refresh if needed
                                if (onConversationUpdate) {
                                    onConversationUpdate();
                                }
                            }
                        }
                    }

                    // Note: streamingMessage will be cleared by the useEffect when animation completes
                    // Note: isLoading will be set to false by the useEffect when animation completes
                    setResearchMode(false);
                } catch (error) {
                    console.error('❌ Error in RAG streaming:', error);
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
            } else if (currentConversation?.id && user?.id && socketReady) {
                // ✅ Only use WebSocket if socket is ready
                console.log('🔌 Sending via WebSocket:', { conversationId: currentConversation.id, userId: user.id, documentId: uploadedDocument?.id });
                // Send via WebSocket for real-time response
                chatService.sendMessageRealtime(
                    currentConversation.id,
                    user.id,
                    messageText,
                    uploadedDocument?.id
                );
            } else {
                // ✅ Fallback to SSE if socket not ready or no conversation
                console.log('📡 Using SSE fallback (socket not ready or new conversation)');
                console.log('📊 Socket ready:', socketReady, '| User:', user?.id, '| Conversation:', currentConversation?.id);

                try {
                    const token = localStorage.getItem('accessToken');
                    const requestBody = {
                        conversationId: conversationId,
                        query: messageText,
                        researchMode: false,
                        attachedDocumentId: uploadedDocument?.id || null,
                    };

                    console.log('📤 RAG REQUEST BODY:', JSON.stringify(requestBody, null, 2));
                    console.log('🚀 [DEBUG] Starting SSE request to:', `${process.env.REACT_APP_API_URL}/api/rag/query/stream`);

                    const response = await fetch(
                        `${process.env.REACT_APP_API_URL}/api/rag/query/stream`,
                        {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                Authorization: `Bearer ${token}`,
                            },
                            body: JSON.stringify(requestBody),
                        }
                    );

                    console.log('🚀 [DEBUG] Response status:', response.status);
                    console.log('🚀 [DEBUG] Response ok:', response.ok);

                    if (!response.ok) {
                        throw new Error(`HTTP error! status: ${response.status}`);
                    }

                    // Set up SSE reader (same as question handling)
                    const reader = response.body.getReader();
                    console.log('🚀 [DEBUG] Got reader:', !!reader);

                    const decoder = new TextDecoder();
                    let buffer = '';
                    let streamedContent = '';
                    let metadata = null;

                    console.log('🌊 Starting SSE stream (fallback)...');
                    console.log('🚀 [DEBUG] Initial streamedContent:', streamedContent);
                    setCurrentStage({ stage: 'generating', message: 'Thinking...' });

                    // Add timeout detection
                    const streamTimeout = setTimeout(() => {
                        console.error('❌ Stream timeout - no chunks received in 30 seconds');
                        reader.cancel();
                        throw new Error('Stream timeout - no response from server');
                    }, 30000);

                    let firstChunkReceived = false;

                    while (true) {
                        console.log('🚀 [DEBUG] Waiting for chunk...');
                        const { value, done } = await reader.read();
                        console.log('🚀 [DEBUG] Got chunk - done:', done, 'value length:', value?.length);

                        if (done) {
                            console.log('✅ Stream finished');
                            console.log('🚀 [DEBUG] Final streamedContent length:', streamedContent.length);
                            clearTimeout(streamTimeout);
                            break;
                        }

                        if (!firstChunkReceived) {
                            console.log('🚀 [DEBUG] First chunk received, clearing timeout');
                            clearTimeout(streamTimeout);
                            firstChunkReceived = true;
                        }

                        const decodedChunk = decoder.decode(value, { stream: true });
                        console.log('🚀 [DEBUG] Decoded chunk length:', decodedChunk.length);
                        console.log('🚀 [DEBUG] Decoded chunk preview:', decodedChunk.substring(0, 100));

                        buffer += decodedChunk;

                        const messages = buffer.split('\n\n');
                        buffer = messages.pop() || '';

                        for (const message of messages) {
                            if (message.startsWith('data: ')) {
                                try {
                                    const data = JSON.parse(message.slice(6));
                                    console.log('🚀 [DEBUG] Parsed SSE message type:', data.type);

                                    if (data.type === 'content') {
                                        streamedContent += data.content;
                                        console.log('💜 [STREAMING] Received chunk, total length:', streamedContent.length);
                                        console.log('💜 [STREAMING] Chunk preview:', streamedContent.substring(0, 50));
                                        console.log('🚀 [DEBUG] About to call setStreamingMessage with length:', streamedContent.length);
                                        setStreamingMessage(streamedContent);
                                        console.log('🚀 [DEBUG] Called setStreamingMessage');
                                    } else if (data.type === 'done') {
                                        metadata = data;
                                    } else if (data.type === 'error') {
                                        throw new Error(data.error);
                                    }
                                } catch (parseError) {
                                    console.error('Error parsing SSE message:', parseError);
                                }
                            }
                        }
                    }

                    // Queue message
                    if (metadata) {
                        const realUserMessage = {
                            id: metadata.userMessageId,
                            role: 'user',
                            content: displayMessageText,
                            createdAt: new Date().toISOString(),
                        };

                        const assistantMessage = {
                            id: metadata.assistantMessageId,
                            role: 'assistant',
                            content: streamedContent,
                            createdAt: new Date().toISOString(),
                            ragSources: metadata.sources || [],
                        };

                        pendingMessageRef.current = {
                            userMessage: realUserMessage,
                            assistantMessage: assistantMessage
                        };
                    }
                } catch (error) {
                    console.error('❌ Error in SSE fallback:', error);
                    setIsLoading(false);
                    setStreamingMessage('');
                }
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
            <div
                ref={messagesContainerRef}
                onDragEnter={handleDragEnter}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                style={{
                    flex: '1 1 0',
                    overflowY: 'auto',
                    overflowX: 'hidden',
                    padding: 20,
                    paddingBottom: 20,
                    position: 'relative',
                }}
            >
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
                                                            <div className="markdown-content" style={{color: '#323232', fontSize: 16, fontFamily: 'Plus Jakarta Sans', fontWeight: '500', lineHeight: '24px', width: '100%', whiteSpace: 'pre-wrap', wordWrap: 'break-word', overflowWrap: 'break-word'}}>
                                                                <ReactMarkdown
                                                                    remarkPlugins={[remarkGfm]}
                                                                    components={{ a: DocumentLink }}
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

                                                            {/* Show File Preview Button */}
                                                            {msg.metadata && msg.metadata.actionType === 'show_file' && msg.metadata.success && msg.metadata.document && (
                                                                <div
                                                                    onClick={() => {
                                                                        console.log('👁️ [SHOW_FILE] Opening preview for:', msg.metadata.document);
                                                                        setPreviewDocument({
                                                                            id: msg.metadata.document.id,
                                                                            filename: msg.metadata.document.filename,
                                                                            mimeType: msg.metadata.document.mimeType
                                                                        });
                                                                    }}
                                                                    style={{
                                                                        display: 'flex',
                                                                        alignItems: 'center',
                                                                        gap: '12px',
                                                                        padding: '12px 16px',
                                                                        marginTop: '8px',
                                                                        backgroundColor: 'white',
                                                                        border: '1px solid #E5E5E5',
                                                                        borderRadius: '8px',
                                                                        cursor: 'pointer',
                                                                        transition: 'all 0.2s ease',
                                                                    }}
                                                                    onMouseEnter={(e) => {
                                                                        e.currentTarget.style.backgroundColor = '#F5F5F5';
                                                                        e.currentTarget.style.borderColor = '#D1D1D6';
                                                                    }}
                                                                    onMouseLeave={(e) => {
                                                                        e.currentTarget.style.backgroundColor = 'white';
                                                                        e.currentTarget.style.borderColor = '#E5E5E5';
                                                                    }}
                                                                >
                                                                    {/* File Icon */}
                                                                    <img
                                                                        src={
                                                                            msg.metadata.document.mimeType === 'application/pdf' ? pdfIcon :
                                                                            msg.metadata.document.mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ? docIcon :
                                                                            msg.metadata.document.mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ? xlsIcon :
                                                                            msg.metadata.document.mimeType === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' ? pptxIcon :
                                                                            msg.metadata.document.mimeType === 'text/plain' ? txtIcon :
                                                                            msg.metadata.document.mimeType === 'image/jpeg' ? jpgIcon :
                                                                            msg.metadata.document.mimeType === 'image/png' ? pngIcon :
                                                                            msg.metadata.document.mimeType === 'video/quicktime' ? movIcon :
                                                                            msg.metadata.document.mimeType === 'video/mp4' ? mp4Icon :
                                                                            msg.metadata.document.mimeType === 'audio/mpeg' ? mp3Icon :
                                                                            msg.metadata.document.mimeType?.startsWith('image/') ? pngIcon :
                                                                            msg.metadata.document.mimeType?.startsWith('video/') ? mp4Icon :
                                                                            msg.metadata.document.mimeType?.startsWith('audio/') ? mp3Icon :
                                                                            pdfIcon
                                                                        }
                                                                        alt="file icon"
                                                                        style={{
                                                                            width: '32px',
                                                                            height: '32px',
                                                                            objectFit: 'contain'
                                                                        }}
                                                                    />

                                                                    {/* File Info */}
                                                                    <div style={{ flex: 1 }}>
                                                                        <div style={{
                                                                            fontSize: '14px',
                                                                            fontWeight: '500',
                                                                            color: '#1F1F1F',
                                                                            marginBottom: '4px',
                                                                            overflow: 'hidden',
                                                                            textOverflow: 'ellipsis',
                                                                            whiteSpace: 'nowrap'
                                                                        }}>
                                                                            {msg.metadata.document.filename}
                                                                        </div>
                                                                        <div style={{
                                                                            fontSize: '12px',
                                                                            color: '#6B7280'
                                                                        }}>
                                                                            {msg.metadata.document.fileSize ?
                                                                                `${(msg.metadata.document.fileSize / 1024).toFixed(2)} KB` :
                                                                                'File'}
                                                                        </div>
                                                                    </div>
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
                                                                            <img
                                                                                src={getFileIcon(filename)}
                                                                                alt="File icon"
                                                                                style={{
                                                                                    width: 40,
                                                                                    height: 40,
                                                                                    objectFit: 'contain',
                                                                                    flexShrink: 0
                                                                                }}
                                                                            />
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
                                        {/* Attached files display - check both optimistic attachedFiles and metadata */}
                                        {(() => {
                                            // Try to get attached files from metadata first (for persisted messages)
                                            let attachedFiles = msg.attachedFiles || [];

                                            if (attachedFiles.length === 0 && msg.metadata) {
                                                try {
                                                    const metadata = typeof msg.metadata === 'string' ? JSON.parse(msg.metadata) : msg.metadata;
                                                    if (metadata?.attachedFiles) {
                                                        attachedFiles = metadata.attachedFiles;
                                                    } else if (metadata?.attachedFile) {
                                                        // Backward compatibility with old single file format
                                                        attachedFiles = [metadata.attachedFile];
                                                    }
                                                } catch (e) {
                                                    console.error('Error parsing message metadata:', e);
                                                }
                                            }

                                            return attachedFiles.length > 0 ? (
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
                                                    {attachedFiles.map((attachedFile, fileIndex) => (
                                                        <div
                                                            key={fileIndex}
                                                            onClick={() => {
                                                                if (attachedFile.id) {
                                                                    // DocumentPreviewModal expects 'filename' property
                                                                    setPreviewDocument({
                                                                        id: attachedFile.id,
                                                                        filename: attachedFile.name,
                                                                        mimeType: attachedFile.type
                                                                    });
                                                                }
                                                            }}
                                                            style={{
                                                                padding: 12,
                                                                background: '#FFFFFF',
                                                                border: '1px solid #E6E6EC',
                                                                borderRadius: 12,
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                gap: 12,
                                                                minWidth: 280,
                                                                cursor: attachedFile.id ? 'pointer' : 'default',
                                                                transition: 'all 0.2s',
                                                            }}
                                                            onMouseEnter={(e) => {
                                                                if (attachedFile.id) {
                                                                    e.currentTarget.style.background = '#F9F9F9';
                                                                    e.currentTarget.style.transform = 'translateY(-1px)';
                                                                }
                                                            }}
                                                            onMouseLeave={(e) => {
                                                                if (attachedFile.id) {
                                                                    e.currentTarget.style.background = '#FFFFFF';
                                                                    e.currentTarget.style.transform = 'translateY(0)';
                                                                }
                                                            }}
                                                        >
                                                            {/* File icon - using proper getFileIcon function */}
                                                            <img
                                                                src={getFileIcon(attachedFile.name)}
                                                                alt="File icon"
                                                                style={{
                                                                    width: 40,
                                                                    height: 40,
                                                                    imageRendering: '-webkit-optimize-contrast',
                                                                    objectFit: 'contain',
                                                                    shapeRendering: 'geometricPrecision',
                                                                    flexShrink: 0,
                                                                }}
                                                            />

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
                                                            </div>
                                                        </div>
                                                    ))}
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
                        {streamingMessage && (
                            <div style={{marginBottom: 16, display: 'flex', justifyContent: 'flex-start'}}>
                                <div style={{maxWidth: '70%', padding: 12, background: 'white', borderRadius: 18, border: '1px solid #E6E6EC', justifyContent: 'flex-start', alignItems: 'flex-start', gap: 10, display: 'flex'}}>
                                    <div style={{overflow: 'hidden', flexDirection: 'column', justifyContent: 'center', alignItems: 'flex-start', gap: 16, display: 'flex'}}>
                                        <div style={{justifyContent: 'flex-start', alignItems: 'flex-start', gap: 8, display: 'flex'}}>
                                            <div style={{width: 34, height: 34, minWidth: 34, minHeight: 34, background: 'white', borderRadius: '50%', border: '1px solid #F1F0EF', justifyContent: 'center', alignItems: 'center', gap: 10, display: 'flex', overflow: 'hidden'}}>
                                                <img style={{width: '100%', height: '100%', objectFit: 'cover'}} src={logo} alt="KODA" />
                                            </div>
                                            <div style={{justifyContent: 'flex-start', alignItems: 'flex-start', gap: 12, display: 'flex'}}>
                                                <div style={{flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: 4, display: 'flex'}}>
                                                    <div className="markdown-content streaming" style={{color: '#323232', fontSize: 16, fontFamily: 'Plus Jakarta Sans', fontWeight: '500', lineHeight: '24px', whiteSpace: 'pre-wrap', overflowWrap: 'break-word'}}>
                                                        <ReactMarkdown
                                                            remarkPlugins={[remarkGfm]}
                                                            components={{ a: DocumentLink }}
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

                        {/* Loading Indicator - show ONLY when waiting for response, hide once streaming starts */}
                        {(isLoading && !streamingMessage && !displayedText) && (
                            <div style={{marginBottom: 16, display: 'flex', justifyContent: 'flex-start'}}>
                                <div style={{padding: '12px 16px', borderRadius: 12, background: '#F5F5F5', color: '#32302C', display: 'flex', flexDirection: 'column', gap: 10}}>
                                    <div style={{color: '#6B7280', fontSize: 15, fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: '500'}}>
                                        {currentStage.message}
                                    </div>
                                    <div style={{display: 'flex', gap: '8px', alignItems: 'center', height: '24px'}}>
                                        <div className="typing-indicator-dot"></div>
                                        <div className="typing-indicator-dot"></div>
                                        <div className="typing-indicator-dot"></div>
                                    </div>
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>
                )}

                {/* Drag and Drop Overlay - Only covers messages area */}
                {isDraggingOver && (
                    <div
                        style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            background: 'rgba(23, 23, 23, 0.95)',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 20,
                            zIndex: 999,
                            pointerEvents: 'none',
                            animation: 'fadeIn 0.2s ease-in'
                        }}
                    >
                        <style>
                            {`
                                @keyframes fadeIn {
                                    from { opacity: 0; }
                                    to { opacity: 1; }
                                }
                                @keyframes pulse {
                                    0%, 100% { transform: scale(1); }
                                    50% { transform: scale(1.05); }
                                }
                            `}
                        </style>
                        <div
                            style={{
                                width: 120,
                                height: 120,
                                background: 'white',
                                borderRadius: '50%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                animation: 'pulse 1.5s ease-in-out infinite'
                            }}
                        >
                            <UploadIconDrag style={{ width: 60, height: 60 }} />
                        </div>
                        <div
                            style={{
                                color: 'white',
                                fontSize: 32,
                                fontFamily: 'Plus Jakarta Sans',
                                fontWeight: '700',
                                textAlign: 'center'
                            }}
                        >
                            Drop files here to upload
                        </div>
                        <div
                            style={{
                                color: 'rgba(255, 255, 255, 0.7)',
                                fontSize: 18,
                                fontFamily: 'Plus Jakarta Sans',
                                fontWeight: '500',
                                textAlign: 'center'
                            }}
                        >
                            Release to attach files to your message
                        </div>
                    </div>
                )}
            </div>

            {/* Message Input */}
            <div
                style={{padding: 20, background: 'white', borderTop: '1px solid #E6E6EC'}}
                onDragEnter={handleDragEnter}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
            >
                {/* REMOVED: Research Mode Popup - disabled per user request */}
                {/* {showResearchSuggestion && !researchMode && (
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
                )} */}

                {/* File Attachments Preview */}
                {(pendingFiles.length > 0 || uploadingFiles.length > 0) && (
                    <div style={{marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 8}}>
                        {/* Pending files */}
                        {pendingFiles.map((file, index) => {
                            const isImage = isImageFile(file);
                            const previewUrl = isImage ? URL.createObjectURL(file) : null;

                            return (
                            <div key={`pending-${index}`} style={{padding: 12, background: '#F5F5F5', borderRadius: 12, border: '1px solid #E6E6EC', display: 'flex', alignItems: 'center', gap: 12}}>
                                <div style={{position: 'relative', width: 40, height: 40, flexShrink: 0}}>
                                    {isImage ? (
                                        <img
                                            src={previewUrl}
                                            alt="Image preview"
                                            style={{
                                                width: 40,
                                                height: 40,
                                                objectFit: 'cover',
                                                borderRadius: 6
                                            }}
                                        />
                                    ) : (
                                        <img
                                            src={getFileIcon(file.name)}
                                            alt="File icon"
                                            style={{
                                                width: 40,
                                                height: 40,
                                                imageRendering: '-webkit-optimize-contrast',
                                                objectFit: 'contain',
                                                shapeRendering: 'geometricPrecision'
                                            }}
                                        />
                                    )}
                                </div>
                                <div style={{flex: 1}}>
                                    <div style={{fontSize: 14, fontWeight: '600', color: '#32302C'}}>{file.name}</div>
                                    <div style={{fontSize: 12, color: '#8E8E93'}}>
                                        {`${(file.size / 1024).toFixed(2)} KB`}
                                    </div>
                                </div>
                                <button
                                    onClick={() => handleRemoveAttachment(index)}
                                    style={{width: 32, height: 32, background: 'white', border: '1px solid #E6E6EC', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, color: '#8E8E93'}}
                                >
                                    ✕
                                </button>
                            </div>
                            );
                        })}

                        {/* Uploading files */}
                        {uploadingFiles.map((file, index) => {
                            const isImage = isImageFile(file);
                            const previewUrl = isImage ? URL.createObjectURL(file) : null;
                            const progressWidth = uploadProgress[index] || 0;

                            return (
                            <div
                                key={`uploading-${index}`}
                                style={{
                                    position: 'relative',
                                    padding: 12,
                                    background: 'white',
                                    borderRadius: 12,
                                    border: '1px solid #E6E6EC',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 12,
                                    overflow: 'hidden'
                                }}
                            >
                                {/* Progress bar background */}
                                <div style={{
                                    width: '100%',
                                    height: '100%',
                                    left: 0,
                                    top: 0,
                                    position: 'absolute',
                                    pointerEvents: 'none'
                                }}>
                                    <div style={{
                                        width: `${progressWidth}%`,
                                        height: '100%',
                                        left: 0,
                                        top: 0,
                                        position: 'absolute',
                                        background: 'rgba(169, 169, 169, 0.12)',
                                        borderTopLeftRadius: 12,
                                        borderBottomLeftRadius: 12,
                                        transition: 'width 0.3s ease-in-out',
                                        opacity: progressWidth >= 100 ? 0 : 1,
                                        transitionProperty: progressWidth >= 100 ? 'width 0.3s ease-in-out, opacity 400ms ease-out' : 'width 0.3s ease-in-out'
                                    }} />
                                </div>

                                {/* Upload percentage counter */}
                                <div style={{
                                    position: 'absolute',
                                    bottom: 12,
                                    right: 16,
                                    fontSize: 13,
                                    fontWeight: '500',
                                    color: '#6C6C6C',
                                    zIndex: 2,
                                    opacity: progressWidth < 100 ? 1 : 0,
                                    transition: 'opacity 0.3s ease-out'
                                }}>
                                    {Math.round(progressWidth)}%
                                </div>

                                {/* File icon */}
                                <div style={{position: 'relative', width: 40, height: 40, flexShrink: 0, zIndex: 1}}>
                                    {isImage ? (
                                        <img
                                            src={previewUrl}
                                            alt="Image preview"
                                            style={{
                                                width: 40,
                                                height: 40,
                                                objectFit: 'cover',
                                                borderRadius: 6
                                            }}
                                        />
                                    ) : (
                                        <img
                                            src={getFileIcon(file.name)}
                                            alt="File icon"
                                            style={{
                                                width: 40,
                                                height: 40,
                                                imageRendering: '-webkit-optimize-contrast',
                                                objectFit: 'contain',
                                                shapeRendering: 'geometricPrecision'
                                            }}
                                        />
                                    )}
                                </div>

                                {/* File info */}
                                <div style={{flex: 1, zIndex: 1}}>
                                    <div style={{fontSize: 14, fontWeight: '600', color: '#32302C'}}>{file.name}</div>
                                    <div style={{fontSize: 12, color: '#A0A0A0'}}>
                                        Uploading to cloud...
                                    </div>
                                </div>
                            </div>
                            );
                        })}
                    </div>
                )}

                {/* Document Attachments Banner - Hide when loading/streaming */}
                {(attachedDocuments.length > 0 || (messages.length > 0 && messages[messages.length - 1]?.role === 'user' && messages[messages.length - 1]?.attachedFiles?.length > 0)) && !isLoading && !isStreaming && (
                    <div
                        onClick={() => {
                            // ✅ FIX #2: Make banner clickable to preview document
                            console.log('🖱️ [BANNER CLICK] Attachment banner clicked');
                            console.log('📎 [BANNER CLICK] attachedDocuments:', attachedDocuments);
                            console.log('💬 [BANNER CLICK] Last message attachedFiles:', messages.length > 0 && messages[messages.length - 1]?.attachedFiles);

                            const docs = attachedDocuments.length > 0
                                ? attachedDocuments
                                : (messages.length > 0 && messages[messages.length - 1]?.attachedFiles) || [];

                            console.log('📋 [BANNER CLICK] Resolved docs array:', docs);

                            if (docs.length > 0 && docs[0].id) {
                                console.log('✅ [BANNER CLICK] Opening preview for document:', {
                                    id: docs[0].id,
                                    filename: docs[0].name,
                                    mimeType: docs[0].type
                                });
                                setPreviewDocument({
                                    id: docs[0].id,
                                    filename: docs[0].name,
                                    mimeType: docs[0].type
                                });
                            } else {
                                console.warn('⚠️ [BANNER CLICK] No valid document found to preview');
                            }
                        }}
                        style={{
                            marginBottom: 12,
                            padding: 12,
                            background: 'white',
                            borderRadius: 12,
                            border: '1px solid #E6E6EC',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 12,
                            cursor: 'pointer',  // ✅ Show it's clickable
                            transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.background = '#F9F9FB';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'white';
                        }}
                    >
                        <img
                            src={getFileIcon((() => {
                                const docs = attachedDocuments.length > 0
                                    ? attachedDocuments
                                    : (messages.length > 0 && messages[messages.length - 1]?.attachedFiles) || [];
                                return docs.length > 0 ? docs[0].name : '';
                            })())}
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
                            <div style={{fontSize: 14, fontWeight: '600', color: '#32302C'}}>
                                {(() => {
                                    const docs = attachedDocuments.length > 0
                                        ? attachedDocuments
                                        : (messages.length > 0 && messages[messages.length - 1]?.attachedFiles) || [];
                                    return docs.length === 1 ? docs[0].name : `${docs.length} documents attached`;
                                })()}
                            </div>
                            <div style={{fontSize: 12, color: '#8E8E93'}}>
                                {(() => {
                                    const docs = attachedDocuments.length > 0
                                        ? attachedDocuments
                                        : (messages.length > 0 && messages[messages.length - 1]?.attachedFiles) || [];
                                    return docs.length === 1
                                        ? 'Ready to answer questions about this document'
                                        : 'Ready to compare and analyze these documents';
                                })()}
                            </div>
                        </div>
                        <button
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleRemoveAttachment();
                            }}
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
                        onChange={(e) => {
                            const newValue = e.target.value;
                            setMessage(newValue);
                            // ✅ FIX: Save draft to localStorage
                            localStorage.setItem(`koda_draft_${currentConversation?.id || 'new'}`, newValue);
                        }}
                        onPaste={handlePaste}
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
                            multiple
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
                            disabled={!message.trim() && pendingFiles.length === 0 && attachedDocuments.length === 0}
                            style={{
                                width: 40,
                                height: 40,
                                background: (message.trim() || pendingFiles.length > 0 || attachedDocuments.length > 0) ? '#171717' : '#ccc',
                                borderRadius: '50%',
                                border: 'none',
                                cursor: (message.trim() || pendingFiles.length > 0 || attachedDocuments.length > 0) ? 'pointer' : 'not-allowed',
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

            {/* Upload Notification - Matches UniversalUploadModal */}
            {showNotification && (uploadedCount > 0 || notificationType === 'error') && (
                <div style={{
                    position: 'fixed',
                    top: 20,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: 'calc(100% - 700px)',
                    maxWidth: '960px',
                    minWidth: '400px',
                    zIndex: 99999,
                    animation: 'slideDown 0.3s ease-out'
                }}>
                    <div style={{
                        width: '100%',
                        padding: '6px 16px',
                        background: '#181818',
                        borderRadius: 14,
                        justifyContent: 'center',
                        alignItems: 'center',
                        gap: 10,
                        display: 'inline-flex'
                    }}>
                        {notificationType === 'success' ? (
                            <>
                                <div style={{
                                    width: 24,
                                    height: 24,
                                    borderRadius: '50%',
                                    background: '#34A853',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    flexShrink: 0
                                }}>
                                    <CheckIcon style={{width: 12, height: 12}} />
                                </div>
                                <div style={{
                                    flex: '1 1 0',
                                    color: 'white',
                                    fontSize: 13,
                                    fontFamily: 'Plus Jakarta Sans',
                                    fontWeight: '400',
                                    lineHeight: '18px',
                                    wordWrap: 'break-word'
                                }}>
                                    {uploadedCount} document{uploadedCount > 1 ? 's have' : ' has'} been successfully uploaded.
                                </div>
                            </>
                        ) : (
                            <>
                                <div style={{width: 24, height: 24, position: 'relative', flexShrink: 0}}>
                                    <div style={{width: 20.57, height: 20.57, left: 1.71, top: 1.71, position: 'absolute', background: 'rgba(217, 45, 32, 0.60)', borderRadius: 9999}} />
                                    <div style={{width: 24, height: 24, left: 0, top: 0, position: 'absolute', background: 'rgba(217, 45, 32, 0.60)', borderRadius: 9999}} />
                                    <div style={{width: 17.14, height: 17.14, left: 3.43, top: 3.43, position: 'absolute', background: '#D92D20', overflow: 'hidden', borderRadius: 8.57, outline: '1.07px #D92D20 solid', outlineOffset: '-1.07px'}}>
                                        <div style={{width: 9.33, height: 9.33, left: 3.91, top: 3.91, position: 'absolute'}}>
                                            <svg width="9" height="9" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                <path d="M5.83333 2.5H4.16667V5.83333H5.83333V2.5ZM5.83333 7.5H4.16667V9.16667H5.83333V7.5Z" fill="white"/>
                                            </svg>
                                        </div>
                                    </div>
                                </div>
                                <div style={{
                                    flex: '1 1 0',
                                    color: 'white',
                                    fontSize: 13,
                                    fontFamily: 'Plus Jakarta Sans',
                                    fontWeight: '400',
                                    lineHeight: '18px',
                                    wordWrap: 'break-word'
                                }}>
                                    Upload failed. Please try again.
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* Document Preview Modal */}
            <DocumentPreviewModal
                isOpen={!!previewDocument}
                onClose={() => setPreviewDocument(null)}
                document={previewDocument}
            />
        </div>
    );
};

export default ChatInterface;
