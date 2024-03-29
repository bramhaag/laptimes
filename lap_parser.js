const TAB_CONTENT = {
    "practice": {
        name: "Practice Session",
        sessions: ["Practice"]
    },
    "race": {
        name: "Race",
        sessions: ["Qualifying", "Race"]
    }
}

const LAPTIME_FORMAT = "HH:mm:ss.SSS";
const TIMESTAMP_FORMAT = "HH:mm:ss";
const SUBTITLE_FORMAT = "HH:mm:ss,SSS";

const MIN_CHAPTER_LENGTH = 10;

const OFFSET_PATTERN = "(\s+)?([0-9]{1,2}:)?[0-9]{1,2}(\s+)?"
const LAP_PATTERN = "(\s+)?([0-9]{1,2}:)?[0-9]{1,2}(\.[0-9]+)?(\s+)?"

let currentTab;

onload = () => {
    initializeTabs();
}

function initializeTabs() {
    let tabs = document.getElementById("tabs-list");

    for (const [id, type] of Object.entries(TAB_CONTENT)) {
        let tab = document.createElement("li")
        tab.id = `tab-${id}`;
        tab.onclick = () => setTab(id);

        let text = document.createElement("a")
        text.textContent = type.name;

        tab.appendChild(text);
        tabs.appendChild(tab);
    }

    setTab("practice");
}

function setTab(id) {
    // Set active tab
    let tabs = document.getElementById("tabs-list");
    tabs.querySelectorAll("li").forEach((elem) => {
        elem.className = elem.id === `tab-${id}` ? "is-active" : "";
    });

    // Clear
    let sessionParent = document.getElementById("sessions");
    sessionParent.innerHTML = "";

    let resultText = document.getElementById("result-text");
    resultText.value = "";

    // Populate
    let sessions = TAB_CONTENT[id].sessions;
    sessions.forEach((sessionName) => {
        let session = document.getElementById("session").content.cloneNode(true);

        let sessionTitle = session.querySelector("h1");
        sessionTitle.textContent = sessionName;

        let sessionSection = session.querySelector("section");
        sessionSection.id = `session-${sessionName}`;

        addOffsetInput(sessionSection, sessionName);
        addLapInput(sessionSection, sessionName, 0);

        let sessionCsv = session.querySelector("input");
        sessionCsv.onchange = () => parseCsv(sessionCsv, sessionSection, sessionName);

        let sessionCsvButton = session.querySelector("a");
        sessionCsvButton.onclick = () => sessionCsv.click();

        sessionParent.appendChild(session);
    });

    currentTab = id;
}

function addLaps(parent, session, laps, lapOffset = 0) {
    for (let i = 0; i < laps.length; i++) {
        let input = addLapInput(parent, session, lapOffset + i);
        input.value = laps[i];
    }
}

function addOffsetInput(parent, session) {
    return addInput(parent, `${session}-offset`, "Time before start", {
        helpPattern: OFFSET_PATTERN,
        helpMessage: "Invalid offset time! Valid format: (minutes):[seconds]. For example: 40 or 1:32"
    })
}

function addLapInput(parent, session, i) {
    let input = addInput(parent, `${session}-lap-${i}`, `Lap ${i + 1}`, {
        helpPattern: LAP_PATTERN,
        helpMessage: "Invalid lap time! Valid format: (minutes):[seconds]:(milliseconds). For example: 40.983 or 1:32.987"
    });

    input.oninput = () => {
        addLapInput(parent, session, i + 1);
    }

    input.onpaste = (e) => {
        // Stop data actually being pasted into div
        e.stopPropagation();
        e.preventDefault();

        // Get pasted data via clipboard API
        let clipboardData = e.clipboardData || window.clipboardData;
        let pastedData = clipboardData.getData('Text');

        addLaps(parent, session, pastedData.trim().split(/\s+/), i);
    }

    return input;
}

function addInput(parent, id, title, options = {}) {
    let existingInput = document.getElementById(id);
    if (existingInput !== null) {
        return existingInput;
    }

    let inputGroup = document.getElementById("lap-input").content.cloneNode(true);

    // Set the label value
    let label = inputGroup.querySelector("label");
    label.htmlFor = id;
    label.textContent = title

    // Set the input ID
    let input = inputGroup.querySelector("input");
    input.id = id;

    if (options.helpPattern !== undefined) {
        input.pattern = options.helpPattern;

        let helpText = inputGroup.querySelector("p.help");
        helpText.textContent = options.helpMessage;

        input.onchange = () => {
            if (input.validity.valid) {
                input.classList.remove("is-danger");
                helpText.classList.add("is-hidden");
            } else {
                input.classList.add("is-danger");
                helpText.classList.remove("is-hidden");
            }
        }
    }

    parent.appendChild(inputGroup);

    return input;
}

function parseCsv(input, parent, session) {
    let files = input.files;
    if (files.length === 0) {
        return;
    }

    Papa.parse(files[0], {
        header: true,
        complete: (results) => {
            let laps = results.data
                .map(lap => lap["Lap Time"])

            addLaps(parent, session, laps);
        }
    })
}

function generateDescription() {
    let laps = parseLaps(TAB_CONTENT[currentTab].sessions);

    if (laps[0].end.minusDuration(laps[0].start).minusSeconds(MIN_CHAPTER_LENGTH).isNegative()) {
        laps[1].start = Duration.ZERO;
    }

    document.getElementById("result-text").value = laps
        .filter(lap => !lap.end.minusDuration(lap.start).minusSeconds(MIN_CHAPTER_LENGTH).isNegative())
        .map(lap => `${toHuman(lap.start, TIMESTAMP_FORMAT, false)} ${lap.description}`)
        .join("\n");
}

function generateSubtitles() {
    let subtitles = parseLaps(TAB_CONTENT[currentTab].sessions)
        .map((lap, i) => `${i+1}\n${toHuman(lap.start, SUBTITLE_FORMAT, false)} --> ${toHuman(lap.end, SUBTITLE_FORMAT, false)}\n${lap.description}`)
        .join("\n\n");

    let fileName = `subtitles_${currentTab}_${LocalDateTime.now().truncatedTo(ChronoUnit.SECONDS).toString().replace("T", "_")}.srt`

    let downloadElement = document.createElement('a');
    downloadElement.setAttribute('href', 'data:text/srt;charset=utf-8,' + encodeURIComponent(subtitles));
    downloadElement.setAttribute('download', fileName);

    downloadElement.style.display = 'none';
    document.body.appendChild(downloadElement);

    downloadElement.click();

    document.body.removeChild(downloadElement);
}

function parseLaps(sessions) {
    let result = [];
    let currentTime = Duration.ZERO;

    sessions.forEach((session) => {
        let offsetStart = currentTime;
        currentTime = getOffset(session);

        result.push({
            start: offsetStart,
            end: currentTime,
            description: `Start of ${session}`
        });

        let lapTimes = Array.from(document.querySelectorAll(`input[type=text][id^=${session}-lap]`))
            .map(input => input.value.trim())
            .filter(input => input !== "")
            .map(input => toDuration(input));

        let fastestLap = getFastestLap(lapTimes);

        for (const [i, lapTime] of lapTimes.entries()) {
            let lapStart = currentTime;
            currentTime = lapStart.plusDuration(lapTime);

            let deltaFastest = fastestLap.compareTo(lapTime) === 0 ? "Fastest Lap" : "+" + toHuman(lapTime.minusDuration(fastestLap), LAPTIME_FORMAT);

            result.push({
                start: lapStart,
                end: currentTime,
                description: `Lap ${i + 1}: ${toHuman(lapTime, LAPTIME_FORMAT)} (${deltaFastest})`
            });
        }
    })

    return result;
}

function getOffset(session) {
    try {
        return toDuration(document.getElementById(`${session}-offset`).value.trim());
    } catch (e) {
        return Duration.ZERO;
    }
}

function getFastestLap(lapTimes) {
    return [...lapTimes].sort((a, b) => a.compareTo(b))[0];
}

function toHuman(duration, format, truncate = true) {
    let timeString = LocalTime.ofNanoOfDay(duration.toNanos()).format(DateTimeFormatter.ofPattern(format));

    while (truncate && timeString.startsWith("00:")) {
        timeString = timeString.substring(3);
    }

    return timeString;
}

function toDuration(input) {
    // Pad parts with 0s
    parts = input.split(":");
    input = parts.map(s => (s.includes(".") ? s.indexOf(".") : s.length) == 1 ? `0${s}` : s).join(":");

    // Add missing 0s
    padding = 2 - (parts.length - 1);
    input = "00:".repeat(padding) + input

    // Calculate duration ((parsed input) - 0:00)
    return Duration.between(LocalTime.MIDNIGHT, LocalTime.parse(input));
}

function copyText() {
    document.getElementById("result-text").select();
    document.execCommand('copy');
}

function clearLaps() {
    setTab(currentTab);
}