import { forwardRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type PropsWithChildren } from "react";

export const Card = ({ children }: PropsWithChildren) => (
  <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-stone-200">{children}</section>
);

export const Button = ({
  className = "",
  children,
  ...props
}: PropsWithChildren<ButtonHTMLAttributes<HTMLButtonElement>>) => (
  <button
    className={
      "min-h-12 rounded-xl px-5 py-3 text-lg font-bold transition focus:outline-none focus:ring-4 focus:ring-lime-300 disabled:cursor-not-allowed disabled:opacity-50 " +
      className
    }
    {...props}
  >
    {children}
  </button>
);

export const FieldLabel = ({ children }: PropsWithChildren) => (
  <label className="mb-2 block text-lg font-semibold text-stone-800">{children}</label>
);

export const TextInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className = "", ...props }, reference) => (
    <input
      ref={reference}
      className={
        "min-h-12 w-full rounded-xl border-2 border-stone-300 bg-white px-4 text-lg text-stone-950 outline-none placeholder:text-stone-400 focus:border-lime-700 " +
        className
      }
      {...props}
    />
  )
);

TextInput.displayName = "TextInput";

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

  return <div className={"rounded-xl p-4 text-lg ring-1 " + colorByTone[tone]}>{children}</div>;
};
