const defaultFormSize = 5;
let lastInput = -1;

function initializeForm() {
    const form = document.getElementById("laps");
    addInput(form, "offset", "Time before start");
    addLapInput(form, 0);

    form.onsubmit = () => generateLapTimes(form);
}

function addLapInput(form, i) {
    let input = addInput(form, `lap-${i}`, `Lap ${i + 1}`);
    lastInput = i;
    input.oninput = () => {
        if (lastInput < i + 1) {
            addLapInput(form, i + 1);
        }
    }

    input.onpaste = (e) => {
        var clipboardData, pastedData;

        // Stop data actually being pasted into div
        e.stopPropagation();
        e.preventDefault();
    
        // Get pasted data via clipboard API
        clipboardData = e.clipboardData || window.clipboardData;
        pastedData = clipboardData.getData('Text');

        let laps = pastedData.trim().split(/\s+/);
        input.value = laps[0];
        for (let j = 1; j < laps.length; j++) {
            addLapInput(form, i + j).value = laps[j];
        }
    }

    return input;
}

function addInput(form, id, text) {
    let fieldSet = form.querySelector("fieldset");
    let submitButton = fieldSet.querySelector("#submit-button");

    let inputGroup = document.getElementById("input-group").content.cloneNode(true);

    let label = inputGroup.querySelector("label");
    label.htmlFor = id;
    label.textContent = text

    let input = inputGroup.querySelector("input");
    input.id = id;

    fieldSet.insertBefore(inputGroup, submitButton);

    return input;
}

function generateLapTimes(form) {
    let inputs = form.querySelectorAll("fieldset > div.pure-control-group > input[type=text][id^='lap']");
    inputs = Array.from(inputs); // Convert 'inputs' into a real array

    let offsetInput = form.querySelector("fieldset > div.pure-control-group > input[type=text][id='offset']");

    let firstEmpty = -1;
    for (let i = 0; i < inputs.length; i++) {
        let input = inputs[i];
        let value = input.value;

        if (value === "" && i == 0) {
            console.log("Fill in something");
            return false;
        }

        if (value === "" && firstEmpty === -1) {
            firstEmpty = i;
            continue;
        }

        if (value !== "" && firstEmpty !== -1) {
            for (let j = firstEmpty; j < i; j++) {
                console.log("Fill in " + j);
            }

            return false;
        }
    }

    let lapTimes = inputs
        .filter(input => input.value !== "")
        .map(a => {console.log(a); return a;})
        .map(input => input.value.trim())
        .map(a => {console.log(a); return a;})
        .map(value => formatDuration(value))
        .map(a => {console.log(a); return a;})
        .map(duration => Duration.parse(duration))
        .map(a => {console.log(a); return a;})
        ;

    console.log(lapTimes);


    let fastestLap = [...lapTimes].sort((a, b) => a.compareTo(b))[0];

    let offset = offsetInput.value.trim() === "" ? Duration.ZERO : Duration.parse(formatDuration(offsetInput.value.trim()));
    let currentTime = offset;
    let result = "00:00:00 Start\n";

    for (let i = 0; i < lapTimes.length; i++) {
        let time = lapTimes[i];

        let timestamp = prettyDuration(currentTime, "HH:mm:ss");
        let laptime = prettyDuration(time, "mm:ss.SSS");
        let fastestLapOffset = fastestLap.compareTo(time) === 0
            ? "Fastest Lap" : "+" + prettyDuration(time.minusDuration(fastestLap), "ss.SSS");

        result += `${timestamp} Lap ${i + 1}: ${laptime} (${fastestLapOffset})\n`
        console.log("new")
        console.log(time);
        console.log(currentTime)
        currentTime = currentTime.plusDuration(time);
        console.log(currentTime);
    }

    document.getElementById("result-text").value = result;


    return false;
}

function formatDuration(time) {

    return `PT${time.replace(":", "M")}S`
}

function prettyDuration(duration, format) {
    return LocalTime.ofNanoOfDay(duration.toNanos()).format(DateTimeFormatter.ofPattern(format));
}

function copyText(e) {
    document.getElementById("result-text").select();
    document.execCommand('copy');
}

onload = function () { initializeForm(); }