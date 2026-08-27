'use client';

/* Accommodation room gallery — the shared ImageCarousel in card form. */
import { ImageCarousel } from './ImageCarousel';

export function RoomGallery({ images, name }: { images: string[]; name: string }) {
  return <ImageCarousel images={images} alt={name} variant="card" />;
}
