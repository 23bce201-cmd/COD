import React, { useState, useMemo } from 'react';
import { useDrag, useDrop } from 'react-dnd';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell
} from 'recharts';
import { GripVertical, X, LayoutTemplate, GripHorizontal } from 'lucide-react';

const ItemTypes = {
  DIMENSION: 'dimension',
  METRIC: 'metric',
  CHART_TYPE: 'chart_type',
};

const CHART_COLORS = ["#6366F1", "#EC4899", "#06B6D4", "#10B981", "#F59E0B", "#8B5CF6", "#F43F5E", "#64748B"];

interface DraggableItemProps {
  id: string;
  label: string;
  type: string;
  bg?: string;
  textColor?: string;
}

const DraggableItem: React.FC<DraggableItemProps> = ({ id, label, type, bg = "bg-white", textColor = "text-slate-700" }) => {
  const [{ isDragging }, drag] = useDrag(() => ({
    type,
    item: { id, label, type },
    collect: (monitor) => ({
      isDragging: !!monitor.isDragging(),
    }),
  }));

  return (
    <div
      ref={drag}
      className={`flex items-center gap-2 px-3 py-2 rounded-lg border shadow-sm cursor-grab active:cursor-grabbing transition-opacity ${bg} ${textColor} ${isDragging ? 'opacity-50' : 'opacity-100'} border-slate-200 hover:border-indigo-300`}
    >
      <GripVertical size={14} className="text-slate-400" />
      <span className="text-xs font-bold">{label}</span>
    </div>
  );
};

interface DropZoneProps {
  accept: string[];
  onDrop: (item: any) => void;
  items: any[];
  onRemove: (id: string) => void;
  label: string;
  icon?: React.ReactNode;
}

const DropZone: React.FC<DropZoneProps> = ({ accept, onDrop, items, onRemove, label, icon }) => {
  const [{ isOver, canDrop }, drop] = useDrop(() => ({
    accept,
    drop: (item) => {
      onDrop(item);
    },
    collect: (monitor) => ({
      isOver: !!monitor.isOver(),
      canDrop: !!monitor.canDrop(),
    }),
  }));

  const isActive = isOver && canDrop;
  const borderClass = isActive ? 'border-indigo-500 bg-indigo-50/50' : canDrop ? 'border-indigo-200 bg-indigo-50/20' : 'border-dashed border-slate-200 bg-slate-50';

  return (
    <div className="flex flex-col gap-2 w-full">
      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
        {icon} {label}
      </label>
      <div
        ref={drop}
        className={`min-h-[48px] rounded-xl border-2 transition-all p-2 flex flex-wrap gap-2 items-center ${borderClass}`}
      >
        {items.length === 0 && (
          <span className="text-xs text-slate-400 font-medium px-2 py-1 italic">Drag item here...</span>
        )}
        {items.map((item) => (
          <div key={item.id} className="flex items-center gap-1.5 bg-white border border-slate-200 shadow-sm rounded-md pl-2 pr-1 py-1 group">
            <span className="text-xs font-bold text-slate-700">{item.label}</span>
            <button
              onClick={() => onRemove(item.id)}
              className="p-0.5 rounded hover:bg-rose-50 hover:text-rose-600 text-slate-400 transition-colors cursor-pointer"
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export function CustomGraphBuilder({ data }: { data: any[] }) {
  const [chartType, setChartType] = useState<any[]>([]);
  const [xAxis, setXAxis] = useState<any[]>([]);
  const [yAxis, setYAxis] = useState<any[]>([]);

  const handleDropChartType = (item: any) => setChartType([item]);
  const handleDropXAxis = (item: any) => setXAxis([item]);
  const handleDropYAxis = (item: any) => {
    if (!yAxis.find(i => i.id === item.id)) {
      setYAxis([...yAxis, item]);
    }
  };

  const removeChartType = () => setChartType([]);
  const removeXAxis = () => setXAxis([]);
  const removeYAxis = (id: string) => setYAxis(yAxis.filter(i => i.id !== id));

  const chartData = useMemo(() => {
    if (!xAxis.length || !yAxis.length || !data.length) return [];

    const dim = xAxis[0].id;
    const aggData = data.reduce((acc, row) => {
      let key = "Unknown";
      if (dim === 'platform') key = row.platform || "Unknown";
      else if (dim === 'campaign') key = row.campaign_name || "Unknown";
      else if (dim === 'client') key = row.client_name || "Unknown";
      else if (dim === 'status') key = row.status || "Unknown";

      if (!acc[key]) {
        acc[key] = { name: key, count: 0 };
        yAxis.forEach(y => { acc[key][y.id] = 0; });
      }

      acc[key].count += 1;
      yAxis.forEach(y => {
        if (y.id === 'spend') acc[key][y.id] += Number(row.total_spend || 0);
        else if (y.id === 'revenue') acc[key][y.id] += Number(row.total_revenue || 0);
        else if (y.id === 'leads') acc[key][y.id] += Number(row.total_leads || 0);
        else if (y.id === 'conversions') acc[key][y.id] += Number(row.total_conversions || 0);
        else if (y.id === 'clicks') acc[key][y.id] += Number(row.total_clicks || 0);
        else if (y.id === 'impressions') acc[key][y.id] += Number(row.total_impressions || 0);
      });

      return acc;
    }, {} as Record<string, any>);

    const arr = Object.values(aggData);
    
    arr.forEach((item: any) => {
      if (yAxis.find(y => y.id === 'cpl')) {
        item['cpl'] = item.leads > 0 ? (item.spend || 0) / item.leads : 0;
      }
      if (yAxis.find(y => y.id === 'roas')) {
        item['roas'] = (item.spend || 0) > 0 ? (item.revenue || 0) / item.spend : 0;
      }
      if (yAxis.find(y => y.id === 'ctr')) {
        item['ctr'] = (item.impressions || 0) > 0 ? ((item.clicks || 0) / item.impressions) * 100 : 0;
      }
    });

    const firstMetric = yAxis[0].id;
    return arr.sort((a: any, b: any) => (b[firstMetric] || 0) - (a[firstMetric] || 0)).slice(0, 20);
  }, [data, xAxis, yAxis]);

  const renderChart = () => {
    if (!xAxis.length || !yAxis.length || !chartType.length) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-slate-400 p-12">
          <LayoutTemplate size={48} className="mb-4 opacity-20" />
          <p className="text-sm font-bold text-slate-500">Canvas is empty</p>
          <p className="text-xs text-slate-400 mt-1">Drag a Chart Type, Dimension, and Metric to build.</p>
        </div>
      );
    }

    const type = chartType[0].id;
    const formatValue = (val: number, metricId: string) => {
      if (['spend', 'revenue', 'cpl'].includes(metricId)) return `$${Number(val).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      if (['roas'].includes(metricId)) return `${Number(val).toFixed(2)}x`;
      if (['ctr'].includes(metricId)) return `${Number(val).toFixed(2)}%`;
      return Number(val).toLocaleString();
    };

    const renderTooltip = (props: any) => {
      const { active, payload, label } = props;
      if (active && payload && payload.length) {
        return (
          <div className="bg-white border border-slate-200 shadow-lg rounded-xl p-3 text-xs z-50">
            <p className="font-bold text-slate-800 mb-2 border-b border-slate-100 pb-1">{label}</p>
            {payload.map((entry: any, index: number) => (
              <div key={index} className="flex items-center gap-2 mt-1">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color || entry.fill }} />
                <span className="text-slate-500 font-semibold">{entry.name}:</span>
                <span className="text-slate-900 font-bold ml-auto pl-4">{formatValue(entry.value, entry.dataKey)}</span>
              </div>
            ))}
          </div>
        );
      }
      return null;
    };

    if (type === 'pie') {
      return (
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={chartData} dataKey={yAxis[0].id} nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={120} paddingAngle={2}>
              {chartData.map((_, index) => <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />)}
            </Pie>
            <Tooltip content={renderTooltip} />
            <Legend iconType="circle" wrapperStyle={{ fontSize: 11, color: "#64748B" }} />
          </PieChart>
        </ResponsiveContainer>
      );
    }

    const ChartComponent = type === 'line' ? LineChart : type === 'area' ? AreaChart : BarChart;
    const DataComponent = type === 'line' ? Line : type === 'area' ? Area : Bar;

    return (
      <ResponsiveContainer width="100%" height="100%">
        <ChartComponent data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
          <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#64748B" }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: "#64748B" }} axisLine={false} tickLine={false} tickFormatter={(val) => {
            if (yAxis.length === 1) return formatValue(val, yAxis[0].id);
            return val.toLocaleString();
          }} />
          <Tooltip content={renderTooltip} />
          <Legend iconType="circle" wrapperStyle={{ fontSize: 11, color: "#64748B" }} />
          {yAxis.map((y, index) => {
            const props = {
              key: y.id,
              dataKey: y.id,
              name: y.label,
              fill: type !== 'line' ? CHART_COLORS[index % CHART_COLORS.length] : undefined,
              stroke: type !== 'bar' ? CHART_COLORS[index % CHART_COLORS.length] : undefined,
              strokeWidth: type === 'line' ? 3 : undefined,
              radius: type === 'bar' ? [4, 4, 0, 0] : undefined,
              fillOpacity: type === 'area' ? 0.3 : 1,
            };
            return React.createElement(DataComponent as any, props);
          })}
        </ChartComponent>
      </ResponsiveContainer>
    );
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col mt-6">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
        <h3 className="text-slate-800 font-bold text-[15px] flex items-center gap-2">
          <LayoutTemplate size={18} className="text-indigo-500" />
          Interactive Graph Builder
        </h3>
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 bg-white px-2 py-0.5 rounded border border-slate-200 shadow-sm">Tableau Mode</span>
      </div>

      <div className="flex flex-col lg:flex-row h-[500px]">
        {/* Sidebar */}
        <div className="w-full lg:w-64 bg-slate-50/50 border-r border-slate-100 p-4 flex flex-col gap-6 overflow-y-auto">
          
          <div>
            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">Chart Types</h4>
            <div className="flex flex-col gap-2">
              <DraggableItem id="bar" label="Bar Chart" type={ItemTypes.CHART_TYPE} />
              <DraggableItem id="line" label="Line Chart" type={ItemTypes.CHART_TYPE} />
              <DraggableItem id="area" label="Area Chart" type={ItemTypes.CHART_TYPE} />
              <DraggableItem id="pie" label="Pie Chart" type={ItemTypes.CHART_TYPE} />
            </div>
          </div>

          <div>
            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">Dimensions (X-Axis)</h4>
            <div className="flex flex-col gap-2">
              <DraggableItem id="platform" label="Platform" type={ItemTypes.DIMENSION} bg="bg-emerald-50" textColor="text-emerald-700" />
              <DraggableItem id="campaign" label="Campaign Name" type={ItemTypes.DIMENSION} bg="bg-emerald-50" textColor="text-emerald-700" />
              <DraggableItem id="client" label="Client Name" type={ItemTypes.DIMENSION} bg="bg-emerald-50" textColor="text-emerald-700" />
              <DraggableItem id="status" label="Status" type={ItemTypes.DIMENSION} bg="bg-emerald-50" textColor="text-emerald-700" />
            </div>
          </div>

          <div>
            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">Metrics (Y-Axis)</h4>
            <div className="flex flex-col gap-2">
              <DraggableItem id="spend" label="Spend" type={ItemTypes.METRIC} bg="bg-sky-50" textColor="text-sky-700" />
              <DraggableItem id="revenue" label="Revenue" type={ItemTypes.METRIC} bg="bg-sky-50" textColor="text-sky-700" />
              <DraggableItem id="leads" label="Leads" type={ItemTypes.METRIC} bg="bg-sky-50" textColor="text-sky-700" />
              <DraggableItem id="conversions" label="Conversions" type={ItemTypes.METRIC} bg="bg-sky-50" textColor="text-sky-700" />
              <DraggableItem id="clicks" label="Clicks" type={ItemTypes.METRIC} bg="bg-sky-50" textColor="text-sky-700" />
              <DraggableItem id="impressions" label="Impressions" type={ItemTypes.METRIC} bg="bg-sky-50" textColor="text-sky-700" />
              <DraggableItem id="ctr" label="CTR %" type={ItemTypes.METRIC} bg="bg-sky-50" textColor="text-sky-700" />
              <DraggableItem id="cpl" label="Cost Per Lead" type={ItemTypes.METRIC} bg="bg-sky-50" textColor="text-sky-700" />
              <DraggableItem id="roas" label="ROAS" type={ItemTypes.METRIC} bg="bg-sky-50" textColor="text-sky-700" />
            </div>
          </div>

        </div>

        {/* Canvas */}
        <div className="flex-1 flex flex-col p-5 bg-white overflow-hidden">
          {/* Drop Zones Toolbar */}
          <div className="flex flex-col md:flex-row gap-4 mb-6 pb-4 border-b border-slate-100">
            <div className="flex-1">
              <DropZone
                label="Chart Type"
                accept={[ItemTypes.CHART_TYPE]}
                items={chartType}
                onDrop={handleDropChartType}
                onRemove={removeChartType}
                icon={<LayoutTemplate size={12} />}
              />
            </div>
            <div className="flex-1">
              <DropZone
                label="Columns (X-Axis)"
                accept={[ItemTypes.DIMENSION]}
                items={xAxis}
                onDrop={handleDropXAxis}
                onRemove={removeXAxis}
                icon={<GripHorizontal size={12} />}
              />
            </div>
            <div className="flex-1">
              <DropZone
                label="Rows (Y-Axis)"
                accept={[ItemTypes.METRIC]}
                items={yAxis}
                onDrop={handleDropYAxis}
                onRemove={removeYAxis}
                icon={<GripVertical size={12} />}
              />
            </div>
          </div>

          {/* Chart Rendering Area */}
          <div className="flex-1 min-h-0 bg-slate-50/30 rounded-xl border border-slate-100 flex flex-col pt-4">
             {renderChart()}
          </div>
        </div>
      </div>
    </div>
  );
}
