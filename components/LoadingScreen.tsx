'use client';

interface Props {
  songName: string;
  artist: string;
  hideMetadata?: boolean;
}

export default function LoadingScreen({ songName, artist, hideMetadata }: Props) {
  return (
    <div className="flex flex-col h-dvh play-page items-center justify-center gap-6 px-8">
      <div className="w-14 h-14 candy-spinner-yellow" style={{ width: 56, height: 56 }} />
      <div className="text-center">
        {hideMetadata ? (
          <p className="text-base font-bold text-brown">מוצא שיר...</p>
        ) : (
          <>
            <p className="text-lg font-bold text-brown">{songName}</p>
            <p className="text-brown-light text-sm mt-1">{artist}</p>
          </>
        )}
      </div>
      <p className="text-brown-light text-xs tracking-wide">מנתח שמע...</p>
    </div>
  );
}
