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

function useColumnCount(containerRef: React.RefObject<HTMLDivElement | null>): { columns: number; containerWidth: number } {
  const [columns, setColumns] = useState(4);
  const [containerWidth, setContainerWidth] = useState(0);

  useEffect(() => {
    const container = containerRef.current;
    if (container === null) return;

    const update = () => {
      const width = container.clientWidth;
      setContainerWidth(width);
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

    update();

    const observer = new ResizeObserver(update);
    observer.observe(container);

    return () => {
      observer.disconnect();
    };
  }, [containerRef]);

  return { columns, containerWidth };
}

function VirtualGrid({
  images,
  columns,
  containerWidth,
  onImageClick,
  selectionMode,
  selectedImages,
  onToggleSelect,
  parentRef,
}: {
  images: ImageRow[];
  columns: number;
  containerWidth: number;
  onImageClick: (id: number) => void;
  selectionMode: boolean;
  selectedImages: Set<number>;
  onToggleSelect: (id: number) => void;
  parentRef: React.RefObject<HTMLDivElement | null>;
}) {
  const ROW_GAP = 16;
  const rowCount = Math.ceil(images.length / columns);

  const estimateRowHeight = useCallback(() => {
    if (containerWidth === 0) return 320;
    const totalGaps = (columns - 1) * ROW_GAP;
    const cardWidth = (containerWidth - totalGaps) / columns;
    return cardWidth + 56;
  }, [columns, containerWidth]);

  const rowVirtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => parentRef.current,
    estimateSize: estimateRowHeight,
    gap: ROW_GAP,
    overscan: 3,
  });

  const getImageForCell = useCallback(
    (rowIndex: number, colIndex: number): ImageRow | undefined => {
      const index = rowIndex * columns + colIndex;
      return images[index];
    },
    [images, columns],
  );

  return (
    <div
      className="relative w-full"
      style={{ height: `${String(rowVirtualizer.getTotalSize())}px` }}
    >
      {rowVirtualizer.getVirtualItems().map((virtualRow) => (
        <div
          key={virtualRow.index}
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
  );
}

export function ImageGrid({ images, onImageClick, selectionMode, selectedImages, onToggleSelect }: ImageGridProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const { columns, containerWidth } = useColumnCount(parentRef);

  if (images.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-gray-500">
        No images found
      </div>
    );
  }

  return (
    <div ref={parentRef} className="h-full overflow-auto">
      <VirtualGrid
        key={`${String(columns)}-${String(Math.round(containerWidth / 50))}`}
        images={images}
        columns={columns}
        containerWidth={containerWidth}
        onImageClick={onImageClick}
        selectionMode={selectionMode}
        selectedImages={selectedImages}
        onToggleSelect={onToggleSelect}
        parentRef={parentRef}
      />
    </div>
  );
}
