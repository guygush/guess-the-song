'use client';

interface Props {
  onBackToHub: () => void;
}

export default function OneWordScreen({ onBackToHub }: Props) {
  return (
    <div className="flex flex-col items-center justify-center h-dvh bg-gray-950 text-white px-6">
      <h1 className="text-3xl font-bold mb-4">במילה אחת</h1>
      <p className="text-gray-400 mb-12 text-center">בקרוב...</p>

      <button onClick={onBackToHub} className="text-indigo-400 hover:text-indigo-300 text-base transition-colors">
        בחר משחק אחר
      </button>
    </div>
  );
}
