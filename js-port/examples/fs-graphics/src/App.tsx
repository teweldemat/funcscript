import { KeyboardEvent, TouchEvent as ReactTouchEvent, useCallback, useEffect, useRef, useState } from 'react';
import './App.css';

const MIN_LEFT_WIDTH = 180;
const MIN_RIGHT_WIDTH = 180;
const DEFAULT_RATIO = 0.4;


const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const App = (): JSX.Element => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const svgWrapperRef = useRef<HTMLDivElement | null>(null);
  const [leftWidth, setLeftWidth] = useState(() => {
    if (typeof window === 'undefined') {
      return 360;
    }
    return Math.round(window.innerWidth * DEFAULT_RATIO) || 360;
  });
  const [dragging, setDragging] = useState(false);

  const applyWidthFromClientX = useCallback(
    (clientX: number) => {
      const container = containerRef.current;
      if (!container) {
        return;
      }
      const rect = container.getBoundingClientRect();
      const clampedLeft = clamp(
        clientX - rect.left,
        MIN_LEFT_WIDTH,
        Math.max(MIN_LEFT_WIDTH, rect.width - MIN_RIGHT_WIDTH)
      );
      setLeftWidth(Math.round(clampedLeft));
    },
    []
  );

  const stopDragging = useCallback(() => {
    setDragging(false);
  }, []);

  useEffect(() => {
    if (!dragging) {
      document.body.style.removeProperty('cursor');
      document.body.style.removeProperty('user-select');
      return;
    }

    const handleMouseMove = (event: MouseEvent) => {
      applyWidthFromClientX(event.clientX);
    };

    const handleTouchMove = (event: TouchEvent) => {
      if (event.touches.length > 0) {
        applyWidthFromClientX(event.touches[0].clientX);
      }
    };

    const handlePointerUp = () => {
      stopDragging();
    };

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('mouseup', handlePointerUp);
    window.addEventListener('touchend', handlePointerUp);
    window.addEventListener('touchcancel', handlePointerUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('mouseup', handlePointerUp);
      window.removeEventListener('touchend', handlePointerUp);
      window.removeEventListener('touchcancel', handlePointerUp);
      document.body.style.removeProperty('cursor');
      document.body.style.removeProperty('user-select');
    };
  }, [applyWidthFromClientX, dragging, stopDragging]);

  const handleSplitterMouseDown = useCallback(() => {
    setDragging(true);
  }, []);

  const handleSplitterTouchStart = useCallback((event: ReactTouchEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(true);
    if (event.touches.length > 0) {
      applyWidthFromClientX(event.touches[0].clientX);
    }
  }, [applyWidthFromClientX]);

  const handleSplitterKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      const container = containerRef.current;
      const containerWidth = container ? container.getBoundingClientRect().width : window.innerWidth;
      const maxLeft = Math.max(MIN_LEFT_WIDTH, containerWidth - MIN_RIGHT_WIDTH);
      const step = event.shiftKey ? 32 : 12;
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        setLeftWidth((current) => clamp(current - step, MIN_LEFT_WIDTH, maxLeft));
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        setLeftWidth((current) => clamp(current + step, MIN_LEFT_WIDTH, maxLeft));
      }
      if (event.key === 'Home') {
        event.preventDefault();
        setLeftWidth(MIN_LEFT_WIDTH);
      }
      if (event.key === 'End') {
        event.preventDefault();
        setLeftWidth(maxLeft);
      }
    },
    []
  );

  useEffect(() => {
    const handleResize = () => {
      const container = containerRef.current;
      if (!container) {
        return;
      }
      const rect = container.getBoundingClientRect();
      const maxLeft = Math.max(MIN_LEFT_WIDTH, rect.width - MIN_RIGHT_WIDTH);
      setLeftWidth((width) => clamp(width, MIN_LEFT_WIDTH, maxLeft));
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const svgFrameRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const wrapper = svgWrapperRef.current;
    const frame = svgFrameRef.current;
    if (!wrapper || !frame) {
      return;
    }

    const updateFrameSize = () => {
      const rect = wrapper.getBoundingClientRect();
      const { width: wrapperWidth, height: wrapperHeight } = rect;
      if (wrapperWidth <= 0 || wrapperHeight <= 0) {
        return;
      }

      const wrapperAspectRatio = wrapperWidth / wrapperHeight;
      const svgAspectRatio = 3 / 5;

      let nextWidth;
      let nextHeight;

      if (wrapperAspectRatio > svgAspectRatio) {
        // Wrapper is wider than the SVG, so height is the limiting factor
        nextHeight = wrapperHeight;
        nextWidth = wrapperHeight * svgAspectRatio;
      } else {
        // Wrapper is taller than the SVG, so width is the limiting factor
        nextWidth = wrapperWidth;
        nextHeight = wrapperWidth / svgAspectRatio;
      }

      frame.style.width = `${nextWidth}px`;
      frame.style.height = `${nextHeight}px`;
    };

    updateFrameSize();

    const observer = new ResizeObserver(() => {
      updateFrameSize();
    });
    observer.observe(wrapper);

    return () => {
      observer.disconnect();
    };
  }, []);

  return (
    <div ref={containerRef} className="app" aria-label="Resizable split view">
      <section className="panel panel-left" style={{ width: `${leftWidth}px` }}>
        <header className="panel-heading">Left</header>
        <div className="panel-body">
          <p>
            This is the left panel. Use the splitter to adjust its width or keyboard arrows while the splitter is
            focused.
          </p>
        </div>
      </section>

      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize panels"
        tabIndex={0}
        className={`splitter${dragging ? ' splitter-dragging' : ''}`}
        onMouseDown={handleSplitterMouseDown}
        onTouchStart={handleSplitterTouchStart}
        onKeyDown={handleSplitterKeyDown}
      />

      <section className="panel panel-right">
        <header className="panel-heading">Right</header>
        <div className="panel-body panel-body-right">
          <div ref={svgWrapperRef} className="svg-wrapper">
            <div
              ref={svgFrameRef}
              className="svg-frame svg-frame-tall"
            >
              <svg
                className="responsive-svg"
                width="300"
                height="500"
                viewBox="0 0 840 1400"
                preserveAspectRatio="xMidYMid meet"
                role="img"
                aria-labelledby="panel-svg-title"
              >
                <title id="panel-svg-title">Resizable preview</title>
                <defs>
                  <linearGradient id="circleGradient" x1="260" y1="200" x2="620" y2="900" gradientUnits="userSpaceOnUse">
                    <stop offset="0" stopColor="#38bdf8" stopOpacity="0.9" />
                    <stop offset="1" stopColor="#1e40af" stopOpacity="0.7" />
                  </linearGradient>
                </defs>
                <rect width="840" height="1400" rx="32" fill="rgba(15, 23, 42, 0.9)" />
                <circle cx="420" cy="700" r="280" fill="url(#circleGradient)" />
              </svg>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default App;

