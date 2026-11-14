// The page's flow-reveal controller (flowReveal.ts) on the browser: one IntersectionObserver, the shared scroll subscription
// (scrollHub.ts), the film viewport (viewport.ts) and the animation frame. Client only; nothing runs until an item is added.
import { FLOW_BAND, createFlowController, type FlowHost, type FlowItem } from "@/components/film/flowReveal";
import { subscribeScroll } from "@/components/film/scrollHub";
import { subscribeFilmViewport } from "@/components/film/viewport";

let io: IntersectionObserver | null = null;
const watched = new Map<Element, (inBand: boolean) => void>();
const elements = new Map<FlowItem, Element>();

function observer(): IntersectionObserver {
  return (io ??= new IntersectionObserver(
    (records) => {
      // The last record per element is its state now.
      for (const r of records) watched.get(r.target)?.(r.isIntersecting);
    },
    { rootMargin: FLOW_BAND },
  ));
}

const host: FlowHost = {
  observe(item, onBand) {
    const el = elements.get(item);
    if (!el) return () => {};
    watched.set(el, onBand);
    observer().observe(el);
    return () => {
      watched.delete(el);
      io?.unobserve(el);
      if (!watched.size) {
        io?.disconnect();
        io = null;
      }
    };
  },
  onScroll: subscribeScroll,
  onViewport: (fn) => subscribeFilmViewport(fn),
  frame: (fn) => requestAnimationFrame(fn),
  cancelFrame: (id) => cancelAnimationFrame(id),
  scrollY: () => window.scrollY,
  height: () => window.innerHeight,
};

const controller = createFlowController(host);

/**
 * Registers a flow element (Reveal.tsx FlowReveal): its opacity and rise follow the scroll through the shared controller.
 * Returns the removal, which clears the inline styles it wrote.
 */
export function addFlowReveal(el: HTMLElement): () => void {
  // The rise the style holds now, so top() can take it out; `:focus-within` shows the item at once (globals.css).
  let rise = "";
  const item: FlowItem = {
    top: () => {
      const ty = rise && !el.matches(":focus-within") ? Number(/translateY\((-?[\d.]+)px\)/.exec(rise)?.[1] ?? 0) : 0;
      return el.getBoundingClientRect().top - ty;
    },
    write: (s) => {
      el.style.opacity = s.opacity;
      el.style.transform = rise = s.transform;
    },
  };
  elements.set(item, el);
  const remove = controller.add(item);
  return () => {
    remove();
    elements.delete(item);
    el.style.opacity = "";
    el.style.transform = "";
  };
}
