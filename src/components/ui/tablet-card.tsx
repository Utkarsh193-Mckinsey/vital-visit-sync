import * as React from "react";
import { cn } from "@/lib/utils";

const TabletCard = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "rounded-xl border bg-card text-card-foreground shadow-md transition-shadow hover:shadow-lg",
        className
      )}
      {...props}
    />
  )
);
TabletCard.displayName = "TabletCard";

const TabletCardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("flex flex-col space-y-1.5 p-5", className)}
      {...props}
    />
  )
);
TabletCardHeader.displayName = "TabletCardHeader";

const TabletCardTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3
      ref={ref}
      className={cn("text-xl font-semibold leading-none tracking-tight", className)}
      {...props}
    />
  )
);
TabletCardTitle.displayName = "TabletCardTitle";

const TabletCardDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p
      ref={ref}
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  )
);
TabletCardDescription.displayName = "TabletCardDescription";

const TabletCardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("p-5 pt-0", className)} {...props} />
  )
);
TabletCardContent.displayName = "TabletCardContent";

const TabletCardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("flex items-center p-5 pt-0", className)}
      {...props}
    />
  )
);
TabletCardFooter.displayName = "TabletCardFooter";

export {
  TabletCard,
  TabletCardHeader,
  TabletCardFooter,
  TabletCardTitle,
  TabletCardDescription,
  TabletCardContent,
};
