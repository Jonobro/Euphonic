document.addEventListener('DOMContentLoaded', () => {
  const chartDataEl = document.getElementById('chart-data');
  if (!chartDataEl) return;
  const chartData = JSON.parse(chartDataEl.textContent);

  Object.entries(chartData).forEach(([feat, data]) => {
    const ctx = document.getElementById(`${feat}-chart`).getContext('2d');
    const total = data.pos + data.neg;
    const posPercentage = total > 0 ? (data.pos / total * 100).toFixed(1) : 0;
    const negPercentage = total > 0 ? (data.neg / total * 100).toFixed(1) : 0;

    new Chart(ctx, {
      type: 'pie',
      data: {
        labels: [
          `${data.pos_label} (${posPercentage}%)`,
          `${data.neg_label} (${negPercentage}%)`
        ],
        datasets: [{
          data: [data.pos, data.neg],
          backgroundColor: ['#1DB954', '#3a3a3a']
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        animation: false,
        events: [],
        plugins: {
          tooltip: { enabled: false },
          legend: {
            position: 'bottom',
            labels: { color: '#FFFFFF', font: { size: 12 } }
          }
        }
      }
    });
  });
});