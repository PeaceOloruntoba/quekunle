"use client";
import { useState } from "react";
import { X } from "lucide-react";

export default function ProfilePhoto({
  src,
  name,
  className,
  badge,
  imageClassName,
}: {
  src: string;
  name: string;
  className: string;
  badge?: string;
  imageClassName?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <>
      <button
        type="button"
        className={`profile-photo ${className}`}
        aria-label={`Enlarge ${name}'s profile picture`}
        onClick={() => setExpanded(true)}
      >
        <img src={src} alt={name} className={imageClassName} />
        {badge && <span>{badge}</span>}
      </button>
      {expanded && (
        <div
          className="image-lightbox"
          role="dialog"
          aria-modal="true"
          aria-label={`${name}'s profile picture`}
          onClick={() => setExpanded(false)}
        >
          <button
            type="button"
            className="image-lightbox-close"
            aria-label="Close picture"
            onClick={() => setExpanded(false)}
          >
            <X size={21} />
          </button>
          <img src={src} alt={name} />
          <strong>{name}</strong>
        </div>
      )}
    </>
  );
}
