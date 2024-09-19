document.addEventListener('DOMContentLoaded', () => {
    fetchData();
    document.getElementById('refresh-btn').addEventListener('click', fetchData);
    document.getElementById('search').addEventListener('input', filterData);
    document.getElementById('prev-page').addEventListener('click', () => changePage(-1));
    document.getElementById('next-page').addEventListener('click', () => changePage(1));
});

let trafficChart;
let currentPage = 1;
let totalPages = 1;
const logsPerPage = 20; // You can adjust this number as needed
let allLogs = [];

async function fetchData() {
    try {
        console.log('Attempting to fetch data...');
        const response = await fetch('http://localhost:9001/data', {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
            },
        });
        console.log('Response received:', response);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            throw new TypeError("Oops, we haven't got JSON!");
        }
        
        const jsonData = await response.json();
        console.log('Data received:', jsonData);
        
        if (jsonData.status === 'success' && Array.isArray(jsonData.data)) {
            allLogs = jsonData.data;
            totalPages = Math.ceil(allLogs.length / logsPerPage);
            updateDashboard();
        } else {
            throw new Error('Unexpected data format');
        }
    } catch (error) {
        console.error('Error fetching data:', error);
        document.getElementById('dashboard-container').innerHTML = `
            <p>Error loading data: ${error.message}. Please try again later.</p>
            <p>Check the console for more details.</p>
        `;
    }
}

function updateDashboard() {
    const paginatedData = paginateData(allLogs, currentPage, logsPerPage);
    displayData(paginatedData);
    updateMetrics(allLogs);
    updateTrafficChart(allLogs);
    updatePaginationControls();
}

function paginateData(data, page, perPage) {
    const start = (page - 1) * perPage;
    const end = start + perPage;
    return data.slice(start, end);
}

function displayData(data) {
    const container = document.getElementById('dashboard-container');
    
    const table = document.createElement('table');
    table.innerHTML = `
        <thead>
            <tr>
                <th>ID</th>
                <th>Source IP</th>
                <th>Destination IP</th>
                <th>Length</th>
                <th>Protocol</th>
                <th>Source Port</th>
                <th>Destination Port</th>
                <th>Flags</th>
                <th>TTL</th>
                <th>Timestamp</th>
            </tr>
        </thead>
        <tbody>
            ${data.map(row => `
                <tr>
                    ${row.map(cell => `<td>${cell}</td>`).join('')}
                </tr>
            `).join('')}
        </tbody>
    `;
    
    container.innerHTML = '';
    container.appendChild(table);
}

function updateMetrics(data) {
    const totalConnections = data.length;
    const uniqueIPs = new Set([...data.map(row => row[1]), ...data.map(row => row[2])]).size;
    const avgPacketSize = data.reduce((sum, row) => sum + parseInt(row[3]), 0) / data.length;

    document.querySelector('#total-connections .metric-value').textContent = totalConnections;
    document.querySelector('#unique-ips .metric-value').textContent = uniqueIPs;
    document.querySelector('#avg-packet-size .metric-value').textContent = `${avgPacketSize.toFixed(2)} bytes`;
}

function updateTrafficChart(data) {
    const ctx = document.getElementById('trafficChart').getContext('2d');
    const timestamps = data.map(row => row[9]);
    const packetSizes = data.map(row => parseInt(row[3]));

    if (trafficChart) {
        trafficChart.data.labels = timestamps;
        trafficChart.data.datasets[0].data = packetSizes;
        trafficChart.update();
    } else {
        trafficChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: timestamps,
                datasets: [{
                    label: 'Packet Size',
                    data: packetSizes,
                    borderColor: 'rgb(75, 192, 192)',
                    tension: 0.1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Packet Size (bytes)'
                        }
                    },
                    x: {
                        title: {
                            display: true,
                            text: 'Timestamp'
                        }
                    }
                }
            }
        });
    }
}

function updatePaginationControls() {
    const prevButton = document.getElementById('prev-page');
    const nextButton = document.getElementById('next-page');
    const pageInfo = document.getElementById('page-info');

    prevButton.disabled = currentPage === 1;
    nextButton.disabled = currentPage === totalPages;
    pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;
}

function changePage(direction) {
    currentPage += direction;
    updateDashboard();
}

function filterData() {
    const searchTerm = document.getElementById('search').value.toLowerCase();
    const filteredLogs = allLogs.filter(row => 
        row.some(cell => cell.toString().toLowerCase().includes(searchTerm))
    );
    
    totalPages = Math.ceil(filteredLogs.length / logsPerPage);
    currentPage = 1;
    
    const paginatedData = paginateData(filteredLogs, currentPage, logsPerPage);
    displayData(paginatedData);
    updatePaginationControls();
}
