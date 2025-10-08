import React from "react";

type FeedbackBannerProps = {
  message: React.ReactNode;
  type?: "success" | "error" | "info";
  onClose?: () => void;
};

export default function FeedbackBanner({
  message,
  type = "info",
  onClose,
}: FeedbackBannerProps) {
  const color =
    type === "success"
      ? "bg-green-100 text-green-800 border-green-300"
      : type === "error"
        ? "bg-red-100 text-red-800 border-red-300"
        : "bg-blue-100 text-blue-800 border-blue-300";

  return (
    <div
      className={`w-full border ${color} px-4 py-2 flex items-center justify-between gap-2 rounded mb-4`}
    >
      <span>{message}</span>
      {onClose && (
        <button
          onClick={onClose}
          className="ml-2 text-sm font-semibold hover:underline focus:outline-none"
        >
          Close
        </button>
      )}
    </div>
  );
}
