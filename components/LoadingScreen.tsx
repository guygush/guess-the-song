'use client';

interface Props {
  songName: string;
  artist: string;
  hideMetadata?: boolean;
}

export default function LoadingScreen({ songName, artist, hideMetadata }: Props) {
  return (
    <div className="flex flex-col h-dvh bg-[#0C0C0C] text-white items-center justify-center gap-6 px-8">
      <div className="w-11 h-11 border-[3px] border-[#FFDA57]/20 border-t-[#FFDA57] rounded-full animate-spin" />
      <div className="text-center">
        {hideMetadata ? (
          <p className="text-base font-semibold text-white/60">מוצא שיר...</p>
        ) : (
          <>
            <p className="text-lg font-bold">{songName}</p>
            <p className="text-white/50 text-sm mt-1">{artist}</p>
          </>
        )}
      </div>
      <p className="text-white/30 text-xs tracking-wide">מנתח שמע...</p>
    </div>
  );
}
