'use client';

import Header from '@/components/Header';

interface Props {
  onSelectGame: (game: 'guess-the-song' | 'one-word') => void;
}

export default function GameHubScreen({ onSelectGame }: Props) {
  return (
    <div className="flex flex-col h-dvh bg-gray-950 text-white">
      <Header title="משחקי משפחה" />

      <div className="flex-1 flex flex-col items-center justify-center px-6">
        <p className="text-gray-300 mb-12 text-center">בחרו משחק להתחיל</p>

        <div className="flex flex-col gap-4 w-full max-w-xs">
          <button
            onClick={() => onSelectGame('guess-the-song')}
            className="w-full py-5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 font-bold text-xl transition-colors"
          >
            זהה את השיר
          </button>
          <button
            onClick={() => onSelectGame('one-word')}
            className="w-full py-5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 font-bold text-xl transition-colors"
          >
            במילה אחת
          </button>
        </div>
      </div>
    </div>
  );
}
