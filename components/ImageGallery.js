'use client';

import { useEffect, useState } from 'react';

export default function ImageGallery({ images }) {
  const [openIndex, setOpenIndex] = useState(null);
  const multi = (images?.length || 0) > 1;

  useEffect(() => {
    if (openIndex === null) return;
    function onKey(e) {
      if (e.key === 'Escape') setOpenIndex(null);
      if (multi && e.key === 'ArrowRight') setOpenIndex((i) => (i + 1) % images.length);
      if (multi && e.key === 'ArrowLeft') setOpenIndex((i) => (i - 1 + images.length) % images.length);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openIndex, multi]);

  if (!images || images.length === 0) return null;

  return (
    <>
      <div className={multi ? 'gallery' : undefined}>
        {images.map((img, i) => (
          <img
            key={img.id}
            src={img.url}
            alt=""
            className={multi ? 'gallery-img' : 'card-image'}
            onClick={() => setOpenIndex(i)}
          />
        ))}
      </div>
      {openIndex !== null && (
        <div className="lightbox" onClick={() => setOpenIndex(null)}>
          <button className="lightbox-close" onClick={() => setOpenIndex(null)} aria-label="Close">×</button>
          {multi && (
            <button
              className="lightbox-nav prev"
              onClick={(e) => { e.stopPropagation(); setOpenIndex((openIndex - 1 + images.length) % images.length); }}
              aria-label="Previous image"
            >
              ‹
            </button>
          )}
          <img src={images[openIndex].url} alt="" onClick={(e) => e.stopPropagation()} />
          {multi && (
            <button
              className="lightbox-nav next"
              onClick={(e) => { e.stopPropagation(); setOpenIndex((openIndex + 1) % images.length); }}
              aria-label="Next image"
            >
              ›
            </button>
          )}
        </div>
      )}
    </>
  );
}
