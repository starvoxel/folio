import { useEffect, useRef } from 'react';
import * as echarts from 'echarts/core';
import { BarChart, PieChart } from 'echarts/charts';
import { AriaComponent, GridComponent, TooltipComponent } from 'echarts/components';
import { SVGRenderer } from 'echarts/renderers';
import { formatCents, formatCentsWhole } from '../shared/money';
import type { MonthFlow, Slice } from './model';
import { monthShort } from './model';

echarts.use([PieChart, BarChart, GridComponent, TooltipComponent, AriaComponent, SVGRenderer]);

export const PALETTE = ['#0078D4', '#E3008C', '#00A88F', '#F7630C', '#8764B8', '#498205', '#C239B3', '#038387', '#986F0B', '#4F6BED', '#767676'];

interface ChartTheme { text: string; muted: string; grid: string; bg: string }

function useChart(init: (c: echarts.ECharts) => void, deps: unknown[]) {
  const ref = useRef<HTMLDivElement>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);
  useEffect(() => {
    if (!ref.current) return;
    const c = echarts.init(ref.current, undefined, { renderer: 'svg' });
    chartRef.current = c;
    const ro = new ResizeObserver(() => c.resize());
    ro.observe(ref.current);
    return () => {
      ro.disconnect();
      c.dispose();
      chartRef.current = null;
    };
  }, []);
  useEffect(() => {
    if (chartRef.current) init(chartRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return ref;
}

export function Donut(props: { slices: Slice[]; theme: ChartTheme; totalCents: number; onPick: (id: string) => void }) {
  const { slices, theme, totalCents, onPick } = props;
  const ref = useChart(
    (c) => {
      c.off('click');
      c.setOption(
        {
          animation: false,
          aria: { enabled: false }, // ECharts' generated label reads raw cents; the legend list and table carry the data
          tooltip: { trigger: 'item', formatter: (p: { name: string; value: number; percent: number }) => `${p.name}: ${formatCents(p.value)} (${Math.round(p.percent)}%)` },
          title: { text: formatCentsWhole(totalCents), subtext: 'spent', left: 'center', top: '40%', textStyle: { color: theme.text, fontSize: 22, fontWeight: 600 }, subtextStyle: { color: theme.muted, fontSize: 12 } },
          series: [
            {
              type: 'pie',
              radius: ['58%', '88%'],
              avoidLabelOverlap: true,
              label: { show: false },
              itemStyle: { borderColor: theme.bg, borderWidth: 2 },
              cursor: 'pointer',
              data: slices.map((s, i) => ({ id: s.id, name: s.name, value: s.cents, itemStyle: { color: PALETTE[i % PALETTE.length] } })),
            },
          ],
        },
        true,
      );
      c.on('click', (p) => {
        const d = p.data as { id?: string } | undefined;
        if (d?.id) onPick(d.id);
      });
    },
    [slices, theme, totalCents, onPick],
  );
  return <div ref={ref} className="chart donut" data-testid="donut" role="img" aria-label="Donut chart of spending by main category. Use the legend list to open a category." />;
}

export function InOutBars(props: { flows: MonthFlow[]; theme: ChartTheme; onPick: (month: string, flow: 'in' | 'out') => void }) {
  const { flows, theme, onPick } = props;
  const ref = useChart(
    (c) => {
      c.off('click');
      c.setOption(
        {
          animation: false,
          aria: { enabled: false },
          tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: (ps: { seriesName: string; value: number; axisValue: string }[]) => ps.map((p) => `${p.seriesName}: ${formatCents(Math.round(p.value))}`).join('<br/>') },
          legend: { data: ['Money in', 'Money out'], textStyle: { color: theme.text }, top: 0 },
          grid: { left: 64, right: 16, top: 36, bottom: 28 },
          xAxis: { type: 'category', data: flows.map((f) => monthShort(f.month)), axisLabel: { color: theme.muted }, axisLine: { lineStyle: { color: theme.grid } } },
          yAxis: { type: 'value', axisLabel: { color: theme.muted, formatter: (v: number) => formatCentsWhole(Math.round(v)) }, splitLine: { lineStyle: { color: theme.grid } } },
          series: [
            { name: 'Money in', type: 'bar', cursor: 'pointer', itemStyle: { color: '#0F7B0F' }, data: flows.map((f) => f.inCents) },
            { name: 'Money out', type: 'bar', cursor: 'pointer', itemStyle: { color: '#C42B1C' }, data: flows.map((f) => f.outCents) },
          ],
        },
        true,
      );
      c.on('click', (p) => {
        const f = flows[p.dataIndex];
        if (f) onPick(f.month, p.seriesName === 'Money in' ? 'in' : 'out');
      });
    },
    [flows, theme, onPick],
  );
  return <div ref={ref} className="chart bars" data-testid="bars" role="img" aria-label="Bar chart of money in and money out by month. Use the table below to open a month." />;
}
