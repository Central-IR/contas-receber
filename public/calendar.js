// ============================================
// CALENDAR.JS - SELETOR DE MÊS E ANO
// ============================================

let calendarYear = new Date().getFullYear();

const mesesNomes = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

window.openCalendar = function() {
    const modal = document.getElementById('calendarModal');
    if (modal) {
        modal.classList.add('show');
        renderCalendar();
    }
};

window.closeCalendar = function() {
    const modal = document.getElementById('calendarModal');
    if (modal) {
        modal.classList.remove('show');
    }
};

window.changeCalendarYear = function(direction) {
    calendarYear += direction;
    document.getElementById('calendarYear').textContent = calendarYear;
    renderCalendar();
};

function renderCalendar() {
    const container = document.getElementById('calendarMonths');
    if (!container) return;

    let html = '';
    for (let i = 0; i < 12; i++) {
        const isCurrent = i === currentMonth && calendarYear === currentYear;
        html += `
            <div class="calendar-month ${isCurrent ? 'current' : ''}" onclick="selectMonth(${i}, ${calendarYear})">
                ${mesesNomes[i]}
            </div>
        `;
    }
    container.innerHTML = html;
}

window.selectMonth = function(month, year) {
    currentMonth = month;
    currentYear = year;
    updateDisplay();
    closeCalendar();
};

// Fechar modal ao clicar fora
document.addEventListener('click', (e) => {
    const modal = document.getElementById('calendarModal');
    if (modal && e.target === modal) {
        closeCalendar();
    }
});
