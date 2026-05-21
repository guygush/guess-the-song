'use client';

import Header from '@/components/Header';

interface Props {
  onBackToHub: () => void;
}

export default function OneWordScreen({ onBackToHub }: Props) {
  return (
    <div className="flex flex-col h-dvh bg-gray-950 text-white">
      <Header title="במילה אחת" onBack={onBackToHub} />

      <div className="flex-1 flex items-center justify-center">
        <p className="text-gray-400 text-center">בקרוב...</p>
      </div>
    </div>
  );
}
