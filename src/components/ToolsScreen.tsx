import React, { useState } from 'react';
import {
  RotateCw,
  FileOutput,
  ArrowUpDown,
  Stamp,
  Search,
} from 'lucide-react';
import { ALL_TOOLS, ToolDescriptor } from '../constants/tools';
import { ToolId } from '../types/pdf';
import { getToolIcon } from './HomeScreen';

interface ToolsScreenProps {
  onLaunchTool: (toolId: ToolId) => void;
}

function getExtendedToolIcon(id: ToolId) {
  switch (id) {
    case 'rotate-pdf':
      return RotateCw;
    case 'extract-pages':
      return FileOutput;
    case 'reorder-pages':
      return ArrowUpDown;
    case 'watermark-pdf':
      return Stamp;
    default:
      return getToolIcon(id);
  }
}

const CATEGORY_SECTIONS: { id: ToolDescriptor['category']; title: string; subtitle: string }[] = [
  { id: 'create', title: 'Create & Scan', subtitle: 'Build PDFs from gallery images, camera captures, or documents' },
  { id: 'organize', title: 'Organize & Edit PDF', subtitle: 'Merge, split, rotate, extract, and reorder PDF pages' },
  { id: 'convert', title: 'Convert Formats', subtitle: 'Convert between PDF, Word, Excel, PowerPoint, and images' },
  { id: 'optimize', title: 'Optimize & Watermark', subtitle: 'Compress large files and stamp custom watermarks' },
];

export const ToolsScreen: React.FC<ToolsScreenProps> = ({ onLaunchTool }) => {
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<'all' | ToolDescriptor['category']>('all');

  const filteredTools = ALL_TOOLS.filter((tool) => {
    const matchesCat = activeCategory === 'all' || tool.category === activeCategory;
    const q = query.trim().toLowerCase();
    const matchesQuery =
      !q ||
      tool.title.toLowerCase().includes(q) ||
      tool.description.toLowerCase().includes(q);
    return matchesCat && matchesQuery;
  });

  return (
    <div className="space-y-6 pb-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#202124] dark:text-[#F3F4F6]">
            All PDF Tools
          </h1>
          <p className="text-sm text-[#777777] dark:text-[#9CA3AF] mt-0.5">
            16 offline utilities — every operation runs directly on your device
          </p>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-[#777777] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Find a tool..."
            className="w-full h-11 pl-10 pr-4 rounded-xl bg-white dark:bg-[#1A1C20] border border-[#E6E6E6] dark:border-[#2A2D34] text-sm text-[#202124] dark:text-[#F3F4F6] placeholder:text-[#777777] focus:outline-none focus:border-[#E50920]"
          />
        </div>
      </div>

      {/* Category segmented filter */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        {[
          { id: 'all', label: 'All Tools' },
          { id: 'create', label: 'Create & Scan' },
          { id: 'organize', label: 'Organize' },
          { id: 'convert', label: 'Convert' },
          { id: 'optimize', label: 'Optimize' },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveCategory(tab.id as typeof activeCategory)}
            className={`px-4 py-2 min-h-[40px] rounded-xl text-xs sm:text-sm font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
              activeCategory === tab.id
                ? 'bg-[#E50920] text-white'
                : 'bg-white dark:bg-[#1A1C20] text-[#202124] dark:text-[#F3F4F6] border border-[#E6E6E6] dark:border-[#2A2D34] hover:bg-[#F5F5F7] dark:hover:bg-[#24272E]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Sections */}
      <div className="space-y-8">
        {CATEGORY_SECTIONS.filter(
          (sec) => activeCategory === 'all' || activeCategory === sec.id
        ).map((sec) => {
          const items = filteredTools.filter((t) => t.category === sec.id);
          if (items.length === 0) return null;
          return (
            <section key={sec.id}>
              <div className="mb-3.5">
                <h2 className="text-base font-bold text-[#202124] dark:text-[#F3F4F6]">
                  {sec.title}
                </h2>
                <p className="text-xs text-[#777777] dark:text-[#9CA3AF] mt-0.5">
                  {sec.subtitle}
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                {items.map((tool) => {
                  const Icon = getExtendedToolIcon(tool.id);
                  return (
                    <button
                      key={tool.id}
                      type="button"
                      onClick={() => onLaunchTool(tool.id)}
                      className="group text-left bg-white dark:bg-[#1A1C20] hover:border-[#E50920]/45 rounded-2xl border border-[#E6E6E6] dark:border-[#2A2D34] p-4 transition-all active:scale-[0.98] cursor-pointer flex items-start gap-3.5"
                    >
                      <div
                        className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-105"
                        style={{ backgroundColor: tool.bgTint, color: tool.color }}
                      >
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-sm font-semibold text-[#202124] dark:text-[#F3F4F6] leading-snug">
                          {tool.title}
                        </h3>
                        <p className="text-xs text-[#777777] dark:text-[#9CA3AF] mt-1 leading-relaxed">
                          {tool.description}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
};
