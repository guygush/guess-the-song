'use client';

interface Props {
  onSelectGame: (game: 'guess-the-song' | 'one-word') => void;
}

export default function GameHubScreen({ onSelectGame }: Props) {
  return (
    <div className="flex flex-col h-dvh bg-[#0C0C0C] text-white overflow-hidden">

      {/* ambient glow */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[300px] rounded-full bg-[#FFDA57]/[0.04] blur-3xl" />
      </div>

      <div className="relative flex-1 flex flex-col items-center justify-center px-6 gap-10">

        {/* Logo */}
        <div className="text-center">
          <div className="text-5xl mb-4">🎮</div>
          <h1 className="text-3xl font-black tracking-tight">משחקי לילה</h1>
          <p className="text-white/35 text-sm mt-2 tracking-wide">בחרו משחק להתחיל</p>
        </div>

        {/* Game cards */}
        <div className="flex flex-col gap-4 w-full max-w-xs">

          <button
            onClick={() => onSelectGame('guess-the-song')}
            className="group w-full bg-[#141414] border border-white/[0.07] rounded-2xl p-5 text-right flex items-center gap-4 active:scale-[0.98] transition-transform"
          >
            <div className="w-12 h-12 rounded-xl bg-[#FFDA57]/10 border border-[#FFDA57]/20 flex items-center justify-center text-2xl flex-shrink-0">
              🎵
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-lg leading-tight">זהה את השיר</p>
              <p className="text-white/35 text-xs mt-0.5">נגן קטע ונחשו</p>
            </div>
            <div className="w-8 h-8 rounded-full bg-[#FFDA57] flex items-center justify-center flex-shrink-0">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="#0C0C0C">
                <path d="M2 2l10 5-10 5z"/>
              </svg>
            </div>
          </button>

          <button
            onClick={() => onSelectGame('one-word')}
            className="group w-full bg-[#141414] border border-white/[0.07] rounded-2xl p-5 text-right flex items-center gap-4 active:scale-[0.98] transition-transform"
          >
            <div className="w-12 h-12 rounded-xl bg-[#FFDA57]/10 border border-[#FFDA57]/20 flex items-center justify-center text-2xl flex-shrink-0">
              💬
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-lg leading-tight">במילה אחת</p>
              <p className="text-white/35 text-xs mt-0.5">תנו רמזים, נחשו מילה</p>
            </div>
            <div className="w-8 h-8 rounded-full bg-[#FFDA57] flex items-center justify-center flex-shrink-0">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="#0C0C0C">
                <path d="M2 2l10 5-10 5z"/>
              </svg>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
