
const config = {
    apiBaseUrl: 'http://localhost:5001/api',  // Usa el puerto 5001 que tienes configurado
    colores: {
        temperatura: 'rgba(255, 99, 132, 0.8)',
        humedad: 'rgba(54, 162, 235, 0.8)',
        ph: 'rgba(75, 192, 192, 0.8)',
        nitrogeno: 'rgba(153, 102, 255, 0.8)',
        fosforo: 'rgba(255, 159, 64, 0.8)',
        potasio: 'rgba(255, 205, 86, 0.8)'
    }
};

let radarChart = null;

// Inicialización
document.addEventListener('DOMContentLoaded', function() {
    cargarParcelas();
    document.getElementById('btn-aplicar').addEventListener('click', actualizarGraficoRadar);
});

// Cargar parcelas desde MongoDB
async function cargarParcelas() {
    try {
        const response = await fetch(`${config.apiBaseUrl}/parcelas`);
        if (!response.ok) throw new Error('Error al cargar parcelas');
        
        const parcelas = await response.json();
        const selector = document.getElementById('select-parcela');
        
        // Limpiar opciones existentes
        selector.innerHTML = '<option value="" disabled selected>Seleccione Parcela</option>';
        
        parcelas.forEach(parcela => {
            const option = document.createElement('option');
            option.value = parcela;
            option.textContent = parcela;
            selector.appendChild(option);
        });
    } catch (error) {
        console.error('Error cargando parcelas:', error);
        alert('Error al cargar las parcelas disponibles');
    }
}

// Actualizar gráfico radial
async function actualizarGraficoRadar() {
    const parcela = document.getElementById('select-parcela').value;
    if (!parcela) {
        alert('Por favor, seleccione una parcela.');
        return;
    }

    try {
        const response = await fetch(`${config.apiBaseUrl}/datos-radar/${encodeURIComponent(parcela)}`);
        if (!response.ok) throw new Error('Error al obtener datos');
        
        const datos = await response.json();
        
        if (Object.keys(datos).length === 0) {
            alert('No hay datos disponibles para esta parcela.');
            return;
        }
        
        renderizarGraficoRadar(datos);
    } catch (error) {
        console.error('Error al obtener datos:', error);
        alert('Error al cargar datos para el gráfico');
    }
}

// Renderizar gráfico radial
function renderizarGraficoRadar(datos) {
    const ctx = document.getElementById('radar-chart').getContext('2d');
    
    // Destruir gráfico existente
    if (radarChart) radarChart.destroy();

    // Preparar datos según checkboxes seleccionados
    const labels = [];
    const valores = [];
    const colores = [];
    
    if (document.getElementById('check-temperatura').checked && datos.temperatura) {
        labels.push('Temperatura (°C)');
        valores.push(datos.temperatura);
        colores.push(config.colores.temperatura);
    }
    
    if (document.getElementById('check-humedad').checked && datos.humedad) {
        labels.push('Humedad (%)');
        valores.push(datos.humedad);
        colores.push(config.colores.humedad);
    }
    
    if (document.getElementById('check-ph').checked && datos.ph) {
        labels.push('pH');
        valores.push(datos.ph);
        colores.push(config.colores.ph);
    }
    
    if (document.getElementById('check-nitrogeno').checked && datos.nitrogeno) {
        labels.push('Nitrógeno (ppm)');
        valores.push(datos.nitrogeno);
        colores.push(config.colores.nitrogeno);
    }
    
    if (document.getElementById('check-fosforo').checked && datos.fosforo) {
        labels.push('Fósforo (ppm)');
        valores.push(datos.fosforo);
        colores.push(config.colores.fosforo);
    }
    
    if (document.getElementById('check-potasio').checked && datos.potasio) {
        labels.push('Potasio (ppm)');
        valores.push(datos.potasio);
        colores.push(config.colores.potasio);
    }
    
    // Crear gráfico radial
    radarChart = new Chart(ctx, {
        type: 'radar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Promedios',
                data: valores,
                backgroundColor: colores.map(color => color.replace('0.8', '0.2')),
                borderColor: colores,
                borderWidth: 2,
                pointBackgroundColor: colores,
                pointRadius: 4
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: 'top',
                },
                title: {
                    display: true,
                    text: `Resumen de ${document.getElementById('select-parcela').value}`
                }
            },
            scales: {
                r: {
                    angleLines: {
                        display: true
                    },
                    suggestedMin: 0,
                    suggestedMax: 100
                }
            }
        }
    });
}
