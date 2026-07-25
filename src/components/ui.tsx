import { forwardRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type PropsWithChildren, type ReactNode } from "react";
import { CircleAlert, CircleCheck, Info, TriangleAlert } from "lucide-react";

export const Card = ({ children }: PropsWithChildren) => (
  <section className="rounded-3xl border border-stone-200/80 bg-white p-5 shadow-[0_8px_28px_rgba(28,25,23,0.06)] sm:p-6">{children}</section>
);

export const Button = ({
  className = "",
  children,
  ...props
}: PropsWithChildren<ButtonHTMLAttributes<HTMLButtonElement>>) => (
  <button
    className={
      "inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl px-4 py-3 text-base font-bold transition active:scale-[0.98] focus:outline-none focus:ring-4 focus:ring-lime-300 disabled:cursor-not-allowed disabled:opacity-50 sm:px-5 sm:text-lg " +
      className
    }
    {...props}
  >
    {children}
  </button>
);

export const FieldLabel = ({ children }: PropsWithChildren) => (
  <label className="mb-2 block text-sm font-bold uppercase tracking-wide text-stone-600">{children}</label>
);

export const TextInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className = "", ...props }, reference) => (
    <input
      ref={reference}
      className={
        "min-h-12 w-full rounded-2xl border border-stone-300 bg-stone-50 px-4 text-lg text-stone-950 outline-none placeholder:text-stone-400 focus:border-lime-700 focus:bg-white focus:ring-4 focus:ring-lime-100 " +
        className
      }
      {...props}
    />
  )
);

TextInput.displayName = "TextInput";

export interface SegmentedControlOption<T extends string> {
  id: T;
  label: ReactNode;
  ariaLabel?: string;
}

export const SegmentedControl = <T extends string,>({
  ariaLabel,
  value,
  options,
  onChange,
  className = ""
}: {
  ariaLabel: string;
  value: T;
  options: SegmentedControlOption<T>[];
  onChange: (value: T) => void;
  className?: string;
}) => (
  <div
    className={"grid gap-1 rounded-2xl bg-stone-100 p-1.5 " + className}
    role="group"
    aria-label={ariaLabel}
    style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
  >
    {options.map((option) => {
      const active = option.id === value;
      return <button key={option.id} type="button" aria-label={option.ariaLabel} aria-pressed={active} className={`min-h-11 rounded-xl px-3 text-sm font-black transition focus:outline-none focus:ring-4 focus:ring-lime-200 ${active ? "bg-white text-lime-950 shadow-sm" : "text-stone-600"}`} onClick={() => onChange(option.id)}>{option.label}</button>;
    })}
  </div>
);

export const Notice = ({
  children,
  tone = "info"
}: PropsWithChildren<{ tone?: "info" | "warning" | "success" | "error" }>) => {
  const colorByTone = {
    info: "bg-sky-50 text-sky-950 ring-sky-200",
    warning: "bg-amber-50 text-amber-950 ring-amber-200",
    success: "bg-lime-50 text-lime-950 ring-lime-200",
    error: "bg-red-50 text-red-950 ring-red-200"
  };
  const iconByTone = {
    info: Info,
    warning: TriangleAlert,
    success: CircleCheck,
    error: CircleAlert
  };
  const Icon = iconByTone[tone];

  return <div className={"flex gap-2 rounded-2xl p-3 text-base leading-snug ring-1 " + colorByTone[tone]}><Icon className="mt-0.5 shrink-0" size={20} aria-hidden="true" /><div>{children}</div></div>;
};
