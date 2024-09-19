document.addEventListener('DOMContentLoaded', () => {
    let chart;

    const API_URL = 'http://localhost:9001/data';

    function fetchData() {
        return fetch(API_URL)
            .then(response => {
                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }
                return response.json();
            });
    }

    function processData(rawData) {
        const logs = rawData.data.map(entry => ({
            id: entry[0],
            sourceIp: entry[1],
            destIp: entry[2],
            packetSize: entry[3],
            protocol: entry[4],
            sourcePort: entry[5],
            destPort: entry[6],
            flags: entry[7],
            ttl: entry[8],
            timestamp: entry[9]
        }));

        const uniqueIPs = new Set(logs.flatMap(log => [log.sourceIp, log.destIp])).size;
        const totalConnections = logs.length;
        const avgPacketSize = Math.round(logs.reduce((sum, log) => sum + log.packetSize, 0) / logs.length);

        const trafficData = {
            labels: logs.slice(-6).map(log => log.timestamp.split(' ')[1]),
            datasets: [{
                label: 'Packet Size',
                data: logs.slice(-6).map(log => log.packetSize),
                borderColor: '#FF5A5F',
                tension: 0.1
            }]
        };

        return {
            logs,
            dashboardData: {
                uniqueIPs,
                totalConnections,
                avgPacketSize,
                trafficData
            }
        };
    }

    function updateDashboardMetrics(data) {
        document.querySelector('#total-connections .metric-value').textContent = data.totalConnections;
        document.querySelector('#unique-ips .metric-value').textContent = data.uniqueIPs;
        document.querySelector('#avg-packet-size .metric-value').textContent = `${data.avgPacketSize} bytes`;
    }

    function createOrUpdateChart(data) {
        const ctx = document.getElementById('trafficChart').getContext('2d');
        
        const chartOptions = {
            responsive: true,
            maintainAspectRatio: false,
            animation: {
                duration: 1000,
                easing: 'easeOutQuart'
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: {
                        color: 'rgba(0, 0, 0, 0.1)'
                    }
                },
                x: {
                    grid: {
                        display: false
                    }
                }
            },
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.7)',
                    titleFont: {
                        size: 14
                    },
                    bodyFont: {
                        size: 12
                    }
                }
            }
        };

        if (chart) {
            chart.data = data.trafficData;
            chart.options = chartOptions;
            chart.update();
        } else {
            chart = new Chart(ctx, {
                type: 'line',
                data: data.trafficData,
                options: chartOptions
            });
        }
    }

    function renderLogs(logs) {
        const logsBody = document.getElementById('logs-body');
        logsBody.innerHTML = '';

        logs.forEach(log => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${log.timestamp}</td>
                <td>${log.sourceIp}</td>
                <td>${log.destIp}</td>
                <td>${log.protocol}</td>
                <td>${log.packetSize}</td>
                <td><span class="status-badge status-${log.flags.toLowerCase()}">${log.flags}</span></td>
            `;
            logsBody.appendChild(row);
        });
    }

    let currentPage = 1;
    let searchQuery = '';
    let allLogs = [];

    document.getElementById('search').addEventListener('input', (e) => {
        searchQuery = e.target.value;
        currentPage = 1;
        updateLogs();
    });

    document.getElementById('refresh-btn').addEventListener('click', () => {
        updateDashboard();
    });

    document.getElementById('prev-page').addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            updateLogs();
        }
    });

    document.getElementById('next-page').addEventListener('click', () => {
        if (currentPage < Math.ceil(allLogs.length / 10)) {
            currentPage++;
            updateLogs();
        }
    });

    function updateDashboard() {
        toggleLoadingSpinner(true);
        fetchData()
            .then((rawData) => {
                const { logs, dashboardData } = processData(rawData);
                allLogs = logs;
                updateDashboardMetrics(dashboardData);
                createOrUpdateChart(dashboardData);
                updateLogs();
            })
            .catch(error => {
                console.error('Error fetching data:', error);
                // Handle error (e.g., show error message to user)
            })
            .finally(() => {
                toggleLoadingSpinner(false);
            });
    }

    function updateLogs() {
        const filteredLogs = allLogs.filter(log => 
            Object.values(log).some(value => 
                value.toString().toLowerCase().includes(searchQuery.toLowerCase())
            )
        );

        const startIndex = (currentPage - 1) * 10;
        const endIndex = startIndex + 10;
        const logsToShow = filteredLogs.slice(startIndex, endIndex);

        renderLogs(logsToShow);
        updatePagination(filteredLogs.length, currentPage);
    }

    function updatePagination(totalLogs, currentPage) {
        const totalPages = Math.ceil(totalLogs / 10);
        const prevBtn = document.getElementById('prev-page');
        const nextBtn = document.getElementById('next-page');
        const pageInfo = document.getElementById('page-info');

        prevBtn.disabled = currentPage === 1;
        nextBtn.disabled = currentPage === totalPages;
        pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;
    }

    function toggleLoadingSpinner(show) {
        const spinner = document.getElementById('loading-spinner');
        if (show) {
            spinner.classList.remove('hidden');
        } else {
            spinner.classList.add('hidden');
        }
    }

    // Initial load
    updateDashboard();

    // Add this function
    function smoothScroll(target) {
        const element = document.querySelector(target);
        window.scrollTo({
            top: element.offsetTop,
            behavior: 'smooth'
        });
    }

    // Add this event listener
    document.querySelectorAll('nav a').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const target = e.target.getAttribute('href');
            smoothScroll(target);
        });
    });

    // Add this function
    function handleBackToTop() {
        const backToTopButton = document.getElementById('back-to-top');
        
        window.addEventListener('scroll', () => {
            if (window.pageYOffset > 300) {
                backToTopButton.classList.add('visible');
            } else {
                backToTopButton.classList.remove('visible');
            }
        });

        backToTopButton.addEventListener('click', () => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }

    // Call this function in the DOMContentLoaded event listener
    handleBackToTop();

    // Add this function
    function handleHeaderScroll() {
        const header = document.querySelector('header');
        window.addEventListener('scroll', () => {
            if (window.scrollY > 10) {
                header.classList.add('scrolled');
            } else {
                header.classList.remove('scrolled');
            }
        });
    }

    // Call this function in the DOMContentLoaded event listener
    handleHeaderScroll();
});
