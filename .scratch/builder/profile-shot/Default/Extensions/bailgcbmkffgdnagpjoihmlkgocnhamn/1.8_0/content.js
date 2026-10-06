// ------------------------------------------Send Data to popup----------------------------------------------------

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitForQrToLoad() {
    try {
        var qr_data = document.getElementById("swift-qr-img");
        while (qr_data.getAttribute("src") == null) {
            await sleep(500);
        }
    } catch { }
}

function getQrData() {
    try {
        const qrDataElem = document.getElementById("qr-data-txt");
        return qrDataElem.value;
    } catch {
    }
    return null;
}

async function sendQrData() {
    await waitForQrToLoad();
    let qrData = getQrData();
    const response = await chrome.runtime.sendMessage({ type: "qr_data", data: qrData });
}

sendQrData();