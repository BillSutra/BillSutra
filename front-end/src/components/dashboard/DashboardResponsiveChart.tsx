"use client";

import React, { useEffect, useState } from "react";
import { ResponsiveContainer } from "recharts";

type DashboardResponsiveChartProps = {
  children: React.ReactElement;
};

const DashboardResponsiveChart = ({
  children,
}: DashboardResponsiveChartProps) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  return (
    <ResponsiveContainer width="100%" height="100%" minWidth={0}>
      {children}
    </ResponsiveContainer>
  );
};

export default DashboardResponsiveChart;
