"use client";

import * as React from "react";

/**
 * HeaderBehavior
 * - Hides the header after 5s of inactivity (no scroll/mouse/key/touch).
 * - Reappears immediately on scroll up.
 * - Hides while scrolling down (after a small threshold).
 *
 * Controlled via toggling `om-hide-header` on <html>.
 */
export default function HeaderBehavior() {
  const lastY = React.useRef(0);
  const ticking = React.useRef(false);
  const timer = React.useRef<number | null>(null);

  const show = React.useCallback(() => {
    document.documentElement.classList.remove("om-hide-header");
  }, []);

  const hide = React.useCallback(() => {
    document.documentElement.classList.add("om-hide-header");
  }, []);

  const resetInactivity = React.useCallback(() => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      hide();
    }, 5000);
  }, [hide]);

  React.useEffect(() => {
    lastY.current = window.scrollY || 0;

    const onActivity = () => {
      // any activity shows header and resets timer
      show();
      resetInactivity();
    };

    const onScroll = () => {
      const y = window.scrollY || 0;
      const dy = y - lastY.current;

      if (!ticking.current) {
        ticking.current = true;
        window.requestAnimationFrame(() => {
          // Always show near the very top
          if (y < 20) {
            show();
          } else if (dy > 8) {
            // scrolling down
            hide();
          } else if (dy < -8) {
            // scrolling up
            show();
          }

          lastY.current = y;
          ticking.current = false;
        });
      }

      resetInactivity();
    };

    // start inactivity timer immediately (so header can hide even if user doesn't touch)
    resetInactivity();

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("mousemove", onActivity, { passive: true });
    window.addEventListener("keydown", onActivity);
    window.addEventListener("touchstart", onActivity, { passive: true });
    window.addEventListener("pointerdown", onActivity, { passive: true });

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("mousemove", onActivity);
      window.removeEventListener("keydown", onActivity);
      window.removeEventListener("touchstart", onActivity);
      window.removeEventListener("pointerdown", onActivity);
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [hide, resetInactivity, show]);

  return null;
}
