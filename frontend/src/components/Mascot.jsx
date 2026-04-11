import React from 'react';
import './Mascot.css';

/**
 * Mascot component that displays an interactive character with speech bubbles.
 * 
 * @param {Object} mascotHook The mascot state and control object from useMascot.
 */
const Mascot = ({ mascotHook }) => {
  const { isIntroActive, currentMessage, showBubble, nextIntro } = mascotHook;

  return (
    <>
      {/* Click-anywhere overlay during intro sequence */}
      {isIntroActive && (
        <div 
          className="fixed inset-0 z-[2000] cursor-pointer"
          onClick={nextIntro}
          aria-hidden="true"
        />
      )}

      {/* Mascot and Bubble Container */}
      <div className="fixed bottom-4 left-4 flex flex-col items-center z-[2001] pointer-events-none">
        
        {/* Speech Bubble */}
        {showBubble && currentMessage && (
          <div className="relative mb-4 max-w-[280px] md:max-w-xs pointer-events-auto animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className={`
              bg-gray-950/85 border border-gray-700/50 backdrop-blur-md 
              text-white p-4 shadow-2xl
              ${currentMessage.length > 40 ? 'rounded-2xl' : 'rounded-full px-6'}
            `}>
              <p className="text-sm md:text-base leading-relaxed font-medium">
                {currentMessage}
              </p>
            </div>
            {/* Pointer triangle */}
            <div className="mascot-bubble-tail" />
          </div>
        )}

        {/* Mascot Image */}
        <div className="w-24 h-24 md:w-32 md:h-32 pointer-events-auto mascot-float">
          <img 
            src="/mascot-ingame.png" 
            alt="Mascot" 
            className="w-full h-full object-contain drop-shadow-2xl"
          />
        </div>
      </div>
    </>
  );
};

export default Mascot;
