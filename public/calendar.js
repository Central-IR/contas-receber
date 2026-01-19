// ============================================
// CALENDAR MODAL - CONTAS A RECEBER
// ============================================

let calendarYear = new Date().getFullYear();

const monthNames = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 
    'Maio', 'Junho', 'Julho', 'Agosto', 
    'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

// ============================================
// TOGGLE CALENDAR MODAL
// ============================================
window.toggleCalendar = function() {
    const modal = document.getElementById('calendarModal');
    if (!modal) return;
    
    if (modal.classList.contains('show')) {
        modal.classList.remove('show');
    } else {
        calendarYear = currentMonth.getFullYear();
        renderCalendar();
        modal.classList.add('show');
    }
};

// ============================================
// CHANGE CALENDAR YEAR
// ============================================
window.changeCalendarYear = function(direction) {
    calendarYear += direction;
    renderCalendar();
};

// ============================================
// RENDER CALENDAR
// ============================================
function renderCalendar() {
    const yearElement = document.getElementById('calendarYear');
    const monthsContainer = document.getElementById('calendarMonths');
    
    if (!yearElement || !monthsContainer) return;
    
    yearElement.textContent = calendarYear;
    
    const currentYear = currentMonth.getFullYear();
    const currentMonthIndex = currentMonth.getMonth();
    
    monthsContainer.innerHTML = monthNames.map((month, index) => {
        const isCurrent = calendarYear === currentYear && index === currentMonthIndex;
        return `
            <div class="calendar-month ${isCurrent ? 'current' : ''}" 
                 onclick="selectMonth(${index})">
                ${month}
            </div>
        `;
    }).join('');
}

// ============================================
// SELECT MONTH
// ============================================
window.selectMonth = function(monthIndex) {
    currentMonth = new Date(calendarYear, monthIndex, 1);
    updateDisplay();
    toggleCalendar();
};

// ============================================
// CLOSE MODAL ON OUTSIDE CLICK
// ============================================
document.addEventListener('click', function(event) {
    const modal = document.getElementById('calendarModal');
    if (!modal) return;
    
    const calendarContent = modal.querySelector('.calendar-content');
    const calendarBtn = event.target.closest('.calendar-btn[onclick="toggleCalendar()"]');
    
    if (modal.classList.contains('show') && 
        !calendarContent.contains(event.target) && 
        !calendarBtn) {
        toggleCalendar();
    }
});

// ============================================
// CLOSE MODAL ON ESC KEY
// ============================================
document.addEventListener('keydown', function(event) {
    const modal = document.getElementById('calendarModal');
    if (!modal) return;
    
    if (event.key === 'Escape' && modal.classList.contains('show')) {
        toggleCalendar();
    }
});

console.log('✅ Calendar.js carregado');
