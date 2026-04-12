export default function MascotBubble({ text, isVisible = true }) {
  if (!isVisible) return null;
  
  return (
    <div className="flex flex-col items-center gap-2 max-w-md mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="relative bg-white text-gray-900 p-4 md:p-6 rounded-3xl shadow-xl border-2 border-orange-100">
        <p className="text-base md:text-lg font-medium leading-relaxed">{text}</p>
        {/* Bubble Tail */}
        <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-6 h-6 bg-white border-r-2 border-b-2 border-orange-100 rotate-45" />
      </div>
      <img src="/mascot-ingame.png" alt="Mascot" className="w-32 h-32 md:w-40 md:h-40 object-contain drop-shadow-2xl" />
    </div>
  );
}
