
var currentElement = "";
var currentMode = "default";
var storageResultGlobal = {};
// var serverUrl = "http://127.0.0.1:5000";
var serverUrl = "https://live.pureauth.io";
// var serverUrl = "https://dev.pureauth.tech";
var registerUrl = "/api/v1/browser-extension/register";
var verifyUrl = "/api/v1/browser-extension/verify";
var refreshTokenUrl = "/api/v1/browser-extension/refresh-token";
var qrTimer;


class UI {
    constructor () {}
    static hideElement(elementId) {
        try {
            let element = document.getElementById(elementId);
            if (!element) return;
            element.classList.add("hidden");
        } catch { }
    }

    static showElement(elementId, push = true) {
        try {
            let element = document.getElementById(elementId);
            if (!element) return;
            element.classList.remove("hidden");
            if (push)
                currentElement = elementId;
        } catch {
            console.log("ERROR")
        }
    }

    static showElementError(message, push = true) {
        try {
            let element = document.getElementById("display-error");
            let messageElement = document.getElementById("error-text");
            if (!element) return;
            if (!messageElement) return;
            messageElement.innerText = message;
            element.classList.remove("hidden");
            if (push)
                currentElement = element;
        } catch (e) {
            console.log("ERROR")
        }
    }

    static showElementSuccess(message, push = true) {
        try {
            let element = document.getElementById("display-success");
            let messageElement = document.getElementById("success-text");
            if (!element) return;
            if (!messageElement) return;
            messageElement.innerText = message;
            element.classList.remove("hidden");
            if (push)
                currentElement = element;
        } catch (e) {
            console.log("ERROR")
        }
    }

    static highlightRefreshButton() {
        try {
            let element = document.getElementById("refresh");
            if (!element) return;
            element.classList.remove("btn-icon");
            element.classList.add("btn-icon-hl");
        } catch {
            console.log("ERROR")
        }
    }

    static unHighlightRefreshButton(message, push = true) {
        try {
            let element = document.getElementById("refresh");
            if (!element) return;
            element.classList.remove("btn-icon-hl");
            element.classList.add("btn-icon");
        } catch {
            console.log("ERROR")
        }
    }

    static reloadExtension () {
        window.location.reload();
    }
}

class Utils {
    constructor () {}
    static async getEmployeeId(corporate_email, org_id) {
        let message = `corp:email:${org_id}:${corporate_email}`
        const msgUint8 = new TextEncoder().encode(message);                           // encode as (utf-8) Uint8Array
        const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);           // hash the message
        const hashArray = Array.from(new Uint8Array(hashBuffer));                     // convert buffer to byte array
        const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join(''); // convert bytes to hex string
        return hashHex;
    }

    static countDown (interval) {
        let i = interval - 2;
        const expiry_timer = document.getElementById("expiry-time");
        qrTimer = setInterval(() => {
            if (i <= 0) {
                Utils.clearAllIntervals();
                UI.hideElement("register-form-parent");
                UI.showElement("register-qr-expired-status");
                UI.hideElement("register-qrcode");
                UI.hideElement("countdown-text");
                UI.highlightRefreshButton();
                // UI.reloadExtension();
            }
            expiry_timer.innerText = i;
            i--;
        }, 1000);
    }

    static clearAllIntervals () {
        clearInterval(qrTimer);
    }
}


function generateQrInExtension(storageResult) {
    let qrData = storageResult.qr_data;
    console.log(storageResult.mode);
    if (storageResult.mode == "registered") {
        let qrDataWithoutMode = qrData.split(":")[1];
        let healthCheckData = JSON.parse(atob(qrDataWithoutMode));
        let machineIdHash = storageResult.token;
        healthCheckData["ruqo"] = {
            "machine_id_hash": machineIdHash,
            "total_score": "0",
            "trust_level": "low",
            "version": "1.0.0"
        }
        qrData = "1:" + btoa(JSON.stringify(healthCheckData));
    }
    console.log(qrData);
    var qrDiv = document.getElementById("qrcode");
    var qrcode = new QRCode(qrDiv, {
        text: qrData,
        width: 340,
        height: 340,
        border: 4,
        colorDark: "#000000",
        colorLight: "#ffffff",
        correctLevel: QRCode.CorrectLevel.L
    });
    qrDiv.title = "";
    UI.showElement("display-default-login");
}

function showLoginDisplays(storageResult) {
    let qrData = storageResult.qr_data;
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        const currentTab = tabs[0];
        if (!(currentTab && currentTab.url)) {
            UI.showElement("display-not-on-pureauth");
            return;
        }
        if (currentTab.url.startsWith("https://live.pureauth.io") || currentTab.url.startsWith("https://dev.pureauth.tech")) {
            if (qrData == null) {
                UI.showElement("display-wait-for-qr");
                return;
            } else {
                generateQrInExtension(storageResult);
                return;
            }
        }
        else {
            UI.showElement("display-not-on-pureauth");
            return;
        }
    });
}

async function showUI(storageResult) {
    storageResultGlobal = storageResult;
    if (storageResult.mode) {
        currentMode = storageResult.mode;
    } else {
        chrome.storage.sync.set({ "mode": "registered" });
        // Force registered mode.
        UI.reloadExtension();
        UI.showElement("display-set-initial-mode");
        return;
    }
    if (storageResult.mode == "registered") {
        if (!(storageResult.corporate_email && storageResult.corporate_email)) {
            UI.showElement("display-get-orgid-corpemail");
        }
        else if (!storageResult.token) {
            UI.showElement("display-wait");
            let challenge = await getChallengeQrFromPureAUTH(storageResult.corporate_email, storageResult.org_id);
            if (challenge) {
                UI.hideElement("display-wait");
                generateRegistrationQrInExtension(challenge);
            }
        }
        else {
            try{
                let splitToken = storageResult.token.split(".")
                if (splitToken.length == 3){
                    let data = JSON.parse(atob(splitToken[1]));
                    if (!data["id"]) {
                        let token = await refreshToken(
                            storageResult.corporate_email,
                            storageResult.org_id,
                            storageResult.token
                        );
                        if (token) {
                            chrome.storage.sync.set({ "token": token });
                            storageResult.token = token;
                        } 
                    }
                }
            } catch {}
            showLoginDisplays(storageResult);
        }
    } else {
        chrome.storage.sync.set({ "mode": "default" });
        showLoginDisplays(storageResult);
    }
}

function setAbsoluteButtonHandlers() {
    let settings = document.getElementById("settings");
    let back = document.getElementById("back");
    let refresh = document.getElementById("refresh");
    let close = document.getElementById("close");

    settings.onclick = () => {
        Utils.clearAllIntervals();
        UI.hideElement(currentElement);
        UI.hideElement("settings");
        UI.showElement("back", false);
        UI.showElement("display-settings", false);
        if (currentMode === "default") {
            document.getElementById("default-radio").checked = true;
        } else {
            document.getElementById("registered-radio").checked = true;
        }
    }

    back.onclick = () => {
        UI.showElement(currentElement);
        UI.hideElement("display-settings");
        UI.showElement("settings", false);
        UI.hideElement("back");
    }

    refresh.onclick = () => {
        UI.unHighlightRefreshButton();
        Utils.clearAllIntervals();
        UI.reloadExtension();
    }

    close.onclick = () => {
        window.close();
    }
}



function setSettingsButtonHandlers() {
    let settingsSubmitBtn = document.getElementById("settings-submit-btn");

    settingsSubmitBtn.onclick = (e) => {
        e.preventDefault();
        let select_mode = $("input[type='radio'][name='select_mode']:checked").val();
        if (select_mode) {
            chrome.storage.sync.set({
                "mode": select_mode,
            }, () => {
                UI.hideElement("display-settings");
                UI.hideElement(currentElement);
                chrome.storage.sync.get(["mode", "org_id", "corporate_email", "token", "qr_data"], showUI);
            })
        }
        let resetButtonChecked = $("#reset-extension").prop("checked");
        if (resetButtonChecked) {
            $("#reset-extension").prop("checked", false);
            chrome.storage.sync.set({
                "mode": null,
                "org_id": null,
                "corporate_email": null,
                "token": null,
                "qr_data": null,
            }, () => {
                UI.hideElement("display-settings");
                UI.hideElement(currentElement);
                chrome.storage.sync.get(["mode", "org_id", "corporate_email", "token", "qr_data"], showUI);
            });
            currentMode = "default";
        }
        UI.showElement(currentElement);
        UI.hideElement("display-settings");
        UI.showElement("settings", false);
        UI.hideElement("back");
        UI.reloadExtension();
    }
}

function generateRegistrationQrInExtension(qrData) {
    UI.showElement("display-register-qr");
    var qrDiv = document.getElementById("register-qrcode");
    var qrcode = new QRCode(qrDiv, {
        text: qrData,
        width: 240,
        height: 240,
        border: 1,
        colorDark: "#000000",
        colorLight: "#ffffff",
        correctLevel: QRCode.CorrectLevel.L
    });
    qrDiv.title = "";
}

async function getChallengeQrFromPureAUTH(corporate_email, org_id) {
    try {
        const manifest = chrome.runtime.getManifest();
        let version = "1.0.0"
        if (manifest){
            version = manifest["version"]
        }
        headersSet = {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'Organization-Id': org_id,
            'AFore-Version': version
        }

        let employee_id = await Utils.getEmployeeId(corporate_email, org_id);

        data = {
            "employee_id": employee_id
        }

        const result = await fetch(serverUrl + registerUrl, {
            headers: headersSet,
            method: "POST",
            body: JSON.stringify(data)
        })
        if (result.status >= 400) {
            try{
                const result_json = await result.json();
                UI.hideElement(currentElement);
                UI.showElementError(result_json["user_error"]);
                chrome.storage.sync.set({ "corporate_email": null, "org_id": null });
                return null;
            } catch {
                UI.hideElement(currentElement);
                UI.showElementError("Could not get your user public key. Incorrect corporate email or public key not uploaded.");
                chrome.storage.sync.set({ "corporate_email": null, "org_id": null });
                return null;
            }
        }
        const response = await result.json();
        console.log(response);
        Utils.countDown(response["data"]["qr_validity"]);
        chrome.storage.sync.set({ "corporate_email": corporate_email, "org_id": org_id });
        return response["data"]["qr_challenge"];
    } catch (e) {
        UI.hideElement(currentElement);
        UI.showElementError("Could not get your user public key. Incorrect corporate email or public key not uploaded.");
        chrome.storage.sync.set({ "corporate_email": null, "org_id": null });
        return null;
    }
}


async function verifyChallenge(corporate_email, org_id, challenge_code) {
    try {
        const manifest = chrome.runtime.getManifest();
        let version = "1.0.0"
        if (manifest){
            version = manifest["version"]
        }
        headersSet = {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'Organization-Id': org_id,
            'AFore-Version': version
        }

        let employee_id = await Utils.getEmployeeId(corporate_email, org_id);

        data = {
            "employee_id": employee_id,
            "challenge_code": challenge_code
        }

        const result = await fetch(serverUrl + verifyUrl, {
            headers: headersSet,
            method: "POST",
            body: JSON.stringify(data)
        })
        if (result.status >= 400) {
            try{
                const result_json = await result.json();
                UI.hideElement(currentElement);
                UI.showElementError(result_json["user_error"]);
                return null;
            } catch {
                UI.hideElement(currentElement);
                UI.showElementError("Something went wrong. Please close and open the extension.");
                return null;
            }
        }
        const response = await result.json();
        Utils.clearAllIntervals();
        return response["data"]["token"];
    } catch {
        UI.hideElement(currentElement);
        UI.showElementError("Something went wrong. Please close and open the extension.");
        return null;
    }
}

async function refreshToken(corporate_email, org_id, token) {
    try {
        const manifest = chrome.runtime.getManifest();
        let version = "1.0.0"
        if (manifest){
            version = manifest["version"]
        }
        headersSet = {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'Organization-Id': org_id,
            'AFore-Version': version
        }

        let employee_id = await Utils.getEmployeeId(corporate_email, org_id);

        data = {
            "employee_id": employee_id,
            "token": token
        }

        const result = await fetch(serverUrl + refreshTokenUrl, {
            headers: headersSet,
            method: "POST",
            body: JSON.stringify(data)
        })
        if (result.status >= 400) {
            try{
                return null;
            } catch {
                return null;
            }
        }
        const response = await result.json();
        return response["data"]["token"];
    } catch (e) {
        return null;
    }
}

function setRegisterFormButtonHandlers() {
    let registerFormSubmitBtn = document.getElementById("register-form-submit-btn");

    registerFormSubmitBtn.onclick = async (e) => {
        e.preventDefault();
        let orgIdElem = document.getElementById("org_id");
        let corporateEmailElem = document.getElementById("corporate_email");
        UI.hideElement(currentElement);
        UI.showElement("display-wait");
        let challenge = await getChallengeQrFromPureAUTH(corporateEmailElem.value.trim().toLowerCase(), orgIdElem.value.trim().toLowerCase());
        if (challenge) {
            UI.hideElement("display-wait");
            generateRegistrationQrInExtension(challenge);
        }
    }
}


function setChallengeFormButtonHandlers() {
    let challengeFormSubmitBtn = document.getElementById("challenge-form-submit-btn");

    challengeFormSubmitBtn.onclick = async (e) => {
        e.preventDefault();
        let challengeElem = document.getElementById("challenge_response");
        chrome.storage.sync.get(["org_id", "corporate_email", "token"], async (res) => {
            let token = await verifyChallenge(res.corporate_email, res.org_id, challengeElem.value);
            if (token) {
                chrome.storage.sync.set({ "token": token });
                UI.hideElement("display-wait");
                UI.showElementSuccess("Registration Complete! Please reopen the extension.");
                UI.highlightRefreshButton();
            }
        });
        UI.hideElement(currentElement);
        UI.showElement("display-wait");

    }
}

function setInitialModeSelectButtonHandlers() {
    let defaultModeBtn = document.getElementById("default-mode-btn");
    let registerModeBtn = document.getElementById("registered-mode-btn");

    defaultModeBtn.onclick = async (e) => {
        e.preventDefault();
        UI.hideElement(currentElement);
        chrome.storage.sync.set({ "mode": "default" });
        chrome.storage.sync.get(["mode", "org_id", "corporate_email", "token", "qr_data"], showUI);
    }

    registerModeBtn.onclick = async (e) => {
        e.preventDefault();
        UI.hideElement(currentElement);
        chrome.storage.sync.set({ "mode": "registered" });
        chrome.storage.sync.get(["mode", "org_id", "corporate_email", "token", "qr_data"], showUI);
    }
}

window.onload = () => {
    chrome.storage.sync.get(["mode", "org_id", "corporate_email", "token", "qr_data"], showUI);
    setAbsoluteButtonHandlers();
    setSettingsButtonHandlers();
    setRegisterFormButtonHandlers();
    setChallengeFormButtonHandlers();
    setInitialModeSelectButtonHandlers();
}



