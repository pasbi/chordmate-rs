import * as React from "react";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger" | "success" | "warning";
};

export default function Button({ variant = "primary", className = "", ...props }: ButtonProps) {
  const base = "px-4 py-2 rounded text-white font-medium transition-colors";

  let colorClasses = "";
  switch (variant) {
    case "primary":
      colorClasses = "bg-blue-500 hover:bg-blue-600";
      break;
    case "secondary":
      colorClasses = "bg-gray-500 hover:bg-gray-600";
      break;
    case "success":
      colorClasses = "bg-green-500 hover:bg-green-600";
      break;
    case "warning":
      colorClasses = "bg-yellow-500 hover:bg-yellow-600 text-black";
      break;
    case "danger":
      colorClasses = "bg-red-500 hover:bg-red-600";
      break;
  }

  return <button className={`${base} ${colorClasses} ${className}`} {...props} />;
}
