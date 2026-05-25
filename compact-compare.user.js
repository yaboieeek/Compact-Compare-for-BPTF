// ==UserScript==
// @name         Compact Compare for bptf
// @namespace    eeek
// @version      1.2.0
// @description  Makes compares easier to view
// @author       eeek
// @match        https://backpack.tf/profiles/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=backpack.tf
// @updateURL    https://github.com/yaboieeek/Compact-Compare-for-BPTF/raw/main/compact-compare.user.js
// @downloadURL  https://github.com/yaboieeek/Compact-Compare-for-BPTF/raw/main/compact-compare.user.js
// @grant        GM_addStyle
// ==/UserScript==


const START_MINIMIZED = true;

let scriptEnabled = true;
let toggleButton = null;


const SELECTORS = {
    COMPARE_BINS: '#inventory-cmp-bins',
    COMPARE_BIN: '.item-list',
}

const SAME_PROPERTIES = ['defindex', 'name', 'quality', 'spell_1', 'effect_name', 'spell_2', 'ks_tier'] // array of properties that are required for items to match to consider those items similar

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

            console.log(groupKey)
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
            console.log('---------------MINIMIZING A TILE-------------')
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

        $item.className = `item q-440-${sameItem[1].quality} q-440-border-${sameItem[1].quality} compact-item`;
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

                    const isPopover = (node) => node.classList?.contains('popover') || node.closest('[id^="popover"]') || mutation.target?.id.includes('popover');
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
                    console.log(mutations)
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

    console.log($bins)

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

    document.querySelectorAll(SELECTORS.COMPARE_BIN).forEach(bin => {
        if (bin.style.display === 'none') {
            bin.style.display = '';
        }
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
const app = () => {
    const stopObserving = observeModal(
        async (modal) => {
            console.log('Modal is open', modal);
            initControls();
            processExistingBins();

        },
        async (modal) => {
            console.log('Content changed', modal);
            initControls();
            processExistingBins();

        },
        () => {
            console.log('Modal closed');
        }
    );
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


