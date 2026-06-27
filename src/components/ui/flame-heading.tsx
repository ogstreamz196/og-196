import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * FlameHeading — the project's signature white-on-dark Bungee headline with a
 * red flame aura. All typography, glow, and responsive breakpoint rules live
 * in the `.font-bungee` utility (src/styles.css) so every page renders the
 * same look. Use this component instead of hand-rolling `font-bungee` spans
 * so size tiers and semantics stay consistent across the app.
 */
export type FlameHeadingSize = "sm" | "md" | "lg" | "xl" | "hero";

const SIZE_CLASSES: Record<FlameHeadingSize, string> = {
  // chip / eyebrow
  sm: "text-sm sm:text-base",
  // card title
  md: "text-xl sm:text-2xl",
  // section heading
  lg: "text-2xl sm:text-3xl md:text-4xl",
  // page heading
  xl: "text-3xl sm:text-4xl md:text-5xl",
  // landing hero
  hero: "text-4xl sm:text-6xl md:text-7xl",
};

type AsTag = "h1" | "h2" | "h3" | "h4" | "h5" | "h6" | "span" | "div" | "p";

type FlameHeadingProps<T extends AsTag = "h2"> = {
  as?: T;
  size?: FlameHeadingSize;
  className?: string;
  children: React.ReactNode;
} & Omit<React.HTMLAttributes<HTMLElement>, "children" | "className">;

export function FlameHeading<T extends AsTag = "h2">({
  as,
  size = "lg",
  className,
  children,
  ...rest
}: FlameHeadingProps<T>) {
  const Tag = (as ?? "h2") as React.ElementType;
  return (
    <Tag className={cn("font-bungee", SIZE_CLASSES[size], className)} {...rest}>
      {children}
    </Tag>
  );
}

export default FlameHeading;
