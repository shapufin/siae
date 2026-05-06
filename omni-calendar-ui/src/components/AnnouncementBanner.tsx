import React from "react";
import { cn } from "../lib/utils";

interface AnnouncementBannerProps {
  text: string;
  color?: "red" | "yellow" | "blue" | "green";
}

export const AnnouncementBanner: React.FC<AnnouncementBannerProps> = ({
  text,
  color = "red",
}) => {
  if (!text) return null;

  const colorClasses = {
    red: "bg-red-600 text-white",
    yellow: "bg-yellow-400 text-black",
    blue: "bg-blue-600 text-white",
    green: "bg-green-600 text-white",
  };

  return (
    <div
      className={cn(
        "relative w-full py-2.5 px-4 text-center text-sm font-semibold shadow-sm",
        colorClasses[color] || colorClasses.red
      )}
      role="alert"
    >
      <div
        className="mx-auto max-w-7xl [&_strong]:font-bold [&_a]:underline [&_a]:underline-offset-2 [&_a:hover]:opacity-80"
        dangerouslySetInnerHTML={{ __html: text }}
      />
    </div>
  );
};
