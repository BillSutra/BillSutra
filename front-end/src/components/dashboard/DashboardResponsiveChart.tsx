"use client";

import React, { useEffect, useRef, useState } from "react";
import { ResponsiveContainer } from "recharts";

type DashboardResponsiveChartProps = {
  children: React.ReactElement;
};

type ChartSize = {
  width: number;
  height: number;
};

const DashboardResponsiveChart = ({
  children,
}: DashboardResponsiveChartProps) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const frameRef = useRef<number | null>(null);
  const [size, setSize] = useState<ChartSize>({ width: 0, height: 0 });

  useEffect(() => {
    const container = containerRef.current;

    if (!container) {
      return undefined;
    }

    const updateSize = () => {
      const nextWidth = Math.max(0, Math.floor(container.clientWidth));
      const nextHeight = Math.max(0, Math.floor(container.clientHeight));

      setSize((current) => {
        if (
          current.width === nextWidth &&
          current.height === nextHeight
        ) {
          return current;
        }

        return {
          width: nextWidth,
          height: nextHeight,
        };
      });
    };

    const scheduleUpdate = () => {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
      }

      frameRef.current = requestAnimationFrame(() => {
        frameRef.current = null;
        updateSize();
      });
    };

    updateSize();

    if (typeof ResizeObserver !== "undefined") {
      const observer = new ResizeObserver(() => {
        scheduleUpdate();
      });

      observer.observe(container);

      return () => {
        observer.disconnect();
        if (frameRef.current !== null) {
          cancelAnimationFrame(frameRef.current);
        }
      };
    }

    window.addEventListener("resize", updateSize);

    return () => {
      window.removeEventListener("resize", updateSize);
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
      }
    };
  }, []);

  const hasMeasuredSize = size.width > 0 && size.height > 0;

  return (
    <div ref={containerRef} className="h-full w-full min-h-0 min-w-0">
      {hasMeasuredSize ? (
        <ResponsiveContainer
          width={size.width}
          height={size.height}
          minWidth={0}
        >
          {children}
        </ResponsiveContainer>
      ) : null}
    </div>
  );
};

export default DashboardResponsiveChart;
