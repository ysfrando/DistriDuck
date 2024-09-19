document.addEventListener('DOMContentLoaded', () => {
    fetchData();
    document.getElementById('refresh-btn').addEventListener('click', fetchData);
    document.getElementById('search').addEventListener('input', filterData);
});

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
            displayData(jsonData.data);
            updateStats(jsonData.data);
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

function updateStats(data) {
    const totalConnections = data.length;
    const uniqueIPs = new Set([...data.map(row => row[1]), ...data.map(row => row[2])]).size;
    const avgPacketSize = data.reduce((sum, row) => sum + row[3], 0) / data.length;

    document.querySelector('#total-connections p').textContent = totalConnections;
    document.querySelector('#unique-ips p').textContent = uniqueIPs;
    document.querySelector('#avg-packet-size p').textContent = `${avgPacketSize.toFixed(2)} bytes`;
}

function filterData() {
    const searchTerm = document.getElementById('search').value.toLowerCase();
    const rows = document.querySelectorAll('#dashboard-container tbody tr');
    
    rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(searchTerm) ? '' : 'none';
    });
}