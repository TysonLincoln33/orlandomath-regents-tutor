export const RT_PROGRESS_UPDATED_EVENT = "rt:progress-updated";

let scheduled = false;

export function emitProgressUpdated(): void {
  if (typeof window === "undefined") return;
  if (scheduled) return;
  scheduled = true;

  const fire = () => {
    scheduled = false;
    window.dispatchEvent(new CustomEvent(RT_PROGRESS_UPDATED_EVENT));
  };

  if (typeof window.requestAnimationFrame === "function") {
    window.requestAnimationFrame(fire);
    return;
  }

  window.setTimeout(fire, 0);
}
