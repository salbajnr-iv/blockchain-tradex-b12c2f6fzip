"use client";
import { useTheme } from "next-themes"
import { Toaster as Sonner } from "sonner"

const Toaster = ({
  ...props
}) => {
  const { theme = "system" } = useTheme()

  return (
    (<Sonner
      theme={theme}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:!bg-card group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-2xl group-[.toaster]:backdrop-blur-none",
          title:
            "group-[.toast]:font-bold group-[.toast]:text-foreground",
          description: "group-[.toast]:text-muted-foreground group-[.toast]:font-medium",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground group-[.toast]:font-semibold",
          cancelButton:
            "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground group-[.toast]:font-medium",
          error:
            "group-[.toaster]:!bg-card group-[.toaster]:border-destructive/40",
          success:
            "group-[.toaster]:!bg-card group-[.toaster]:border-primary/40",
          warning:
            "group-[.toaster]:!bg-card group-[.toaster]:border-yellow-500/40",
          info:
            "group-[.toaster]:!bg-card group-[.toaster]:border-blue-500/40",
        },
      }}
      {...props} />)
  );
}

export { Toaster }
