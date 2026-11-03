import * as React from "react"
import * as SliderPrimitive from "@radix-ui/react-slider"

import { cn } from "@/lib/utils"

const Slider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root> & {
    size?: "default" | "lg";
    tone?: "default" | "light";
  }
>(({ className, size = "default", tone = "default", value, defaultValue, ...props }, ref) => {
  const current = value ?? defaultValue;
  const thumbCount = Array.isArray(current) ? Math.max(current.length, 1) : 1;
  return (
    <SliderPrimitive.Root
      ref={ref}
      value={value}
      defaultValue={defaultValue}
      className={cn(
        "relative flex w-full touch-none select-none items-center",
        className
      )}
      {...props}
    >
      <SliderPrimitive.Track
        className={cn(
          "relative w-full grow overflow-hidden rounded-full",
          size === "lg" ? "h-3" : "h-2",
          tone === "light" ? "bg-white/25" : "bg-secondary",
        )}
      >
        <SliderPrimitive.Range className={cn("absolute h-full", tone === "light" ? "bg-[#8ec8ff]" : "bg-primary")} />
      </SliderPrimitive.Track>
      {Array.from({ length: thumbCount }, (_, index) => (
        <SliderPrimitive.Thumb
          key={index}
          className={cn(
            "block rounded-full border-2 ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
            size === "lg" ? "h-6 w-6" : "h-5 w-5",
            tone === "light" ? "border-white bg-[#1ea7ff]" : "border-primary bg-background",
          )}
        />
      ))}
    </SliderPrimitive.Root>
  );
})
Slider.displayName = SliderPrimitive.Root.displayName

export { Slider }
