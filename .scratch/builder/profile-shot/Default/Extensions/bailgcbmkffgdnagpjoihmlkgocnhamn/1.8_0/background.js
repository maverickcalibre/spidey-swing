
// -------------------------------Update ICON--------------------------------------------------------

let tabData = {}
let currentTabId = 0;

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
	currentTabId = tab.id;
	if (changeInfo.status === 'complete' && tab.url) {
		if (urlIsPureAUTH(tab.url)) {
			if (!tabData[currentTabId]) tabData[currentTabId] = null;
			chrome.storage.sync.set({ "qr_data": tabData[currentTabId] });
		}
		// updateIcon(tabId, tab.url);
	}
});
  
chrome.tabs.onActivated.addListener(activeInfo => {
	chrome.tabs.get(activeInfo.tabId, tab => {
		currentTabId = tab.id;
		if (tab.url) {
			if (urlIsPureAUTH(tab.url)) {
				if (!tabData[currentTabId]) tabData[currentTabId] = null;
				chrome.storage.sync.set({ "qr_data": tabData[currentTabId] });
			}
			// updateIcon(tab.id, tab.url);
		}
	});
});

chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
	console.log(`Tab ${tabId} closed`);
	delete tabData[tabId];
});


function urlIsPureAUTH(url) {
	const targetDomain1 = "https://live.pureauth.io"; 
	const targetDomain2 = "https://dev.pureauth.tech"; 
	let res1 = url.includes(targetDomain1)
	let res2 = url.includes(targetDomain2)
	return res1 | res2
}

function getServerUrl(url) {
	const targetDomain1 = "https://live.pureauth.io"; 
	const targetDomain2 = "https://dev.pureauth.tech"; 
	let res2 = url.includes(targetDomain2)
	if (res2) return targetDomain2
	return targetDomain1;
}


// function updateIcon(tabId, url) {

// 	const iconPath = urlIsPureAUTH(url)
// 		? {
// 			16: "icons/logo16_green.png",
// 			32: "icons/logo32_green.png",
// 			48: "icons/logo48_green.png",
// 			128: "icons/logo128_green.png"
// 		}
// 		: {
// 			16: "icons/logo16.png",
// 			32: "icons/logo32.png",
// 			48: "icons/logo48.png",
// 			128: "icons/logo128.png"
// 		};

// 	chrome.action.setIcon({ path: iconPath });
// }


// ----------------------------------------------Store QR Data--------------------------------------------

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
	if (message.type === "qr_data") {
		tabData[currentTabId] = message.data;
		chrome.storage.sync.set({ "qr_data": message.data });
	}
});



