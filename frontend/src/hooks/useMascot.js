import { useState, useCallback, useEffect, useRef } from 'react';

/**
 * Hook to manage the mascot's state, including intro sequence and dynamic messages.
 * 
 * @param {Object} scenario The current scenario object containing introMessages and mascotDialogue.
 * @returns {Object} Mascot state and control functions.
 */
export const useMascot = (scenario) => {
  const [introIndex, setIntroIndex] = useState(0);
  const [isIntroActive, setIsIntroActive] = useState(!!(scenario?.introMessages?.length > 0));
  const [currentMessage, setCurrentMessage] = useState(
    scenario?.introMessages?.[0] || ''
  );
  const [showBubble, setShowBubble] = useState(!!(scenario?.introMessages?.[0]));
  
  const timeoutRef = useRef(null);

  /**
   * Clear the current message bubble and any active timeouts.
   */
  const clearBubble = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setCurrentMessage('');
    setShowBubble(false);
  }, []);

  /**
   * Display a specific message for a set duration.
   */
  const say = useCallback((msg, duration = 3000) => {
    clearBubble();

    setCurrentMessage(msg);
    setShowBubble(true);

    if (duration > 0) {
      timeoutRef.current = setTimeout(() => {
        setCurrentMessage('');
        setShowBubble(false);
        timeoutRef.current = null;
      }, duration);
    }
  }, [clearBubble]);

  /**
   * Advance to the next message in the intro sequence.
   */
  const nextIntro = useCallback(() => {
    clearBubble();
    
    const messages = scenario?.introMessages || [];
    const nextIndex = introIndex + 1;
    
    setIntroIndex(nextIndex);
    
    if (nextIndex < messages.length) {
      setCurrentMessage(messages[nextIndex]);
      setShowBubble(true);
    } else {
      setIsIntroActive(false);
    }
  }, [scenario, introIndex, clearBubble]);

  /**
   * Trigger a random message from a specific category in the mascot's dialogue.
   */
  const triggerRandom = useCallback((category) => {
    const dialogue = scenario?.mascotDialogue?.[category];
    if (dialogue && dialogue.length > 0) {
      const randomMsg = dialogue[Math.floor(Math.random() * dialogue.length)];
      say(randomMsg);
    }
  }, [scenario, say]);

  // Clean up timeouts on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return {
    introIndex,
    isIntroActive,
    currentMessage,
    showBubble,
    nextIntro,
    say,
    triggerRandom
  };
};
