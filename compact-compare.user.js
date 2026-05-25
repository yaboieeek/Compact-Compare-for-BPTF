// ==UserScript==
// @name         Compact Compare for bptf
// @namespace    eeek
// @version      1.3.0
// @description  Makes compares easier to view
// @author       eeek
// @match        https://backpack.tf/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=backpack.tf
// @updateURL    https://github.com/yaboieeek/Compact-Compare-for-BPTF/raw/main/compact-compare.user.js
// @downloadURL  https://github.com/yaboieeek/Compact-Compare-for-BPTF/raw/main/compact-compare.user.js
// @grant        GM_addStyle
// @connect backpack.tf
// ==/UserScript==


const START_MINIMIZED = true;

let scriptEnabled = true;
let toggleButton = null;


const SELECTORS = {
    COMPARE_BINS: '#inventory-cmp-bins',
    COMPARE_BIN: '.item-list',
}

const SAME_PROPERTIES = ['defindex', 'name', 'quality', 'spell_1', 'effect_name', 'spell_2', 'ks_tier', 'quality_elevated'] // array of properties that are required for items to match to consider those items similar

class ItemsController {
    constructor() {
        this.items = [];
        this.sameItems = new Map();
    }

    addItem(item) {
        this.items.push(item);
    }

    finalize() {
        this.items.forEach((item) => {
            const groupKey = this.getGroupKey(item);

            if (this.sameItems.has(groupKey)) {
                const existing = this.sameItems.get(groupKey);
                existing.amount++;
            } else {
                this.sameItems.set(groupKey, {
                    ...item,
                    amount: 1
                });
            }
        });
    }

    getGroupKey(item) {
        return `${SAME_PROPERTIES.reduce((acc, curr) => acc + (item[curr] || ''),'') || 'none'}`;
    }
}

class Item {
    constructor(e) {
        this.e = e;
        this.fromElement();
    }

    fromElement() {
        for (const [k, v] of Object.entries(this.e.dataset)) {
            this[k] = v;
        }

        this.$itemIcon = this.e.innerHTML;
    }
}

class BinController {
    constructor(e){
        this.e = e;
        this.title = this.e?.additionalTitle ?? null;
        this.itemsController = new ItemsController();
        this.fromElement();
    }

    fromElement() {
        const $items = [...this.e.querySelectorAll('li.item')];
        $items.forEach($item => {
            const item = new Item($item);
            this.itemsController.addItem(item)
        })

        this.itemsController.finalize()
    }
}

class BinUIController {
    constructor(binController) {
        this.binController = binController;
        this.$mainTile = this.binController.e;
        this.$additionalTile = document.createElement('ul');

        if (START_MINIMIZED) {
            this.hideMain();
        }
    }


    addCompactView() {
        if (this.$mainTile.previousElementSibling?.classList.contains('additional-tile')) {
            return;
        }
        for (const sameItem of this.binController.itemsController.sameItems) {
            this.addItemToCompactView(sameItem);
        }

        this.$additionalTile.className = 'additional-tile';
        this.$mainTile.before(this.$additionalTile);
        this.setupClickHandler();
        this.setupAdditionalTitle();
    }

    addItemToCompactView(sameItem) {
        const $item = document.createElement('li');

        $item.className = `item q-440-${sameItem[1].quality} q-440-border-${sameItem[1].quality_elevated || sameItem[1].quality} compact-item`;
        const $amount = document.createElement('span');
        $amount.className = 'compact-amount';
        $amount.innerText = sameItem[1].amount;

        const $addC = document.createElement('div');
        $addC.className = 'additional-tags';


        $item.innerHTML= sameItem[1].$itemIcon;
        $item.append($amount);
        $item.append($addC);

        if (sameItem[1].spell_1) {
            const $flaskIcon = document.createElement('i');
            $flaskIcon.className = 'fa fa-flask';
            $addC.append($flaskIcon);
        }
        if (sameItem[1].spell_2) {
            const $flaskIcon = document.createElement('i');
            $flaskIcon.className = 'fa fa-flask';
            $addC.append($flaskIcon);
        }

        this.$additionalTile.append($item);

        $item.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();

            if (e.ctrlKey) {
                window.open('https://backpack.tf/item/' + sameItem[1].original_id);
                return;
            }

                window.open(this.constructItemLink(sameItem[1]))
        })
    }

    constructItemLink(item) {
        let base = `https://backpack.tf/stats/BLANK/EMPTY/1/${item.craftable}/`
        if (item.effect_id) base+= item.effect_id + '/';

        if (item.quality_elevated) {
            base = base.replace('BLANK', (item.quality_elevated && item.quality === '5')? 'Strange Unusual' : item.quality)

        } else {
            base = base.replace('BLANK', item.quality)
        };

        const aussieName = item.australium ? 'Australium ' + item.name : item.name;
        switch(item.ks_tier) {
            case '1': base = base.replace('EMPTY', 'Killstreak ' + aussieName); break;
            case '2': base = base.replace('EMPTY', 'Specialized Killstreak ' + aussieName); break;
            case '3': base = base.replace('EMPTY', 'Professional Killstreak ' + aussieName); break;
            default: base = base.replace('EMPTY', aussieName); break;
        }


        return base
    }

    hideMain() {
        this.$mainTile.style.display = 'none';
    }

    showMain() {
        this.$mainTile.style.display = 'block';
    }

    toggleMain() {
        this.$mainTile.style.display === 'block' ? this.hideMain() : this.showMain();
    }

    setupClickHandler() {
        this.$additionalTile.addEventListener('click', () => {
            this.toggleMain();
        })
    }

    setupAdditionalTitle() {
        if (this.binController.title === null) return;

        const $title = document.createElement('h6');
        $title.innerText = this.binController.title + ':';
        this.$additionalTile.prepend($title)

    }

}

function observeModal(onAppear, onChange, onDisappear) {
    let modalElement = null;
    let contentObserver = null;

    const observer = new MutationObserver(() => {
        const newModal = document.getElementById('active-modal');

        if (newModal && !modalElement) {
            modalElement = newModal;
            onAppear?.(modalElement);

            contentObserver = new MutationObserver((mutations) => {
                const isOurChange = mutations.some(mutation => {

                    const isPopover = (node) => node.classList?.contains('popover') || node?.closest('[id^="popover"]') || mutation.target?.id.includes('popover');
                    const isAdditionalTile = (node) => mutation.target?.classList?.contains('additional-tile') || node.classList?.contains('additional-tile') || (node.classList?.contains('item') && node.closest('.additional-tile'));


                    if (isAdditionalTile(mutation.target)) {
                        return true;
                    }

                    if (mutation.addedNodes.length) {
                        return Array.from(mutation.addedNodes)
                            .some(node => isAdditionalTile(node) || isPopover(node));
                    }

                    if (mutation.removedNodes.length) {
                        return Array.from(mutation.removedNodes).some(isPopover)
                    }

                    return false;
                });

                if (!isOurChange) {
                    onChange?.(modalElement);
                }
            });

            contentObserver.observe(modalElement, {
                childList: true,
                subtree: true,
            });
        }
        else if (!newModal && modalElement) {
            contentObserver?.disconnect();
            contentObserver = null;
            modalElement = null;
            onDisappear?.();
        }
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });

    const existingModal = document.getElementById('active-modal');
    if (existingModal) {
        onAppear?.(existingModal);
        modalElement = existingModal;

        contentObserver = new MutationObserver(() => {
            onChange?.(modalElement);
        });

        contentObserver.observe(modalElement, {
            childList: true,
            subtree: true,
        });
        initControls();
        processExistingBins();
    }

    return () => {
        observer.disconnect();
        contentObserver?.disconnect();
    };
}

function processExistingBins() {
    if (!scriptEnabled) return;
    const binsParent = document.querySelector(SELECTORS.COMPARE_BINS);
    const $bins = [...binsParent.querySelectorAll(SELECTORS.COMPARE_BIN)];

    ['Removed', 'Changed'].forEach(header => {
        const $bin = [...binsParent.children].find(e => {
            const spanWithText = e.querySelector('span');
            if (!spanWithText) return;
            return spanWithText.innerText.toLowerCase().includes(header.toLowerCase());
        })

        if (!$bin) return;
        $bin.additionalTitle = header;
        $bins.push($bin)
    })


    for (const $bin of $bins) {
        const oldTile = $bin.previousElementSibling;
        if (oldTile?.classList.contains('additional-tile')) {
            oldTile.remove();
        }

        const binController = new BinController($bin);
        const binUI = new BinUIController(binController);

        binUI.addCompactView();
    }
}

function revertCompactView() {
    document.querySelectorAll('.additional-tile').forEach(tile => tile.remove());

    document.querySelectorAll(`.inventory-cmp-bin, ${SELECTORS.COMPARE_BIN}`).forEach(bin => {
            bin.style.display = '';
    });
}

function initControls() {
    const filtersPanel = document.querySelector('#inventory-cmp-filters');
    if (!filtersPanel) return;

    if (!document.querySelector('#toggle-compact-script')) {
        const btn = document.createElement('button');
        btn.id = 'toggle-compact-script';
        btn.textContent = scriptEnabled ? 'Disable Compact View' : 'Enable Compact View';
        btn.style.margin = '10px 0';
        btn.style.padding = '5px 10px';
        btn.style.width = '100%';

        btn.className = `btn btn-sm btn-${scriptEnabled ? 'danger' : 'success'}`;

        filtersPanel.appendChild(btn);
        toggleButton = btn;

        btn.addEventListener('click', () => {
            scriptEnabled = !scriptEnabled;
            toggleButton.textContent = scriptEnabled ? 'Disable Compact View' : 'Enable Compact View';
            btn.className = `btn btn-sm btn-${scriptEnabled ? 'danger' : 'success'}`;
            if (scriptEnabled) {
                clearOtherScriptInputs();
                processExistingBins();
            } else {
                revertCompactView();
            }
        });
    }

    function clearOtherScriptInputs() {
        const inputs = filtersPanel.querySelectorAll('input, select, textarea');
        inputs.forEach(input => {
            if (input.tagName === 'SELECT') input.selectedIndex = 0;
            else if (input.type === 'checkbox' || input.type === 'radio') input.checked = false;
            else input.value = '';
        });
    }

    const handleInputChange = () => {
        if (scriptEnabled) {
            scriptEnabled = false;
            if (toggleButton) toggleButton.textContent = 'Enable Compact View';
            toggleButton.className = `btn btn-sm btn-${scriptEnabled ? 'danger' : 'success'}`;
            revertCompactView();
        }
    };

    filtersPanel.removeEventListener('input', handleInputChange);
    filtersPanel.removeEventListener('change', handleInputChange);
    filtersPanel.addEventListener('input', handleInputChange);
    filtersPanel.addEventListener('change', handleInputChange);
}

const initTooltipUpdates = () => {

    function getCompareURL(steamid, date) {
        if (!steamid || !date) return null;

        const d = new Date(date.getTime());
        d.setUTCHours(0, 0, 0, 0);
        const timestamp = Math.round(d.getTime() / 1000);

        return `https://backpack.tf/profiles/${steamid}#!/compare/${timestamp}/${timestamp}/nearest`;
    }

    function extractCompareLinks(html) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        const historyTable = doc.querySelector('.history-sheet table.table');
        if (!historyTable) return null;

        const rows = historyTable.querySelectorAll('tbody > tr');
        if (rows.length < 2) return null;

        const headers = historyTable.querySelectorAll('thead tr th');
        const headerMap = {};
        headers.forEach((th, idx) => {
            headerMap[th.textContent.trim()] = idx;
        });

        if (!headerMap['Last seen'] || !headerMap['User']) return null;

        const getValueFromURL = (url, pattern) => {
            const match = (url || '').match(pattern);
            return match ? match[1] : null;
        };

        const rowData = [];

        for (let i = 0; i < Math.min(2, rows.length); i++) {
            const row = rows[i];
            const cells = row.querySelectorAll('td');

            const lastSeenLink = cells[headerMap['Last seen']]?.querySelector('a');
            if (!lastSeenLink) continue;

            const timestampStr = getValueFromURL(lastSeenLink.href, /time=(\d+)$/);
            if (!timestampStr) continue;

            const lastSeenDate = new Date(parseInt(timestampStr) * 1000);

            const userLink = cells[headerMap['User']]?.querySelector('.user-handle a');
            if (!userLink) continue;

            const steamId = userLink.getAttribute('data-id');
            if (!steamId) continue;

            rowData.push({ steamId, lastSeenDate });
        }

        if (rowData.length < 2) return null;

        const [prevRow, currentRow] = rowData;

        return {
            sellerCompare: getCompareURL(currentRow.steamId, currentRow.lastSeenDate),
            buyerCompare: getCompareURL(prevRow.steamId, currentRow.lastSeenDate)
        };
    }
    function fetchItemCompareLinks(itemid, callback) {
        if (!itemid) {
            console.error('itemid is required');
            if (typeof callback === 'function') callback(null);
            else callback.onError?.(new Error('itemid is required'));
            return;
        }

        GM_xmlhttpRequest({
            method: 'GET',
            url: `https://backpack.tf/item/${itemid}`,
            headers: {
                'User-Agent': 'skibidi toilet 228'
            },
            onload: (response) => {
                if (response.status === 200) {
                    try {
                        const links = extractCompareLinks(response.responseText);
                        if (typeof callback === 'function') {
                            callback(links);
                        } else {
                            callback.onSuccess?.(links);
                        }
                    } catch (e) {
                        console.error('Error parsing item page:', e);
                        if (typeof callback === 'function') callback(null);
                        else callback.onError?.(e);
                    }
                } else {
                    console.error(`HTTP ${response.status} fetching item ${itemid}`);
                    if (typeof callback === 'function') callback(null);
                    else callback.onError?.(new Error(`HTTP ${response.status}`));
                }
            },
            onerror: (err) => {
                console.error('Network error fetching item page:', err);
                if (typeof callback === 'function') callback(null);
                else callback.onError?.(err);
            }
        });
    }

    async function handleTooltip(node) {
        const c = node.querySelector('#popover-search-links');
        if (!c) return;

        const dds = [...node.querySelectorAll('dd.popover-btns')];
        if (dds.length === 0) return;

        const ourDD = document.createElement('dd');
        ourDD.className = 'popover-btns';
        dds[0].before(ourDD);

        if (c.querySelector('.compare-seller-button, .compare-buyer-button')) return;

        const types = ['seller', 'buyer'];
        const itemID = node.querySelector('#popover-additional-links a[href*="item/"]').href;
        const createTypeButton = (type) => {
            const button = document.createElement('a');
            button.className = `btn btn-default btn-xs compare-${type}-button`;
            button.target = '_blank';
            button.rel = 'noopener noreferrer';

            const arrowDir = type === 'buyer' ? 'left' : 'right';
            button.innerHTML = `<i class="fa fa-arrow-${arrowDir}"></i> Open ${type} compare`;

            const linkKey = `${type}Compare`;
            if (compareLinks?.[linkKey]) {
                button.href = compareLinks[linkKey];
                button.title = `Compare inventory at time of sale`;
            } else {
                button.href = '#';
                button.style.pointerEvents = 'none';
                button.style.opacity = '0.5';
                button.title = 'Compare link not available';
            }

            button.addEventListener('click', (e) => {
                if (!compareLinks?.[linkKey]) {
                    e.preventDefault();
                }
            });

            return button;
        };

        types.map(createTypeButton).forEach(btn => ourDD.appendChild(btn));
    }
}

const app = () => {

    initTooltipUpdates();
    if (window.location.href.includes('profiles') ||
        window.location.href.includes('id')
       ) {
        const stopObserving = observeModal(
            async (modal) => {
                initControls();
                processExistingBins();

            },
            async (modal) => {
                initControls();
                processExistingBins();

            },
            () => {
                console.log('Modal closed');
            }
        );
    }
}

app();

GM_addStyle(`
    .compact-item {
        position: relative;
    }

    .compact-item:hover .compact-amount {
        opacity: 0.1;
        background-color: #ff4444;
    }
    .compact-amount {
        position: absolute;
        top: 4px;
        left: 4px;
        padding: 1px 3px;
        color: #FFFFFF;
        background-color: cornflowerblue;
        border-radius: 4px;
        font-size: 14px;
        cursor: default;
        font-weight: bold;
    }

           .additional-tags {
            position: absolute;
            bottom: 0px;
            left: 4px;
            color: #FFFFFF;
            cursor: default;
            font-weight: bold;

            display: flex;
            flex-direction: column;
            gap: 0;
            z-index: 5;
        }

        .additional-tags i {
            background-color: lightgreen;
            padding: 3px 3px;
            border-radius: 4px;
            font-size: 10px;
            transform: translate(5px, -10px);
            z-index: 6
        }

        .additional-tags i:first-child {
            background-color: cornflowerblue;

            transform: translate(0, 10px);
            z-index: 7;
        }

    .additional-tags.double {

    }

`)


GM_addStyle(
    `
    .additional-tile {
        display: flex;
        flex-direction: row;
        flex-wrap: wrap;
        background: linear-gradient(-30deg in oklch, rgba(0, 0, 0, 0) 0%, rgba(43,60,72, .3) 100%);
        cursor: pointer;
        margin: 0;
        padding: 0;
    }

    .additional-tile h6 {
        width: 100%;
    }


    .inventory-cmp-group {
        border: 1px solid rgba(43,60,72, .15);
        border-radius: 5px;
        padding: 12px 0;
    }


`
)


