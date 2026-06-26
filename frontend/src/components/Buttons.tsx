import React from "react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary";
    isLoading?: boolean;
    }

    export default function Button({
      variant = "primary",
        isLoading = false,
          children,
            disabled,
              className = "",
                ...props
                }: ButtonProps) {
                  const base =
                      "px-4 py-2 rounded-lg font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2";

                        const variants = {
                            primary: "bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500",
                                secondary:
                                      "bg-gray-200 text-gray-800 hover:bg-gray-300 focus:ring-gray-400",
                                        };

                                          return (
                                              <button
                                                    className={`${base} ${variants[variant ?? "primary"]} ${
                                                            isLoading || disabled ? "opacity-50 cursor-not-allowed" : ""
                                                                  } ${className}`}
                                                                        disabled={isLoading || disabled}
                                                                              {...props}
                                                                                  >
                                                                                        {isLoading ? (
                                                                                                <span className="flex items-center gap-2">
                                                                                                          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                                                                                                                      <circle
                                                                                                                                    className="opacity-25"
                                                                                                                                                  cx="12" cy="12" r="10"
                                                                                                                                                                stroke="currentColor" strokeWidth="4"
                                                                                                                                                                            />
                                                                                                                                                                                        <path
                                                                                                                                                                                                      className="opacity-75"
                                                                                                                                                                                                                    fill="currentColor"
                                                                                                                                                                                                                                  d="M4 12a8 8 0 018-8v8z"
                                                                                                                                                                                                                                              />
                                                                                                                                                                                                                                                        </svg>
                                                                                                                                                                                                                                                                  Loading...
                                                                                                                                                                                                                                                                          </span>
                                                                                                                                                                                                                                                                                ) : (
                                                                                                                                                                                                                                                                                        children
                                                                                                                                                                                                                                                                                              )}
                                                                                                                                                                                                                                                                                                  </button>
                                                                                                                                                                                                                                                                                                    );
                                                                                                                                                                                                                                                                                                    }