import { useRef, useCallback, useEffect, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { ImageRow } from '@/shared/types';
import { ImageCard } from './ImageCard';

interface ImageGridProps {
  images: ImageRow[];
  onImageClick: (id: number) => void;
  selectionMode: boolean;
  selectedImages: Set<number>;
  onToggleSelect: (id: number) => void;
}

function useColumnCount(containerRef: React.RefObject<HTMLDivElement | null>): number {
  const [columns, setColumns] = useState(4);

  useEffect(() => {
    const container = containerRef.current;
    if (container === null) return;

    const updateColumns = () => {
      const width = container.clientWidth;
      if (width < 640) {
        setColumns(2);
      } else if (width < 1024) {
        setColumns(3);
      } else if (width < 1280) {
        setColumns(4);
      } else {
        setColumns(5);
      }
    };

    updateColumns();

    const observer = new ResizeObserver(updateColumns);
    observer.observe(container);

    return () => {
      observer.disconnect();
    };
  }, [containerRef]);

  return columns;
}

export function ImageGrid({ images, onImageClick, selectionMode, selectedImages, onToggleSelect }: ImageGridProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const columns = useColumnCount(parentRef);
  const rowCount = Math.ceil(images.length / columns);

  const ROW_GAP = 16; // gap-4 = 1rem = 16px

  const estimateRowHeight = useCallback(() => {
    const container = parentRef.current;
    if (container === null) return 320;
    const totalGaps = (columns - 1) * ROW_GAP;
    const cardWidth = (container.clientWidth - totalGaps) / columns;
    // aspect-square image + ~56px for title/size below
    return cardWidth + 56;
  }, [columns]);

  const rowVirtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => parentRef.current,
    estimateSize: estimateRowHeight,
    gap: ROW_GAP,
    overscan: 3,
  });

  // Re-measure when columns change (window resize)
  useEffect(() => {
    rowVirtualizer.measure();
  }, [columns, rowVirtualizer]);

  const getImageForCell = useCallback(
    (rowIndex: number, colIndex: number): ImageRow | undefined => {
      const index = rowIndex * columns + colIndex;
      return images[index];
    },
    [images, columns],
  );

  if (images.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-gray-500">
        No images found
      </div>
    );
  }

  return (
    <div ref={parentRef} className="h-full overflow-auto">
      <div
        className="relative w-full"
        style={{ height: `${String(rowVirtualizer.getTotalSize())}px` }}
      >
        {rowVirtualizer.getVirtualItems().map((virtualRow) => (
          <div
            key={virtualRow.key}
            className="absolute left-0 top-0 grid w-full gap-x-4"
            style={{
              height: `${String(virtualRow.size)}px`,
              transform: `translateY(${String(virtualRow.start)}px)`,
              gridTemplateColumns: `repeat(${String(columns)}, minmax(0, 1fr))`,
            }}
          >
            {Array.from({ length: columns }, (_, colIndex) => {
              const image = getImageForCell(virtualRow.index, colIndex);
              if (image === undefined) {
                return <div key={colIndex} />;
              }
              return (
                <ImageCard
                  key={image.id}
                  image={image}
                  onClick={onImageClick}
                  selectionMode={selectionMode}
                  selected={selectedImages.has(image.id)}
                  onToggleSelect={onToggleSelect}
                />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
