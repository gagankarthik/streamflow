
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
}

export function PageHeader({ title, description, actions, className }: PageHeaderProps) {
  return (
    <div className={cn("py-6 mb-8", className)}> {/* Adjusted py according to guide (40-80px for section padding, this is smaller but consistent) */}
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl"> {/* H1: 32-40px Bold */}
            {title}
          </h1>
          {description && (
            <p className="mt-2 text-base text-muted-foreground leading-relaxed sm:text-lg"> {/* Body Text: 16px Regular, increased line height */}
              {description}
            </p>
          )}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-3">{/* Element Spacing: 8-24px, gap-3 is 12px */}{actions}</div>}
      </div>
    </div>
  );
}
