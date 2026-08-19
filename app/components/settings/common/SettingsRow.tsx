"use client";

import { ChevronRight } from "lucide-react";
import { ReactNode } from "react";

interface SettingsRowProps {
  icon: ReactNode;
  title: string;
  description?: string;
  value?: string;
  active?: boolean;
  children?: ReactNode;
  onClick?: () => void;
}

export default function SettingsRow({
  icon,
  title,
  description,
  value,
  active = false,
  children,
  onClick,
}: SettingsRowProps) {
  // The row used to ALWAYS be a <button>, while `children` is typically a
  // SettingsToggle — which is itself a <button>. Nested interactive buttons
  // are invalid HTML: parsing the server-rendered markup implicitly closes
  // the outer button at the inner start tag, producing a DOM that doesn't
  // match React's tree (a hydration mismatch) with the toggle and the
  // trailing value/chevron falling outside the row until React repairs it.
  //
  // So: only render a real <button> when the row itself is clickable. When
  // it just hosts a control, it's a plain <div> — which also fixes the
  // second half of the problem, that non-clickable rows were styled as
  // pressable (hover-lift, border highlight) and so felt broken when
  // clicking the row did nothing.
  const interactive = typeof onClick === "function";
  const Wrapper = interactive ? "button" : "div";

  return (
    <Wrapper
      {...(interactive ? { type: "button" as const, onClick } : {})}
      className={`
        group
        flex
        w-full
        items-center
        justify-between
        rounded-2xl
        border
        border-transparent
        px-5
        py-4
        text-left
        transition-all
        duration-300
        ${
          interactive
            ? "hover:border-orange-400/20 hover:bg-white/[0.04] light:hover:bg-black/[0.04] hover:-translate-y-0.5"
            : ""
        }
      `}
    >
      <div className="flex items-center gap-4">

        <div
          className={`
            flex
            h-11
            w-11
            items-center
            justify-center
            rounded-xl
            transition-all
            duration-300
            ${
              active
                ? "bg-orange-500/20 text-orange-300"
                : "bg-white/5 light:bg-black/5 text-slate-300 light:text-slate-700 group-hover:bg-orange-500/10 group-hover:text-orange-300"
            }
          `}
        >
          {icon}
        </div>

        <div>

          <h3 className="text-[16px] font-bold text-white light:text-slate-900">
            {title}
          </h3>

          {description && (
            <p className="mt-1 text-sm text-slate-400 light:text-slate-600">
              {description}
            </p>
          )}

        </div>

      </div>

      <div className="flex items-center gap-3">

        {children}

        {value && (
          <span className="text-sm font-medium text-orange-300">
            {value}
          </span>
        )}

        {/* The chevron means "this row goes somewhere" — only true when the
            row is actually clickable. It was previously shown on every row
            without children, including inert ones. */}
        {!children && interactive && (
          <ChevronRight
            size={18}
            className="
              text-slate-500 light:text-slate-600
              transition-transform
              duration-300
              group-hover:translate-x-1
            "
          />
        )}

      </div>

    </Wrapper>
  );
}