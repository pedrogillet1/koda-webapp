import React, { useState, useEffect, useRef, useMemo } from 'react';

/**
 * StreamingWelcomeMessage - ChatGPT-style smooth character streaming
 *
 * Features:
 * - Character-by-character streaming like ChatGPT
 * - Uses requestAnimationFrame for 60fps smooth rendering
 * - Randomly selects from 50 message variants
 * - Some messages are personalized with userName
 */
const StreamingWelcomeMessage = ({ userName, isFirstChat = false }) => {
  const [displayedText, setDisplayedText] = useState('');
  const [isComplete, setIsComplete] = useState(false);
  const animationRef = useRef(null);
  const startTimeRef = useRef(null);

  // 50 message variants - {name} will be replaced with userName
  const messageVariants = [
    "Hey {name}, what do you need?",
    "What are you looking for today?",
    "What do you want to find?",
    "What do you need from Koda?",
    "Tell me what you need now.",
    "What should I pull up?",
    "What do you want to open?",
    "Type what you're looking for.",
    "What can I find for you?",
    "What do you need to see?",
    "What's the first thing you need?",
    "What can I search for?",
    "What's on your mind, {name}?",
    "What do you want to check?",
    "What do you want to review?",
    "What answer do you need now?",
    "What should we work on first?",
    "Which document do you need now?",
    "Which client are you working on?",
    "Which project do you need today?",
    "What do you need clarity on?",
    "What do you want to confirm?",
    "Search your docs. What's the query?",
    "Ask Koda anything in your files.",
    "What detail are you chasing now?",
    "What do you need before your meeting?",
    "What can I surface for you?",
    "What should I look up first?",
    "What's blocking you right now?",
    "What do you need to decide?",
    "What number do you need to check?",
    "What clause should I find?",
    "What do you want proof for?",
    "What's the next question, {name}?",
    "What do you need in seconds?",
    "Which case are you on now?",
    "Which deal are you reviewing today?",
    "Tell me the topic. I'll search.",
    "Tell me what you're working on.",
    "Drop your question. I'll handle it.",
    "What do you want Koda to find?",
    "What do you want to understand?",
    "What do you need from your docs?",
    "What's the key fact you need?",
    "What can I verify for you?",
    "What should I double-check for you?",
    "What do you need to be sure of?",
    "What's urgent for you right now?",
    "What should Koda help with first?",
    "Okay {name}, what do you need next?"
  ];

  // Select a random message on component mount and replace {name} with userName
  const selectedMessage = useMemo(() => {
    const randomIndex = Math.floor(Math.random() * messageVariants.length);
    const message = messageVariants[randomIndex];
    return message.replace(/{name}/g, userName || 'there');
  }, [userName]);

  const fullMessage = selectedMessage;

  useEffect(() => {
    setDisplayedText('');
    setIsComplete(false);
    startTimeRef.current = null;

    // Characters per second - ChatGPT-like speed
    const charsPerSecond = 40;
    const msPerChar = 1000 / charsPerSecond;

    const animate = (timestamp) => {
      if (!startTimeRef.current) {
        startTimeRef.current = timestamp;
      }

      const elapsed = timestamp - startTimeRef.current;
      const targetChars = Math.floor(elapsed / msPerChar);
      const charsToShow = Math.min(targetChars, fullMessage.length);

      if (charsToShow <= fullMessage.length) {
        setDisplayedText(fullMessage.slice(0, charsToShow));
      }

      if (charsToShow < fullMessage.length) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        setIsComplete(true);
      }
    };

    // Small delay before starting
    const timeout = setTimeout(() => {
      animationRef.current = requestAnimationFrame(animate);
    }, 150);

    return () => {
      clearTimeout(timeout);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [fullMessage]);

  return (
    <div
      style={{
        fontSize: 30,
        fontWeight: '600',
        color: '#32302C',
        fontFamily: 'Plus Jakarta Sans, sans-serif',
        lineHeight: '1.4',
        minHeight: '42px'
      }}
    >
      {displayedText}
      <span
        style={{
          display: 'inline-block',
          width: '2px',
          height: '28px',
          backgroundColor: '#32302C',
          marginLeft: '1px',
          verticalAlign: 'text-bottom',
          opacity: isComplete ? 0 : 1,
          transition: 'opacity 0.3s ease-out'
        }}
      />
    </div>
  );
};

export default StreamingWelcomeMessage;
