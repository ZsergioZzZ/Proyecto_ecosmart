// Configuración global
const config = {
    apiBaseUrl: 'http://localhost:5000/api',
    colores: {
        temperatura: 'rgba(255, 99, 132, 0.8)',
        humedad: 'rgba(54, 162, 235, 0.8)',
        ph: 'rgba(75, 192, 192, 0.8)',
        nitrogeno: 'rgba(153, 102, 255, 0.8)',
        fosforo: 'rgba(255, 159, 64, 0.8)',
        potasio: 'rgba(255, 205, 86, 0.8)'
    }
};

// Variables globales
let chart = null;
let currentData = [];

// Inicialización
document.addEventListener('DOMContentLoaded', function() {
    initSelectParcela();
    initEventListeners();
});

function initSelectParcela() {
    fetch(`${config.apiBaseUrl}/parcelas`)
        .then(response => {
            if (!response.ok) throw new Error('Error en la respuesta del servidor');
            return response.json();
        })
        .then(data => {
            const select = document.getElementById('select-parcela');
            
            // Limpiar y agregar opciones
            select.innerHTML = '<option value="">Seleccione Parcela</option>';
            data.forEach(parcela => {
                const option = document.createElement('option');
                option.value = parcela;
                option.textContent = parcela;
                select.appendChild(option);
            });
            
            // Cargar datos de la primera parcela si existe
            if (data.length > 0) {
                loadSensorData(data[0]);
            }
        })
        .catch(error => {
            console.error('Error al cargar parcelas:', error);
            alert('Error al cargar las parcelas. Verifica la conexión con el servidor.');
        });
}

function initEventListeners() {
    document.getElementById('select-parcela').addEventListener('change', function() {
        if (this.value) loadSensorData(this.value);
    });
    
    document.getElementById('btn-aplicar').addEventListener('click', updateMainChart);
}

function loadSensorData(parcela) {
    fetch(`${config.apiBaseUrl}/datos-sensores/${parcela}`)
        .then(response => {
            if (!response.ok) throw new Error('Error al obtener datos');
            return response.json();
        })
        .then(data => {
            currentData = data;
            updateMainChart();
            updateSensorIndicators(data);
        })
        .catch(error => {
            console.error('Error al cargar datos:', error);
            alert('Error al cargar datos de sensores. Intente nuevamente.');
        });
}

function updateMainChart() {
    const ctx = document.getElementById('farmer-chart-container').getContext('2d');
    const chartType = document.getElementById('select-grafico').value;
    
    if (chart) chart.destroy();
    
    const datasets = [];
    const labels = currentData.map(d => formatDate(d.fecha));
    
    // Agregar cada parámetro seleccionado
    if (document.getElementById('check-temperatura').checked) {
        datasets.push(createDataset('temperatura', 'Temperatura (°C)', config.colores.temperatura));
    }
    
    if (document.getElementById('check-humedad').checked) {
        datasets.push(createDataset('humedad_suelo', 'Humedad (%)', config.colores.humedad));
    }
    
    if (document.getElementById('check-ph').checked) {
        datasets.push(createDataset('ph', 'pH', config.colores.ph));
    }
    
    if (document.getElementById('check-nitrogeno').checked) {
        datasets.push(createDataset('nitrogeno', 'Nitrógeno (ppm)', config.colores.nitrogeno));
    }
    
    if (document.getElementById('check-fosforo').checked) {
        datasets.push(createDataset('fosforo', 'Fósforo (ppm)', config.colores.fosforo));
    }
    
    if (document.getElementById('check-potasio').checked) {
        datasets.push(createDataset('potasio', 'Potasio (ppm)', config.colores.potasio));
    }
    
    chart = new Chart(ctx, {
        type: chartType,
        data: {
            labels: labels,
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: false
                }
            }
        }
    });
}

function updateSensorIndicators(sensorData) {
    if (sensorData.length > 0) {
        const lastReading = sensorData[sensorData.length - 1];
        
        // Actualizar indicadores
        document.getElementById('tempValor').textContent = lastReading.temperatura?.toFixed(1) || '--';
        document.getElementById('humedadValor').textContent = lastReading.humedad_suelo?.toFixed(1) || '--';
        document.getElementById('phValor').textContent = lastReading.ph?.toFixed(1) || '--';
        
        // Calcular promedio de nutrientes
        const nutrientes = [
            lastReading.nitrogeno || 0,
            lastReading.fosforo || 0,
            lastReading.potasio || 0
        ].filter(n => n > 0);
        
        const avgNutrientes = nutrientes.length > 0 ? 
            (nutrientes.reduce((a, b) => a + b, 0) / nutrientes.length).toFixed(1) : '--';
        
        document.getElementById('nutrientesValor').textContent = avgNutrientes;
    }
}

// Funciones auxiliares
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function createDataset(field, label, color) {
    return {
        label: label,
        data: currentData.map(d => d[field]),
        borderColor: color,
        backgroundColor: color,
        borderWidth: 2,
        fill: false
    };
}
