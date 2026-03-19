import type { ImageRow } from '@/shared/types';

interface ImageCardProps {
  image: ImageRow;
  onClick: (id: number) => void;
}

export function ImageCard({ image, onClick }: ImageCardProps) {
  const handleClick = () => {
    onClick(image.id);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick(image.id);
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className="group cursor-pointer rounded-lg border border-gray-200 bg-white shadow-sm transition-shadow hover:shadow-md"
    >
      <div className="relative aspect-square overflow-hidden rounded-t-lg bg-gray-100">
        <img
          src={`/api/images/${String(image.id)}/thumb`}
          alt={image.title ?? image.file_name}
          loading="lazy"
          className="h-full w-full object-cover transition-transform group-hover:scale-105"
        />
        {image.prompt !== null ? (
          <div className="absolute inset-0 flex items-end bg-gradient-to-t from-black/80 via-black/30 to-transparent opacity-0 transition-opacity group-hover:opacity-100">
            <p className="line-clamp-5 p-3 text-xs leading-relaxed text-white">{image.prompt}</p>
          </div>
        ) : null}
      </div>
      <div className="p-2">
        <p className="truncate text-sm font-medium text-gray-900">
          {image.title ?? image.file_name}
        </p>
        {image.width !== null && image.height !== null ? (
          <p className="text-xs text-gray-500">
            {String(image.width)} x {String(image.height)}
          </p>
        ) : null}
      </div>
    </div>
  );
}
