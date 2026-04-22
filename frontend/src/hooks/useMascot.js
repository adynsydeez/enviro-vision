import { useState, useCallback, useEffect, useRef, useMemo } from 'react';

export const useMascot = (scenario) => {
  const [introIndex, setIntroIndex] = useState(0);
  const [isIntroActive, setIsIntroActive] = useState(!!(scenario?.introMessages?.length > 0));
  const [isFadingOut, setIsFadingOut] = useState(false);
  const [currentMessage, setCurrentMessage] = useState(
    scenario?.introMessages?.[0] || ''
  );
  const [showBubble, setShowBubble] = useState(!!(scenario?.introMessages?.[0]));

  const timeoutRef = useRef(null);

  const clearBubble = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setCurrentMessage('');
    setShowBubble(false);
  }, []);

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

  const nextIntro = useCallback(() => {
    clearBubble();

    const messages = scenario?.introMessages || [];
    const nextIndex = introIndex + 1;

    setIntroIndex(nextIndex);

    if (nextIndex < messages.length) {
      setCurrentMessage(messages[nextIndex]);
      setShowBubble(true);
    } else {
      setIsFadingOut(true);
      timeoutRef.current = setTimeout(() => {
        setIsIntroActive(false);
        setIsFadingOut(false);
        timeoutRef.current = null;
      }, 400);
    }
  }, [scenario, introIndex, clearBubble]);

  const triggerRandom = useCallback((category) => {
    const dialogue = scenario?.mascotDialogue?.[category];
    if (dialogue && dialogue.length > 0) {
      const randomMsg = dialogue[Math.floor(Math.random() * dialogue.length)];
      say(randomMsg);
    }
  }, [scenario, say]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  return useMemo(() => ({
    introIndex,
    isIntroActive,
    isFadingOut,
    currentMessage,
    showBubble,
    nextIntro,
    say,
    triggerRandom
  }), [introIndex, isIntroActive, isFadingOut, currentMessage, showBubble, nextIntro, say, triggerRandom]);
};
