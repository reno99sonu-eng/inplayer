import { Calendar, Eye, Tag } from "lucide-react";
import AnimatedCounter from "@/app/components/AnimatedCounter";
import { formatTimeAgo, formatViews } from "@/app/lib/formatters";

interface WatchMetaProps {
  views: number;
  uploadedAt: string;
  category: string;
  ageRestricted?: boolean;
}

export default function WatchMeta({
  views,
  uploadedAt,
  category,
  ageRestricted,
}: WatchMetaProps) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-slate-300 light:text-slate-700">
      <span className="flex items-center gap-1.5"><Eye size={14} className="text-orange-400" /><AnimatedCounter value={views || 0} format={formatViews} /></span>
      <span className="h-1 w-1 rounded-full bg-slate-600" />
      <span className="flex items-center gap-1.5"><Calendar size={14} className="text-orange-400" />{formatTimeAgo(uploadedAt)}</span>
      <span className="h-1 w-1 rounded-full bg-slate-600" />
      <span className="flex items-center gap-1.5"><Tag size={14} className="text-orange-400" />{category}</span>
      {ageRestricted && <span className="rounded-md border border-red-500/30 bg-red-500/10 px-1.5 py-0.5 text-[11px] font-bold text-red-300 light:text-red-700">18+</span>}
    </div>
  );
}
