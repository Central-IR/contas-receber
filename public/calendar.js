// ============================================
// CALENDÁRIO
// ============================================
let calendarYear = new Date().getFullYear();

window.toggleCalendar = function() {
    const modal = document.getElementById('calendarModal');
    if (modal.classList.contains('show')) {
        modal.classList.remove('show');
    } else {
        calendarYear = currentYear;
        updateCalendarView();
        modal.classList.add('show');
    }
};

window.changeCalendarYear = function(direction) {
    calendarYear += direction;
    updateCalendarView();
};

function updateCalendarView() {
    document.getElementById('calendarYear').textContent = calendarYear;
    
    const monthsContainer = document.getElementById('calendarMonths');
    
    monthsContainer.innerHTML = meses.map((mes, index) => {
        const isCurrent = index === currentMonth && calendarYear === currentYear;
        return `
            <div class="calendar-month ${isCurrent ? 'current' : ''}" onclick="selectMonth(${index})">
                ${mes}
            </div>
        `;
    }).join('');
}

window.selectMonth = function(monthIndex) {
    currentMonth = monthIndex;
    currentYear = calendarYear;
    updateMonthDisplay();
    toggleCalendar();
};

// Fechar calendário ao clicar fora
document.addEventListener('click', (e) => {
    const calendarModal = document.getElementById('calendarModal');
    const calendarBtn = document.querySelector('.calendar-btn');
    
    if (calendarModal && calendarModal.classList.contains('show')) {
        if (!calendarModal.contains(e.target) && !calendarBtn.contains(e.target)) {
            toggleCalendar();
        }
    }
});
