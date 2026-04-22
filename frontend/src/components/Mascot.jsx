import React from 'react';
import './Mascot.css';

const Mascot = ({ mascotHook, introTotal }) => {
  const { isIntroActive, isFadingOut, currentMessage, showBubble, nextIntro, introIndex } = mascotHook;

  const showOverlay = isIntroActive || isFadingOut;
  const showIntroElements = isIntroActive && !isFadingOut;

  return (
    <>
      {showOverlay && (
        <button
          className={`fixed inset-0 z-[2000] cursor-pointer border-none w-full h-full p-0 mascot-intro-overlay${isFadingOut ? ' mascot-intro-overlay-fading' : ''}`}
          onClick={!isFadingOut ? nextIntro : undefined}
          aria-label="Next intro message"
        />
      )}

      {showIntroElements && (
        <div className="mascot-tap-hint" data-testid="mascot-tap-hint">
          <div className="mascot-tap-hint-arrow">👈</div>
          <div className="mascot-tap-hint-text">TAP ANYWHERE</div>
        </div>
      )}

      <div className="fixed bottom-4 left-4 flex flex-col items-start z-[2001] pointer-events-none">
        {showIntroElements && introTotal > 0 && (
          <div className="mascot-progress-dots" data-testid="mascot-progress-dots">
            {Array.from({ length: introTotal }).map((_, i) => (
              <div
                key={i}
                className={`mascot-dot${i === introIndex ? ' mascot-dot-active' : ''}`}
                aria-current={i === introIndex ? 'step' : undefined}
              />
            ))}
          </div>
        )}

        {showBubble && currentMessage && (
          <div
            className={`relative mb-2 max-w-[280px] md:max-w-xs pointer-events-auto mascot-bubble-animate flex flex-col items-start${isIntroActive ? ' cursor-pointer' : ''}`}
            onClick={isIntroActive ? nextIntro : undefined}
          >
            <div className={`bg-gray-950/85 border border-gray-700/50 backdrop-blur-md text-white p-4 shadow-2xl${currentMessage.length > 40 ? ' rounded-2xl' : ' rounded-full px-6'}`}>
              <p className="text-sm md:text-base leading-relaxed font-medium">
                {currentMessage}
              </p>
            </div>
            <div className="mascot-bubble-tail left-12 md:left-16" />
          </div>
        )}

        <div
          className={`w-24 h-24 md:w-32 md:h-32 pointer-events-auto ${showIntroElements ? 'mascot-pulse cursor-pointer' : 'mascot-float'}`}
          onClick={showIntroElements ? nextIntro : undefined}
        >
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
