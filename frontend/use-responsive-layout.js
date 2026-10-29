import { useLayoutEffect, useState } from "react";

// CSS container queries own the breakpoints; interaction follows the rendered layout.
export function useResponsiveLayout(ref) {
  const [layout, setLayout] = useState({ compact: false, mobile: false });
  useLayoutEffect(() => {
    const update = () => {
      const style = getComputedStyle(ref.current);
      const compact =
        style.getPropertyValue("--detail-layout").trim() === "compact";
      const mobile =
        style.getPropertyValue("--calendar-layout").trim() === "list";
      setLayout((previous) =>
        previous.compact === compact && previous.mobile === mobile
          ? previous
          : { compact, mobile },
      );
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [ref]);
  return layout;
}
