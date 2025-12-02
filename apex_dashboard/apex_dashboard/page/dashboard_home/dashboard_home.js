frappe.pages['dashboard_home'].on_page_load = function (wrapper) {
    var page = frappe.ui.make_app_page({
        parent: wrapper,
        title: 'Dashboard Home',
        single_column: true
    });

    // Hide page header
    page.$title_area.hide();

    // Initialize all widgets
    initializeProfile();
    initializeDigitalClock();
    initializeWorldClocks();
    initializeMainAnalogClock();
    initializeHolidays();
    initializeNotes();
}

function initializeProfile() {
    const nameEl = document.querySelector('#user-name');
    const emailEl = document.querySelector('#user-email');
    const imgEl = document.querySelector('#user-avatar');

    if (frappe.session) {
        const fullName = frappe.session.user_fullname || frappe.boot.user.full_name;
        const email = frappe.session.user;

        if (nameEl) nameEl.textContent = fullName;
        if (emailEl) emailEl.textContent = email;

        let avatar = frappe.boot.user.image || frappe.user_info(frappe.session.user).image;
        if (!avatar || avatar.includes('default-avatar')) {
            avatar = "https://ui-avatars.com/api/?name=" + encodeURIComponent(fullName) + "&background=random";
        }
        if (imgEl) imgEl.src = avatar;
    }
}

function initializeDigitalClock() {
    const timeEl = document.querySelector('#digital-time');
    const dateEl = document.querySelector('#digital-date');

    function updateClock() {
        const now = new Date();
        let hours = now.getHours();
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const seconds = String(now.getSeconds()).padStart(2, '0');
        const ampm = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12;
        hours = hours ? hours : 12;

        if (timeEl) timeEl.innerHTML = `${hours}:${minutes}:${seconds} <span class="clock-ampm">${ampm}</span>`;

        const options = { weekday: 'short', year: 'numeric', month: 'long', day: 'numeric' };
        if (dateEl) dateEl.textContent = now.toLocaleDateString('en-US', options);
    }
    setInterval(updateClock, 1000);
    updateClock();
}

function initializeWorldClocks() {
    function updateChinaClock() {
        const now = new Date();
        const chinaTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Shanghai' }));
        const hours = chinaTime.getHours();
        const minutes = chinaTime.getMinutes();
        const seconds = chinaTime.getSeconds();

        const hourHand = document.querySelector('#china-hour');
        const minuteHand = document.querySelector('#china-minute');
        const secondHand = document.querySelector('#china-second');

        if (hourHand) {
            const hourDeg = (hours % 12) * 30 + minutes * 0.5;
            hourHand.style.transform = `translateX(-50%) rotate(${hourDeg}deg)`;
        }
        if (minuteHand) {
            const minuteDeg = minutes * 6;
            minuteHand.style.transform = `translateX(-50%) rotate(${minuteDeg}deg)`;
        }
        if (secondHand) {
            const secondDeg = seconds * 6;
            secondHand.style.transform = `translateX(-50%) rotate(${secondDeg}deg)`;
        }
    }

    function updateGermanyClock() {
        const now = new Date();
        const germanyTime = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Berlin' }));
        const hours = germanyTime.getHours();
        const minutes = germanyTime.getMinutes();
        const seconds = germanyTime.getSeconds();

        const hourHand = document.querySelector('#germany-hour');
        const minuteHand = document.querySelector('#germany-minute');
        const secondHand = document.querySelector('#germany-second');

        if (hourHand) {
            const hourDeg = (hours % 12) * 30 + minutes * 0.5;
            hourHand.style.transform = `translateX(-50%) rotate(${hourDeg}deg)`;
        }
        if (minuteHand) {
            const minuteDeg = minutes * 6;
            minuteHand.style.transform = `translateX(-50%) rotate(${minuteDeg}deg)`;
        }
        if (secondHand) {
            const secondDeg = seconds * 6;
            secondHand.style.transform = `translateX(-50%) rotate(${secondDeg}deg)`;
        }
    }

    setInterval(updateChinaClock, 1000);
    setInterval(updateGermanyClock, 1000);
    updateChinaClock();
    updateGermanyClock();
}

function initializeMainAnalogClock() {
    const hourHand = document.querySelector('#hour-hand');
    const minuteHand = document.querySelector('#minute-hand');
    const secondHand = document.querySelector('#second-hand');
    const marksGroup = document.querySelector('#minute-marks');

    if (marksGroup && !marksGroup.hasChildNodes()) {
        for (let i = 0; i < 60; i++) {
            const angle = i * 6;
            const isHourMark = i % 5 === 0;
            const length = isHourMark ? 10 : 5;
            const width = isHourMark ? 2 : 1;
            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.setAttribute('x1', '100');
            line.setAttribute('y1', '10');
            line.setAttribute('x2', '100');
            line.setAttribute('y2', String(10 + length));
            line.setAttribute('stroke', '#2c3e50');
            line.setAttribute('stroke-width', String(width));
            line.setAttribute('transform', `rotate(${angle} 100 100)`);
            marksGroup.appendChild(line);
        }
    }

    function updateAnalog() {
        const now = new Date();
        const seconds = now.getSeconds();
        const minutes = now.getMinutes();
        const hours = now.getHours();
        const secondDegrees = ((seconds / 60) * 360);
        const minuteDegrees = ((minutes / 60) * 360) + ((seconds / 60) * 6);
        const hourDegrees = ((hours / 12) * 360) + ((minutes / 60) * 30);
        if (secondHand) secondHand.style.transform = `translateX(-50%) rotate(${secondDegrees}deg)`;
        if (minuteHand) minuteHand.style.transform = `translateX(-50%) rotate(${minuteDegrees}deg)`;
        if (hourHand) hourHand.style.transform = `translateX(-50%) rotate(${hourDegrees}deg)`;
    }
    setInterval(updateAnalog, 1000);
    updateAnalog();
}

function initializeHolidays() {
    const holidays = [
        { name: "New Year's Day", date: "Thursday, January 1st 2026" },
        { name: "Coptic Christmas", date: "Wednesday, January 7th 2026" },
        { name: "Revolution Day (Jan 25)", date: "Sunday, January 25th 2026" },
        { name: "Eid al-Fitr", date: "Friday, March 20th 2026" },
        { name: "Coptic Easter", date: "Sunday, April 12th 2026" },
        { name: "Sinai Liberation Day", date: "Saturday, April 25th 2026" },
        { name: "Labour Day", date: "Friday, May 1st 2026" },
        { name: "Eid al-Adha", date: "Wednesday, May 27th 2026" },
        { name: "Islamic New Year", date: "Wednesday, July 1st 2026" },
        { name: "Revolution Day (July 23)", date: "Thursday, July 23rd 2026" },
        { name: "Prophet's Birthday", date: "Thursday, August 27th 2026" },
        { name: "Armed Forces Day", date: "Thursday, October 8th 2026" }
    ];

    let currentIndex = 0;
    const nameEl = document.querySelector('.holiday-name');
    const dateEl = document.querySelector('.holiday-date');
    const prevBtn = document.querySelector('#prev-btn');
    const nextBtn = document.querySelector('#next-btn');

    function updateDisplay() {
        if (nameEl) nameEl.textContent = holidays[currentIndex].name;
        if (dateEl) dateEl.textContent = holidays[currentIndex].date;
    }

    if (prevBtn) {
        prevBtn.addEventListener('click', () => {
            currentIndex = (currentIndex - 1 + holidays.length) % holidays.length;
            updateDisplay();
        });
    }

    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            currentIndex = (currentIndex + 1) % holidays.length;
            updateDisplay();
        });
    }

    updateDisplay();
}

function initializeNotes() {
    const textarea = document.querySelector('#apex-notes-area');
    const saveBtn = document.querySelector('#save-notes-btn');
    const clearBtn = document.querySelector('#clear-notes-btn');
    const userId = frappe.session.user;
    const storageKey = `apex_dashboard_notes_${userId}`;

    if (textarea) {
        const savedNotes = localStorage.getItem(storageKey) || '';
        textarea.value = savedNotes;

        let saveTimeout;
        textarea.addEventListener('input', function () {
            clearTimeout(saveTimeout);
            saveTimeout = setTimeout(function () {
                localStorage.setItem(storageKey, textarea.value);
            }, 1000);
        });
    }

    if (saveBtn) {
        saveBtn.addEventListener('click', function () {
            if (textarea) {
                localStorage.setItem(storageKey, textarea.value);
                frappe.show_alert({ message: 'Notes saved!', indicator: 'green' }, 2);
            }
        });
    }

    if (clearBtn) {
        clearBtn.addEventListener('click', function () {
            if (confirm('Clear all notes?')) {
                if (textarea) {
                    textarea.value = '';
                    localStorage.removeItem(storageKey);
                    frappe.show_alert({ message: 'Notes cleared!', indicator: 'blue' }, 2);
                }
            }
        });
    }
}
