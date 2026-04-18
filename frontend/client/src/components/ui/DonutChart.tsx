import { PieChart, Pie, Cell, Tooltip, Legend } from "recharts";
interface DataProps {
    data: Object,
    color: number
};

export default function DonutChart({ data, color }: DataProps) {

    const filteredData = Object.entries(data).map(([name, value]) => ({
        name, value
    })).filter((entry) => {
        return entry.value > 0;
    });

  return (
    <div style={{ width: "100%", display: "flex", justifyContent: "center", flexDirection: "column", overflowY: "auto" }}>
      <PieChart width={300} height={400}>
        <Pie
          data={filteredData}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          innerRadius={50}
          outerRadius={100}
          fill="#8884d8"
          paddingAngle={0}
          label={ false }
        >
          {filteredData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={`hsl(${ color },80%,${index * (50 / filteredData.length)}%)`} />
          ))}
        </Pie>
        <Tooltip
          formatter={(value) => value.toLocaleString()}
        />
        <Legend
          wrapperStyle={{
            maxHeight: 150,
            overflowY: "auto",
            paddingLeft: 10
          }}
        />
      </PieChart>
    </div>
  );
}