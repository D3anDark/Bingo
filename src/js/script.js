let currentBoardState = [];

function loadSavedState() {
    const savedItems = localStorage.getItem('bingoItems');
    const itemBlocks = document.getElementById('itemBlocks');
    
    if (savedItems) {
        const items = savedItems.split('\n');
        itemBlocks.innerHTML = '';
        items.forEach(item => addNewBlock(item));
    } else {
        // Dodaj jeden początkowy blok jeśli brak zapisanych danych
        addNewBlock();
    }

    // Wczytaj zapisaną planszę
    const savedBoard = localStorage.getItem('bingoBoard');
    if (savedBoard) {
        currentBoardState = JSON.parse(savedBoard);
        displayBoard(currentBoardState);
    }

    // Wczytaj zaznaczone pola
    const savedMarkedCells = localStorage.getItem('markedCells');
    if (savedMarkedCells) {
        const markedIndices = JSON.parse(savedMarkedCells);
        markedIndices.forEach(index => {
            const cell = document.querySelector(`.bingo-cell[data-index="${index}"]`);
            if (cell && index !== 12) cell.classList.add('marked'); // Ignoruj FREE
        });
    }
}

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

function generateBoard() {
    const inputs = document.getElementsByClassName('item-input');
    const items = Array.from(inputs)
        .map(input => input.value.trim())
        .filter(item => item !== '');

    if (items.length < 24) {
        alert('Wprowadź co najmniej 24 elementy!');
        return;
    }

    localStorage.setItem('bingoItems', items.join('\n'));
    
    // Generuj nowy układ planszy
    currentBoardState = shuffleArray([...items]).slice(0, 24);
    localStorage.setItem('bingoBoard', JSON.stringify(currentBoardState));
    
    // Wyczyść zaznaczone pola przy nowej generacji
    localStorage.removeItem('markedCells');
    
    displayBoard(currentBoardState);
}

function displayBoard(boardItems) {
    const board = document.getElementById('bingoBoard');
    board.innerHTML = '';

    // Generuj komórki
    boardItems.forEach((item, index) => {
        const cell = document.createElement('div');
        cell.className = 'bingo-cell';
        cell.textContent = item;
        cell.dataset.index = index < 12 ? index : index + 1; // Dostosowanie indeksów dla FREE
        cell.onclick = toggleMark;
        board.appendChild(cell);

        if (index === 11) {
            const freeCell = document.createElement('div');
            freeCell.className = 'bingo-cell marked';
            freeCell.textContent = 'FREE';
            freeCell.dataset.index = "12";
            board.appendChild(freeCell);
        }
    });
}

function toggleMark(event) {
    const cell = event.target;
    if (cell.dataset.index === "12") return; // Blokada zmiany stanu dla FREE
    cell.classList.toggle('marked');
    saveMarkedCells();
    updateMarkedCounter();
}

function saveMarkedCells() {
    const markedIndices = Array.from(document.querySelectorAll('.bingo-cell.marked:not([data-index="12"])'))
        .map(cell => cell.dataset.index);
    localStorage.setItem('markedCells', JSON.stringify(markedIndices));
}

function getExistingItems() {
    const inputs = document.getElementsByClassName('item-input');
    return Array.from(inputs)
        .map(input => input.value.trim().toLowerCase())
        .filter(item => item !== '');
}

function addNewBlock(value = '') {
    if (value && isDuplicate(value)) {
        alert(`Element "${value}" już istnieje na liście!`);
        return;
    }

    const itemBlocks = document.getElementById('itemBlocks');
    const newBlock = document.createElement('div');
    newBlock.className = 'item-block';
    newBlock.innerHTML = `
        <input type="text" class="item-input" placeholder="Wpisz element bingo" value="${value}" oninput="checkDuplicate(this)">
        <button class="remove-item" onclick="removeBlock(this)">×</button>
    `;
    itemBlocks.appendChild(newBlock);
}

function isDuplicate(value) {
    const existingItems = getExistingItems();
    return existingItems.includes(value.trim().toLowerCase());
}

function checkDuplicate(input) {
    const value = input.value.trim();
    if (value === '') return;

    const existingItems = getExistingItems();
    const currentIndex = Array.from(document.getElementsByClassName('item-input')).indexOf(input);
    const otherItems = existingItems.filter((_, index) => index !== currentIndex);

    if (otherItems.includes(value.toLowerCase())) {
        alert(`Element "${value}" już istnieje na liście!`);
        input.value = '';
    }
}

function removeBlock(button) {
    const block = button.parentElement;
    if (document.getElementsByClassName('item-block').length > 1) {
        block.remove();
    }
}

function showBulkInput() {
    document.getElementById('bulkInputContainer').style.display = 'block';
}

function hideBulkInput() {
    document.getElementById('bulkInputContainer').style.display = 'none';
    document.getElementById('bulkInput').value = '';
}

function addBulkItems() {
    const bulkText = document.getElementById('bulkInput').value;
    const items = bulkText.split('\n')
        .map(item => item.trim())
        .filter(item => item !== '');

    const duplicates = [];
    const uniqueItems = items.filter(item => {
        if (isDuplicate(item)) {
            duplicates.push(item);
            return false;
        }
        return true;
    });

    if (duplicates.length > 0) {
        alert(`Następujące elementy zostały pominięte, ponieważ już istnieją:\n${duplicates.join('\n')}`);
    }

    uniqueItems.forEach(item => addNewBlock(item));
    hideBulkInput();
}

function exportData() {
    try {
        const data = {
            items: getExistingItems(),
            board: currentBoardState,
            markedCells: Array.from(document.querySelectorAll('.bingo-cell.marked'))
                .map(cell => cell.dataset.index),
            exportDate: new Date().toISOString() // Add export timestamp
        };

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'bingo_data.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    } catch (error) {
        alert('Błąd podczas eksportowania danych.');
        console.error(error);
    }
}

function importData() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,.txt';
    
    input.onchange = e => {
        const file = e.target.files[0];
        const reader = new FileReader();
        
        reader.onload = event => {
            try {
                const data = JSON.parse(event.target.result);
                
                // Importuj elementy
                const itemBlocks = document.getElementById('itemBlocks');
                itemBlocks.innerHTML = '';
                data.items.forEach(item => addNewBlock(item));
                
                // Zapisz do localStorage
                localStorage.setItem('bingoItems', data.items.join('\n'));
                
                // Importuj planszę
                if (data.board && data.board.length > 0) {
                    currentBoardState = data.board;
                    localStorage.setItem('bingoBoard', JSON.stringify(data.board));
                    displayBoard(data.board);
                    
                    // Przywróć zaznaczone pola
                    if (data.markedCells) {
                        data.markedCells.forEach(index => {
                            const cell = document.querySelector(`.bingo-cell[data-index="${index}"]`);
                            if (cell) {
                                cell.classList.add('marked');
                            }
                        });
                        localStorage.setItem('markedCells', JSON.stringify(data.markedCells));
                    }
                }
                
                alert('Dane zostały zaimportowane pomyślnie!');
            } catch (error) {
                alert('Błąd podczas importowania danych. Upewnij się, że plik jest w prawidłowym formacie.');
                console.error(error);
            }
        };
        
        reader.readAsText(file);
    };
    
    input.click();
}

function updateMarkedCounter() {
    const markedCount = document.querySelectorAll('.bingo-cell.marked:not([data-index="12"])').length;
    document.getElementById('markedCounter').textContent = `Zaznaczone pola: ${markedCount}/24`;
}

function resetMarks() {
    // Usuń zaznaczenie ze wszystkich pól oprócz FREE
    const markedCells = document.querySelectorAll('.bingo-cell.marked:not([data-index="12"])');
    markedCells.forEach(cell => cell.classList.remove('marked'));
    
    // Wyczyść zapisane zaznaczenia w localStorage
    localStorage.removeItem('markedCells');
    
    // Zaktualizuj licznik zaznaczonych pól
    updateMarkedCounter();
}

function resetAll() {
    if (confirm('Czy na pewno chcesz zresetować wszystko? Ta operacja usunie wszystkie dane i wygenerowaną planszę.')) {
        // Wyczyść localStorage
        localStorage.removeItem('bingoItems');
        localStorage.removeItem('bingoBoard');
        localStorage.removeItem('markedCells');
        
        // Wyczyść planszę
        const board = document.getElementById('bingoBoard');
        board.innerHTML = '';
        
        // Zresetuj listę elementów do jednego pustego pola
        const itemBlocks = document.getElementById('itemBlocks');
        itemBlocks.innerHTML = `
            <div class="item-block">
                <input type="text" class="item-input" placeholder="Wpisz element bingo">
                <button class="remove-item" onclick="removeBlock(this)">×</button>
            </div>
        `;
        
        // Zresetuj licznik zaznaczonych pól
        updateMarkedCounter();
        
        // Wyczyść stan planszy
        currentBoardState = [];
    }
}

// Wywołaj loadSavedState przy załadowaniu strony
window.onload = loadSavedState;