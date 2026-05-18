import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';

const zoneStyle: CSSProperties = {
  width: '100%',
  height: '100%',
  minWidth: 0,
  minHeight: 0,
  overflow: 'hidden',
  display: 'grid',
  placeItems: 'center',
};

function measuredSize(element: HTMLElement | null): {
  width: number;
  height: number;
} {
  if (!element) {
    return { width: 0, height: 0 };
  }

  const rect = element.getBoundingClientRect();
  return {
    width: rect.width,
    height: rect.height,
  };
}

export function FitToZone({ children }: { children: ReactNode }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const container = containerRef.current;
    const content = contentRef.current;

    if (!container || !content) {
      return undefined;
    }

    const observedContainer = container;
    const observedContent = content;

    function updateScale(): void {
      const containerSize = measuredSize(observedContainer);
      observedContent.style.transform = 'scale(1)';
      const contentSize = measuredSize(observedContent);

      if (
        containerSize.width <= 0 ||
        containerSize.height <= 0 ||
        contentSize.width <= 0 ||
        contentSize.height <= 0
      ) {
        setScale(1);
        return;
      }

      setScale(Math.min(
        containerSize.width / contentSize.width,
        containerSize.height / contentSize.height,
        1,
      ));
    }

    const observer = new ResizeObserver(updateScale);
    observer.observe(observedContainer);
    observer.observe(observedContent);
    updateScale();

    window.addEventListener('orientationchange', updateScale);
    window.addEventListener('resize', updateScale);

    return () => {
      observer.disconnect();
      window.removeEventListener('orientationchange', updateScale);
      window.removeEventListener('resize', updateScale);
    };
  }, []);

  const contentStyle: CSSProperties = {
    transform: `scale(${scale})`,
    transformOrigin: 'center',
  };

  return (
    <div ref={containerRef} style={zoneStyle}>
      <div ref={contentRef} style={contentStyle}>
        {children}
      </div>
    </div>
  );
}

export default FitToZone;
