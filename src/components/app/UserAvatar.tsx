"use client";

import { useState } from "react";

interface UserAvatarProps {
  name?: string | null;
  image?: string | null;
  size?: "sm" | "md" | "lg";
}

const SIZE_CLASSES = {
  sm: { container: "w-7 h-7", text: "text-xs" },
  md: { container: "w-10 h-10", text: "text-sm" },
  lg: { container: "w-12 h-12", text: "text-lg" },
};

export function UserAvatar({ name, image, size = "sm" }: UserAvatarProps) {
  const [imgFailed, setImgFailed] = useState(false);
  const sizeConf = SIZE_CLASSES[size];

  const initial = (name?.[0] ?? "U").toUpperCase();
  const showImage = image && !imgFailed;

  if (showImage) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={image}
        alt=""
        referrerPolicy="no-referrer"
        onError={() => setImgFailed(true)}
        className={`${sizeConf.container} rounded-full border border-workspace-border object-cover`}
      />
    );
  }

  return (
    <div
      className={`${sizeConf.container} rounded-full bg-accent-primary/20 flex items-center justify-center flex-shrink-0`}
    >
      <span className={`${sizeConf.text} font-bold text-accent-primary`}>
        {initial}
      </span>
    </div>
  );
}
