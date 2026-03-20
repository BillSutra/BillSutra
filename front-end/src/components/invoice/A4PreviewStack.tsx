"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

export const A4_WIDTH_PX = 794;
export const A4_HEIGHT_PX = 1123;
export const A4_PAGE_PADDING_PX = 28;
export const A4_CONTENT_HEIGHT_PX = A4_HEIGHT_PX - A4_PAGE_PADDING_PX * 2;

type A4PreviewStackProps = {
  children: ReactNode;
  stackKey: string;
  className?: string;
  pageGapClassName?: string;
};

const combineClassNames = (...values: Array<string | undefined>) => {
  return values.filter(Boolean).join(" ");
};

const A4PreviewStack = ({
  children,
  stackKey,
  className,
  pageGapClassName,
}: A4PreviewStackProps) => {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const measureRef = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(1);
  const [pageCount, setPageCount] = useState(1);

  useEffect(() => {
    const updateScale = () => {
      const width = viewportRef.current?.clientWidth ?? 0;
      if (!width) return;
      const nextScale = Math.min(1, width / A4_WIDTH_PX);
      setScale((currentScale) =>
        Math.abs(currentScale - nextScale) < 0.001 ? currentScale : nextScale,
      );
    };

    updateScale();

    const observer =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(updateScale)
        : null;

    if (observer && viewportRef.current) {
      observer.observe(viewportRef.current);
    }

    window.addEventListener("resize", updateScale);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", updateScale);
    };
  }, []);

  useEffect(() => {
    let animationFrameId = 0;

    const measurePages = () => {
      const target = measureRef.current;
      if (!target) return;
      const nextPageCount = Math.max(
        1,
        Math.ceil(target.scrollHeight / A4_CONTENT_HEIGHT_PX),
      );
      setPageCount((currentPageCount) =>
        currentPageCount === nextPageCount
          ? currentPageCount
          : nextPageCount,
      );
    };

    const scheduleMeasure = () => {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = window.requestAnimationFrame(measurePages);
    };

    scheduleMeasure();

    const observer =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(scheduleMeasure)
        : null;

    if (observer && measureRef.current) {
      observer.observe(measureRef.current);
    }

    window.addEventListener("resize", scheduleMeasure);
    return () => {
      cancelAnimationFrame(animationFrameId);
      observer?.disconnect();
      window.removeEventListener("resize", scheduleMeasure);
    };
  }, []);

  const pages = useMemo(
    () => Array.from({ length: pageCount }, (_, index) => index),
    [pageCount],
  );

  return (
    <div className={combineClassNames("a4-preview-stack", className)}>
      <div ref={viewportRef} className="a4-preview-viewport">
        <div
          className={combineClassNames("a4-preview-pages", pageGapClassName)}
        >
          {pages.map((pageIndex) => (
            <div
              key={`${stackKey}-page-${pageIndex}`}
              className="a4-preview-page-slot invoice-page page-fade-in"
              style={{
                width: A4_WIDTH_PX * scale,
                height: A4_HEIGHT_PX * scale,
              }}
            >
              <span className="a4-page-badge print:hidden">
                Page {pageIndex + 1} / {pageCount}
              </span>
              <div
                className="a4-page-frame"
                style={{
                  width: A4_WIDTH_PX,
                  height: A4_HEIGHT_PX,
                  transform: `scale(${scale})`,
                }}
              >
                <div className="a4-page-content">
                  <div
                    style={{
                      transform: `translateY(-${pageIndex * A4_CONTENT_HEIGHT_PX}px)`,
                    }}
                  >
                    {children}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="a4-measure-layer" aria-hidden>
        <div style={{ width: A4_WIDTH_PX }}>
          <div className="a4-page-content">
            <div ref={measureRef}>{children}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default A4PreviewStack;
