// ============================================
// CALENDAR.JS - MODAL DE CALENDÁRIO
// ============================================

let calendarYear = new Date().getFullYear();

const mesesNomes = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

// Função para abrir/fechar modal de calendário
window.toggleCalendar = function() {
    const modal = document.getElementById('calendarModal');
    if (!modal) return;
    
    if (modal.classList.contains('show')) {
        modal.classList.remove('show');
    } else {
        renderCalendarMonths();
        modal.classList.add('show');
    }
};

// Função para mudar o ano no calendário
window.changeCalendarYear = function(direction) {
    calendarYear += direction;
    document.getElementById('calendarYear').textContent = calendarYear;
    renderCalendarMonths();
};

// Função para renderizar os meses do calendário
function renderCalendarMonths() {
    const container = document.getElementById('calendarMonths');
    if (!container) return;
    
    container.innerHTML = '';
    
    mesesNomes.forEach((mes, index) => {
        const monthDiv = document.createElement('div');
        monthDiv.className = 'calendar-month';
        monthDiv.textContent = mes;
        
        // Marcar mês atual se for o ano corrente
        if (calendarYear === new Date().getFullYear() && index === new Date().getMonth()) {
            monthDiv.classList.add('current');
        }
        
        // Ao clicar, seleciona o mês e fecha o modal
        monthDiv.onclick = () => selectMonth(index);
        
        container.appendChild(monthDiv);
    });
}

// Função para selecionar um mês
function selectMonth(monthIndex) {
    // Verifica se as variáveis globais existem
    if (typeof currentMonth !== 'undefined' && typeof currentYear !== 'undefined') {
        currentMonth = monthIndex;
        currentYear = calendarYear;
        
        // Atualiza a interface se as funções existirem
        if (typeof updateMonthDisplay === 'function') {
            updateMonthDisplay();
        }
    }
    
    // Fecha o modal
    toggleCalendar();
}

// Fechar modal ao clicar fora dele
document.addEventListener('click', function(e) {
    const modal = document.getElementById('calendarModal');
    if (modal && e.target === modal) {
        toggleCalendar();
    }
});
