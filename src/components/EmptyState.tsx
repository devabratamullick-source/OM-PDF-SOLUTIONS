import React from 'react';
import { Plus } from 'lucide-react';

interface EmptyStateProps {
  title?: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title = 'No PDF files yet',
  description = 'Create your first PDF from images, documents, or camera scans.',
  actionLabel = 'Create PDF',
  onAction,
}) => {
  return (
    <div className="flex flex-col items-center justify-center text-center py-14 px-6 bg-white dark:bg-[#1A1C20] rounded-2xl border border-[#E6E6E6] dark:border-[#2A2D34]">
      <div className="w-24 h-24 mb-5 flex items-center justify-center">
        <svg
          viewBox="0 0 96 96"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full"
          aria-hidden="true"
        >
          <rect
            x="16"
            y="14"
            width="52"
            height="68"
            rx="10"
            className="fill-[#F5F5F7] dark:fill-[#24272E] stroke-[#E6E6E6] dark:stroke-[#343842]"
            strokeWidth="2"
          />
          <rect
            x="28"
            y="10"
            width="52"
            height="68"
            rx="10"
            className="fill-white dark:fill-[#1A1C20] stroke-[#E50920]/30"
            strokeWidth="2"
          />
          <path d="M40 30H68" stroke="#E50920" strokeWidth="3.5" strokeLinecap="round" />
          <path
            d="M40 42H68M40 52H60M40 62H54"
            className="stroke-[#D1D5DB] dark:stroke-[#4B5563]"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <circle cx="72" cy="72" r="14" fill="#E50920" />
          <path
            d="M72 66V78M66 72H78"
            stroke="white"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        </svg>
      </div>
      <h3 className="text-lg font-semibold text-[#202124] dark:text-[#F3F4F6] mb-1.5">
        {title}
      </h3>
      <p className="text-sm text-[#777777] dark:text-[#9CA3AF] max-w-sm mb-6 leading-relaxed">
        {description}
      </p>
      {onAction && (
        <button
          type="button"
          onClick={onAction}
          className="inline-flex items-center gap-2 px-5 py-2.5 min-h-[44px] rounded-xl bg-[#E50920] hover:bg-[#B81024] text-white text-sm font-medium transition-colors active:scale-[0.98] whitespace-nowrap cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>{actionLabel}</span>
        </button>
      )}
    </div>
  );
};
