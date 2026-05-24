// ==UserScript==
// @name         Compact Compare for bptf
// @namespace    eeek
// @version      1.0.0
// @description  Makes compares easier to view
// @author       You
// @match        https://backpack.tf/profiles/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=backpack.tf
// @updateURL    https://github.com/yaboieeek/Compact-Compare-for-BPTF/raw/main/compact-compare.user.js
// @downloadURL  https://github.com/yaboieeek/Compact-Compare-for-BPTF/raw/main/compact-compare.user.js
// @grant        GM_addStyle
// ==/UserScript==


const START_MINIMIZED = true;

const SELECTORS = {
    COMPARE_BINS: '#inventory-cmp-bins',
    COMPARE_BIN: '.item-list',
}

const SAME_PROPERTIES = ['defindex', 'name', 'quality', 'spell_1', 'effect_name'] // array of properties that are required for items to match to consider those items similar

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
        $amount.innerText = 'x' + sameItem[1].amount;

        $item.innerHTML = sameItem[1].$itemIcon;
        $item.append($amount);

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
                let isOurChange = false;

                for (const mutation of mutations) {
                    for (const node of mutation.addedNodes) {
                        if (node.classList?.contains('additional-tile') ||
                            node.classList?.contains('item') && node.closest('.additional-tile') ||
                            node.classList?.contains('popover')
                           ) {
                            isOurChange = true;
                            break;
                        }
                    }

                    for (const node of mutation.removedNodes) {
                        if (node.classList?.contains('popover')) {
                            isOurChange = true;
                            break;
                        }
                    }
                }

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
    }

    return () => {
        observer.disconnect();
        contentObserver?.disconnect();
    };
}

function processExistingBins() {
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

const app = () => {
    const stopObserving = observeModal(
        (modal) => {
            console.log('Modal is open', modal);
            processExistingBins();

        },
        (modal) => {
            console.log('Content changed', modal);
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

    .compact-amount {
        position: absolute;
        top: 0;
        right: 0;
        color: white;
        background: #33333355;
        font-size: 20px;
        font-weight: bold;
        border-radius: 3px;
        z-index: 5;
    }
`)


GM_addStyle(
    `
    .additional-tile {
        display: flex;
        flex-direction: row;
        flex-wrap: wrap;
        padding: 12px 24px;
        background: linear-gradient(-30deg in oklch, rgba(0, 0, 0, 0) 0%, rgba(43,60,72, .3) 100%);
        cursor: pointer;
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


