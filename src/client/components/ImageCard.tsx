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
      className="group cursor-pointer overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm transition-shadow hover:shadow-md"
    >
      <div className="relative aspect-square overflow-hidden bg-gray-100">
        <img
          src={`/api/images/${String(image.id)}/thumb`}
          alt={image.title ?? image.file_name}
          loading="lazy"
          className="h-full w-full object-cover transition-transform group-hover:scale-105"
        />
        {image.prompt !== null ? (
          <div className="absolute inset-x-0 bottom-0 translate-y-full bg-black/75 p-2 text-xs text-white transition-transform group-hover:translate-y-0">
            <p className="line-clamp-3">{image.prompt}</p>
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
