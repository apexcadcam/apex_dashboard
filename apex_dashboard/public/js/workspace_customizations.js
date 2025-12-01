frappe.router.on('change', () => {
    checkAndInitApexWidgets();
});

$(document).on('page-change', function () {
    checkAndInitApexWidgets();
});

function checkAndInitApexWidgets() {
    const route = frappe.get_route();
    if (route[0] === 'app' && route[1] === 'apex-dashboards-hub') {
        // Wait for DOM to be ready
        setTimeout(initApexDashboardWidgets, 500);
        // Retry a few times in case of slow loading
        setTimeout(initApexDashboardWidgets, 1500);
        setTimeout(initApexDashboardWidgets, 3000);
    }
}

function initApexDashboardWidgets() {
    // 1. Clock Widget
    if ($('#apex-clock-digital').length && !window.apexClockInterval) {
        console.log("Initializing Apex Clock");

        function updateClock() {
            const now = new Date();

            // Digital
            const hours = String(now.getHours()).padStart(2, '0');
            const minutes = String(now.getMinutes()).padStart(2, '0');
            $('#apex-clock-time').text(`${hours}:${minutes}`);

            const days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
            const months = ['Jan.', 'Feb.', 'Mar.', 'Apr.', 'May', 'Jun.', 'Jul.', 'Aug.', 'Sep.', 'Oct.', 'Nov.', 'Dec.'];
            const dayName = days[now.getDay()];
            const monthName = months[now.getMonth()];
            const day = now.getDate();
            $('#apex-clock-date').text(`${dayName}, ${monthName} ${day}`);

            // Analog
            const h = now.getHours() % 12;
            const m = now.getMinutes();
            const s = now.getSeconds();

            const hAngle = (h * 30) + (m * 0.5);
            const mAngle = m * 6;
            const sAngle = s * 6;

            $('#apex-hand-hour').css('transform', `rotate(${hAngle}deg)`);
            $('#apex-hand-minute').css('transform', `rotate(${mAngle}deg)`);
            $('#apex-hand-second').css('transform', `rotate(${sAngle}deg)`);
        }

        updateClock();
        window.apexClockInterval = setInterval(updateClock, 1000);

        // Toggle Buttons
        $('#apex-clock-toggle').off('click').on('click', function () {
            $('#apex-clock-digital').hide();
            $('#apex-clock-analog').addClass('active').css('display', 'flex');
        });

        $('#apex-clock-toggle-back').off('click').on('click', function () {
            $('#apex-clock-analog').removeClass('active').hide();
            $('#apex-clock-digital').show();
        });
    }

    // 2. Calendar Widget
    if ($('#apex-cal-grid').length && $('#apex-cal-grid').is(':empty')) {
        console.log("Initializing Apex Calendar");
        renderApexCalendar();
    }

    // 3. Notes Widget
    if ($('#apex-notes-area').length && !$('#apex-notes-area').data('initialized')) {
        console.log("Initializing Apex Notes");
        initApexNotes();
    }
}

function renderApexCalendar() {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const today = now.getDate();
    const months = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'];

    $('#apex-cal-month').text(months[currentMonth]);

    const firstDay = new Date(currentYear, currentMonth, 1).getDay();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(currentYear, currentMonth, 0).getDate();

    let calendarHtml = '';

    for (let i = firstDay - 1; i >= 0; i--) {
        const day = daysInPrevMonth - i;
        calendarHtml += `<div class="calendar-day other-month">${day}</div>`;
    }

    for (let day = 1; day <= daysInMonth; day++) {
        const isToday = day === today;
        calendarHtml += `<div class="calendar-day ${isToday ? 'today' : ''}">${day}</div>`;
    }

    const totalCells = firstDay + daysInMonth;
    const remaining = 42 - totalCells;

    for (let day = 1; day <= remaining; day++) {
        calendarHtml += `<div class="calendar-day other-month">${day}</div>`;
    }

    $('#apex-cal-grid').html(calendarHtml);
}

function initApexNotes() {
    const textarea = $('#apex-notes-area');
    textarea.data('initialized', true);

    // Load notes
    const notes = localStorage.getItem('apex_workspace_notes') || '';
    textarea.val(notes);

    // Stop propagation to prevent search bar focus
    textarea.on('keydown', function (e) {
        e.stopPropagation();
    });

    // Auto-save
    let saveTimeout;
    textarea.on('input', function () {
        clearTimeout(saveTimeout);
        saveTimeout = setTimeout(saveApexNotes, 1000);
    });

    // Buttons
    // Note: We used onclick in HTML, but we can override/attach here for safety
    window.saveApexNotes = function () {
        localStorage.setItem('apex_workspace_notes', textarea.val());
        frappe.show_alert({ message: 'Notes saved', indicator: 'green' }, 2);
    };

    window.clearApexNotes = function () {
        if (confirm('Clear all notes?')) {
            textarea.val('');
            localStorage.removeItem('apex_workspace_notes');
            frappe.show_alert({ message: 'Notes cleared', indicator: 'blue' }, 2);
        }
    };
}
