import Image from "next/image";
import { POSTER_PREFIX, categoryImage } from "@/lib/constants";

interface Props {
  src: string;
  alt: string;
  className?: string;
  priority?: boolean;
  sizes?: string;
}

/** Bundled photos go through the optimiser; arbitrary https URLs are served as-is. */
export default function EventImage({ src, alt, className, priority, sizes }: Props) {
  // Events saved with the old `poster:<Category>` value now show that category's photo.
  const resolved = src.startsWith(POSTER_PREFIX) ? categoryImage(src.slice(POSTER_PREFIX.length)) : src;
  const remote = /^https?:\/\//i.test(resolved);
  return (
    <Image
      src={resolved}
      alt={alt}
      fill
      unoptimized={remote}
      priority={priority}
      sizes={sizes ?? "(min-width: 1024px) 380px, (min-width: 640px) 50vw, 100vw"}
      className={className ?? "object-cover"}
    />
  );
}
