import * as React from "react";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant: "primary" | "secondary" | "danger" | "success";
  /** `icon` is narrower, for buttons labeled with a single symbol. */
  size?: "regular" | "icon";
};

const VARIANT_CLASSES: Record<ButtonProps["variant"], string> = {
  primary: "bg-blue-500 hover:bg-blue-600 text-white",
  secondary:
    "bg-gray-200 hover:bg-gray-300 text-gray-900 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-100",
  success: "bg-green-500 hover:bg-green-600 text-white",
  danger: "bg-red-500 hover:bg-red-600 text-white",
};

const SIZE_CLASSES: Record<NonNullable<ButtonProps["size"]>, string> = {
  regular: "px-4",
  icon: "min-w-10 px-2",
};

export default function Button({
  variant,
  size = "regular",
  className = "",
  ...props
}: ButtonProps) {
  const base =
    "inline-flex items-center justify-center min-h-10 py-2 rounded font-medium transition-colors " +
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 " +
    "disabled:opacity-50 disabled:cursor-not-allowed";
  return (
    <button
      type="button"
      className={`${base} ${SIZE_CLASSES[size]} ${VARIANT_CLASSES[variant]} ${className}`}
      {...props}
    />
  );
}
